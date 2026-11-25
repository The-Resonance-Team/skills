import type { Env } from './types';

async function digest(value: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
}

function constantTime(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let different = 0;
  for (let index = 0; index < left.length; index += 1) {
    different |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return different === 0;
}

export async function matchesBearer(request: Request, env: Env): Promise<boolean> {
  const header = request.headers.get('Authorization') ?? '';
  if (!header.startsWith('Bearer ')) return false;
  const supplied = header.slice(7);
  const [left, right] = await Promise.all([digest(supplied), digest(env.MCP_TOKEN)]);
  return constantTime(
    Array.from(new Uint8Array(left)).join(','),
    Array.from(new Uint8Array(right)).join(','),
  );
}

export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function tokenDigest(value: string): Promise<string> {
  const bytes = new Uint8Array(await digest(value));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256(value: string): Promise<string> {
  return tokenDigest(value);
}

export async function s256(value: string): Promise<string> {
  const bytes = new Uint8Array(await digest(value));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
