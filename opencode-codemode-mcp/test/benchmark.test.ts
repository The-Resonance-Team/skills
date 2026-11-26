import { describe, expect, test } from 'bun:test';
import { workload, type Result } from '../bench/workload';

describe('benchmark workload', () => {
  test('returns a deterministic result', async () => {
    const source = workload.replace(/^export default /, '').replace(/;\s*$/, '');
    const run = new Function(`return (${source});`)() as () => Promise<Result>;
    const first = await run();
    const second = await run();
    expect(first.blocked).toBe(715);
    expect(first.groups).toBe(11);
    expect(first.total).toBe(second.total);
  });
});
