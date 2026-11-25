import { runInDurableObject } from 'cloudflare:test';
import { env, exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import type { PatchDraft } from '../src/contracts';
import type { ApprovalStore } from '../src/patches';
import type { Env } from '../src/types';

const bindings = env as unknown as Env;

function draft(id: string): PatchDraft {
  return {
    id,
    path: 'rules/general.md',
    before: 'old',
    after: 'new',
    summary: 'Regression fixture',
    digest: `digest-${id}`,
    status: 'pending',
    createdAt: '2026-11-25T00:00:00.000Z',
  };
}

function newStore() {
  return bindings.PATCHES.get(bindings.PATCHES.newUniqueId());
}

describe('atomic human approvals', () => {
  it('creates consecutive proposals without any Workers KV writes', async () => {
    const store = newStore();
    const token = await store.propose(draft('one'));
    expect(await store.propose(draft('two'))).toBe(token);
    expect((await store.dashboard(token))?.patches.map((patch) => patch.id)).toEqual([
      'one',
      'two',
    ]);
  });

  it('returns the final approval ID before invalidating the dashboard', async () => {
    const store = newStore();
    const token = await store.propose(draft('final'));
    const result = await store.decide(token, 'final', 'approved');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.closed).toBe(true);
    expect(result.patch.approvalId).toHaveLength(64);
    expect(await store.dashboard(token)).toBeNull();
    expect(await store.claim(result.patch.approvalId!, 'final')).not.toBeNull();
  });

  it('allows only one simultaneous claim and persists uncertainty before GitHub', async () => {
    const store = newStore();
    const token = await store.propose(draft('race'));
    const decision = await store.decide(token, 'race', 'approved');
    if (!decision.ok) throw new Error(decision.reason);
    const claims = await Promise.all(
      Array.from({ length: 8 }, () => store.claim(decision.patch.approvalId!, 'race')),
    );
    expect(claims.filter((claim) => claim !== null)).toHaveLength(1);
    expect(claims.find((claim) => claim !== null)?.status).toBe('unknown');
    expect(await store.claim(decision.patch.approvalId!, 'race')).toBeNull();
  });

  it('rejects denied, mismatched, and expired approvals', async () => {
    const store = newStore();
    const token = await store.propose(draft('denied'));
    await store.propose(draft('expired'));
    const denied = await store.decide(token, 'denied', 'denied');
    const approved = await store.decide(token, 'expired', 'approved');
    if (!denied.ok || !approved.ok) throw new Error('Decisions were not recorded');
    expect(await store.claim(denied.patch.approvalId!, 'denied')).toBeNull();
    expect(await store.claim(approved.patch.approvalId!, 'another-patch')).toBeNull();
    await runInDurableObject(store, (_instance: ApprovalStore, state) => {
      const key = `approval:${approved.patch.approvalId}`;
      const record = state.storage.kv.get<Record<string, unknown>>(key)!;
      state.storage.kv.put(key, { ...record, expiresAt: 0 });
    });
    expect(await store.claim(approved.patch.approvalId!, 'expired')).toBeNull();
  });

  it('records a human decision only once under concurrent requests', async () => {
    const store = newStore();
    const token = await store.propose(draft('decision-race'));
    const decisions = await Promise.all([
      store.decide(token, 'decision-race', 'approved'),
      store.decide(token, 'decision-race', 'denied'),
    ]);
    expect(decisions.filter((decision) => decision.ok)).toHaveLength(1);
  });
});

describe('static-asset authorization regression', () => {
  it('keeps unauthenticated root, index, and approval routes closed', async () => {
    const paths = ['/', '/index.html', '/approve/missing', '/approve/missing?token=wrong'];
    const responses = await Promise.all(
      paths.map((path) => exports.default.fetch(`https://worker.test${path}`)),
    );
    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401]);
  });

  it('loads nested dashboard assets and returns the last decision through HTTP', async () => {
    const store = bindings.PATCHES.getByName('approvals');
    const id = crypto.randomUUID();
    const token = await store.propose(draft(id));
    const page = await exports.default.fetch(`https://worker.test/approve/${id}?token=${token}`);
    expect(page.status).toBe(200);
    const html = await page.text();
    const script = html.match(/src="([^"]+\.js)"/)?.[1];
    expect(script).toMatch(/^\/assets\//);
    const asset = await exports.default.fetch(new URL(script!, page.url || 'https://worker.test'));
    expect(asset.status).toBe(200);
    const response = await exports.default.fetch('https://worker.test/api/decide', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, patchId: id, decision: 'approved' }),
    });
    expect(response.status).toBe(200);
    const result = (await response.json()) as { ok: boolean; patch: PatchDraft; closed: boolean };
    expect(result.patch.approvalId).toHaveLength(64);
    expect(result.closed).toBe(true);
    const refreshed = await exports.default.fetch(`https://worker.test/api/patches?token=${token}`);
    expect(refreshed.status).toBe(401);
  });
});
