import data from '../generated/catalog.json';

import type { Catalog, CatalogEntry, Match, Metadata } from './types';

export const catalog = data as unknown as Catalog;
export const maxMatches = 5;
export const maxContentBytes = 51200;

const byId = new Map(catalog.entries.map((entry) => [entry.id, entry]));
const vectors = new Map<string, Float32Array>();
const stopWords = new Set(
  'a an the with and or in on to for from of at by is as that this add build create run set up into using'.split(
    ' ',
  ),
);

function terms(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (word) => word.length > 1 && !stopWords.has(word),
  );
}

const documents = catalog.entries.map((entry) => {
  const words = terms(`${entry.title} ${entry.scope} ${entry.content}`);
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  return { id: entry.id, counts, length: words.length };
});
const averageLength =
  documents.reduce((sum, document) => sum + document.length, 0) / documents.length;
const frequencies = new Map<string, number>();
for (const document of documents) {
  for (const word of document.counts.keys()) {
    frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
  }
}

function lexicalScores(query: string): Map<string, number> {
  const words = [...new Set(terms(query))];
  return new Map(
    documents.map((document) => {
      const score = words.reduce((sum, word) => {
        const count = document.counts.get(word) ?? 0;
        if (count === 0) return sum;
        const frequency = frequencies.get(word) ?? 0;
        const inverse = Math.log(1 + (documents.length - frequency + 0.5) / (frequency + 0.5));
        return (
          sum +
          (inverse * count * 2.2) /
            (count + 1.2 * (0.25 + (0.75 * document.length) / averageLength))
        );
      }, 0);
      return [document.id, score];
    }),
  );
}

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
    .slice(0, limit);
}

function searchRank(query: string, vector: Float32Array, limit: number): Match[] {
  const candidates = rank(vector, catalog.entries.length);
  const lexical = lexicalScores(query);
  // Lexical evidence selects a topic inside the semantic shortlist; it cannot invent a topic.
  const anchor = candidates
    .slice(0, maxMatches)
    .reduce((best, candidate) =>
      (lexical.get(candidate.id) ?? 0) > (lexical.get(best.id) ?? 0) ? candidate : best,
    );
  const anchorEntry = byId.get(anchor.id)!;
  const selected: Match[] = [];
  const count = Math.max(0, Math.min(Math.floor(limit), maxMatches));
  while (selected.length < count) {
    const remaining = candidates.filter(
      (candidate) => !selected.some((item) => item.id === candidate.id),
    );
    const ranked = remaining
      .map((candidate) => {
        const entry = byId.get(candidate.id)!;
        const connected =
          candidate.id === anchor.id ||
          anchorEntry.references.includes(candidate.id) ||
          entry.references.includes(anchor.id);
        const redundancy = Math.max(
          0,
          ...selected.map((item) =>
            cosine(decode(entry.vector), decode(byId.get(item.id)!.vector)),
          ),
        );
        // A small citation boost includes co-read rules; MMR avoids near-duplicate results.
        return {
          candidate,
          relevance: candidate.score + (connected ? 0.05 : 0) - 0.1 * redundancy,
        };
      })
      .sort((left, right) => right.relevance - left.relevance);
    if (ranked[0] === undefined) break;
    selected.push(ranked[0].candidate);
  }
  // Keep score as cosine similarity; ordering also accounts for citations and diversity.
  return selected;
}

export async function searchAi(query: string, ai: Ai, limit = maxMatches): Promise<Match[]> {
  const response = await ai.run(catalog.model, {
    input: [`task: search result | query: ${query}`],
    dimensions: catalog.dimensions,
    encoding_format: 'base64',
  });
  const embedding = (response as { data?: Array<{ embedding?: string }> }).data?.[0]?.embedding;
  if (embedding === undefined) return [];
  return searchRank(query, decode(embedding), limit);
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
