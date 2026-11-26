import { DynamicWorkflowBinding } from '@cloudflare/dynamic-workflows';
import { Deployment } from './deployment';
import type { Env } from './env';
import { route } from './http';
import { handleMcp } from './mcp-server';
import { approve, Capabilities, DeployService, DynamicWorkflow } from './workflow';

export { Capabilities, Deployment, DeployService, DynamicWorkflow, DynamicWorkflowBinding };

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (!env.MCP_TOKEN || !env.APPROVAL_TOKEN || env.MCP_TOKEN === env.APPROVAL_TOKEN) {
      return Promise.resolve(new Response('Server not configured', { status: 503 }));
    }
    return route(request, env.MCP_TOKEN, env.APPROVAL_TOKEN, {
      mcp: async (incoming) => {
        if (!(await env.REQUEST_LIMIT.limit({ key: 'operator' })).success) {
          return new Response('Rate limit exceeded', { status: 429 });
        }
        return handleMcp(incoming, env, ctx);
      },
      approve: (incoming) => approve(incoming, env),
    });
  },
};
