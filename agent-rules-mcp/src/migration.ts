import { z } from 'zod';

import type { ApprovalRecord, PatchDraft } from './contracts';

const legacyPatch = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  before: z.string(),
  after: z.string(),
  summary: z.string().min(1),
  digest: z.string().min(1),
  status: z.enum(['pending', 'approved', 'denied', 'unknown']),
  createdAt: z.iso.datetime(),
  decidedAt: z.iso.datetime().optional(),
  approvalId: z.string().min(1).optional(),
  pullRequestUrl: z.url().optional(),
});

const legacyApproval = z.object({
  id: z.string().min(1),
  patchId: z.string().min(1),
  digest: z.string().min(1),
  decision: z.enum(['approved', 'denied']),
  decidedAt: z.iso.datetime(),
  used: z.boolean(),
});

export type LegacyRecord = { key: string; value: unknown };
export type MigrationStatus = {
  imported: number;
  approvals: number;
  conflicts: number;
  malformed: number;
  unresolved: number;
  cursor?: string;
  paused: boolean;
  readyToVerify: boolean;
  complete: boolean;
};

function outcomeTime(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

export function importLegacyBatch(
  storage: DurableObjectStorage,
  records: LegacyRecord[],
  cursor?: string,
  verify = false,
): MigrationStatus {
  const readyToVerify = cursor === undefined;
  const status: MigrationStatus = {
    imported: 0,
    approvals: 0,
    conflicts: 0,
    malformed: 0,
    unresolved: 0,
    ...(cursor === undefined ? {} : { cursor }),
    paused: !verify || !readyToVerify || records.length > 0,
    readyToVerify,
    complete: verify && readyToVerify && records.length === 0,
  };
  const approvals = new Map<string, ApprovalRecord>();
  for (const record of records) {
    if (!record.key.startsWith('approval:')) continue;
    const parsed = legacyApproval.safeParse(record.value);
    if (!parsed.success) {
      status.malformed += 1;
      continue;
    }
    approvals.set(parsed.data.id, {
      ...parsed.data,
      expiresAt: 0,
      reviewer: undefined,
      legacy: true,
    });
  }
  for (const record of records) {
    if (!record.key.startsWith('patch:')) continue;
    const parsed = legacyPatch.safeParse(record.value);
    if (!parsed.success) {
      status.malformed += 1;
      continue;
    }
    const legacy = parsed.data;
    const key = `patch:${legacy.id}`;
    if (storage.kv.get(`receipt:${legacy.id}`) !== undefined) {
      status.conflicts += 1;
      continue;
    }
    const existing = storage.kv.get<PatchDraft>(key);
    if (existing !== undefined) {
      if (existing.digest !== legacy.digest) status.conflicts += 1;
      continue;
    }
    const history = [...approvals.values()].filter((approval) => approval.patchId === legacy.id);
    const decision = history.at(-1);
    const patch: PatchDraft = {
      id: legacy.id,
      path: legacy.path,
      before: legacy.before,
      after: legacy.after,
      summary: legacy.summary,
      digest: legacy.digest,
      status: legacy.status,
      createdAt: legacy.createdAt,
      history,
      legacy: true,
    };
    if (legacy.decidedAt !== undefined) patch.decidedAt = legacy.decidedAt;
    if (legacy.approvalId !== undefined) patch.approvalId = legacy.approvalId;
    if (legacy.pullRequestUrl !== undefined) patch.pullRequestUrl = legacy.pullRequestUrl;
    if (legacy.status === 'denied') {
      patch.finalAt = outcomeTime(legacy.decidedAt ?? legacy.createdAt);
    } else if (legacy.status === 'approved' && legacy.pullRequestUrl !== undefined) {
      patch.status = 'submitted';
      patch.finalAt = outcomeTime(legacy.decidedAt ?? legacy.createdAt);
    } else if (legacy.status !== 'pending') {
      patch.status = 'unknown';
      patch.message =
        'Legacy submission needs reconciliation. No new approval is valid for this proposal.';
      status.unresolved += 1;
    }
    if (decision !== undefined && patch.approvalId === undefined) patch.approvalId = decision.id;
    storage.kv.put(key, patch);
    status.imported += 1;
    status.approvals += history.length;
    for (const approval of history) storage.kv.put(`approval:${approval.id}`, approval);
  }
  storage.kv.put('migration:status', status);
  return status;
}
