import type { Env } from './types';
import { z } from 'zod';

export function authorizeUrl(env: Env, state: string, challenge: string): string {
  const url = new URL(env.ACCESS_AUTHORIZATION_URL);
  for (const [key, value] of Object.entries({
    response_type: 'code',
    client_id: env.ACCESS_CLIENT_ID,
    redirect_uri: `${env.PUBLIC_URL}/callback`,
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }))
    url.searchParams.set(key, value);
  return url.toString();
}

export async function exchangeCode(
  env: Env,
  code: string,
  verifier: string,
): Promise<string | null> {
  const response = await fetch(env.ACCESS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      client_id: env.ACCESS_CLIENT_ID,
      client_secret: env.ACCESS_CLIENT_SECRET,
      redirect_uri: `${env.PUBLIC_URL}/callback`,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) return null;
  const tokens = (await response.json()) as { access_token?: string };
  return tokens.access_token ?? null;
}

export async function userInfo(
  env: Env,
  token: string,
): Promise<{ email?: string; sub?: string; email_verified?: boolean }> {
  const response = await fetch(env.ACCESS_USERINFO_URL, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) return {};
  return z
    .object({
      email: z.email().optional(),
      sub: z.string().optional(),
      email_verified: z.boolean().optional(),
    })
    .parse(await response.json());
}
