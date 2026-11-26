import {
  createDynamicWorkflowEntrypoint,
  wrapWorkflowBinding,
} from '@cloudflare/dynamic-workflows';
import { WorkerEntrypoint } from 'cloudflare:workers';
import { sha256 } from './digest';
import type { Env } from './env';

type WorkflowRunner = import('@cloudflare/dynamic-workflows').WorkflowRunner;

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
  return sha256(
    JSON.stringify({
      runner,
      compatibilityDate: '2026-11-25',
      globalOutbound: null,
      capability: 'deploy-v1',
    }),
  );
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
    if (
      !/^[a-f0-9]{32}$/i.test(account) ||
      account !== record.account ||
      target !== record.target
    ) {
      throw new Error('Deployment target changed');
    }
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${target}/script-settings`,
      { headers: { Authorization: `Bearer ${this.env.CLOUDFLARE_API_TOKEN}` }, redirect: 'error' },
    );
    if (!response.ok) throw new Error(`Status check failed: ${response.status}`);
    const payload: unknown = await response.json();
    if (
      !payload ||
      typeof payload !== 'object' ||
      !('success' in payload) ||
      payload.success !== true
    ) {
      throw new Error('Status check returned an invalid response');
    }
    return { state: 'complete', check: 'settings_available', fixtureVerified: false };
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
    const deployment = this.env.DEPLOYMENTS.getByName(id);
    let record = await deployment.status();
    if (record.state === 'missing') throw new Error('Workflow not found');
    const instance = await this.env.WORKFLOWS.get(id);
    const workflow = await instance.status();
    if (['complete', 'errored', 'terminated'].includes(workflow.status)) {
      await deployment.closeUnconsumed();
      record = await deployment.status();
    }
    return { id, ...record, workflow };
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
    !/^[a-f0-9-]{36}$/.test(body.id) ||
    !('fixtureHash' in body) ||
    typeof body.fixtureHash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(body.fixtureHash)
  ) {
    return new Response('Invalid workflow ID', { status: 400 });
  }
  const deployment = env.DEPLOYMENTS.getByName(body.id);
  const instance = await env.WORKFLOWS.get(body.id);
  const workflow = await instance.status();
  if (['complete', 'errored', 'terminated'].includes(workflow.status)) {
    await deployment.closeUnconsumed();
    return new Response('Workflow is no longer active', { status: 409 });
  }
  if (!(await deployment.approve(body.fixtureHash))) {
    return new Response('Approval does not match the pending deployment', { status: 409 });
  }
  try {
    await instance.sendEvent({ type: 'approved', payload: {} });
  } catch {
    return new Response('Approval delivery unknown; inspect status before retry', { status: 503 });
  }
  return Response.json(await deployment.status());
}
