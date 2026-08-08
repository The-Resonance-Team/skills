# skills — The Resonance Team library

The Resonance Team library: remote **rule modules** for opencode (plain markdown fetched via `instructions` URLs) and the **resonance plugin package** (Agent Plugins 1.0.0) carrying workflow skills and MCP servers.

## Resonance plugin

The repo root is the plugin root. `plugin.json` identifies it; `mcp.json` declares the team's MCP servers (context7, chrome-devtools, context-mode, github, firecrawl); `skills/` holds team-authored skills (empty until the first one lands); `rules/` and `configs/` are extra files clients ignore.

Validate the package with `node scripts/validate.mjs`.

### One-command install

```sh
node scripts/install.mjs            # skills + MCP servers, for every client present
node scripts/install.mjs --dry-run  # preview without changing anything
node scripts/install.mjs --client claude
```

The script installs both halves in one command:

- **Skills** — fetches and copies into each client's discovery dirs: mattpocock engineering set, ponytail, context-mode skills (from their git repos, pinned at latest commit), and firecrawl's set via `npx firecrawl init` (CLI-managed).
- **MCP servers** — merges the `mcp.json` servers into each client's config (`opencode.json` `mcp`, `~/.claude.json` `mcpServers`), skipping entries that already exist. The client config is backed up to `*.resonance.bak` before writing.

State is recorded in `~/.config/team-skills/installed.json`.

**Secrets**: `mcp.json` holds `${GITHUB_TOKEN}` and `${FIRECRAWL_API_KEY}` placeholders only; the script translates them to each client's env syntax (opencode `{env:VAR}`, Claude Code `${VAR}`). Never commit real keys.

### Client installs (plugin itself)

| Client | Install |
|---|---|
| VS Code | Chat → "Install Plugin From Source" → `https://github.com/The-Resonance-Team/skills` |
| Cursor | Copy/symlink into `~/.cursor/plugins/local/resonance` |
| opencode, Claude Code, Antigravity | `node scripts/install.mjs` |
| Codex | Cloud store publish (manual, deferred) |

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
