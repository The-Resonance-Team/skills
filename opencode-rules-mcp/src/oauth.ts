import {
  AuthorizationError,
  CimdFetchError,
  OAuthProvider,
  type OAuthHelpers,
  insufficientScope,
} from '@cloudflare/workers-oauth-provider';

import { handleDashboard } from './dashboard';
import { handleMcp, type CallerAuth } from './mcp-server';
import { dashboardRecord } from './patches';
import { s256 } from './auth-tokens';
import type { Env } from './types';

type ProviderEnv = Env & { OAUTH_PROVIDER?: OAuthHelpers };

type AuthProps = { email?: string };

function authorizeUrl(env: Env, state: string, challenge: string): string {
  const url = new URL(env.ACCESS_AUTHORIZATION_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', env.ACCESS_CLIENT_ID);
  url.searchParams.set('redirect_uri', `${env.PUBLIC_URL}/callback`);
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

async function exchangeCode(env: Env, code: string, verifier: string): Promise<string | null> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: verifier,
    client_id: env.ACCESS_CLIENT_ID,
    client_secret: env.ACCESS_CLIENT_SECRET,
    redirect_uri: `${env.PUBLIC_URL}/callback`,
  });
  const response = await fetch(env.ACCESS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) return null;
  const tokens = (await response.json()) as { access_token?: string };
  return tokens.access_token ?? null;
}

async function userInfo(env: Env, accessToken: string): Promise<AuthProps> {
  const response = await fetch(env.ACCESS_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return {};
  const info = (await response.json()) as { email?: string };
  return { email: info.email };
}

const defaultHandler = {
  async fetch(request: Request, env: ProviderEnv): Promise<Response> {
    const dashboard = await handleDashboard(request, env);
    if (dashboard !== null) return dashboard;
    const url = new URL(request.url);
    const oauth = env.OAUTH_PROVIDER;
    if (oauth === undefined) return new Response('OAuth provider missing', { status: 500 });
    if (url.pathname === '/authorize') {
      try {
        if (request.method === 'GET') {
          const authRequest = await oauth.parseAuthRequest(request);
          const details = await oauth.describeConsent(authRequest);
          const consent = await oauth.beginConsent(authRequest);
          const page = new URL('/consent.html', request.url);
          page.searchParams.set('handle', consent.handle);
          page.searchParams.set('name', details.clientName);
          page.searchParams.set('redirect', details.redirectHost);
          page.searchParams.set('domain', details.clientDomain ?? '');
          page.searchParams.set('scopes', details.scope.join(' '));
          page.searchParams.set('loopback', details.redirectIsLoopback ? '1' : '0');
          consent.headers.set('Location', page.toString());
          return new Response(null, { status: 302, headers: consent.headers });
        }
        const form = await request.formData();
        const handle = String(form.get('handle') ?? '');
        if (form.get('decision') !== 'approve') {
          const denied = await oauth.denyConsent(request, handle);
          return new Response(null, { status: 302, headers: denied.headers });
        }
        const approved = await oauth.approveConsent(request, handle, {
          scope: form.getAll('scope').map(String),
        });
        const verifier = `${crypto.randomUUID()}${crypto.randomUUID()}`;
        const challenge = await s256(verifier);
        const upstream = await oauth.beginUpstream(approved.request, { data: { verifier } });
        upstream.headers.set('Location', authorizeUrl(env, upstream.state, challenge));
        return new Response(null, { status: 302, headers: upstream.headers });
      } catch (error) {
        if (error instanceof AuthorizationError && error.redirectTo) {
          return Response.redirect(error.redirectTo, 302);
        }
        if (error instanceof AuthorizationError || error instanceof CimdFetchError) {
          return new Response('Authorization failed', { status: 400 });
        }
        throw error;
      }
    }
    if (url.pathname === '/callback') {
      const finished = await oauth.finishUpstream<{ verifier: string }>(request);
      const code = url.searchParams.get('code');
      if (code === null || url.searchParams.get('error') !== null) {
        finished.headers.set('Location', 'https://opencode.ai/');
        return new Response(null, { status: 302, headers: finished.headers });
      }
      const accessToken = await exchangeCode(env, code, finished.data.verifier);
      if (accessToken === null) {
        return new Response('Upstream token exchange failed', { status: 502 });
      }
      const props = await userInfo(env, accessToken);
      if (props.email === undefined) {
        return new Response('Upstream identity lookup failed', { status: 502 });
      }
      const completed = await oauth.completeAuthorization({
        request: finished.request,
        userId: props.email,
        metadata: {},
        scope: finished.request.scope,
        props,
      });
      finished.headers.set('Location', completed.redirectTo);
      return new Response(null, { status: 302, headers: finished.headers });
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const token = url.searchParams.get('token') ?? '';
      if ((await dashboardRecord(env.OAUTH_KV, token)) === null) {
        return new Response('Invalid or expired dashboard token', { status: 401 });
      }
    }
    return env.ASSETS.fetch(request);
  },
};

const writeTools = new Set(['propose_rule_patch', 'apply_rule_patch']);

type RpcCall = { method?: string; params?: { name?: string } };

const apiHandler = {
  async fetch(request: Request, env: Env, ctx: { auth: { scope: string[] }; props: AuthProps }) {
    const granted =
      ctx.auth.scope.length === 0 && ctx.props.email === 'static-token'
        ? ['rules:read']
        : ctx.auth.scope;
    const needed = ['rules:read'];
    // Adapter boundary: the provider types require a full auth record; our handler needs only scope.
    if (!needed.every((scope) => granted.includes(scope))) {
      return insufficientScope({ ...ctx.auth, scope: granted } as never, needed);
    }
    let calls: RpcCall[] = [];
    if (request.method === 'POST') {
      try {
        const parsed = (await request.clone().json()) as RpcCall | RpcCall[];
        calls = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        calls = [];
      }
    }
    const wantsWrite = calls.some(
      (call) => call.method === 'tools/call' && writeTools.has(call.params?.name ?? ''),
    );
    if (wantsWrite && !granted.includes('rules:write')) {
      return insufficientScope({ ...ctx.auth, scope: granted } as never, ['rules:write']);
    }
    const auth: CallerAuth = { scope: granted };
    return handleMcp(request, env, auth);
  },
};

export function createProvider(env: Env): OAuthProvider<ProviderEnv> {
  const resource = env.PUBLIC_URL.replace(/\/$/, '');
  return new OAuthProvider<ProviderEnv>({
    apiRoute: '/mcp',
    // Adapter boundary: the SDK handler type does not expose the provider's augmented context.
    apiHandler: apiHandler as never,
    defaultHandler,
    authorizeEndpoint: '/authorize',
    tokenEndpoint: '/oauth/token',
    clientRegistrationEndpoint: '/oauth/register',
    resourceMetadata: {
      resource: `${resource}/mcp`,
      authorization_servers: [resource],
    },
    requiredScopes: ['rules:read'],
    scopesSupported: ['rules:read', 'rules:write', 'offline_access'],
    clientIdMetadataDocumentEnabled: true,
    resolveExternalToken: async ({ token, request, env: tokenEnv }) => {
      if (token !== tokenEnv.MCP_TOKEN) return null;
      void request;
      return {
        props: { email: 'static-token' },
        audience: `${tokenEnv.PUBLIC_URL.replace(/\/$/, '')}/mcp`,
      };
    },
  });
}
