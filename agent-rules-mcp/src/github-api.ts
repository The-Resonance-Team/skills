import { z } from 'zod';

export type GitHubEnv = { GITHUB_TOKEN: string; GITHUB_OWNER: string; GITHUB_REPO: string };

export class GitHubError extends Error {
  constructor(public status: number) {
    super(`GitHub request failed (HTTP ${status})`);
  }
}

export async function github(
  env: GitHubEnv,
  path: string,
  method = 'GET',
  body?: object,
): Promise<unknown> {
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPO)}${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2026-03-10',
        'User-Agent': 'agent-rules-mcp',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok) {
    await response.body?.cancel();
    throw new GitHubError(response.status);
  }
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > 2_000_000) {
    await response.body?.cancel();
    throw new Error('GitHub response exceeds the submission budget');
  }
  return response.json();
}

export async function sourceAt(env: GitHubEnv, path: string, ref: string): Promise<string> {
  const data = z
    .object({
      type: z.literal('file'),
      encoding: z.literal('base64'),
      content: z.string().max(400000),
    })
    .parse(
      await github(
        env,
        `/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`,
      ),
    );
  return new TextDecoder().decode(
    Uint8Array.from(atob(data.content.replace(/\s/g, '')), (character) => character.charCodeAt(0)),
  );
}
