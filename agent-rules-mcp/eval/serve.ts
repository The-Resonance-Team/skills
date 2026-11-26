import { handleMcp } from '../src/mcp-server';
import type { Env } from '../src/types';
import { cases } from './cases';
import { fixtureAi } from './fixture-ai';

const port = Number(process.env.EVAL_PORT ?? 18790);
const token = process.env.AGENT_RULES_MCP_TOKEN ?? 'testing-agent-rules-token';

// Adapter boundary: evaluation grants read-only scope and never calls a write binding.
const env = { AI: fixtureAi } as Env;

Bun.serve({
  port,
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/ready') return Response.json({ cases: cases.length });
    if (path !== '/mcp') return new Response('Not found', { status: 404 });
    if (token.length === 0 || request.headers.get('authorization') !== `Bearer ${token}`) {
      return new Response('Unauthorized', { status: 401 });
    }
    return handleMcp(request, env, { scope: ['rules:read'] });
  },
});

console.error(`eval worker ready on ${port}`);
