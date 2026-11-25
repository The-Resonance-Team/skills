import { describe, expect, test } from 'bun:test';

import { route } from '../src/http';
import type { Env } from '../src/types';

const zero = Buffer.alloc(256 * 4).toString('base64');
const ai = { run: async () => ({ data: [{ embedding: zero }] }) } as unknown as Ai;
const env: Env = { AI: ai, MCP_TOKEN: 'a-secret-value' };
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
  const response = await route(request, env);
  expect(response.status).toBe(200);
  return (await response.json()) as RpcResponse;
}

describe('HTTP surface', () => {
  test('rejects missing, wrong, and empty credentials', async () => {
    const responses = await Promise.all(
      ['', 'Bearer wrong', 'Bearer '].map((auth) =>
        route(new Request('https://example.test/mcp', { headers: { authorization: auth } }), env),
      ),
    );
    for (const response of responses) expect(response.status).toBe(401);
  });

  test('rejects unknown paths and unconfigured servers', async () => {
    const other = await route(new Request('https://example.test/health'), env);
    expect(other.status).toBe(404);
    const unconfigured = await route(new Request('https://example.test/mcp', { headers }), {
      ...env,
      MCP_TOKEN: '',
    });
    expect(unconfigured.status).toBe(401);
  });

  test('advertises exactly the three rules tools', async () => {
    const response = await rpc('tools/list', {});
    expect(response.result?.tools?.map((tool) => tool.name)).toEqual([
      'search_ai',
      'get_metadata',
      'get',
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
});
