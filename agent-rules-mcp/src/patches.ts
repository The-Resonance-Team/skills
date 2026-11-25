import { DurableObject } from 'cloudflare:workers';

import { newToken } from './auth-tokens';
import type {
  ApprovalRecord,
  DashboardToken,
  Decision,
  DecisionResult,
  PatchDraft,
} from './contracts';
import { patchSchema } from './contracts';

const dayMs = 86400000;

// One coordinator owns this repository's dashboards and approval claims.
export class ApprovalStore extends DurableObject {
  private dashboardToken(token: string): DashboardToken | null {
    const record = this.ctx.storage.kv.get<DashboardToken>(`dash:${token}`);
    return record !== undefined && record.expiresAt > Date.now() ? record : null;
  }

  propose(input: PatchDraft): string {
    const draft = patchSchema.parse(input);
    if (draft.status !== 'pending') throw new Error('A proposal must be pending');
    return this.ctx.storage.transactionSync(() => {
      const kv = this.ctx.storage.kv;
      if (kv.get(`patch:${draft.id}`) !== undefined) throw new Error('Patch already exists');
      const current = kv.get<string>('dash:current');
      const existing = current === undefined ? null : this.dashboardToken(current);
      const token = existing?.id ?? newToken();
      const record: DashboardToken = existing ?? {
        id: token,
        expiresAt: Date.now() + dayMs,
        patchIds: [],
      };
      record.patchIds.push(draft.id);
      kv.put(`patch:${draft.id}`, draft);
      kv.put(`dash:${token}`, record);
      kv.put('dash:current', token);
      return token;
    });
  }

  dashboard(token: string): { patches: PatchDraft[]; closed: false } | null {
    const record = this.dashboardToken(token);
    if (record === null) return null;
    const patches = record.patchIds.map((id) => {
      const patch = this.ctx.storage.kv.get<PatchDraft>(`patch:${id}`);
      if (patch === undefined) throw new Error('Dashboard patch is missing');
      return patch;
    });
    return { patches, closed: false };
  }

  decide(
    token: string,
    patchId: string,
    decision: Decision,
  ): DecisionResult | { ok: false; reason: string } {
    return this.ctx.storage.transactionSync(() => {
      const kv = this.ctx.storage.kv;
      const record = this.dashboardToken(token);
      if (record === null || !record.patchIds.includes(patchId)) {
        return { ok: false, reason: 'Invalid dashboard token' };
      }
      const patch = kv.get<PatchDraft>(`patch:${patchId}`);
      if (patch === undefined || patch.status !== 'pending') {
        return { ok: false, reason: 'Patch is missing or already decided' };
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
      };
      patch.status = decision;
      patch.decidedAt = approval.decidedAt;
      patch.approvalId = approvalId;
      kv.put(`approval:${approvalId}`, approval);
      kv.put(`patch:${patchId}`, patch);
      const closed = record.patchIds.every(
        (id) => kv.get<PatchDraft>(`patch:${id}`)?.status !== 'pending',
      );
      if (closed) {
        kv.delete(`dash:${token}`);
        kv.delete('dash:current');
      }
      // Return the authoritative patch before revocation makes a reload impossible.
      return { ok: true, patch, closed };
    });
  }

  claim(approvalId: string, patchId: string): PatchDraft | null {
    return this.ctx.storage.transactionSync(() => {
      const kv = this.ctx.storage.kv;
      const approval = kv.get<ApprovalRecord>(`approval:${approvalId}`);
      const patch = kv.get<PatchDraft>(`patch:${patchId}`);
      if (
        approval === undefined ||
        patch === undefined ||
        approval.patchId !== patchId ||
        approval.digest !== patch.digest ||
        approval.decision !== 'approved' ||
        approval.used ||
        approval.expiresAt <= Date.now() ||
        patch.status !== 'approved'
      )
        return null;
      approval.used = true;
      // Persist uncertainty before the external write so a crash cannot enable a retry.
      patch.status = 'unknown';
      kv.put(`approval:${approvalId}`, approval);
      kv.put(`patch:${patchId}`, patch);
      return patch;
    });
  }

  finish(patchId: string, pullRequestUrl?: string): void {
    this.ctx.storage.transactionSync(() => {
      const kv = this.ctx.storage.kv;
      const patch = kv.get<PatchDraft>(`patch:${patchId}`);
      if (patch === undefined || patch.status !== 'unknown') {
        throw new Error('Patch has no active approval claim');
      }
      if (pullRequestUrl !== undefined) {
        patch.status = 'approved';
        patch.pullRequestUrl = pullRequestUrl;
      }
      kv.put(`patch:${patchId}`, patch);
    });
  }
}
