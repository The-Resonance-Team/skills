import { createProvider } from './oauth';
import type { Env } from './types';

export async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const provider = createProvider(env);
  return provider.fetch(request, env, ctx);
}
