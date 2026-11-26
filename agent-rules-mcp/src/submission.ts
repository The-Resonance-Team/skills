import type { PatchDraft, Submission } from './contracts';
import { z } from 'zod';
import { github, GitHubError, sourceAt, type GitHubEnv } from './github-api';

const sha = z.object({ sha: z.string().min(1) });
const ref = z.object({ object: sha });
const pullSchema = z.object({
  html_url: z.url(),
  body: z.string().nullable(),
  head: z.object({ ref: z.string(), sha: z.string(), repo: z.object({ full_name: z.string() }) }),
  base: z.object({ ref: z.string() }),
});

function complete(patch: PatchDraft, job: Submission, url: string) {
  patch.status = 'submitted';
  patch.pullRequestUrl = url;
  patch.finalAt = Date.now();
  delete patch.message;
  job.phase = 'done';
}

function stale(patch: PatchDraft, job: Submission) {
  patch.status = 'stale';
  patch.message = 'The target file changed. Propose the current original and review the new diff.';
  patch.finalAt = Date.now();
  job.phase = 'done';
}

export async function advanceSubmission(
  patch: PatchDraft,
  job: Submission,
  env: GitHubEnv,
  checkpoint: (job: Submission) => Promise<void>,
): Promise<{ patch: PatchDraft; job: Submission }> {
  const branch = `rules-mcp/${patch.id}`;
  const marker = `Proposal: ${patch.id}\nDigest: ${patch.digest}`;
  if (job.phase === 'base') {
    job.baseSha = ref.parse(await github(env, '/git/ref/heads/main')).object.sha;
    job.phase = 'source';
    return { patch, job };
  }
  if (job.phase === 'source') {
    if ((await sourceAt(env, patch.path, job.baseSha!)) !== patch.before) {
      stale(patch, job);
    } else job.phase = 'blob';
    return { patch, job };
  }
  if (job.phase === 'blob') {
    job.blobSha = sha.parse(
      await github(env, '/git/blobs', 'POST', { content: patch.after, encoding: 'utf-8' }),
    ).sha;
    job.phase = 'tree';
    return { patch, job };
  }
  if (job.phase === 'tree') {
    const commit = z.object({ tree: sha }).parse(await github(env, `/git/commits/${job.baseSha}`));
    job.treeSha = sha.parse(
      await github(env, '/git/trees', 'POST', {
        base_tree: commit.tree.sha,
        tree: [{ path: patch.path, mode: '100644', type: 'blob', sha: job.blobSha }],
      }),
    ).sha;
    job.phase = 'commit';
    return { patch, job };
  }
  if (job.phase === 'commit') {
    job.commitSha = sha.parse(
      await github(env, '/git/commits', 'POST', {
        message: `rules: ${patch.summary}`,
        tree: job.treeSha,
        parents: [job.baseSha],
        author: {
          name: 'rules-mcp',
          email: 'rules-mcp@users.noreply.github.com',
          date: patch.createdAt,
        },
      }),
    ).sha;
    job.phase = 'branch';
    return { patch, job };
  }
  if (job.phase === 'branch') {
    if ((await sourceAt(env, patch.path, 'main')) !== patch.before) {
      stale(patch, job);
      return { patch, job };
    }
    try {
      const existing = ref.parse(await github(env, `/git/ref/heads/${branch}`));
      if (existing.object.sha !== job.commitSha)
        throw new Error('Submission branch has unexpected content');
    } catch (error) {
      if (!(error instanceof GitHubError) || error.status !== 404) throw error;
      await github(env, '/git/refs', 'POST', { ref: `refs/heads/${branch}`, sha: job.commitSha });
    }
    job.phase = 'pull';
    return { patch, job };
  }
  if (job.phase === 'pull') {
    // Checkpoint BEFORE the non-idempotent write. A crash must resume with reads.
    job.pullSent = true;
    job.phase = 'recover';
    await checkpoint(job);
    const result = z.object({ html_url: z.url(), draft: z.literal(true) }).parse(
      await github(env, '/pulls', 'POST', {
        title: `rules: ${patch.summary}`,
        head: branch,
        base: 'main',
        body: `Human-reviewed rule patch.\n\n${marker}\nBase: ${job.baseSha}`,
        draft: true,
      }),
    );
    complete(patch, job, result.html_url);
    return { patch, job };
  }
  if (job.phase === 'recover') {
    const pages = await Promise.all(
      [1, 2, 3].map(async (page) => {
        const query = new URLSearchParams({
          head: `${env.GITHUB_OWNER}:${branch}`,
          base: 'main',
          state: 'all',
          per_page: '100',
          page: String(page),
        });
        return z.array(pullSchema).parse(await github(env, `/pulls?${query}`));
      }),
    );
    const found = pages
      .flat()
      .find(
        (pull) =>
          pull.head.ref === branch &&
          pull.head.sha === job.commitSha &&
          pull.head.repo.full_name.toLowerCase() ===
            `${env.GITHUB_OWNER}/${env.GITHUB_REPO}`.toLowerCase() &&
          pull.base.ref === 'main' &&
          pull.body?.includes(marker),
      );
    if (found) {
      complete(patch, job, found.html_url);
      return { patch, job };
    }
    patch.status = 'unknown';
    patch.message =
      'Submission outcome remains uncertain. Recovery will only read GitHub; no second PR is created.';
    if (job.attempts >= 8) {
      job.phase = 'blocked';
      patch.message = 'Submission needs operator reconciliation; no second PR will be created.';
    }
  }
  return { patch, job };
}
