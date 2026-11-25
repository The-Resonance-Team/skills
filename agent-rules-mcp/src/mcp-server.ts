import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';

import { sha256 } from './auth-tokens';
import type { PatchDraft } from './contracts';
import { catalog, getContent, getMetadata, maxMatches, searchAi } from './search';
import type { Env } from './types';

export type CallerAuth = { scope: string[]; clientId?: string; subject?: string };

function text(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value) }] };
}

function requireWrite(auth: CallerAuth): void {
  if (!auth.scope.includes('rules:write')) {
    throw new Error('This tool requires OAuth scope rules:write');
  }
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

export async function handleMcp(request: Request, env: Env, auth: CallerAuth): Promise<Response> {
  const server = new McpServer({ name: 'team-rules', version: '0.1.0' });

  server.registerTool(
    'search_ai',
    {
      description:
        'Call this before any code change. Finds the team rules and workflows relevant to the task by meaning. Returns at most five IDs with scores and a semantic or lexical mode; then call get_metadata or get.',
      inputSchema: {
        query: z.string().min(1).max(500),
        limit: z.number().int().min(1).max(maxMatches).optional(),
      },
      outputSchema: {
        matches: z.array(
          z.object({ id: z.string(), kind: z.string(), scope: z.string(), score: z.number() }),
        ),
        mode: z.enum(['semantic', 'lexical']),
        warning: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, limit }) => {
      try {
        const result = await searchAi(query, env.AI, limit);
        return { structuredContent: result, ...text(result) };
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

  server.registerTool(
    'propose_rule_patch',
    {
      description:
        'Call this to propose a change to a rule or workflow. Requires rules:write. Stores a draft and opens the approval dashboard; no pull request is created until a human approves.',
      inputSchema: {
        id: z.string().max(64),
        summary: z.string().min(1).max(500),
        content: z.string().min(1).max(200000),
      },
      outputSchema: {
        id: z.string(),
        digest: z.string(),
        dashboardUrl: z.string(),
      },
    },
    async ({ id, summary, content }) => {
      try {
        requireWrite(auth);
        const entry = catalog.entries.find((item) => item.id === id);
        if (entry === undefined) throw new Error(`Unknown rule ID: ${id}`);
        const requestKey = [auth.clientId ?? '', auth.subject ?? '', id, summary, content].join(
          '\u0000',
        );
        const patchId = (await sha256(requestKey)).slice(0, 16);
        const draft: PatchDraft = {
          id: patchId,
          path: entry.path,
          before: entry.content,
          after: content,
          summary,
          digest: await sha256(`${entry.path}\n${entry.content}\n${content}`),
          status: 'pending',
          createdAt: new Date().toISOString(),
        };
        await env.PATCHES.getByName('approvals').propose(draft);
        const value = {
          id: patchId,
          digest: draft.digest,
          dashboardUrl: `${env.PUBLIC_URL}/approve/${patchId}`,
        };
        return { structuredContent: value, ...text(value) };
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'apply_rule_patch',
    {
      description:
        'Call this only after a human approved a patch in the dashboard. Requires rules:write and a one-use approval ID. Opens a draft pull request; never pushes to main.',
      inputSchema: { patchId: z.string().max(64), approvalId: z.string().max(64) },
      outputSchema: {
        patchId: z.string(),
        state: z.string(),
        pullRequestUrl: z.string().optional(),
        message: z.string().optional(),
      },
    },
    async ({ patchId, approvalId }) => {
      try {
        requireWrite(auth);
        const patch = await env.PATCHES.getByName('approvals').claim(approvalId, patchId);
        if (patch === null) {
          throw new Error('Approval is invalid, used, or does not match the patch');
        }
        const value = {
          patchId,
          state: patch.status,
          ...(patch.pullRequestUrl ? { pullRequestUrl: patch.pullRequestUrl } : {}),
          ...(patch.message ? { message: patch.message } : {}),
        };
        return { structuredContent: value, ...text(value) };
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
