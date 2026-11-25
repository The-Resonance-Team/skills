import { decisionSchema } from './contracts';
import type { Env } from './types';

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status });
}

export async function handleDashboard(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname === '/api/patches') {
    const token = url.searchParams.get('token') ?? '';
    const record = await env.PATCHES.getByName('approvals').dashboard(token);
    if (record === null) return json({ error: 'Invalid or expired dashboard token' }, 401);
    return json(record);
  }
  if (url.pathname === '/api/decide' && request.method === 'POST') {
    const body = decisionSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return json({ error: 'Invalid decision request' }, 400);
    }
    const { token, patchId, decision } = body.data;
    const result = await env.PATCHES.getByName('approvals').decide(token, patchId, decision);
    return json(result, result.ok ? 200 : 403);
  }
  if (url.pathname.startsWith('/approve/')) {
    const token = url.searchParams.get('token') ?? '';
    if ((await env.PATCHES.getByName('approvals').dashboard(token)) === null) {
      return new Response('Invalid or expired approval link', { status: 401 });
    }
    const assetUrl = new URL('/index.html', request.url);
    return env.ASSETS.fetch(assetUrl.toString());
  }
  return null;
}
