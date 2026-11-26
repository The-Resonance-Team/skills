import { authorizeUrl, exchangeCode, userInfo } from './access-oidc';
import { newToken, s256, sha256 } from './auth-tokens';
import { reviewerSchema, type Reviewer } from './contracts';
import { dayMs } from './deadlines';
import { noStoreHeaders } from './http-headers';
import type { Env } from './types';

export type ReviewAuth = { expiresAt: number } & (
  | { kind: 'login'; verifier: string; browser: string }
  | { kind: 'session'; reviewer: Reviewer }
);

const sessionCookie = '__Host-reviewer';
const stateCookie = '__Host-review-state';

function cookie(request: Request, name: string): string {
  return (
    (request.headers.get('cookie') ?? '')
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? ''
  );
}

function allowed(env: Env, email: string): boolean {
  return (env.REVIEWER_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

export async function reviewer(request: Request, env: Env): Promise<Reviewer | null> {
  const token = cookie(request, sessionCookie);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const record = await env.PATCHES.getByName('approvals').authRead(await sha256(token));
  if (record?.kind !== 'session' || !allowed(env, record.reviewer.email)) return null;
  return record.reviewer;
}

export function sameOrigin(request: Request, env: Env): boolean {
  return (
    request.headers.get('origin') === new URL(env.PUBLIC_URL).origin &&
    request.headers.get('sec-fetch-site') !== 'cross-site'
  );
}

export async function reviewLogin(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const store = env.PATCHES.getByName('approvals');
  if (url.pathname === '/review/login' && request.method === 'GET') {
    const state = newToken();
    const browser = newToken();
    const verifier = newToken();
    await store.authPut(await sha256(state), {
      kind: 'login',
      browser: await sha256(browser),
      verifier,
      expiresAt: Date.now() + 600000,
    });
    const responseHeaders = noStoreHeaders();
    responseHeaders.set(
      'Set-Cookie',
      `${stateCookie}=${browser}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
    );
    responseHeaders.set('Location', authorizeUrl(env, `review.${state}`, await s256(verifier)));
    return new Response(null, { status: 302, headers: responseHeaders });
  }
  if (url.pathname !== '/callback' || !url.searchParams.get('state')?.startsWith('review.'))
    return null;
  const state = url.searchParams.get('state')!.slice(7);
  const browser = cookie(request, stateCookie);
  const record = await store.authRead(await sha256(state), true);
  if (record?.kind !== 'login' || record.browser !== (await sha256(browser)))
    return new Response('Invalid reviewer login', { status: 400, headers: noStoreHeaders() });
  const code = url.searchParams.get('code');
  if (!code || url.searchParams.has('error'))
    return new Response('Reviewer sign-in was not completed', {
      status: 400,
      headers: noStoreHeaders(),
    });
  const accessToken = await exchangeCode(env, code, record.verifier);
  if (!accessToken)
    return new Response('Identity exchange failed', { status: 502, headers: noStoreHeaders() });
  const info = await userInfo(env, accessToken);
  const identity = reviewerSchema.safeParse({
    issuer: new URL(env.ACCESS_AUTHORIZATION_URL).origin,
    sub: info.sub,
    email: info.email,
  });
  if (!identity.success || info.email_verified !== true || !allowed(env, identity.data.email))
    return new Response('This identity is not an authorized reviewer', {
      status: 403,
      headers: noStoreHeaders(),
    });
  const token = newToken();
  await store.authPut(await sha256(token), {
    kind: 'session',
    reviewer: identity.data,
    expiresAt: Date.now() + dayMs,
  });
  const responseHeaders = noStoreHeaders();
  responseHeaders.append(
    'Set-Cookie',
    `${sessionCookie}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`,
  );
  responseHeaders.append(
    'Set-Cookie',
    `${stateCookie}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
  );
  responseHeaders.set('Location', `${env.PUBLIC_URL}/`);
  return new Response(null, { status: 302, headers: responseHeaders });
}
