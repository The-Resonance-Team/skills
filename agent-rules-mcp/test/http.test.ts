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
    PATCHES: {
      getByName: () => ({ dashboard: async () => null }),
    } as unknown as Env['PATCHES'],
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
      metadata?: Array<{
        id: string;
        kind?: string;
        path: string;
        priority?: string;
        rules?: Array<{ id: string; title: string }>;
      }>;
      content?: string;
      rule?: { id: string; content: string; scope: string; priority: string };
      workflow?: {
        id: string;
        steps: Array<{ title: string; content: string }>;
      };
      total?: number;
      nextOffset?: number | null;
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

  test('advertises the discovery, retrieval, and patch tools', async () => {
    const response = await rpc('tools/list', {});
    expect(response.result?.tools?.map((tool) => tool.name)).toEqual([
      'search_ai',
      'get_metadata',
      'get_rule',
      'get_workflow',
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

  test('lists mandatory rules by stable slug without loading rule bodies', async () => {
    const response = await rpc('tools/call', {
      name: 'get_metadata',
      arguments: { id: 'general' },
    });
    const entry = response.result?.structuredContent?.metadata?.[0];
    expect(entry?.priority).toBe('mandatory');
    expect(entry?.rules?.[0].id).toMatch(/^rule:general:[a-z0-9-]+$/);
    expect(entry?.rules?.[0].title).toBeTruthy();
    expect(entry?.rules?.[0]).not.toHaveProperty('content');
    expect(entry?.rules?.some((rule) => rule.id === 'rule:general:project-context')).toBe(true);
  });

  test('filters and pages the metadata index by category and priority', async () => {
    const response = await rpc('tools/call', {
      name: 'get_metadata',
      arguments: { kind: 'workflow', priority: 'mandatory', offset: 0, limit: 2 },
    });
    const entries = response.result?.structuredContent?.metadata ?? [];
    expect(entries).toHaveLength(2);
    expect(entries.every((entry) => entry.kind === 'workflow')).toBe(true);
    expect(entries.every((entry) => entry.priority === 'mandatory')).toBe(true);
  });

  test('signals when the metadata index has more pages', async () => {
    const response = await rpc('tools/call', { name: 'get_metadata', arguments: {} });
    const result = response.result?.structuredContent;
    expect(result?.metadata?.length).toBeLessThan(result?.total ?? 0);
    expect(result?.nextOffset).toBe(result?.metadata?.length);
  });

  test('caps large index requests and keeps the next page visible', async () => {
    const response = await rpc('tools/call', {
      name: 'get_metadata',
      arguments: { priority: 'mandatory', limit: 100 },
    });
    const result = response.result?.structuredContent;
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(18000);
    expect(result?.nextOffset).toBe(result?.metadata?.length);
    expect(result?.nextOffset).not.toBeNull();
  });

  test('returns only the requested rule and its scope', async () => {
    const response = await rpc('tools/call', {
      name: 'get_rule',
      arguments: { id: 'rule:general:postgres-always-docker-never' },
    });
    const rule = response.result?.structuredContent?.rule;
    expect(rule?.id).toBe('rule:general:postgres-always-docker-never');
    expect(rule?.scope).toBe('All projects');
    expect(rule?.priority).toBe('mandatory');
    expect(rule?.content).toContain('docker compose up -d postgres');
    expect(rule?.content).not.toContain('Vietnamese diacritics');
  });

  test('does not attach the next section heading to a rule', async () => {
    const response = await rpc('tools/call', {
      name: 'get_rule',
      arguments: { id: 'rule:general:module-context' },
    });
    expect(response.result?.structuredContent?.rule?.content).not.toContain(
      '## Environment & language',
    );
  });

  test('makes the mandatory library baseline table discoverable as individual rules', async () => {
    const index = await rpc('tools/call', {
      name: 'get_metadata',
      arguments: { id: 'libraries' },
    });
    const entries = index.result?.structuredContent?.metadata?.[0].rules ?? [];
    expect(entries.map((rule) => rule.id)).toContain('rule:libraries:library-baseline-core');
    const response = await rpc('tools/call', {
      name: 'get_rule',
      arguments: { id: 'rule:libraries:library-baseline-core' },
    });
    expect(response.result?.structuredContent?.rule?.content).toContain('`slugify`');
  });

  test('returns a workflow as ordered complete instructions', async () => {
    const response = await rpc('tools/call', {
      name: 'get_workflow',
      arguments: { id: 'wf-qa' },
    });
    const workflow = response.result?.structuredContent?.workflow;
    expect(workflow?.id).toBe('wf-qa');
    const titles = workflow?.steps.map((step) => step.title) ?? [];
    expect(titles.indexOf('1. Recon → target list')).toBeLessThan(
      titles.indexOf('2. Stack up with seeded data'),
    );
    expect(workflow?.steps.some((step) => step.content.includes('every app answers'))).toBe(true);
  });

  test('refuses a full-file response that exceeds the safe client limit', async () => {
    const response = await rpc('tools/call', {
      name: 'get',
      arguments: { id: 'frontend' },
    });
    expect(response.result?.isError).toBe(true);
    expect(response.result?.content?.[0].text).toContain('too large');
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
