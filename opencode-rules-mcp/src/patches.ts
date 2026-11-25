import { newToken, sha256 } from './auth-tokens';
import type { ApprovalRecord, DashboardToken, PatchDraft } from './contracts';

const day = 86400;

function patchKey(id: string): string {
  return `patch:${id}`;
}

function approvalKey(id: string): string {
  return `approval:${id}`;
}

function dashKey(hash: string): string {
  return `dash:${hash}`;
}

export async function putPatch(kv: KVNamespace, draft: PatchDraft): Promise<void> {
  await kv.put(patchKey(draft.id), JSON.stringify(draft));
}

export async function getPatch(kv: KVNamespace, id: string): Promise<PatchDraft | null> {
  const raw = await kv.get(patchKey(id));
  return raw === null ? null : (JSON.parse(raw) as PatchDraft);
}

export async function listPatches(kv: KVNamespace): Promise<PatchDraft[]> {
  const list = await kv.list({ prefix: 'patch:' });
  const loaded = await Promise.all(list.keys.map((key) => kv.get(key.name)));
  return loaded
    .filter((raw): raw is string => raw !== null)
    .map((raw) => JSON.parse(raw) as PatchDraft)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getOrCreateDashboardToken(kv: KVNamespace): Promise<string> {
  const current = await kv.get('dash:current');
  if (current !== null) {
    const raw = await kv.get(dashKey(current));
    if (raw !== null) {
      const record = JSON.parse(raw) as DashboardToken;
      if (record.expiresAt > Date.now()) return current;
    }
  }
  const token = await sha256(newToken());
  const record: DashboardToken = {
    id: token,
    expiresAt: Date.now() + day * 1000,
    patchIds: [],
  };
  await kv.put(dashKey(token), JSON.stringify(record), { expirationTtl: day });
  await kv.put('dash:current', token, { expirationTtl: day });
  return token;
}

export async function dashboardRecord(
  kv: KVNamespace,
  token: string,
): Promise<DashboardToken | null> {
  const raw = await kv.get(dashKey(token));
  if (raw === null) return null;
  const record = JSON.parse(raw) as DashboardToken;
  return record.expiresAt > Date.now() ? record : null;
}

export async function addPatchToDashboard(
  kv: KVNamespace,
  token: string,
  patchId: string,
): Promise<void> {
  const record = await dashboardRecord(kv, token);
  if (record === null) return;
  if (!record.patchIds.includes(patchId)) record.patchIds.push(patchId);
  await kv.put(dashKey(token), JSON.stringify(record), { expirationTtl: day });
}

export async function decidePatch(
  kv: KVNamespace,
  token: string,
  patchId: string,
  decision: 'approved' | 'denied',
): Promise<{ ok: boolean; reason?: string }> {
  const record = await dashboardRecord(kv, token);
  if (record === null || !record.patchIds.includes(patchId))
    return { ok: false, reason: 'Invalid dashboard token' };
  const patch = await getPatch(kv, patchId);
  if (patch === null) return { ok: false, reason: 'Unknown patch' };
  if (patch.status !== 'pending') return { ok: false, reason: 'Patch already decided' };
  const approvalId = newToken();
  const approval: ApprovalRecord = {
    id: approvalId,
    patchId,
    digest: patch.digest,
    decision,
    decidedAt: new Date().toISOString(),
    used: false,
  };
  await kv.put(approvalKey(approvalId), JSON.stringify(approval), { expirationTtl: day });
  patch.status = decision;
  patch.decidedAt = approval.decidedAt;
  patch.approvalId = approvalId;
  await putPatch(kv, patch);
  const remaining = await Promise.all(record.patchIds.map(async (id) => getPatch(kv, id)));
  if (remaining.every((item) => item === null || item.status !== 'pending')) {
    await kv.delete(dashKey(token));
    await kv.delete('dash:current');
  }
  return { ok: true };
}

export async function consumeApproval(
  kv: KVNamespace,
  approvalId: string,
  patchId: string,
  digest: string,
): Promise<boolean> {
  const raw = await kv.get(approvalKey(approvalId));
  if (raw === null) return false;
  const approval = JSON.parse(raw) as ApprovalRecord;
  if (approval.patchId !== patchId || approval.digest !== digest) return false;
  if (approval.decision !== 'approved' || approval.used) return false;
  approval.used = true;
  await kv.put(approvalKey(approvalId), JSON.stringify(approval), { expirationTtl: day });
  return true;
}
