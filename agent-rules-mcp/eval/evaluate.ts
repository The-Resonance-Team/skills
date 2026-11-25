import { catalog } from '../src/search';
import { cases } from './cases';
import type { UseCase } from './cases';

export type Lookup = { ids: string[]; bytes: number; wallMs: number };

function lexical(query: string): string[] {
  const words = query.toLowerCase().match(/[a-z0-9@-]{3,}/g) ?? [];
  return catalog.entries
    .map((entry) => ({
      id: entry.id,
      score: words.filter((word) => entry.retrievalText.toLowerCase().includes(word)).length,
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map((entry) => entry.id);
}

export async function evaluate(
  search: (query: string) => Promise<Lookup>,
  useCases: UseCase[] = cases,
) {
  if (useCases.length === 0) throw new Error('Evaluation requires at least one case');
  const rows = [];
  for (const item of useCases) {
    if (item.expected.length === 0) throw new Error(`No required IDs: ${item.query}`);
    const result = await search(item.query);
    const baseline = lexical(item.query);
    rows.push({
      query: item.query,
      expected: item.expected,
      semanticTop5: result.ids,
      lexicalTop5: baseline,
      semanticHits: item.expected.filter((id) => result.ids.includes(id)).length,
      lexicalHits: item.expected.filter((id) => baseline.includes(id)).length,
      missing: item.expected.filter((id) => !result.ids.includes(id)),
      responseBytes: result.bytes,
      approxTokens: Math.round(result.bytes / 4),
      wallMs: Math.round(result.wallMs * 100) / 100,
    });
  }
  const total = rows.reduce(
    (sum, row) => ({
      semanticHits: sum.semanticHits + row.semanticHits,
      lexicalHits: sum.lexicalHits + row.lexicalHits,
      expected: sum.expected + row.expected.length,
      bytes: sum.bytes + row.responseBytes,
      wallMs: sum.wallMs + row.wallMs,
    }),
    { semanticHits: 0, lexicalHits: 0, expected: 0, bytes: 0, wallMs: 0 },
  );
  return {
    cases: rows.length,
    requiredIds: total.expected,
    semanticHits: total.semanticHits,
    semanticRecall: total.semanticHits / total.expected,
    lexicalRecall: total.lexicalHits / total.expected,
    meanResponseBytes: Math.round(total.bytes / rows.length),
    meanWallMs: Math.round((total.wallMs / rows.length) * 100) / 100,
    rows,
  };
}

export function assertRecall(report: Awaited<ReturnType<typeof evaluate>>): void {
  const failures = report.rows.filter((row) => row.missing.length > 0);
  if (failures.length > 0) {
    throw new Error(
      `Required recall failed: ${failures.map((row) => `${row.query}: ${row.missing.join(', ')}`).join('; ')}`,
    );
  }
  if (report.rows.some((row) => row.semanticTop5.length > 5)) {
    throw new Error('Search returned more than five IDs');
  }
}
