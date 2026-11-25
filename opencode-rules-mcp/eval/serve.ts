import { route } from '../src/http';
import type { Env } from '../src/types';

import { cases } from './cases';

const vectors = (await Bun.file(`${import.meta.dir}/query-vectors.json`).json()) as Record<
  string,
  string
>;

const zero = Buffer.alloc(256 * 4).toString('base64');

function queryFrom(input: unknown): string {
  const text = (input as { input?: string[] }).input?.[0] ?? '';
  return text.replace(/^task: search result \| query: /, '');
}

const ai = {
  run: async (_model: string, input: unknown) => ({
    data: [{ embedding: vectors[queryFrom(input)] ?? zero }],
  }),
} as unknown as Ai;

const emptyKv = {
  get: async () => null,
  put: async () => undefined,
  delete: async () => undefined,
  list: async () => ({ keys: [] }),
} as unknown as KVNamespace;
const emptyAssets = {
  fetch: async () => new Response('Not found', { status: 404 }),
} as unknown as Fetcher;
const env = {
  AI: ai,
  ASSETS: emptyAssets,
  OAUTH_KV: emptyKv,
  MCP_TOKEN: process.env.RULES_MCP_TOKEN ?? 'testing-rules-token',
  PUBLIC_URL: 'http://127.0.0.1:18790',
  ACCESS_AUTHORIZATION_URL: '',
  ACCESS_TOKEN_URL: '',
  ACCESS_USERINFO_URL: '',
  ACCESS_CLIENT_ID: '',
  ACCESS_CLIENT_SECRET: '',
  GITHUB_TOKEN: '',
  GITHUB_OWNER: '',
  GITHUB_REPO: '',
} as Env;
const ctx = {} as ExecutionContext;
const port = Number(process.env.EVAL_PORT ?? 18790);

Bun.serve({
  port,
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/ready') return Response.json({ cases: cases.length });
    return route(request, env, ctx);
  },
});

console.error(`eval worker ready on ${port}`);
