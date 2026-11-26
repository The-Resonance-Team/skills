import { decisionSchema } from './contracts';
import { noStoreHeaders } from './http-headers';
import { reviewer, reviewLogin, sameOrigin } from './reviewer';
import type { Env } from './types';

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: noStoreHeaders() });
}

export async function handleDashboard(request: Request, env: Env): Promise<Response | null> {
  const login = await reviewLogin(request, env);
  if (login) return login;
  const url = new URL(request.url);
  const isPage =
    url.pathname === '/' || url.pathname === '/index.html' || url.pathname.startsWith('/approve/');
  if (!isPage && !url.pathname.startsWith('/api/')) return null;
  const identity = await reviewer(request, env);
  if (!identity) {
    if (isPage) return Response.redirect(`${env.PUBLIC_URL}/review/login`, 302);
    return json({ error: 'Reviewer sign-in required', loginUrl: '/review/login' }, 401);
  }
  const store = env.PATCHES.getByName('approvals');
  if (request.method !== 'GET' && !sameOrigin(request, env))
    return json({ error: 'Cross-origin request rejected' }, 403);
  if (url.pathname === '/api/renew' && request.method === 'POST') {
    await store.renew(identity);
    return json(await store.dashboard());
  }
  if (url.pathname === '/api/migrate' && request.method === 'POST') {
    const cursor = url.searchParams.get('cursor') ?? undefined;
    const verify = url.searchParams.get('verify') === '1';
    const page = await env.OAUTH_KV.list({
      limit: 50,
      ...(cursor === undefined ? {} : { cursor }),
    });
    const loaded = await Promise.all(
      page.keys
        .filter((key) => /^(patch|approval):/.test(key.name))
        .map(async (key) => ({ key: key.name, value: await env.OAUTH_KV.get(key.name, 'json') })),
    );
    const records = loaded
      .filter((record) => record.value !== null)
      .map((record) => ({ key: record.key, value: record.value }));
    const complete = page.list_complete;
    const nextCursor = complete ? undefined : page.cursor;
    const status = await store.importLegacy(records, nextCursor, verify);
    return json({ ...status, nextCursor: nextCursor ?? null });
  }
  if (url.pathname === '/api/patches' && request.method === 'GET') {
    const board = await store.dashboard();
    return board ? json(board) : json({ error: 'Review access expired; renew access' }, 403);
  }
  if (url.pathname === '/api/decide' && request.method === 'POST') {
    const body = decisionSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return json({ error: 'Invalid decision request' }, 400);
    const result = await store.decide(body.data.patchId, body.data.decision, identity);
    return json(result, result.ok ? 200 : 409);
  }
  if (isPage) return env.ASSETS.fetch(new URL('/index.html', env.PUBLIC_URL).toString());
  return json({ error: 'Not found' }, 404);
}
