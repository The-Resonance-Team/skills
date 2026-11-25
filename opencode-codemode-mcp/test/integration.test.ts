import { describe, expect, test } from 'bun:test';

const url = process.env.TEST_WORKER_URL;
const headers = {
  authorization: 'Bearer testing-mcp-token',
  'content-type': 'application/json',
  accept: 'application/json, text/event-stream',
};

type RpcResponse = {
  result: {
    tools: { name: string }[];
    structuredContent: { result: { id: string; state: string; answer?: number } };
    isError: boolean;
    content: { text: string }[];
  };
};

async function rpc(method: string, params: object): Promise<RpcResponse> {
  const response = await fetch(`${url}/mcp`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  expect(response.status).toBe(200);
  return (await response.json()) as RpcResponse;
}

describe.skipIf(!url)('local Worker integration', () => {
  test('advertises only search and execute', async () => {
    const response = await rpc('tools/list', {});
    expect(response.result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      'search',
      'execute',
    ]);
  });

  test('executes TypeScript and blocks direct network access', async () => {
    const success = await rpc('tools/call', {
      name: 'execute',
      arguments: { code: 'export default async (_sdk: unknown) => ({ answer: 42 })' },
    });
    expect(success.result.structuredContent.result.answer).toBe(42);
    const blocked = await rpc('tools/call', {
      name: 'execute',
      arguments: { code: 'export default async () => fetch("https://example.com")' },
    });
    expect(blocked.result.isError).toBe(true);
    expect(blocked.result.content[0].text).toContain('not permitted');
  });

  test('a deployment starts pending and cannot be approved by the MCP credential', async () => {
    const started = await rpc('tools/call', {
      name: 'execute',
      arguments: { code: 'export default async (sdk) => sdk.workflow.start()' },
    });
    const deployment = started.result.structuredContent.result;
    expect(deployment.state).toBe('pending');
    const response = await fetch(`${url}/approve`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: deployment.id }),
    });
    expect(response.status).toBe(401);
    const status = await rpc('tools/call', {
      name: 'execute',
      arguments: {
        code: `export default async (sdk) => sdk.workflow.status(${JSON.stringify(deployment.id)})`,
      },
    });
    expect(status.result.structuredContent.result.state).toBe('pending');
  });
});
