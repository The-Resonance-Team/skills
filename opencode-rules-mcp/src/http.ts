import { handleMcp } from './mcp-server';
import type { Env } from './types';

function unauthorized(): Response {
  return new Response('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Bearer' },
  });
}

function authorized(request: Request, token: string): boolean {
  const header = request.headers.get('Authorization') ?? '';
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) return false;
  return header.slice(prefix.length) === token;
}

export async function route(request: Request, env: Env): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path !== '/mcp') return new Response('Not found', { status: 404 });
  if (env.MCP_TOKEN === undefined || env.MCP_TOKEN.length === 0) return unauthorized();
  if (!authorized(request, env.MCP_TOKEN)) return unauthorized();
  return handleMcp(request, env);
}
