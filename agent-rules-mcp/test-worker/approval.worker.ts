import { runInDurableObject } from 'cloudflare:test';
import { env, exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import type { PatchDraft } from '../src/contracts';
import type { ApprovalStore } from '../src/patches';
import type { Env } from '../src/types';
import { newToken, sha256 } from '../src/auth-tokens';

const reviewer = {
  issuer: 'https://identity.test',
  sub: 'operator',
  email: 'operator@example.test',
};

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
    expect((await store.dashboard())?.patches.map((patch) => patch.id)).toEqual(['one', 'two']);
  });

  it('keeps the final decision recoverable after the last proposal is decided', async () => {
    const store = newStore();
    await store.propose(draft('final'));
    const result = await store.decide('final', 'approved', reviewer);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.closed).toBe(true);
    expect(result.patch.approvalId).toHaveLength(64);
    expect((await store.dashboard())?.patches[0].approvalId).toBe(result.patch.approvalId);
    expect(await store.claim(result.patch.approvalId!, 'final')).not.toBeNull();
  });

  it('allows only one simultaneous claim and persists uncertainty before GitHub', async () => {
    const store = newStore();
    await store.propose(draft('race'));
    const decision = await store.decide('race', 'approved', reviewer);
    if (!decision.ok) throw new Error(decision.reason);
    const claims = await Promise.all(
      Array.from({ length: 8 }, () => store.claim(decision.patch.approvalId!, 'race')),
    );
    expect(claims.every((claim) => claim?.id === 'race')).toBe(true);
    expect(claims.every((claim) => claim?.status === 'submitting')).toBe(true);
    const replay = await store.claim(decision.patch.approvalId!, 'race');
    expect(replay?.id).toBe('race');
    expect(replay?.status).toBe('submitting');
    await runInDurableObject(store, (_instance: ApprovalStore, state) => {
      expect([...state.storage.kv.list({ prefix: 'job:' })].map(([key]) => key)).toEqual([
        'job:race',
      ]);
    });
  });

  it('rejects denied, mismatched, and expired approvals', async () => {
    const store = newStore();
    await store.propose(draft('denied'));
    await store.propose(draft('expired'));
    const denied = await store.decide('denied', 'denied', reviewer);
    const approved = await store.decide('expired', 'approved', reviewer);
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
    await store.propose(draft('decision-race'));
    const decisions = await Promise.all([
      store.decide('decision-race', 'approved', reviewer),
      store.decide('decision-race', 'denied', reviewer),
    ]);
    expect(decisions.filter((decision) => decision.ok)).toHaveLength(1);
  });
});

describe('static-asset authorization regression', () => {
  it('keeps unauthenticated root, index, and approval routes closed', async () => {
    const paths = ['/', '/index.html', '/approve/missing', '/approve/missing?token=wrong'];
    const responses = await Promise.all(
      paths.map((path) =>
        exports.default.fetch(`https://worker.test${path}`, { redirect: 'manual' }),
      ),
    );
    expect(responses.map((response) => response.status)).toEqual([302, 302, 302, 302]);
  });

  it('loads nested dashboard assets and returns the last decision through HTTP', async () => {
    const store = bindings.PATCHES.getByName('approvals');
    const id = crypto.randomUUID();
    const token = await store.propose(draft(id));
    const session = newToken();
    await store.authPut(await sha256(session), {
      kind: 'session',
      reviewer,
      expiresAt: Date.now() + 86400000,
    });
    const cookie = `__Host-reviewer=${session}`;
    const page = await exports.default.fetch(`https://worker.test/approve/${id}?token=${token}`, {
      headers: { cookie },
    });
    expect(page.status).toBe(200);
    const html = await page.text();
    const script = html.match(/src="([^"]+\.js)"/)?.[1];
    expect(script).toMatch(/^\/assets\//);
    const asset = await exports.default.fetch(new URL(script!, page.url || 'https://worker.test'));
    expect(asset.status).toBe(200);
    const response = await exports.default.fetch('https://worker.test/api/decide', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: 'https://worker.test' },
      body: JSON.stringify({ patchId: id, decision: 'approved' }),
    });
    expect(response.status).toBe(200);
    const result = (await response.json()) as { ok: boolean; patch: PatchDraft; closed: boolean };
    expect(result.patch.approvalId).toHaveLength(64);
    expect(result.closed).toBe(true);
    const refreshed = await exports.default.fetch(`https://worker.test/api/patches`, {
      headers: { cookie },
    });
    expect(refreshed.status).toBe(200);
  });
});
