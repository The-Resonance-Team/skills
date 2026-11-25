import { afterEach, expect, test } from 'bun:test';
import { advanceSubmission } from '../src/submission';
import type { PatchDraft, Submission } from '../src/contracts';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const patch: PatchDraft = {
  id: 'one',
  path: 'rules/general.md',
  before: 'reviewed\n',
  after: 'proposed\n',
  summary: 'fixture',
  digest: 'digest',
  status: 'submitting',
  createdAt: '2026-11-25T00:00:00.000Z',
};
const env = { GITHUB_TOKEN: 'test', GITHUB_OWNER: 'acme', GITHUB_REPO: 'rules' };

test('rejects target drift at the pinned base before any GitHub mutation', async () => {
  let method = '';
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    method = init?.method ?? 'GET';
    return Response.json({ type: 'file', encoding: 'base64', content: btoa('changed\n') });
  }) as unknown as typeof fetch;
  const job: Submission = {
    patchId: patch.id,
    approvalId: 'approved',
    phase: 'source',
    dueAt: 0,
    attempts: 0,
    baseSha: 'base',
  };
  const result = await advanceSubmission({ ...patch }, job, env, async () => {});
  expect(result.patch.status).toBe('stale');
  expect(result.job.phase).toBe('done');
  expect(method).toBe('GET');
});

test('recovers an accepted PR after response loss without sending another create request', async () => {
  const methods: string[] = [];
  let saved: Submission | undefined;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    methods.push(init?.method ?? 'GET');
    throw new Error('response lost after GitHub accepted the PR');
  }) as unknown as typeof fetch;
  const job: Submission = {
    patchId: patch.id,
    approvalId: 'approved',
    phase: 'pull',
    dueAt: 0,
    attempts: 0,
    commitSha: 'commit',
  };
  await expect(
    advanceSubmission({ ...patch }, job, env, async (value) => {
      saved = structuredClone(value);
    }),
  ).rejects.toThrow('response lost');
  expect(saved?.pullSent).toBe(true);
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    methods.push(init?.method ?? 'GET');
    return Response.json([
      {
        html_url: 'https://github.com/acme/rules/pull/42',
        body: 'Proposal: one\nDigest: digest',
        head: { ref: 'rules-mcp/one', sha: 'commit', repo: { full_name: 'acme/rules' } },
        base: { ref: 'main' },
      },
    ]);
  }) as unknown as typeof fetch;
  const result = await advanceSubmission({ ...patch }, saved!, env, async () => {});
  expect(result.patch.pullRequestUrl).toBe('https://github.com/acme/rules/pull/42');
  expect(result.patch.status).toBe('submitted');
  expect(methods.filter((method) => method === 'POST')).toEqual(['POST']);
  expect(methods.filter((method) => method === 'GET')).toHaveLength(3);
});
