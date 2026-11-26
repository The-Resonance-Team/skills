import type { Deployment } from './deployment';

export interface Env {
  LOADER: WorkerLoader;
  WORKFLOWS: Workflow;
  REQUEST_LIMIT: RateLimit;
  START_LIMIT: RateLimit;
  DEPLOYMENTS: DurableObjectNamespace<Deployment>;
  MCP_TOKEN: string;
  APPROVAL_TOKEN: string;
  CLOUDFLARE_API_TOKEN: string;
  TARGET_ACCOUNT_ID: string;
  TARGET_WORKER_NAME: string;
}
