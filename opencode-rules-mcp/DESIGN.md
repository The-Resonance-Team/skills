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
| Query embedding | Workers AI `@cf/google/embeddinggemma-2`. Cosine similarity in the Worker. No Vectorize. |
| Placement | Separate Worker `opencode-rules-mcp`, on Workers Free. Not the Code Mode Worker. |
| Layout | Follow `cloudflare/mcp-server-cloudflare`; see `docs/adr/0001-mcp-server-layout-reference.md`. |
| Auth | Bearer token in a Worker secret, distinct from the Code Mode MCP token. |
| Failure | Continue with a visible warning when the MCP is down. Raw-URL fetch stays documented as an emergency switch. |
| CD | GitHub Actions on push to `main` builds the pinned snapshot and runs `wrangler deploy`. No runtime GitHub fetch. |
| Quality | Ten real use cases with expected IDs. Recall@5 against a lexical baseline. Three subagents run the benchmark. A required rule missing from the top five blocks release. |

## Components

1. **Builder** — reads `CONTEXT.md` and the module files, pins the snapshot to a
   content digest, emits a catalog with stable IDs, retrieval text, digests and
   citation edges, and reuses vectors for unchanged digests.
2. **Worker** — serves `/mcp`, checks the bearer token, registers the three
   tools with short descriptions, embeds the query, ranks the catalog, and
   returns results.
3. **CI** — runs the builder, the quality check, and the deploy on `main`.
4. **Evals** — ten real tasks, run through subagents, comparing semantic search
   with raw-URL fetch on rule selection, tokens and wall time.

## Non-goals

- No Vectorize index, Dynamic Workers, workflow, or Durable Object.
- No rule rewriting or automatic edits to rule files.
- No fourth MCP tool and no eager injection of rule files.
- No shared token with the Code Mode MCP server.

## Open items

The repo owner must add `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and
`RULES_MCP_TOKEN` as GitHub Actions secrets before CD can deploy. The deploy
does not proceed until they exist. `RULES_MCP_TOKEN` must differ from the Code
Mode MCP token.
