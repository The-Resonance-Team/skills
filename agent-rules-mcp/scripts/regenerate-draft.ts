import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Run this script from a trusted main checkout with dependencies installed, with
 * DRAFT_DIR pointing at the draft worktree. PR scripts are never executed; the
 * trusted builder and its dependencies read draft files only as data.
 */
const draft = process.env.DRAFT_DIR;
if (draft === undefined || draft.length === 0) {
  throw new Error('Set DRAFT_DIR to the draft worktree root.');
}
const draftRoot = path.resolve(draft);
const trustedBuilder = path.join(import.meta.dir, 'build-catalog.ts');
const model = '@cf/google/embeddinggemma-2';
const dimensions = 256;

function trustedBuild(args: string[], extraEnv: Record<string, string> = {}): void {
  const result = spawnSync('bun', [trustedBuilder, ...args], {
    env: { ...process.env, SKILLS_ROOT: draftRoot, ...extraEnv },
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error('Trusted catalog build failed');
}

trustedBuild(['--emit-inputs']);
const pendingPath = path.join(draftRoot, 'agent-rules-mcp', 'generated', 'pending.json');
const pending = JSON.parse(readFileSync(pendingPath, 'utf8')) as Array<{
  digest: string;
  input: string;
}>;
const vectors: Record<string, string> = {};
if (pending.length > 0) {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !token) {
    throw new Error('Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in the trusted shell.');
  }
  const entries = await Promise.all(
    pending.map(async (item) => {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/ai/run/${model}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: [item.input],
            dimensions,
            encoding_format: 'base64',
          }),
        },
      );
      const body = (await response.json()) as {
        success?: boolean;
        result?: { data?: Array<{ embedding?: string }> };
      };
      const embedding = body.result?.data?.[0]?.embedding;
      if (!response.ok || body.success === false || embedding === undefined) {
        throw new Error(`Workers AI did not return a vector for ${item.digest}`);
      }
      return [item.digest, embedding] as const;
    }),
  );
  Object.assign(vectors, Object.fromEntries(entries));
}
const externalPath = path.join(draftRoot, 'agent-rules-mcp', 'generated', '.draft-embeddings.json');
writeFileSync(externalPath, `${JSON.stringify(vectors, null, 2)}\n`);
trustedBuild([], { AGENT_RULES_EMBEDDINGS_FILE: externalPath });
console.error(
  [
    `Generated ${pending.length} genuine vector(s) and refreshed the draft catalog.`,
    'Commit generated/catalog.json and generated/embeddings.json on the draft branch.',
    'Then mark the PR ready so CI runs build:check and eval:check without credentials.',
  ].join('\n'),
);
