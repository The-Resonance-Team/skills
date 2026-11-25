import {
  createDynamicWorkflowEntrypoint,
  wrapWorkflowBinding,
} from '@cloudflare/dynamic-workflows';
import type { WorkflowRunner } from '@cloudflare/dynamic-workflows';
import { WorkerEntrypoint } from 'cloudflare:workers';
import type { Env } from './env';

const runner = `
import { WorkflowEntrypoint } from "cloudflare:workers";
export class FixtureWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    await step.waitForEvent("human approval", { type: "approved", timeout: "1 day" });
    const deployment = await step.do("deploy fixture", { retries: { limit: 0, delay: "1 second" } },
      async () => this.env.DEPLOY.deploy(event.instanceId));
    if (deployment.state !== "complete") return deployment;
    return step.do("check fixture", async () => this.env.DEPLOY.verify(event.instanceId));
  }
}
`;
async function runnerId(): Promise<string> {
  const bytes = new TextEncoder().encode(runner);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function loadRunner(env: Env, ctx: ExecutionContext) {
  const id = await runnerId();
  return env.LOADER.get(`workflow:${id}`, async () => ({
    compatibilityDate: '2026-11-25',
    mainModule: 'workflow.js',
    modules: { 'workflow.js': runner },
    env: { DEPLOY: ctx.exports.DeployService({}) },
    globalOutbound: null,
  }));
}

export const DynamicWorkflow = createDynamicWorkflowEntrypoint<Env>(
  async ({ env, ctx, metadata }) => {
    if (metadata.version !== (await runnerId()))
      throw new Error('Workflow version is no longer available');
    // The Worker Loader RPC stub implements the dynamic runner contract.
    return (await loadRunner(env, ctx)).getEntrypoint(
      'FixtureWorkflow',
    ) as unknown as WorkflowRunner;
  },
);

export class DeployService extends WorkerEntrypoint<Env> {
  async deploy(id: string) {
    return this.env.DEPLOYMENTS.getByName(id).deploy();
  }

  async verify(id: string) {
    const record = await this.env.DEPLOYMENTS.getByName(id).status();
    if (record.state !== 'complete') throw new Error('Deployment not complete');
    const account = this.env.TARGET_ACCOUNT_ID;
    const target = this.env.TARGET_WORKER_NAME;
    if (!/^[a-f0-9]{32}$/i.test(account) || target !== record.target) {
      throw new Error('Deployment target changed');
    }
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${target}/settings`,
      { headers: { Authorization: `Bearer ${this.env.CLOUDFLARE_API_TOKEN}` }, redirect: 'error' },
    );
    if (!response.ok) throw new Error(`Status check failed: ${response.status}`);
    return { state: 'complete', verified: true };
  }
}

export class Capabilities extends WorkerEntrypoint<Env> {
  async start() {
    if (!(await this.env.START_LIMIT.limit({ key: 'operator' })).success) {
      throw new Error('Deployment request rate limit exceeded');
    }
    const id = crypto.randomUUID();
    await this.env.DEPLOYMENTS.getByName(id).prepare();
    const binding = wrapWorkflowBinding({ version: await runnerId() });
    await binding.create({ id });
    return { id, ...(await this.env.DEPLOYMENTS.getByName(id).status()) };
  }

  async status(id: string) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid workflow ID');
    const record = await this.env.DEPLOYMENTS.getByName(id).status();
    if (record.state === 'missing') throw new Error('Workflow not found');
    const instance = await this.env.WORKFLOWS.get(id);
    return { id, ...record, workflow: await instance.status() };
  }
}

export async function approve(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid request', { status: 400 });
  }
  if (
    !body ||
    typeof body !== 'object' ||
    !('id' in body) ||
    typeof body.id !== 'string' ||
    !/^[a-f0-9-]{36}$/.test(body.id)
  ) {
    return new Response('Invalid workflow ID', { status: 400 });
  }
  const deployment = env.DEPLOYMENTS.getByName(body.id);
  await deployment.approve();
  const instance = await env.WORKFLOWS.get(body.id);
  await instance.sendEvent({ type: 'approved', payload: {} });
  return Response.json(await deployment.status());
}
