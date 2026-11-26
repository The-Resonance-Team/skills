import { describe, expect, test } from 'bun:test';

import { assertRecall, evaluate } from '../eval/evaluate';
import { fixtureAi } from '../eval/fixture-ai';
import { searchAi } from '../src/search';

describe('required recall release gate', () => {
  test('rejects a missing required ID even when the search request succeeds', async () => {
    const report = await evaluate(
      async () => ({ ids: [], bytes: 0, wallMs: 0 }),
      [{ query: 'fixture', expected: ['general'] }],
    );
    expect(() => assertRecall(report)).toThrow('general');
  });

  test('finds every unchanged required ID using the committed query vectors', async () => {
    const report = await evaluate(async (query) => ({
      ids: (await searchAi(query, fixtureAi)).matches.map((match) => match.id),
      bytes: 0,
      wallMs: 0,
    }));
    expect(report.cases).toBe(10);
    expect(report.requiredIds).toBe(23);
    expect(() => assertRecall(report)).not.toThrow();
  });

  test('fails closed when cases or required IDs are missing', async () => {
    const search = async () => ({ ids: [], bytes: 0, wallMs: 0 });
    await expect(evaluate(search, [])).rejects.toThrow('at least one case');
    await expect(evaluate(search, [{ query: 'fixture', expected: [] }])).rejects.toThrow(
      'No required IDs',
    );
  });
});
