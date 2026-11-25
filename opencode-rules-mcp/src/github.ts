import type { PullRequestInput, PullRequestResult } from './contracts';

const API_ROOT = 'https://api.github.com';
const AUTHOR = {
  name: 'rules-mcp',
  email: 'rules-mcp@users.noreply.github.com',
};

type GitHubResponse = {
  object?: { sha?: unknown };
  sha?: unknown;
  number?: unknown;
  html_url?: unknown;
  state?: unknown;
  draft?: unknown;
};

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`GitHub response missing ${field}`);
  return value;
}

function requiredNumber(value: unknown, field: string): number {
  if (typeof value !== 'number') throw new Error(`GitHub response missing ${field}`);
  return value;
}

async function request(
  token: string,
  method: 'GET' | 'POST',
  path: string,
  body?: object,
): Promise<GitHubResponse> {
  const response = await fetch(`${API_ROOT}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    let excerpt = '';
    try {
      excerpt = (await response.text()).slice(0, 200);
    } catch {
      excerpt = '';
    }
    throw new Error(
      `GitHub ${method} ${path} failed with HTTP ${response.status}${excerpt ? `: ${excerpt}` : ''}`,
    );
  }

  return (await response.json()) as GitHubResponse;
}

/**
 * Push a single file to a new branch and open a draft pull request for it.
 * Every GitHub call is sequential and fails fast — there is no retry.
 */
export async function createDraftPullRequest(
  input: PullRequestInput,
  token: string,
): Promise<PullRequestResult> {
  const repo = `/repos/${input.owner}/${input.repo}`;

  // 1. Resolve the base branch to the commit it points at.
  const ref = await request(token, 'GET', `${repo}/git/ref/heads/${input.base}`);
  const baseSha = requiredString(ref.object?.sha, 'base commit sha');

  // 2. Upload the changed rule as a blob.
  const blob = await request(token, 'POST', `${repo}/git/blobs`, {
    content: input.content,
    encoding: 'utf-8',
  });
  const blobSha = requiredString(blob.sha, 'blob sha');

  // 3. Resolve the base commit's tree.
  const baseTree = await request(token, 'GET', `${repo}/git/trees/${baseSha}`);
  const baseTreeSha = requiredString(baseTree.sha, 'base tree sha');

  // 4. Build a new tree that replaces just this one path.
  const tree = await request(token, 'POST', `${repo}/git/trees`, {
    base_tree: baseTreeSha,
    tree: [{ path: input.path, mode: '100644', type: 'blob', sha: blobSha }],
  });
  const treeSha = requiredString(tree.sha, 'tree sha');

  // 5. Commit the tree on top of the base commit.
  const commit = await request(token, 'POST', `${repo}/git/commits`, {
    message: input.message,
    tree: treeSha,
    parents: [baseSha],
    author: AUTHOR,
  });
  const commitSha = requiredString(commit.sha, 'commit sha');

  // 6. Point the new branch at that commit.
  await request(token, 'POST', `${repo}/git/refs`, {
    ref: `refs/heads/${input.branch}`,
    sha: commitSha,
  });

  // 7. Open the draft pull request.
  const pull = await request(token, 'POST', `${repo}/pulls`, {
    title: input.title,
    head: input.branch,
    base: input.base,
    body: input.body,
    draft: true,
  });

  return {
    number: requiredNumber(pull.number, 'pull request number'),
    htmlUrl: requiredString(pull.html_url, 'pull request html_url'),
    state: requiredString(pull.state, 'pull request state'),
    draft: pull.draft === true,
  };
}
