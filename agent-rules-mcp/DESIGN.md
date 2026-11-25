# Design: rules MCP server

## Goal

Reduce the rule tokens the model carries at session start and make rule
selection relevant to the task. Today `instructions[]` loads the profile and
`CONTEXT.md` at session start. The 23 rule modules and 6 workflows are fetched
by raw URL only when the agent asks for them. A Worker MCP server replaces that
fetch step with semantic discovery and exact retrieval.

## Decisions

| Area | Decision |
| --- | --- |
| Objective | Fewer tokens at session start and better rule relevance. Guardrail: total tokens per session. |
| Bootstrap | Drop `CONTEXT.md` from `instructions[]`. Keep the profile. Put the "when to call" sentence in both tool descriptions. |
| Tools | `search_ai(query)`, `get_metadata(id?)`, and `get(id)`. No `rules_` prefix. |
| Tool output | `search_ai` returns at most five IDs with scores. `get_metadata` returns descriptors with IDs, scope, path and relations. `get` returns one full module, capped and truncated with a notice. |
| IDs | Stable logical IDs. File path is a returned field, not the ID. |
| Catalog | Generated at build time from `CONTEXT.md` tables and module files. Never hand-maintained. |
| Relations | `related` from semantic search. `references` from a build-time citation graph; router rows are excluded. |
| Retrieval text | Title + `CONTEXT.md` scope or trigger cell + first paragraph. Not the whole file. |
| Vectors | Precomputed in the Worker bundle. Rebuild only entries whose retrieval text changed. |
| Query embedding | Workers AI `@cf/google/embeddinggemma-2`. Cosine similarity over bundled vectors. An extra search service requires measured benefit. |
| Placement | Separate Worker `agent-rules-mcp`, on Workers Free. Not the Code Mode Worker. |
| Layout | Follow `cloudflare/mcp-server-cloudflare`; see `docs/adr/0001-mcp-server-layout-reference.md`. |
| Auth | Scoped OAuth tokens. The static bearer token is read-only and distinct from the Code Mode MCP token. |
| Failure | Continue with a visible warning when the MCP is down. Raw-URL fetch stays documented as an emergency switch. |
| CD | GitHub Actions on push to `main` builds the pinned snapshot and runs `wrangler deploy`. No runtime GitHub fetch. |
| Quality | Ten real use cases with expected IDs. Recall@5 against a lexical baseline. Three subagents run the benchmark. A required rule missing from the top five blocks release. |

## Components

1. **Builder** — reads `CONTEXT.md` and the module files, pins the snapshot to a
   content digest, emits a catalog with stable IDs, retrieval text, digests and
   citation edges, and reuses vectors for unchanged digests.
2. **Worker** — serves `/mcp`, checks scoped authentication, registers discovery,
   retrieval and patch tools, embeds the query, ranks the catalog, and returns
   results.
3. **CI** — runs the builder, the quality check, and the deploy on `main`.
4. **Evals** — ten real tasks, run through subagents, comparing semantic search
   with raw-URL fetch on rule selection, tokens and wall time.

## Auth and rule writes

| Area | Decision |
| --- | --- |
| Identity | Cloudflare Access signs the human in. The Worker issues its own scoped tokens. |
| Registration | CIMD first, DCR fallback. No client secret on a new device. |
| Scopes | `rules:read` for all current tools; `rules:write` for propose and apply. Bearer tokens never write. |
| Proposal | `propose_rule_patch` stores a draft in the SQLite-backed `ApprovalStore` Durable Object and returns a dashboard URL plus token. |
| Dashboard | Astryx UI served as static assets from the same Worker. Access sign-in and a reviewer allowlist protect one stable board. |
| Decision | Allow or Deny creates a one-use record bound to patch digest and reviewer. Review access expires in one day and is renewable. |
| Apply | `apply_rule_patch` consumes the approval and queues a durable job. The alarm-driven runner opens one draft PR from `rules-mcp/<id>` to `main`. |
| Failure | Unknown GitHub writes are reconciled from their branch/PR before another write. No blind retry and no auto-merge. |
| Browser | An OpenCode plugin in this project opens the dashboard URL after a proposal. |
| Repo rule | Manual edits ask direct push or PR. Worker patches always open a PR. |
| Credentials | Fine-grained GitHub PAT and Access OIDC app; created through the browser with human help. |

## Non-goals

- No Paid-only runtime features. Dynamic Workers and Containers remain excluded.
- No extra search, storage, or background service without a workload benefit and
  a verified Free-tier budget. SQLite Durable Objects are already used; Free
  allocations also exist for Workflows and Vectorize.
- No ongoing PR-status sync or live catalog refresh. GitHub owns PR review and
  merge; a successful rebuild and deployment publishes the catalog.
- No rule rewriting or automatic edits to rule files.
- No fourth read tool, no eager injection of rule files.
- No shared token with the Code Mode MCP server.
- No direct `main` write, auto-merge, or silent rule edit from the Worker.

## Lifecycle update and verification

Reviewer sign-in, renewable access, retention, source checks, and recoverable
submission are implemented and recorded in
[the handoff resolution](docs/handoff-resolution.md). A human-approved draft PR
on the deployed Worker is the remaining live verification.

The Free-tier evidence and conflicting platform limits are recorded in
[the audit](docs/research/cloudflare-free-audit.md). Free availability alone does
not justify adding a service.

Read-only deployment checks on 2026-11-25 found that the active Worker predates
the branch's `PATCHES` binding. Current branch approval persistence, a real
human-approved draft PR, and the post-merge deployment path still need live
verification. Existing successful PR checks do not establish a deployment.
