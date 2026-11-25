import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import type { Env } from './env';
import { execute } from './sandbox';
import { sdkDefinitions } from './sandbox-sdk';

export async function handleMcp(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const server = new McpServer({ name: 'remote-code', version: '0.1.0' });
  server.registerTool(
    'search',
    {
      description: 'Find the sandbox SDK TypeScript definitions. Search for workflow.',
      inputSchema: { query: z.string().max(200) },
      outputSchema: { definitions: z.string() },
    },
    async ({ query }) => {
      const definitions = /workflow|deploy|status|start|sdk/i.test(query) ? sdkDefinitions : '';
      return {
        structuredContent: { definitions },
        content: [{ type: 'text', text: definitions }],
      };
    },
  );
  server.registerTool(
    'execute',
    {
      description:
        'Execute an ES module with a default async function taking the SDK. Network is blocked.',
      inputSchema: { code: z.string().min(1).max(32768) },
      outputSchema: { result: z.unknown() },
    },
    async ({ code }) => {
      try {
        const result = await execute(code, env, ctx);
        return {
          structuredContent: { result },
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            { type: 'text', text: error instanceof Error ? error.message : 'Execution failed' },
          ],
        };
      }
    },
  );
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}
