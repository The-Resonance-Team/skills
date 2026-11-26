# Rules MCP server

A Cloudflare Worker that serves the team rule modules and workflows over MCP.
It replaces raw-URL fetching with semantic discovery and exact retrieval. It
does not inject rule files at session start.

## Tools

- `search_ai(query, limit?)` — returns at most five IDs with similarity scores.
- `get_metadata(id?, kind?, priority?, offset?, limit?)` — lists the catalog and
  each rule or workflow index without loading the body. Page through all mandatory
  entries by following `nextOffset` until it is `null`; assess their scopes before
  coding. Load module context and each applicable rule.
- `get_rule(id)` — returns one numbered rule by stable slug ID, with scope,
  priority, and references.
- `get_workflow(id)` — returns the complete workflow as ordered instructions, or
  an error if it exceeds the safe response size.
- `get(id)` — returns one full source file if it fits safely; otherwise fails
  without returning partial content.
- `propose_rule_patch(id, summary, content)` — requires `rules:write`. Stores a
  draft and returns a review URL. Repeated identical requests return the same
  proposal. No PR yet.
- `apply_rule_patch(patchId, approvalId)` — requires `rules:write`. Consumes a
  human approval, queues a durable submission, and returns its state. The Worker
  opens one draft PR from `rules-mcp/<id>` to `main`; it never pushes to `main`.

Module IDs remain stable logical names. Workflow IDs start with `wf-`. Individual
rule IDs use `rule:<module-id>:<slug>`; their display numbers may change. The file
path is metadata, not the ID.

Do not change an existing ID for a reorder or title edit. To retire or replace
an ID, add its old value to `id-migrations.json` with the replacement ID or
`null` for retirement. CI compares the catalog with the base commit.

Mandatory guidance takes precedence over recommended guidance. When equally
ranked applicable rules conflict, stop affected work and ask the user to resolve
the conflict; propose a patch through the human approval flow. Unattended agents
must not guess. If this MCP is unavailable, pause affected coding work.

## Auth

The Worker is the OAuth authorization server and the resource server. Cloudflare
Access signs the human in; the Worker issues tokens with `rules:read` and
`rules:write`. OpenCode uses CIMD with DCR fallback, so a new device needs no
client secret. The static bearer token stays read-only for CI and subagents.
See ADR 0003.

## Approval dashboard

`ui/` is an Astryx 0.7.17 app served by the same Worker. After a proposal,
`plugin/` opens its review URL. `REVIEWER_EMAILS` is a comma-separated allowlist;
only those verified Access identities can view proposals, decide, or renew. A
decision creates a one-use approval bound to the patch digest and reviewer.
Proposals stay on one stable repository board. Access expires after one day and
can be renewed without losing proposals or history.

A pending proposal has a 30-day review window. Final history is kept for 90
days. Unresolved submissions are kept until reconciled. Files use a lazy
`@pierre/diffs` viewer plus a JSDiff-generated plain unified patch.

The SQLite-backed `ApprovalStore` owns proposals, approvals, submission phases,
and cleanup. An hourly repair Cron restores lost alarms. A decision queues a
durable submission; the alarm-driven runner verifies the reviewed file, creates
one draft PR, and recovers branch/PR identity after a lost response. It never
retries an uncertain GitHub `POST` blindly. See ADR 0004 and
[the handoff resolution](docs/handoff-resolution.md).

Legacy `patch:` and `approval:` records in `OAUTH_KV` need a one-time import.
After deploying, stop the old writer and let in-flight requests settle. An
authorized reviewer calls `POST /api/migrate` with the session cookie and follows
`nextCursor` until it is `null`, then repeats with `?verify=1` after a fresh scan
finds no remaining keys. Until verification succeeds the migration stays paused;
a single empty page is not treated as completion. Import preserves history but
never creates a new submit-ready approval from a legacy decision.

## Layout

- `src/` — Worker entry, OAuth, HTTP routes, MCP tools, ranking, patch state.
- `scripts/build-catalog.ts` — validates source metadata and builds `generated/catalog.json`.
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
Keep the profile as an eager instruction. The MCP provides the catalog and rules.

## Source metadata

Every Markdown file in `rules/` and `workflows/` carries YAML frontmatter with
`id`, `name`, `kind`, `description`, `scope`, and `priority`. Each numbered rule
has a stable `<!-- rule: slug -->` anchor. Do not derive IDs from display numbers
or change them on reorder. Metadata, scopes, references, and IDs are validated by
the builder. Rules are limited to 1,000 tokens and workflows to 10,000 tokens
using OpenAI's `o200k_base` encoding.

`bun run build:check` uses only committed embedding vectors and fails if they are
missing; it does not call Workers AI. A maintainer generates missing vectors in a
trusted environment and commits the catalog and cache before PR validation.

## Limits

- Workers Free: 100,000 requests/day, 10 ms CPU per request.
- Workers AI Free: 10,000 Neurons/day.
- KV Free: 1,000 writes/day to different keys, 1 write/second to the same key.
- SQLite Durable Objects are available on Free and already hold patch state.
- Workflows and Vectorize have documented Free allocations. Add a service only
  when its measured benefit and quota budget justify it.
- One hourly Cron repair trigger; the account had zero of five slots in use.
- Dynamic Workers and Containers require Paid and remain excluded.

See [the Free-tier audit](docs/research/cloudflare-free-audit.md) for primary
sources, quota-failure behavior, and conflicts in the platform documentation.

## Verification

```sh
bun fmt --check
bun run lint
bun run typecheck
bun test
bun run build:check
(cd ui && bun run build && bunx astryx doctor --built dist)
bunx wrangler deploy --dry-run
```

The `.oxlintrc.json` override for `ui/src/pages/dashboard.tsx` is deliberately
scoped: the Astryx page template is longer than the 300-line cap, and its
render props create arrays and callbacks inline. Astryx's own `doctor` checks
component props and purity for this file.

## Regenerating a draft branch

A Worker-created rule PR is a draft. Before marking it ready, use a separate,
trusted checkout of `main` with its dependencies installed. Keep credentials
in the trusted shell:

```sh
DRAFT_DIR=/path/to/draft/worktree \
CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... \
bun /path/to/trusted/skills/agent-rules-mcp/scripts/regenerate-draft.ts
```

The trusted checkout supplies the builder, tokenizer, and dependencies from
`main`. Verify that checkout is trusted and clean before running it. The builder
reads draft files as data.
It obtains genuine embeddings only for missing retrieval inputs and never runs
PR scripts with credentials. Commit `generated/catalog.json` and
`generated/embeddings.json` on the draft branch, then mark it ready. CI runs
`build:check` and `eval:check` without AI secrets. Never substitute zero vectors
or reuse a vector from a different input digest.

## Evaluation

`eval/cases.ts` holds ten real task queries with expected rule IDs. Start
`bun eval/serve.ts`, then run `bun run eval`.

## CD

`.github/workflows/deploy-agent-rules-mcp.yml` builds the dashboard and catalog, then
deploys on a push to `main` touching rule content or this project. Repo secrets:
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `AGENT_RULES_MCP_TOKEN`,
`ACCESS_CLIENT_SECRET`, and `AGENT_RULES_GITHUB_TOKEN` (fine-grained PAT with
Contents:write and Pull requests:write on this repo). Access endpoints and
client ID are vars in `wrangler.jsonc`. Set `REVIEWER_EMAILS` to the authorized
reviewer allowlist.

The deploy step tags the version with the built commit SHA and records the
catalog source digest and generated-artifact digest in the Wrangler message.
Check the version referenced by the active deployment; an uploaded version or a
green PR run alone does not show what is serving traffic.
