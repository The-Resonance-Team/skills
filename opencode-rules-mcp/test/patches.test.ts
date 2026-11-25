import { describe, expect, test } from 'bun:test';

import {
  addPatchToDashboard,
  consumeApproval,
  decidePatch,
  getOrCreateDashboardToken,
  getPatch,
  putPatch,
} from '../src/patches';
import type { PatchDraft } from '../src/contracts';

function memoryKv(): KVNamespace {
  const values = new Map<string, string>();
  return {
    get: async (key: string) => values.get(key) ?? null,
    put: async (key: string, value: string) => {
      values.set(key, value);
    },
    delete: async (key: string) => {
      values.delete(key);
    },
    list: async (options: { prefix?: string }) => ({
      keys: [...values.keys()]
        .filter((key) => key.startsWith(options.prefix ?? ''))
        .map((name) => ({ name })),
    }),
  } as unknown as KVNamespace;
}

function draft(id: string): PatchDraft {
  return {
    id,
    path: 'rules/general.md',
    before: 'old',
    after: 'new',
    summary: 'test patch',
    digest: `digest-${id}`,
    status: 'pending',
    createdAt: '2026-11-25T00:00:00.000Z',
  };
}

describe('patch approval state', () => {
  test('a dashboard token collects patches and decides them once', async () => {
    const kv = memoryKv();
    await putPatch(kv, draft('one'));
    await putPatch(kv, draft('two'));
    const token = await getOrCreateDashboardToken(kv);
    expect(token).toHaveLength(64);
    await addPatchToDashboard(kv, token, 'one');
    await addPatchToDashboard(kv, token, 'two');
    expect((await getOrCreateDashboardToken(kv)) === token).toBe(true);

    const approved = await decidePatch(kv, token, 'one', 'approved');
    expect(approved.ok).toBe(true);
    const again = await decidePatch(kv, token, 'one', 'approved');
    expect(again.ok).toBe(false);

    const one = await getPatch(kv, 'one');
    expect(one?.status).toBe('approved');
    expect(one?.approvalId).toBeDefined();
  });

  test('an approval is consumed once and bound to the patch digest', async () => {
    const kv = memoryKv();
    await putPatch(kv, draft('one'));
    const token = await getOrCreateDashboardToken(kv);
    await addPatchToDashboard(kv, token, 'one');
    await decidePatch(kv, token, 'one', 'approved');
    const patch = await getPatch(kv, 'one');
    const approvalId = patch?.approvalId ?? '';

    expect(await consumeApproval(kv, approvalId, 'one', 'digest-one')).toBe(true);
    expect(await consumeApproval(kv, approvalId, 'one', 'digest-one')).toBe(false);
    expect(await consumeApproval(kv, approvalId, 'two', 'digest-one')).toBe(false);
  });

  test('a denied patch cannot be consumed', async () => {
    const kv = memoryKv();
    await putPatch(kv, draft('one'));
    const token = await getOrCreateDashboardToken(kv);
    await addPatchToDashboard(kv, token, 'one');
    await decidePatch(kv, token, 'one', 'denied');
    const approvalId = (await getPatch(kv, 'one'))?.approvalId ?? '';
    expect(await consumeApproval(kv, approvalId, 'one', 'digest-one')).toBe(false);
  });
});
