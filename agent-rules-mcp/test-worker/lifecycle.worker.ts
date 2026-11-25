import { env, exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import type { PatchDraft, Reviewer } from '../src/contracts';
import type { Env } from '../src/types';
import { newToken, sha256 } from '../src/auth-tokens';

const bindings = env as unknown as Env;
const reviewer: Reviewer = {
  issuer: 'https://identity.test',
  sub: 'operator',
  email: 'operator@example.test',
};
function draft(id: string): PatchDraft {
  return {
    id,
    path: 'rules/general.md',
    before: 'original\n',
    after: 'proposed\n',
    summary: 'Review fixture',
    digest: id,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
}

describe('renewable repository review board', () => {
  it('does not expose proposals to an unauthenticated holder of a valid link', async () => {
    const store = bindings.PATCHES.getByName('approvals');
    const token = await store.propose(draft('private'));
    const response = await exports.default.fetch(`https://worker.test/api/patches?token=${token}`);
    expect(response.status).toBe(401);
  });
  it('imports surviving legacy records without creating submit-ready approvals', async () => {
    const store = bindings.PATCHES.getByName('approvals');
    const legacyId = 'legacy-one';
    const approvalId = 'legacy-approval-one';
    await bindings.OAUTH_KV.put(
      `patch:${legacyId}`,
      JSON.stringify({
        id: legacyId,
        path: 'rules/general.md',
        before: 'old',
        after: 'new',
        summary: 'Legacy fixture',
        digest: 'legacy-digest',
        status: 'approved',
        createdAt: '2026-11-24T00:00:00.000Z',
        decidedAt: '2026-11-24T01:00:00.000Z',
        approvalId,
      }),
    );
    await bindings.OAUTH_KV.put(
      `approval:${approvalId}`,
      JSON.stringify({
        id: approvalId,
        patchId: legacyId,
        digest: 'legacy-digest',
        decision: 'approved',
        decidedAt: '2026-11-24T01:00:00.000Z',
        used: true,
      }),
    );
    const session = newToken();
    await store.authPut(await sha256(session), {
      kind: 'session',
      reviewer,
      expiresAt: Date.now() + 86400000,
    });
    const response = await exports.default.fetch('https://worker.test/api/migrate', {
      method: 'POST',
      headers: {
        cookie: `__Host-reviewer=${session}`,
        origin: 'https://worker.test',
      },
    });
    expect(response.status).toBe(200);
    const result = (await response.json()) as {
      imported: number;
      unresolved: number;
      paused: boolean;
      complete: boolean;
    };
    expect(result.imported).toBeGreaterThanOrEqual(1);
    expect(result.unresolved).toBeGreaterThanOrEqual(1);
    expect(result.paused).toBe(true);
    expect(result.complete).toBe(false);
    const legacy = (await store.dashboard())?.patches.find((patch) => patch.id === legacyId);
    expect(legacy?.status).toBe('unknown');
    expect(legacy?.legacy).toBe(true);
    expect((await store.decide(legacyId, 'approved', reviewer)).ok).toBe(false);
    expect(await store.claim(approvalId, legacyId)).toBeNull();
    await bindings.OAUTH_KV.delete(`patch:${legacyId}`);
    await bindings.OAUTH_KV.delete(`approval:${approvalId}`);
    const verified = await exports.default.fetch('https://worker.test/api/migrate?verify=1', {
      method: 'POST',
      headers: {
        cookie: `__Host-reviewer=${session}`,
        origin: 'https://worker.test',
      },
    });
    const verification = (await verified.json()) as { complete: boolean; paused: boolean };
    expect(verification.complete).toBe(true);
    expect(verification.paused).toBe(false);
  });

  it('renews access to the same decided proposals and records the authenticated reviewer', async () => {
    const store = bindings.PATCHES.get(bindings.PATCHES.newUniqueId());
    await store.propose(draft('renewed'));
    await store.renew(reviewer);
    const result = await store.decide('renewed', 'approved', reviewer);
    expect(result.ok).toBe(true);
    const renewed = await store.renew(reviewer);
    const board = await store.dashboard();
    expect(renewed).not.toBe('');
    expect(board?.patches[0].history?.[0].reviewer).toEqual(reviewer);
    expect(board?.patches[0].approvalId).toBe(result.ok ? result.patch.approvalId : undefined);
  });
});
