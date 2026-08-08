# skills — The Resonance Team library

The Resonance Team library: remote **rule modules** for opencode (plain markdown fetched via `instructions` URLs) and the **resonance plugin package** (Agent Plugins 1.0.0) carrying workflow skills and MCP servers.

## Resonance plugin

The repo root is the plugin root. `plugin.json` identifies it; `mcp.json` declares the team's MCP servers (context7, chrome-devtools, context-mode, github, firecrawl); `skills/` holds team-authored skills (empty until the first one lands); `rules/` and `configs/` are extra files clients ignore.

Validate the package with `node scripts/validate.mjs`.

### Install

The install link for every client is the repo URL: **`https://github.com/The-Resonance-Team/skills`**

| Client | Install method |
|---|---|
| VS Code | Chat → "Install Plugin From Source" → paste the repo URL |
| Cursor | Clone or copy the repo into `~/.cursor/plugins/local/resonance` |
| Codex | Cloud store publish (manual, deferred) |

opencode, Claude Code, and Antigravity do not load `plugin.json` natively. For them, add the MCP servers from `mcp.json` to the client config (`opencode.json` `mcp` / `~/.claude.json` `mcpServers`), translating `${VAR}` placeholders per client env rules (opencode `{env:VAR}`, Claude Code `${VAR}`) — never real keys. Team-authored skills in `skills/` drop into the client discovery dirs when they land.

**Secrets**: `mcp.json` holds `${GITHUB_TOKEN}` and `${FIRECRAWL_API_KEY}` placeholders only. Never commit real keys.

## Usage (rule modules)

Add the modules you need to `opencode.json` (per project) or `~/.config/opencode/opencode.json` (global). Each file is **self-contained** — include only the modules your project needs.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": [
    "https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/general.md",
    "https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/nestjs.md",
    "https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/frontend.md"
  ]
}
```

Remote instructions are fetched with a 5-second timeout; the repo must stay public for anonymous fetch to work. Simplest wiring: add **only** `CONTEXT.md` to `instructions` — it is the rule router and lists every module with its fetch URL.

## Rule modules

| File                | Scope              | Include when                                                     |
| ------------------- | ------------------ | ---------------------------------------------------------------- |
| `rules/general.md`  | All projects       | Always — language, axios generics, Tailwind v4, trust boundaries |
| `rules/nestjs.md`   | NestJS API         | Working in a NestJS backend (`apps/api`)                         |
| `rules/frontend.md` | Web/portal/miniapp | Working in a browser client                                      |
| `rules/linting.md`  | All TS/JS projects | Lint & format — Prettier, Oxlint, ESLint (Next.js only)          |
| `rules/libraries.md` | All TS/JS projects | One library per concern — axios, zod, RHF, TanStack Query, class-validator, date-fns |
| `rules/upload.md`    | APIs with uploads  | Inline multipart + S3 — mediaUpload interceptor, StorageService, URL-shaped DTOs |

Machine-readable tool configs (Prettier, Oxlint, ESLint-for-Next.js) ship in [`configs/`](./configs/) and are copied into consumer repos per `rules/linting.md`.

## Skills & plugins in use

Skills installed in client discovery dirs (`~/.agents/skills`, `~/.claude/skills`), by source:

| Source | Skills installed |
|---|---|
| [mattpocock/skills](https://github.com/mattpocock/skills) (35/35) | ask-matt, code-review, codebase-design, diagnosing-bugs, domain-modeling, grill-with-docs, implement, improve-codebase-architecture, prototype, research, resolving-merge-conflicts, setup-matt-pocock-skills, tdd, to-spec, to-tickets, triage, wayfinder, wizard, grill-me, grilling, handoff, teach, to-questionnaire, wait-what, writing-for-agents, claude-handoff, loop-me, setup-ts-deep-modules, writing-beats, writing-fragments, writing-shape, git-guardrails-claude-code, migrate-to-shoehorn, scaffold-exercises, setup-pre-commit |
| [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) (0/6 installed) | `ponytail` mode runs via injected config (`.ponytail-active`), not a skill dir: ponytail, ponytail-audit, ponytail-debt, ponytail-gain, ponytail-help, ponytail-review |
| [mksglu/context-mode](https://github.com/mksglu/context-mode) (0/9 installed) | Only the MCP server runs (no skill dirs): context-mode, ctx-doctor, ctx-index, ctx-insight, ctx-purge, ctx-search, ctx-stats, ctx-upgrade, context-mode-ops |
| [firecrawl](https://github.com/firecrawl/firecrawl) (32) | Installed via `npx firecrawl init` (CLI-managed): firecrawl, firecrawl-agent, firecrawl-build, firecrawl-build-interact, firecrawl-build-onboarding, firecrawl-build-scrape, firecrawl-build-search, firecrawl-company-directories, firecrawl-competitive-intel, firecrawl-crawl, firecrawl-dashboard-reporting, firecrawl-deep-research, firecrawl-demo-walkthrough, firecrawl-download, firecrawl-interact, firecrawl-knowledge-base, firecrawl-knowledge-ingest, firecrawl-lead-gen, firecrawl-lead-research, firecrawl-map, firecrawl-market-research, firecrawl-monitor, firecrawl-parse, firecrawl-qa, firecrawl-research-index, firecrawl-research-papers, firecrawl-scrape, firecrawl-search, firecrawl-seo-audit, firecrawl-shop, firecrawl-website-design-clone, firecrawl-workflows |

MCP servers (plugins) by client config:

| Client | Servers |
|---|---|
| opencode (`~/.config/opencode/opencode.json`) | github, context7, chrome-devtools, firecrawl, xcode, notion, google-sheets |
| Claude Code (`~/.claude.json`) | notion, firecrawl, claude-config, codegraph, obsidian-vault, stitch, tolaria |

## Contributing

See [AGENTS.md](./AGENTS.md) for the rule-file format contract. Commits go directly to `main` (trunk-based).
