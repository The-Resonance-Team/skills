# Rules MCP server

A small Cloudflare Worker that serves the team rule modules and workflows over
MCP. It replaces raw-URL fetching with semantic discovery and exact retrieval.
It does not inject rule files at session start.

## Tools

- `search_ai(query, limit?)` — returns at most five IDs with similarity scores.
  Call it before a code change.
- `get_metadata(id?)` — returns IDs, scope, source path, semantic neighbours
  and citation links. No rule body.
- `get(id)` — returns one full rule or workflow, capped at 51,200 bytes.

Rule IDs are stable logical names. Workflow IDs start with `wf-`. The file path
is metadata, not the ID, so a file rename does not break saved queries.

## Layout

- `src/` — Worker entry, HTTP auth, MCP tools, ranking.
- `scripts/build-catalog.ts` — builds `generated/catalog.json` from
  `CONTEXT.md` and the module files.
- `generated/` — committed catalog, embedding store, and build inputs.
- `eval/` — ten real use cases, local eval server and benchmark runner.
- `docs/adr/` — decisions; see ADR 0001 for the layout reference.

## Local setup

```sh
bun install
cp .dev.vars.example .dev.vars   # set MCP_TOKEN
bun run build                    # needs Cloudflare AI credentials
bun run dev
```

The builder needs `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` when a
retrieval text changes. It embeds only new or changed entries. Existing
vectors are reused by digest. `RULES_EMBEDDINGS_FILE` can supply vectors from
another runner; this is how the committed store was bootstrapped through the
Cloudflare MCP.

## OpenCode

Copy `opencode.example.json` into your OpenCode config and set
`RULES_MCP_TOKEN` in the environment. Keep the Code Mode server separate.
Remove the `CONTEXT.md` URL from `instructions[]`; keep the profile. The tool
descriptions carry the "when to call" instruction.

## Limits

- Workers Free: 100,000 requests/day, 10 ms CPU per request.
- Workers AI Free: 10,000 Neurons/day. A short query uses a small fraction.
- No Vectorize index, Dynamic Worker, workflow, or Durable Object.
- Tool schemas are in context on every request. Keep the three descriptions
  short and do not add a fourth tool without a measured reason.

## Verification

```sh
bun fmt --check
bun run lint
bun run typecheck
bun test
bun run build:check
bunx wrangler deploy --dry-run
```

## Evaluation

`eval/cases.ts` holds ten real task queries with expected rule IDs. Start
`bun eval/serve.ts`, then run `bun run eval`. The report compares semantic
search with a lexical baseline on recall@5, response bytes and wall time.
`eval/query-vectors.json` holds the precomputed query embeddings used by the
local server.

## CD

`.github/workflows/deploy-rules-mcp.yml` rebuilds the catalog and deploys on a
push to `main` that touches rule content or this project. It needs three repo
secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and
`RULES_MCP_TOKEN`. The last one must differ from the Code Mode MCP token.
