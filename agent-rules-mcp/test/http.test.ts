import { describe, expect, mock, test } from 'bun:test';

import type { Env } from '../src/types';

function MockEntrypoint() {}
mock.module('cloudflare:workers', () => ({ WorkerEntrypoint: MockEntrypoint }));
const { route } = await import('../src/http');

const zero = Buffer.alloc(256 * 4).toString('base64');
const ai = { run: async () => ({ data: [{ embedding: zero }] }) } as unknown as Ai;
const memory = new Map<string, string>();
const kv = {
  get: async (key: string) => memory.get(key) ?? null,
  put: async (key: string, value: string) => {
    memory.set(key, value);
  },
  delete: async (key: string) => {
    memory.delete(key);
  },
  list: async (options: { prefix?: string }) => ({
    keys: [...memory.keys()]
      .filter((key) => key.startsWith(options.prefix ?? ''))
      .map((name) => ({ name })),
  }),
} as unknown as KVNamespace;
const assets = {
  fetch: async () => new Response('Not found', { status: 404 }),
} as unknown as Fetcher;
const ctx = {} as ExecutionContext;

function makeEnv(token = 'a-secret-value'): Env {
  return {
    AI: ai,
    ASSETS: assets,
    OAUTH_KV: kv,
    MCP_TOKEN: token,
    PUBLIC_URL: 'https://example.test',
    ACCESS_AUTHORIZATION_URL: '',
    ACCESS_TOKEN_URL: '',
    ACCESS_USERINFO_URL: '',
    ACCESS_CLIENT_ID: '',
    ACCESS_CLIENT_SECRET: '',
    GITHUB_TOKEN: '',
    GITHUB_OWNER: '',
    GITHUB_REPO: '',
  };
}

const env = makeEnv();
const headers = {
  authorization: 'Bearer a-secret-value',
  'content-type': 'application/json',
  accept: 'application/json, text/event-stream',
};

type RpcResponse = {
  result?: {
    tools?: Array<{ name: string; description: string }>;
    structuredContent?: {
      matches?: Array<{ id: string; score: number }>;
      metadata?: Array<{ id: string; path: string }>;
      content?: string;
    };
    isError?: boolean;
    content?: Array<{ text: string }>;
  };
};

async function rpc(
  method: string,
  params: object,
  auth = headers.authorization,
): Promise<RpcResponse> {
  const request = new Request('https://example.test/mcp', {
    method: 'POST',
    headers: { ...headers, authorization: auth },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const response = await route(request, env, ctx);
  expect(response.status).toBe(200);
  return (await response.json()) as RpcResponse;
}

describe('HTTP surface', () => {
  test('rejects missing, wrong, and empty credentials', async () => {
    const responses = await Promise.all(
      ['', 'Bearer wrong', 'Bearer '].map((auth) =>
        route(
          new Request('https://example.test/mcp', { headers: { authorization: auth } }),
          env,
          ctx,
        ),
      ),
    );
    for (const response of responses) expect(response.status).toBe(401);
  });

  test('rejects unconfigured servers', async () => {
    const response = await route(
      new Request('https://example.test/mcp', { headers }),
      makeEnv(''),
      ctx,
    );
    expect(response.status).toBe(401);
  });

  test('advertises exactly the five rules tools', async () => {
    const response = await rpc('tools/list', {});
    expect(response.result?.tools?.map((tool) => tool.name)).toEqual([
      'search_ai',
      'get_metadata',
      'get',
      'propose_rule_patch',
      'apply_rule_patch',
    ]);
    expect(response.result?.tools?.[0].description).toContain('before any code change');
  });

  test('returns metadata without a rule body', async () => {
    const response = await rpc('tools/call', {
      name: 'get_metadata',
      arguments: { id: 'general' },
    });
    expect(response.result?.structuredContent?.metadata?.[0].path).toBe('rules/general.md');
    const metadata = response.result?.structuredContent?.metadata?.[0] ?? {};
    expect(Object.keys(metadata)).not.toContain('content');
  });

  test('returns at most five semantic matches', async () => {
    const response = await rpc('tools/call', {
      name: 'search_ai',
      arguments: { query: 'how to audit a repository' },
    });
    const matches = response.result?.structuredContent?.matches ?? [];
    expect(matches).toHaveLength(5);
    expect(matches.every((match) => Number.isFinite(match.score))).toBe(true);
  });

  test('reports an unknown ID as a tool error', async () => {
    const response = await rpc('tools/call', { name: 'get', arguments: { id: 'missing' } });
    expect(response.result?.isError).toBe(true);
  });

  test('refuses write tools for a read-only bearer token with HTTP 403', async () => {
    const request = new Request('https://example.test/mcp', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'propose_rule_patch',
          arguments: { id: 'general', summary: 'test', content: '# test' },
        },
      }),
    });
    const response = await route(request, env, ctx);
    expect(response.status).toBe(403);
  });
});
