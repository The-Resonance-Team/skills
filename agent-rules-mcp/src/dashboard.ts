import { dashboardRecord, decidePatch, listPatches } from './patches';
import type { Env } from './types';

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status });
}

export async function handleDashboard(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname === '/api/patches') {
    const token = url.searchParams.get('token') ?? '';
    const record = await dashboardRecord(env.OAUTH_KV, token);
    if (record === null) return json({ error: 'Invalid or expired dashboard token' }, 401);
    const patches = await listPatches(env.OAUTH_KV);
    return json({ patches: patches.filter((patch) => record.patchIds.includes(patch.id)) });
  }
  if (url.pathname === '/api/decide' && request.method === 'POST') {
    const body = (await request.json()) as { token?: string; patchId?: string; decision?: string };
    if (
      body.token === undefined ||
      body.patchId === undefined ||
      (body.decision !== 'approved' && body.decision !== 'denied')
    ) {
      return json({ error: 'Invalid decision request' }, 400);
    }
    const result = await decidePatch(env.OAUTH_KV, body.token, body.patchId, body.decision);
    return json(result, result.ok ? 200 : 403);
  }
  if (url.pathname.startsWith('/approve/')) {
    const token = url.searchParams.get('token') ?? '';
    if ((await dashboardRecord(env.OAUTH_KV, token)) === null) {
      return new Response('Invalid or expired approval link', { status: 401 });
    }
    const assetUrl = new URL('/index.html', request.url);
    return env.ASSETS.fetch(assetUrl.toString());
  }
  return null;
}
