# Cloudflare Code Mode MCP experiment

A remote MCP server for OpenCode and other MCP clients. It exposes only `search`
and `execute`. Scripts run in Dynamic Workers with outbound networking disabled.
OpenCode's own Code Mode remains enabled.

**Not yet production-ready.** Cloudflare marks `@cloudflare/worker-bundler` as
experimental and not recommended for production. This project has not been tested
against a real Cloudflare account or independently security-audited. Do not deploy
it to a production account without those checks. Dynamic Workers require Workers
Paid; requests, CPU, and unique Worker identities can incur charges.

## Scope

The only privileged capability is a fixed test deployment workflow. It uploads the
bundled fixture to the configured `codemode-test-*` Worker, waits for a separate
human approval, and checks the Worker's settings. It cannot read the local workspace,
access arbitrary Cloudflare API endpoints, or choose a target. The sandbox is not
a general MCP proxy.

The two tools are:

- `search({ query: "workflow" })`: returns TypeScript declarations for the SDK.
- `execute({ code })`: executes an ES module with a default async function.

Example code:

```ts
export default async (sdk) => {
  return await sdk.workflow.start();
};
```

The returned ID identifies the workflow. Retrieve its status with:

```ts
export default async (sdk) => {
  return await sdk.workflow.status("WORKFLOW_ID");
};
```

Each sandbox Worker is keyed by a hash of the compiled code and its configuration,
scoped to the single configured operator. Cloudflare can recycle isolates at any
time; isolate memory is not durable. Reusing an ID can also reuse memory, so do not
use this single-operator design for separate tenants. A generated script has no
direct network access, but it can call the explicitly supplied workflow capability.
MCP responses are limited to 64 KiB; scripts to 32 KiB; requests to 64 KiB.

## Local setup

Install dependencies with `bun install`. Use a `.dev.vars` file for local-only
secrets; never commit it. Set three distinct values:

```dotenv
MCP_TOKEN="a-long-random-mcp-secret"
APPROVAL_TOKEN="a-different-long-random-human-secret"
CLOUDFLARE_API_TOKEN="a-scoped-cloudflare-api-token"
```

For real deployment, set `TARGET_ACCOUNT_ID` and `TARGET_WORKER_NAME` in
`wrangler.jsonc`. The name must start with `codemode-test-`. Use a dedicated
account and the narrowest Workers edit/read token available. Verify the account,
target, and API permissions before deploying. Configure the two rate-limit
namespace IDs so they do not collide with other Workers in your account.

Run `bun run dev` for local development. Rate limits are approximate and apply
per Cloudflare location; they are not a global spending cap. Use Cloudflare
account spending controls and additional WAF/Access controls before exposure.

## Human approval

`workflow.start()` only creates a pending request. Read its ID, target, and
fixture version before approval. The workflow waits up to one day. A human with
the **separate** `APPROVAL_TOKEN` sends a POST to `/approve` with
`{"id":"WORKFLOW_ID"}` and an `Authorization: Bearer ...` header. Keep this
credential off the OpenCode machine and out of model context. A person must use
their own trusted client to submit the request; an MCP credential cannot approve.

Each approval is tied to the workflow ID, target account, Worker name, and fixture
version. The Durable Object records the deployment as `unknown` **before** the
external write. It will not issue that write again after a crash or uncertain
response. An `unknown` result requires manual investigation; do not automatically
retry. If an approval request fails before the workflow receives the event, the
human can resend it while the deployment is still approved.

Changing the dynamic workflow source changes its ID. This prototype does not keep
older runner versions; do not update it while workflows are waiting. A production
version needs immutable versioned runners and a retention policy.

## OpenCode configuration

Copy `opencode.example.json` into the appropriate OpenCode V2 configuration and
replace the URL. Set `CODEMODE_MCP_TOKEN` in OpenCode's environment. The example
does not set `codemode: false`: OpenCode's default Code Mode stays enabled.
Remote scripts can compose only this server's SDK operations, not OpenCode's
local tools.

## Verification

`bun run typecheck`, `bun test`, and `bunx wrangler deploy --dry-run` check the
project without deploying. Integration tests require a running local Worker:

```sh
bunx wrangler dev --local --port 18788 \
  --var MCP_TOKEN:testing-mcp-token \
  --var APPROVAL_TOKEN:testing-approval-token \
  --var CLOUDFLARE_API_TOKEN:testing-cloudflare-token \
  --var TARGET_ACCOUNT_ID:invalid \
  --var TARGET_WORKER_NAME:codemode-test-fixture
```

In another terminal run:

```sh
TEST_WORKER_URL=http://127.0.0.1:18788 bun test
```

The invalid account ID prevents this local test configuration from issuing a
deployment. Do not point these tests at a real deployment.
