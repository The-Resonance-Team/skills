import data from '../generated/catalog.json';

import type { Catalog, CatalogEntry, Match, Metadata } from './types';

export const catalog = data as unknown as Catalog;
export const maxMatches = 5;
export const maxContentBytes = 51200;

const byId = new Map(catalog.entries.map((entry) => [entry.id, entry]));
const vectors = new Map<string, Float32Array>();

function decode(base64: string): Float32Array {
  const cached = vectors.get(base64);
  if (cached !== undefined) return cached;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const decoded = new Float32Array(bytes.buffer);
  vectors.set(base64, decoded);
  return decoded;
}

function cosine(left: Float32Array, right: Float32Array): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function rank(vector: Float32Array, limit: number): Match[] {
  return catalog.entries
    .map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      scope: entry.scope,
      score: cosine(vector, decode(entry.vector)),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.min(limit, maxMatches));
}

export async function searchAi(query: string, ai: Ai, limit = maxMatches): Promise<Match[]> {
  const response = await ai.run(catalog.model, {
    input: [`task: search result | query: ${query}`],
    dimensions: catalog.dimensions,
    encoding_format: 'base64',
  });
  const embedding = (response as { data?: Array<{ embedding?: string }> }).data?.[0]?.embedding;
  if (embedding === undefined) return [];
  return rank(decode(embedding), limit);
}

export function related(id: string): string[] {
  const entry = byId.get(id);
  if (entry === undefined) return [];
  return rank(decode(entry.vector), maxMatches)
    .filter((match) => match.id !== id)
    .map((match) => match.id);
}

function metadata(entry: CatalogEntry): Metadata {
  return {
    id: entry.id,
    kind: entry.kind,
    path: entry.path,
    scope: entry.scope,
    related: related(entry.id),
    references: entry.references,
  };
}

export function getMetadata(id?: string): Metadata | Metadata[] {
  if (id === undefined) return catalog.entries.map(metadata);
  const entry = byId.get(id);
  if (entry === undefined) throw new Error(`Unknown rule ID: ${id}`);
  return metadata(entry);
}

export function getContent(id: string): {
  id: string;
  path: string;
  content: string;
  truncated: boolean;
} {
  const entry = byId.get(id);
  if (entry === undefined) throw new Error(`Unknown rule ID: ${id}`);
  const bytes = new TextEncoder().encode(entry.content);
  if (bytes.byteLength <= maxContentBytes) {
    return { id: entry.id, path: entry.path, content: entry.content, truncated: false };
  }
  return {
    id: entry.id,
    path: entry.path,
    content: new TextDecoder().decode(bytes.slice(0, maxContentBytes)),
    truncated: true,
  };
}
