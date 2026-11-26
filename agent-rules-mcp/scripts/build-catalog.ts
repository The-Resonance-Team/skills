import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

import { checkMetadataSize } from './check-metadata-size';
import { checkRuleReferences } from './check-references';
import { parseRules, parseWorkflow } from './parse-content';

import type { Catalog, CatalogEntry, EntryKind } from '../src/types';

const project = path.resolve(import.meta.dir, '..');
// A trusted builder on `main` can target a draft worktree without executing PR scripts.
const root = process.env.SKILLS_ROOT
  ? path.resolve(process.env.SKILLS_ROOT)
  : path.resolve(project, '..');
const generated = process.env.SKILLS_ROOT
  ? path.join(root, 'agent-rules-mcp', 'generated')
  : path.join(project, 'generated');
const model = '@cf/google/embeddinggemma-2';
const dimensions = 256;
const check = process.argv.includes('--check');

type Draft = Omit<CatalogEntry, 'vector' | 'content'> & {
  embeddingInput: string;
  content: string;
};

function read(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8');
}

const metadataSchema = z.object({
  id: z
    .string()
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  kind: z.enum(['rule', 'workflow']),
  description: z.string().min(1),
  scope: z.string().min(1),
  priority: z.enum(['mandatory', 'recommended']),
});

function parseSources(): Draft[] {
  const drafts: Draft[] = [];
  const directories: Array<{ kind: EntryKind; directory: string }> = [
    { kind: 'rule', directory: 'rules' },
    { kind: 'workflow', directory: 'workflows' },
  ];
  for (const { kind, directory } of directories) {
    const files = readdirSync(path.join(root, directory)).filter((file) => file.endsWith('.md'));
    for (const name of files.sort()) {
      const filePath = `${directory}/${name}`;
      const content = read(filePath);
      const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
      if (frontmatter === null) throw new Error(`${filePath}: missing catalog metadata`);
      let yaml: unknown;
      try {
        yaml = Bun.YAML.parse(frontmatter[1]);
      } catch (error) {
        throw new Error(`${filePath}: invalid catalog metadata YAML`, { cause: error });
      }
      const parsed = metadataSchema.safeParse(yaml);
      if (!parsed.success) {
        const fields = parsed.error.issues.map((issue) => issue.path.join('.') || 'metadata');
        throw new Error(`${filePath}: invalid catalog metadata: ${fields.join(', ')}`);
      }
      if (parsed.data.kind !== kind) throw new Error(`${filePath}: incorrect catalog kind`);
      const metadata = parsed.data;
      const body = content.slice(frontmatter[0].length);
      const retrievalBody = body.replace(/^<!-- rule: [a-z0-9-]+ -->\r?\n/gm, '');
      const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? metadata.name;
      const paragraph =
        kind === 'workflow'
          ? metadata.description
          : firstParagraph(kind, retrievalBody.trimStart());
      const headings = ruleHeadings(kind, retrievalBody);
      const detail = `${paragraph} ${headings}`.slice(0, 1400);
      const scope = metadata.scope;
      drafts.push({
        id: metadata.id,
        kind,
        path: filePath,
        title,
        name: metadata.name,
        description: metadata.description,
        scope,
        priority: metadata.priority,
        rules: kind === 'rule' ? parseRules(filePath, metadata.id, body) : [],
        steps: kind === 'workflow' ? parseWorkflow(filePath, body) : [],
        retrievalText: `${title}. Scope: ${scope}. ${detail}`,
        embeddingInput: `title: ${title} | text: ${scope} ${detail}`,
        digest: '',
        references: [],
        content,
      });
    }
  }
  if (drafts.length === 0) throw new Error('No rule or workflow source files found');
  if (new Set(drafts.map((draft) => draft.id)).size !== drafts.length) {
    throw new Error('Duplicate catalog IDs');
  }
  return drafts;
}

function firstParagraph(kind: EntryKind, content: string): string {
  if (kind === 'workflow') {
    const frontmatter = content.split(/^---$/m)[1] ?? '';
    const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? '';
    return description;
  }
  const lines = content.split('\n');
  const start = Math.min(3, lines.length - 1);
  const parts: string[] = [];
  for (let index = start; index < lines.length && parts.length < 3; index += 1) {
    const line = lines[index].trim();
    if (line.length === 0 || line.startsWith('#') || line.startsWith('>')) {
      if (parts.length > 0) break;
      continue;
    }
    parts.push(line);
  }
  return parts.join(' ').slice(0, 600);
}

function ruleHeadings(kind: EntryKind, content: string): string {
  if (kind !== 'rule') return '';
  return [...content.matchAll(/^\d+\.\s+\*\*(.+?)\*\*/gm)]
    .map((match) => match[1].replace(/`/g, ''))
    .join('; ')
    .slice(0, 900);
}

function addDigests(drafts: Draft[]): void {
  for (const draft of drafts) {
    draft.digest = createHash('sha256').update(draft.embeddingInput).digest('hex');
  }
}

function addReferences(drafts: Draft[]): void {
  const byPath = new Map(drafts.map((draft) => [draft.path, draft.id]));
  for (const draft of drafts) {
    const seen = new Set<string>();
    for (const match of draft.content.matchAll(/(rules|workflows)\/([a-z0-9-]+)\.md/g)) {
      const targetPath = `${match[1]}/${match[2]}.md`;
      const target = byPath.get(targetPath);
      if (target === undefined) {
        throw new Error(`Broken reference: ${draft.path} -> ${targetPath}`);
      }
      if (target !== draft.id) seen.add(target);
    }
    draft.references = [...seen].sort();
    for (const rule of draft.rules) {
      const references = new Set<string>();
      for (const match of rule.content.matchAll(/(rules|workflows)\/([a-z0-9-]+)\.md/g)) {
        const target = byPath.get(`${match[1]}/${match[2]}.md`);
        if (target !== undefined && target !== draft.id) references.add(target);
      }
      rule.references = [...references].sort();
    }
  }
}

type EmbeddingStore = {
  model: string;
  dimensions: number;
  vectors: Record<string, string>;
};

function loadEmbeddings(): EmbeddingStore {
  const file = path.join(generated, 'embeddings.json');
  try {
    const store = JSON.parse(readFileSync(file, 'utf8')) as EmbeddingStore;
    if (store.model !== model || store.dimensions !== dimensions) {
      throw new Error('Embedding model or dimensions changed; rebuild the store.');
    }
    return store;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { model, dimensions, vectors: {} };
    }
    throw error;
  }
}

async function embed(inputs: string[]): Promise<string[]> {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (account === undefined || token === undefined || account.length === 0 || token.length === 0) {
    throw new Error('Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN to build embeddings.');
  }
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: inputs, dimensions, encoding_format: 'base64' }),
    },
  );
  const body = (await response.json()) as {
    success?: boolean;
    errors?: Array<{ message: string }>;
    result?: { data?: Array<{ embedding: string }> };
  };
  if (!response.ok || body.success === false || body.result?.data === undefined) {
    const detail = body.errors?.map((item) => item.message).join('; ') ?? response.statusText;
    throw new Error(`Workers AI embedding request failed: ${detail}`);
  }
  return body.result.data.map((item) => item.embedding);
}

async function build(): Promise<{ catalog: Catalog; embeddings: EmbeddingStore }> {
  const drafts = parseSources();
  addDigests(drafts);
  addReferences(drafts);
  checkRuleReferences(drafts);
  checkMetadataSize(drafts);
  const embeddings = loadEmbeddings();
  const external = process.env.AGENT_RULES_EMBEDDINGS_FILE;
  if (external !== undefined && external.length > 0) {
    const supplied = JSON.parse(readFileSync(external, 'utf8')) as Record<string, string>;
    for (const [digest, vector] of Object.entries(supplied)) embeddings.vectors[digest] = vector;
  }
  const missing = [...new Set(drafts.map((draft) => draft.embeddingInput))].filter(
    (input) => embeddings.vectors[createHash('sha256').update(input).digest('hex')] === undefined,
  );
  if (process.argv.includes('--emit-inputs')) {
    writeFileSync(
      path.join(generated, 'pending.json'),
      `${JSON.stringify(
        missing.map((input) => ({
          digest: createHash('sha256').update(input).digest('hex'),
          input,
        })),
        null,
        2,
      )}\n`,
    );
    console.error(`Wrote ${missing.length} pending embedding inputs.`);
    process.exit(0);
  }
  if (missing.length > 0) {
    if (check) throw new Error(`Missing embeddings for ${missing.length} catalog entries.`);
    const vectors = await embed(missing);
    for (const [index, input] of missing.entries()) {
      const digest = createHash('sha256').update(input).digest('hex');
      embeddings.vectors[digest] = vectors[index];
    }
  }
  const entries: CatalogEntry[] = drafts.map(({ embeddingInput: _input, ...draft }) => ({
    ...draft,
    vector: embeddings.vectors[draft.digest],
  }));
  const sources = drafts.map((draft) => draft.path).sort();
  const sourceDigest = createHash('sha256')
    .update(sources.map((source) => `${source}\0${read(source)}`).join('\n'))
    .digest('hex');
  return {
    catalog: { sourceDigest, model, dimensions, entries },
    embeddings,
  };
}

const { catalog, embeddings } = await build();
const catalogFile = path.join(generated, 'catalog.json');
const embeddingsFile = path.join(generated, 'embeddings.json');
const catalogText = `${JSON.stringify(catalog, null, 2)}\n`;
const embeddingsText = `${JSON.stringify(embeddings, null, 2)}\n`;
if (check) {
  for (const [file, text] of [
    [catalogFile, catalogText],
    [embeddingsFile, embeddingsText],
  ] as const) {
    const current = readFileSync(file, 'utf8');
    if (current !== text) throw new Error(`${path.basename(file)} is stale; run bun run build.`);
  }
  console.error('Catalog and embeddings are current.');
} else {
  writeFileSync(catalogFile, catalogText);
  writeFileSync(embeddingsFile, embeddingsText);
  console.error(
    `Built ${catalog.entries.length} entries from digest ${catalog.sourceDigest.slice(0, 12)}.`,
  );
}
