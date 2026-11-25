import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { Catalog, CatalogEntry, EntryKind } from '../src/types';

const project = path.resolve(import.meta.dir, '..');
const root = path.resolve(project, '..');
const generated = path.join(project, 'generated');
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

function stableId(kind: EntryKind, name: string): string {
  return kind === 'workflow' ? `wf-${name}` : name;
}

function parseRouter(): Draft[] {
  const router = read('CONTEXT.md');
  const drafts: Draft[] = [];
  const patterns: Array<{ kind: EntryKind; re: RegExp }> = [
    { kind: 'rule', re: /^\|\s*`rules\/([^`]+)\.md`\s*\|\s*([^|]+)\|/gm },
    { kind: 'workflow', re: /^\|\s*`workflows\/([^`]+)\.md`\s*\|\s*([^|]+)\|/gm },
  ];
  for (const { kind, re } of patterns) {
    for (const match of router.matchAll(re)) {
      const name = match[1];
      const filePath = `${kind === 'rule' ? 'rules' : 'workflows'}/${name}.md`;
      const content = read(filePath);
      const title = content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? name;
      const paragraph = firstParagraph(kind, content);
      const headings = ruleHeadings(kind, content);
      const detail = `${paragraph} ${headings}`.slice(0, 1400);
      const scope = match[2].trim();
      const id = stableId(kind, name);
      drafts.push({
        id,
        kind,
        path: filePath,
        title,
        scope,
        retrievalText: `${title}. Scope: ${scope}. ${detail}`,
        embeddingInput: `title: ${title} | text: ${scope} ${detail}`,
        digest: '',
        references: [],
        content,
      });
    }
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
  const drafts = parseRouter();
  addDigests(drafts);
  addReferences(drafts);
  const embeddings = loadEmbeddings();
  const external = process.env.RULES_EMBEDDINGS_FILE;
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
  const sources = ['CONTEXT.md', ...drafts.map((draft) => draft.path).sort()];
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
