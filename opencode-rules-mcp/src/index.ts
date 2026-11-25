import { route } from './http';
import type { Env } from './types';

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return route(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
