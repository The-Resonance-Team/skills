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

const env: Env = { AI: ai, MCP_TOKEN: process.env.RULES_MCP_TOKEN ?? 'testing-rules-token' };
const port = Number(process.env.EVAL_PORT ?? 18790);

Bun.serve({
  port,
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/ready') return Response.json({ cases: cases.length });
    return route(request, env);
  },
});

console.error(`eval worker ready on ${port}`);
