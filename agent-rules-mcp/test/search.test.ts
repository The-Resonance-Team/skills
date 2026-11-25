import { describe, expect, test } from 'bun:test';

import {
  cachedVectorCount,
  catalog,
  getContent,
  getMetadata,
  lexicalSearch,
  related,
  searchAi,
} from '../src/search';

function aiReturning(embedding: string): Ai {
  return {
    run: async () => ({ data: [{ embedding }] }),
  } as unknown as Ai;
}

describe('rule lookup', () => {
  test('lists metadata and fetches one descriptor', () => {
    const all = getMetadata();
    expect(Array.isArray(all)).toBe(true);
    if (!Array.isArray(all)) return;
    expect(all).toHaveLength(29);
    const one = getMetadata('wf-qa');
    if (Array.isArray(one)) return;
    expect(one.path).toBe('workflows/qa.md');
    expect(one.related).not.toContain('wf-qa');
  });

  test('rejects an unknown rule ID', () => {
    expect(() => getMetadata('missing')).toThrow('Unknown rule ID');
    expect(() => getContent('missing')).toThrow('Unknown rule ID');
  });

  test('returns the full rule body', () => {
    const result = getContent('general');
    expect(result.content).toContain('# General Rules');
    expect(result.truncated).toBe(false);
  });

  test('finds semantic neighbours without a query call', () => {
    const neighbours = related('frontend');
    expect(neighbours).toHaveLength(4);
    expect(neighbours).not.toContain('frontend');
  });

  test('ranks the matching vector first', async () => {
    const audit = catalog.entries.find((entry) => entry.id === 'audit');
    expect(audit).toBeDefined();
    const { matches } = await searchAi('audit a codebase', aiReturning(audit!.vector), 5);
    expect(matches[0].id).toBe('audit');
    expect(matches[0].score).toBeCloseTo(1, 5);
  });

  test('handles a missing embedding without throwing', async () => {
    const env = { run: async () => ({}) } as unknown as Ai;
    const result = await searchAi('github actions workflow', env);
    expect(result.mode).toBe('lexical');
    expect(result.warning).toContain('Semantic search is unavailable');
    expect(result.matches.length).toBeGreaterThan(0);
  });

  test('keeps exact semantic matches first for catalog topics outside the query fixtures', async () => {
    const ids = ['github-releases', 'mobile-store-submission', 'miniapp', 'linting'];
    const results = await Promise.all(
      ids.map(async (id) => {
        const entry = catalog.entries.find((item) => item.id === id)!;
        return { id, matches: (await searchAi(entry.title, aiReturning(entry.vector))).matches };
      }),
    );
    for (const { id, matches } of results) {
      expect(matches[0].id).toBe(id);
      expect(matches[0].score).toBeCloseTo(1, 5);
    }
  });

  test('caps direct callers at five results and honors smaller limits', async () => {
    const entry = catalog.entries[0];
    expect((await searchAi(entry.title, aiReturning(entry.vector), 50)).matches).toHaveLength(5);
    expect((await searchAi(entry.title, aiReturning(entry.vector), 2)).matches).toHaveLength(2);
  });

  test('finds lexical matches without inference', () => {
    const matches = lexicalSearch('github actions workflow');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.map((match) => match.id)).toContain('github-actions');
  });

  test('bounds the decoded vector cache across distinct queries', async () => {
    await Promise.all(
      Array.from({ length: 200 }, (_, index) => {
        const embedding = Buffer.alloc(256 * 4, index % 251).toString('base64');
        return searchAi('cache bound query', aiReturning(embedding));
      }),
    );
    expect(cachedVectorCount()).toBeLessThanOrEqual(128);
  });
});
