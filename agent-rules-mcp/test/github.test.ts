import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import type { PullRequestInput } from '../src/contracts';
import { createDraftPullRequest } from '../src/github';

const input: PullRequestInput = {
  owner: 'acme',
  repo: 'rules',
  base: 'main',
  branch: 'rules/update',
  path: 'rules/general.md',
  content: '# General Rules\nUse the shared rules.\n',
  message: 'Update general rules',
  title: 'Sync general rules',
  body: 'Automated rules update',
};

const HTML_URL = 'https://github.com/acme/rules/pull/42';

type Step = { status: number; body: unknown };
type Call = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
};

function okSteps(): Step[] {
  return [
    { status: 200, body: { object: { sha: 'base-sha' } } },
    { status: 201, body: { sha: 'blob-sha' } },
    { status: 200, body: { sha: 'base-tree-sha' } },
    { status: 201, body: { sha: 'new-tree-sha' } },
    { status: 201, body: { sha: 'commit-sha' } },
    { status: 201, body: {} },
    {
      status: 201,
      body: { number: 42, html_url: HTML_URL, state: 'open', draft: true },
    },
  ];
}

function urlOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof URL) return value.toString();
  if (value !== null && typeof value === 'object' && 'url' in value) {
    return String((value as { url: unknown }).url);
  }
  return String(value);
}

function headerRecord(init?: RequestInit): Record<string, string> {
  const headers = init?.headers;
  let entries: Array<[string, string]>;
  if (headers instanceof Headers) {
    entries = [...headers.entries()];
  } else if (Array.isArray(headers)) {
    entries = headers.map(([key, value]) => [key, String(value)]);
  } else {
    entries = Object.entries((headers as Record<string, string> | undefined) ?? {});
  }
  return Object.fromEntries(entries.map(([key, value]) => [key.toLowerCase(), value]));
}

const originalFetch = globalThis.fetch;
let calls: Call[] = [];
let steps: Step[] = [];

beforeEach(() => {
  calls = [];
  steps = okSteps();
  globalThis.fetch = (async (url: unknown, init?: RequestInit): Promise<Response> => {
    const raw = init?.body;
    calls.push({
      method: init?.method ?? 'GET',
      url: urlOf(url),
      headers: headerRecord(init),
      body: typeof raw === 'string' ? JSON.parse(raw) : undefined,
    });
    const step = steps.shift();
    if (step === undefined) throw new Error('Unexpected fetch call');
    return new Response(JSON.stringify(step.body), {
      status: step.status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('createDraftPullRequest', () => {
  test('makes the seven GitHub calls in order and returns the PR summary', async () => {
    const result = await createDraftPullRequest(input, 'test-token');

    expect(result).toEqual({
      number: 42,
      htmlUrl: HTML_URL,
      state: 'open',
      draft: true,
    });
    expect(calls).toHaveLength(7);
    expect(
      calls.map((call) => `${call.method} ${call.url.replace('https://api.github.com', '')}`),
    ).toEqual([
      'GET /repos/acme/rules/git/ref/heads/main',
      'POST /repos/acme/rules/git/blobs',
      'GET /repos/acme/rules/git/trees/base-sha',
      'POST /repos/acme/rules/git/trees',
      'POST /repos/acme/rules/git/commits',
      'POST /repos/acme/rules/git/refs',
      'POST /repos/acme/rules/pulls',
    ]);
  });

  test('sends standard headers, the branch ref, and draft:true', async () => {
    await createDraftPullRequest(input, 'test-token');

    for (const call of calls) {
      expect(call.headers.authorization).toBe('Bearer test-token');
      expect(call.headers.accept).toBe('application/vnd.github+json');
      expect(call.headers['x-github-api-version']).toBe('2026-03-10');
      expect(call.url.startsWith('https://api.github.com/')).toBe(true);
    }
    expect(calls[1].body).toEqual({ content: input.content, encoding: 'utf-8' });
    expect(calls[3].body).toEqual({
      base_tree: 'base-tree-sha',
      tree: [{ path: input.path, mode: '100644', type: 'blob', sha: 'blob-sha' }],
    });
    expect(calls[4].body).toEqual({
      message: input.message,
      tree: 'new-tree-sha',
      parents: ['base-sha'],
      author: {
        name: 'rules-mcp',
        email: 'rules-mcp@users.noreply.github.com',
      },
    });
    expect(calls[5].body).toEqual({ ref: 'refs/heads/rules/update', sha: 'commit-sha' });
    expect(calls[6].body).toEqual({
      title: input.title,
      head: input.branch,
      base: input.base,
      body: input.body,
      draft: true,
    });
    const pullBody = calls[6].body as Record<string, unknown>;
    expect(pullBody.draft).toBe(true);
  });

  test('throws with status and body excerpt on non-2xx, without retrying', async () => {
    steps = [{ status: 422, body: { message: 'Validation Failed: reference already exists' } }];

    let caught: unknown;
    try {
      await createDraftPullRequest(input, 'test-token');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).toContain('422');
    expect(message).toContain('Validation Failed');
    expect(calls).toHaveLength(1);
  });

  test('throws when a later step fails after earlier calls succeeded', async () => {
    steps = okSteps();
    steps[4] = { status: 403, body: { message: 'Resource not accessible' } };

    await expect(createDraftPullRequest(input, 'test-token')).rejects.toThrow(
      /403.*Resource not accessible/,
    );
    expect(calls).toHaveLength(5);
  });
});
