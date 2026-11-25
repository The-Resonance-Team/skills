import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';

import { getContent, getMetadata, maxMatches, searchAi } from './search';
import type { Env } from './types';

function text(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value) }] };
}

function failure(error: unknown) {
  return {
    isError: true,
    content: [
      {
        type: 'text' as const,
        text: error instanceof Error ? error.message : 'Rule lookup failed',
      },
    ],
  };
}

export async function handleMcp(request: Request, env: Env): Promise<Response> {
  const server = new McpServer({ name: 'team-rules', version: '0.1.0' });

  server.registerTool(
    'search_ai',
    {
      description:
        'Call this before any code change. Finds the team rules and workflows relevant to the task by meaning. Returns at most five IDs with scores; then call get_metadata or get.',
      inputSchema: {
        query: z.string().min(1).max(500),
        limit: z.number().int().min(1).max(maxMatches).optional(),
      },
      outputSchema: {
        matches: z.array(
          z.object({ id: z.string(), kind: z.string(), scope: z.string(), score: z.number() }),
        ),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, limit }) => {
      try {
        const matches = await searchAi(query, env.AI, limit);
        return { structuredContent: { matches }, ...text({ matches }) };
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'get_metadata',
    {
      description:
        'Call this after search_ai to inspect rule IDs, scope, source path and related rules without loading rule text. Omit id to list all 29 entries.',
      inputSchema: { id: z.string().max(64).optional() },
      outputSchema: {
        metadata: z.array(
          z.object({
            id: z.string(),
            kind: z.string(),
            path: z.string(),
            scope: z.string(),
            related: z.array(z.string()),
            references: z.array(z.string()),
          }),
        ),
      },
      annotations: { readOnlyHint: true },
    },
    ({ id }) => {
      try {
        const found = getMetadata(id);
        const metadata = Array.isArray(found) ? found : [found];
        return { structuredContent: { metadata }, ...text({ metadata }) };
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'get',
    {
      description:
        'Call this to load the full markdown of one rule or workflow. Use an ID from search_ai or get_metadata. Long files are truncated with a flag.',
      inputSchema: { id: z.string().max(64) },
      outputSchema: {
        id: z.string(),
        path: z.string(),
        content: z.string(),
        truncated: z.boolean(),
      },
      annotations: { readOnlyHint: true },
    },
    ({ id }) => {
      try {
        const result = getContent(id);
        return { structuredContent: result, ...text(result) };
      } catch (error) {
        return failure(error);
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
