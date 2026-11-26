import type { PatchDraft, Submission } from './contracts';
import { dayMs, deadline, historyDays, reviewDays } from './deadlines';
import { GitHubError } from './github-api';
import { advanceSubmission } from './submission';
import type { Env } from './types';

export async function repairDueWork(storage: DurableObjectStorage): Promise<void> {
  const jobs = [...storage.kv.list<Submission>({ prefix: 'job:', limit: 25 })]
    .map(([, job]) => job)
    .filter((job) => job.phase !== 'blocked');
  const dueAt = Math.max(
    Date.now() + 100,
    Math.min(Date.now() + 3600000, ...jobs.map((job) => job.dueAt)),
  );
  await storage.transaction(async (transaction) => {
    const existing = await transaction.getAlarm();
    if (existing === null || existing > dueAt || existing < Date.now())
      await transaction.setAlarm(dueAt);
  });
}

function cleanup(storage: DurableObjectStorage): void {
  const kv = storage.kv;
  const cursor = kv.get<string>('cleanup:cursor');
  const page = [
    ...kv.list<PatchDraft>({
      prefix: 'patch:',
      limit: 25,
      ...(cursor ? { startAfter: cursor } : {}),
    }),
  ];
  for (const [key, patch] of page) {
    const job = kv.get<Submission>(`job:${patch.id}`);
    if (patch.status === 'unknown' || patch.status === 'submitting') continue;
    if (job !== undefined && job.phase !== 'blocked' && job.phase !== 'done') continue;
    if (
      (patch.status === 'pending' || patch.status === 'approved') &&
      deadline(patch.createdAt, reviewDays) <= Date.now()
    ) {
      patch.status = 'expired';
      patch.finalAt = deadline(patch.createdAt, reviewDays);
      kv.put(key, patch);
    }
    if (patch.finalAt !== undefined && patch.finalAt + historyDays * dayMs <= Date.now()) {
      kv.put(`receipt:${patch.id}`, { status: patch.status, digest: patch.digest });
      kv.delete(key);
      kv.delete(`job:${patch.id}`);
      for (const decision of patch.history ?? []) kv.delete(`approval:${decision.id}`);
    }
  }
  if (page.length === 25) kv.put('cleanup:cursor', page.at(-1)![0]);
  else kv.delete('cleanup:cursor');
  for (const [key, record] of kv.list<{ expiresAt: number }>({ prefix: 'auth:', limit: 25 })) {
    if (record.expiresAt <= Date.now()) kv.delete(key);
  }
}

export async function runJobs(storage: DurableObjectStorage, env: Env): Promise<void> {
  const entry = [...storage.kv.list<Submission>({ prefix: 'job:', limit: 25 })].find(
    ([, job]) => job.phase !== 'blocked' && job.dueAt <= Date.now(),
  );
  if (entry) {
    const [key, job] = entry;
    const patch = storage.kv.get<PatchDraft>(`patch:${job.patchId}`);
    if (!patch) throw new Error('Submission proposal is missing');
    try {
      const result = await advanceSubmission(patch, job, env, async (checkpoint) => {
        await storage.put(key, checkpoint);
      });
      result.job.attempts = result.job.phase === 'recover' ? result.job.attempts + 1 : 0;
      result.job.dueAt = Date.now() + (result.job.phase === 'recover' ? 60000 : 100);
    } catch (error) {
      job.attempts += 1;
      const permanent = error instanceof GitHubError && [401, 403, 404, 422].includes(error.status);
      if (job.pullSent) {
        job.phase = 'recover';
        patch.status = 'unknown';
      } else if (permanent || job.attempts >= 8) {
        job.phase = 'blocked';
        patch.status = 'failed';
        patch.finalAt = Date.now();
      }
      patch.message = job.pullSent
        ? 'GitHub outcome is uncertain; reconciling the original submission.'
        : 'Submission deferred; check GitHub permissions or retry after the service recovers.';
      job.dueAt = Date.now() + Math.min(3600000, 1000 * 2 ** Math.min(job.attempts, 12));
    }
    storage.transactionSync(() => {
      storage.kv.put(`patch:${patch.id}`, patch);
      if (job.phase === 'done') storage.kv.delete(key);
      else storage.kv.put(key, job);
    });
  }
  storage.transactionSync(() => cleanup(storage));
  await repairDueWork(storage);
}
