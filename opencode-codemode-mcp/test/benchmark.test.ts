import { describe, expect, test } from 'bun:test';
import type { Result } from '../bench/workload';

describe('benchmark workload', () => {
  test('returns a deterministic result', async () => {
    const source = await Bun.file(new URL('../bench/workload.ts', import.meta.url)).text();
    const match = source.match(/export const workload = `([\s\S]*?)`;/);
    expect(match).not.toBeNull();
    const loaded = await import(`data:text/javascript,${encodeURIComponent(match![1])}`);
    const run = loaded.default as () => Promise<Result>;
    const first = await run();
    const second = await run();
    expect(first.blocked).toBe(715);
    expect(first.groups).toBe(11);
    expect(first.total).toBe(second.total);
  });
});
