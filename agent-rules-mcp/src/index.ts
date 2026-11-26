import { route } from './http';
import type { Env } from './types';

export { ApprovalStore } from './patches';

export default {
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    await env.PATCHES.getByName('approvals').repairAlarms();
  },
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return route(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
