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

## Contributing

See [AGENTS.md](./AGENTS.md) for the rule-file format contract. Commits go directly to `main` (trunk-based).
