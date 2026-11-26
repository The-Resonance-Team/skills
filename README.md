# Team engineering rules and workflows

This repository contains the team's coding rules, workflows, and tool baselines.
The [rules MCP](./agent-rules-mcp/README.md) discovers and serves applicable
guidance. Source Markdown files own the catalog metadata.

## Setup

Follow the [rules MCP setup](./agent-rules-mcp/README.md#local-setup) and the
[OpenCode instructions](./agent-rules-mcp/README.md#opencode). Keep the agent
profile as a standing instruction. Before coding, inspect the mandatory catalog
metadata for the task and load each applicable rule and workflow.

Pi setup and client-safe retrieval for long workflows are tracked in
[#21](https://github.com/The-Resonance-Team/skills/issues/21). Pi is not yet a
migrated consumer; it must pause affected coding work until the rules MCP is
configured.

## Migration from the old router

`CONTEXT.md` has been removed. Consumers that loaded it must switch to the rules
MCP and its metadata index. Existing raw URLs for individual `rules/*.md` and
`workflows/*.md` files remain available; use them only when explicitly directed.

## Repository

- [`rules/`](./rules/) — self-contained rule modules.
- [`workflows/`](./workflows/) — task procedures.
- [`configs/`](./configs/) — formatter, linter, and other tool baselines.
- [`free-resources/INDEX.md`](./free-resources/INDEX.md) — optional reference notes.
- [`AGENTS.md`](./AGENTS.md) — contributor rules and catalog authoring contract.

After a test audit, an optional retrospective can capture newly identified
rules or checks.

Skill, profile, and configuration metadata is tracked in
[#20](https://github.com/The-Resonance-Team/skills/issues/20).
