import { createWorker } from '@cloudflare/worker-bundler';
import type { Env } from './env';

const wrapper = `
import run from "./user.js";
export default {
  async fetch(_request, env) {
    const sdk = { workflow: {
      start: () => env.CAP.start(),
      status: (id) => env.CAP.status(id)
    }};
    try {
      const result = await run(sdk);
      const json = JSON.stringify({ result: result === undefined ? null : result });
      if (new TextEncoder().encode(json).byteLength > 65536) throw new Error("Result too large");
      return new Response(json, { headers: { "content-type": "application/json" } });
    } catch (error) {
      return Response.json({ error: String(error).slice(0, 4096) }, { status: 400 });
    }
  }
};`;

export async function execute(code: string, env: Env, ctx: ExecutionContext): Promise<unknown> {
  if (new TextEncoder().encode(code).byteLength > 32768) throw new Error('Script too large');
  const built = await createWorker({
    files: { 'user.ts': code },
    entryPoint: 'user.ts',
    bundle: false,
  });
  const compiled = built.modules[built.mainModule];
  if (typeof compiled !== 'string') throw new Error('Unexpected compiler output');
  const modules = { 'index.js': wrapper, 'user.js': compiled };
  const limits = { cpuMs: 1000, subRequests: 20 };
  const identity = JSON.stringify({
    principal: 'operator',
    modules,
    capability: 'workflow-v1',
    compatibilityDate: '2026-11-25',
    globalOutbound: null,
    limits,
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  const worker = env.LOADER.get(`sandbox:${hash}`, async () => ({
    compatibilityDate: '2026-11-25',
    mainModule: 'index.js',
    modules,
    env: { CAP: ctx.exports.Capabilities({}) },
    limits,
    globalOutbound: null,
  }));
  const response = await worker.getEntrypoint().fetch('https://sandbox.invalid/', {
    signal: AbortSignal.timeout(15000),
  });
  const value: unknown = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(value));
  if (!value || typeof value !== 'object' || !('result' in value)) {
    throw new Error('Invalid sandbox response');
  }
  return value.result;
}
