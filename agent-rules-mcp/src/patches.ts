import { DurableObject } from 'cloudflare:workers';

import { newToken } from './auth-tokens';
import type {
  ApprovalRecord,
  DashboardToken,
  Decision,
  DecisionResult,
  PatchDraft,
  Reviewer,
  Submission,
} from './contracts';
import { patchSchema, replayableStatuses, reviewerSchema } from './contracts';
import { dayMs, deadline, reviewDays } from './deadlines';
import { repairDueWork, runJobs } from './jobs';
import { importLegacyBatch, type LegacyRecord } from './migration';
import type { ReviewAuth } from './reviewer';
import { putReviewAuth, readReviewAuth } from './review-auth-storage';
import type { Env } from './types';

// One coordinator owns this repository's review board and submission claims.
export class ApprovalStore extends DurableObject<Env> {
  async alarm(): Promise<void> {
    await runJobs(this.ctx.storage, this.env);
  }

  async repairAlarms(): Promise<void> {
    await repairDueWork(this.ctx.storage);
  }

  authPut(id: string, record: ReviewAuth): void {
    putReviewAuth(this.ctx.storage, id, record);
  }

  authRead(id: string, consume = false): ReviewAuth | null {
    return readReviewAuth(this.ctx.storage, id, consume);
  }

  importLegacy(records: LegacyRecord[], cursor?: string, verify = false) {
    return this.ctx.storage.transactionSync(() =>
      importLegacyBatch(this.ctx.storage, records, cursor, verify),
    );
  }

  private currentToken(): string {
    return this.ctx.storage.kv.get<string>('dash:current') ?? '';
  }

  private allPatches(): PatchDraft[] {
    return [...this.ctx.storage.kv.list<PatchDraft>({ prefix: 'patch:' })].map(
      ([, patch]) => patch,
    );
  }

  private dashboardToken(token: string): DashboardToken | null {
    const id = token === '' ? this.currentToken() : token;
    const record = this.ctx.storage.kv.get<DashboardToken>(`dash:${id}`);
    return record !== undefined && record.expiresAt > Date.now() ? record : null;
  }

  propose(input: PatchDraft): string {
    const draft = patchSchema.parse(input);
    if (draft.status !== 'pending') throw new Error('A proposal must be pending');
    return this.ctx.storage.transactionSync(() => {
      const kv = this.ctx.storage.kv;
      if (kv.get(`receipt:${draft.id}`))
        throw new Error('This proposal has expired; use a new request ID');
      const prior = kv.get<PatchDraft>(`patch:${draft.id}`);
      if (prior !== undefined && prior.digest !== draft.digest) {
        throw new Error('Proposal request conflicts with its original input');
      }
      const existing = this.dashboardToken('');
      const token = existing?.id ?? newToken();
      const record: DashboardToken = existing ?? {
        id: token,
        expiresAt: Date.now() + dayMs,
        patchIds: [],
      };
      if (!record.patchIds.includes(draft.id)) record.patchIds.push(draft.id);
      if (prior === undefined) kv.put(`patch:${draft.id}`, { ...draft, history: [] });
      kv.put(`dash:${token}`, record);
      kv.put('dash:current', token);
      return token;
    });
  }

  renew(identity: Reviewer): string {
    reviewerSchema.parse(identity);
    return this.ctx.storage.transactionSync(() => {
      const kv = this.ctx.storage.kv;
      const old = this.currentToken();
      if (old !== '') kv.delete(`dash:${old}`);
      const token = newToken();
      kv.put(`dash:${token}`, { id: token, expiresAt: Date.now() + dayMs, patchIds: [] });
      kv.put('dash:current', token);
      kv.put('board:renewal', { reviewer: identity, renewedAt: new Date().toISOString() });
      return token;
    });
  }

  dashboard(): { patches: PatchDraft[]; closed: false; accessExpiresAt: number } | null {
    const record = this.dashboardToken('');
    if (record === null) return null;
    const patches = this.allPatches().map((patch) => ({
      ...patch,
      expiresAt:
        patch.status === 'pending' || patch.status === 'approved'
          ? deadline(patch.createdAt, reviewDays)
          : undefined,
    }));
    return { patches, closed: false, accessExpiresAt: record.expiresAt };
  }

  decide(
    patchId: string,
    decision: Decision,
    identity: Reviewer,
  ): DecisionResult | { ok: false; reason: string } {
    const reviewer = reviewerSchema.parse(identity);
    return this.ctx.storage.transactionSync(() => {
      const kv = this.ctx.storage.kv;
      const patch = kv.get<PatchDraft>(`patch:${patchId}`);
      const previous = patch?.history?.at(-1);
      if (
        patch?.status === decision &&
        previous?.decision === decision &&
        previous.expiresAt > Date.now()
      ) {
        return { ok: true, patch, closed: false };
      }
      const canReapprove =
        patch?.status === 'approved' &&
        previous !== undefined &&
        !previous.used &&
        previous.expiresAt <= Date.now();
      if (patch === undefined || (patch.status !== 'pending' && !canReapprove)) {
        return { ok: false, reason: 'Patch is missing or already decided' };
      }
      if (patch.legacy === true) {
        return { ok: false, reason: 'Legacy proposal needs reconciliation before a new decision' };
      }
      if (deadline(patch.createdAt, reviewDays) <= Date.now()) {
        patch.status = 'expired';
        patch.finalAt = deadline(patch.createdAt, reviewDays);
        kv.put(`patch:${patchId}`, patch);
        return { ok: false, reason: 'Proposal review window expired' };
      }
      const approvalId = newToken();
      const approval: ApprovalRecord = {
        id: approvalId,
        patchId,
        digest: patch.digest,
        decision,
        decidedAt: new Date().toISOString(),
        expiresAt: Date.now() + dayMs,
        used: false,
        reviewer,
      };
      patch.status = decision;
      patch.decidedAt = approval.decidedAt;
      patch.approvalId = approvalId;
      patch.history = [...(patch.history ?? []), approval];
      if (decision === 'denied') patch.finalAt = Date.now();
      kv.put(`approval:${approvalId}`, approval);
      kv.put(`patch:${patchId}`, patch);
      const closed = this.allPatches().every((item) => item.status !== 'pending');
      return { ok: true, patch, closed };
    });
  }

  async claim(approvalId: string, patchId: string): Promise<PatchDraft | null> {
    const result = this.ctx.storage.transactionSync(() => {
      const kv = this.ctx.storage.kv;
      const approval = kv.get<ApprovalRecord>(`approval:${approvalId}`);
      const patch = kv.get<PatchDraft>(`patch:${patchId}`);
      if (
        patch?.approvalId === approvalId &&
        patch.legacy !== true &&
        (replayableStatuses as readonly string[]).includes(patch.status)
      ) {
        return patch;
      }
      if (
        approval === undefined ||
        patch === undefined ||
        approval.patchId !== patchId ||
        approval.digest !== patch.digest ||
        approval.decision !== 'approved' ||
        approval.used ||
        approval.reviewer === undefined ||
        approval.expiresAt <= Date.now() ||
        patch.status !== 'approved'
      ) {
        return null;
      }
      approval.used = true;
      patch.status = 'submitting';
      patch.history = patch.history?.map((item) => (item.id === approvalId ? approval : item));
      kv.put(`approval:${approvalId}`, approval);
      kv.put(`patch:${patchId}`, patch);
      const job: Submission = {
        patchId,
        approvalId,
        phase: 'base',
        dueAt: Date.now(),
        attempts: 0,
      };
      kv.put(`job:${patchId}`, job);
      return patch;
    });
    if (result) await this.repairAlarms();
    return result;
  }
}
