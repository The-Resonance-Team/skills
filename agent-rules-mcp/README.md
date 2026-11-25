# Rules MCP server

A Cloudflare Worker that serves the team rule modules and workflows over MCP.
It replaces raw-URL fetching with semantic discovery and exact retrieval. It
does not inject rule files at session start.

## Tools

- `search_ai(query, limit?)` — returns at most five IDs with similarity scores.
- `get_metadata(id?)` — returns IDs, scope, source path, semantic neighbours and
  citation links. No rule body.
- `get(id)` — returns one full rule or workflow, capped at 51,200 bytes.
- `propose_rule_patch(id, summary, content)` — requires `rules:write`. Stores a
  draft, returns an approval dashboard URL and token. No PR yet.
- `apply_rule_patch(patchId, approvalId)` — requires `rules:write`. Consumes a
  human approval and opens a draft PR from `rules-mcp/<id>` to `main`.

Rule IDs are stable logical names. Workflow IDs start with `wf-`. The file path
is metadata, not the ID.

## Auth

The Worker is the OAuth authorization server and the resource server. Cloudflare
Access signs the human in; the Worker issues tokens with `rules:read` and
`rules:write`. OpenCode uses CIMD with DCR fallback, so a new device needs no
client secret. The static bearer token stays read-only for CI and subagents.
See ADR 0003.

## Approval dashboard

`ui/` is an Astryx 0.7.17 app built to `ui/dist` and served by the same Worker.
After a proposal, `plugin/` opens the dashboard in the browser. The dashboard
lists undecided, approved and denied patches with diffs. A decision creates a
one-use approval bound to the patch digest. The dashboard token expires in one
day or when all patches are decided. See ADR 0004.

## Layout

- `src/` — Worker entry, OAuth, HTTP routes, MCP tools, ranking, patch state.
- `scripts/build-catalog.ts` — builds `generated/catalog.json`.
- `generated/` — committed catalog, embedding store and build inputs.
- `ui/` — Astryx approval dashboard.
- `plugin/` — OpenCode plugin that opens the dashboard.
- `eval/` — ten real use cases and the benchmark runner.
- `docs/adr/` — decisions.

## Local setup

```sh
bun install
cp .dev.vars.example .dev.vars   # set MCP_TOKEN
(cd ui && bun install && bun run build)
bun run build                    # needs Cloudflare AI credentials
bun run dev
```

The builder embeds only new or changed entries. `AGENT_RULES_EMBEDDINGS_FILE` can
supply vectors from another runner.

## OpenCode

Copy `opencode.example.json` into your OpenCode config. The `agent-rules-mcp`
entry uses OAuth with `scope: rules:read rules:write`; run
`opencode mcp auth agent-rules-mcp` once on a new device. There is no CI MCP
entry: CI and eval use the read-only static token through the
`AGENT_RULES_MCP_TOKEN` environment variable, not through OpenCode. See ADR
0002. Verify with `opencode mcp list`; it must print `agent-rules-mcp connected`.
Keep the profile as an eager instruction; `CONTEXT.md` stays lazy in the MCP.

## Limits

- Workers Free: 100,000 requests/day, 10 ms CPU per request.
- Workers AI Free: 10,000 Neurons/day.
- KV Free: 1,000 writes/day to different keys, 1 write/second to the same key.
- No Vectorize, Dynamic Worker, workflow, or Durable Object.

## Verification

```sh
bun fmt --check
bun run lint
bun run typecheck
bun test
bun run build:check
(cd ui && bun run build && bunx astryx doctor --built dist)
bunx wrangler deploy --dry-run

The `.oxlintrc.json` override for `ui/src/pages/dashboard.tsx` is deliberately
scoped: the Astryx page template is longer than the 300-line cap, and its
render props create arrays and callbacks inline. Astryx's own `doctor` checks
component props and purity for this file.
```

## Evaluation

`eval/cases.ts` holds ten real task queries with expected rule IDs. Start
`bun eval/serve.ts`, then run `bun run eval`.

## CD

`.github/workflows/deploy-agent-rules-mcp.yml` builds the dashboard and catalog, then
deploys on a push to `main` touching rule content or this project. Repo secrets:
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `AGENT_RULES_MCP_TOKEN`,
`ACCESS_CLIENT_SECRET`, and `AGENT_RULES_GITHUB_TOKEN` (fine-grained PAT with
Contents:write and Pull requests:write on this repo). Access endpoints and
client ID are vars in `wrangler.jsonc`.
