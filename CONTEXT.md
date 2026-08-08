# CONTEXT.md — skills repo glossary & rule router

Consumers add **only this file** to `opencode.json` `instructions`. It is the router: fetch the rule modules your project needs by URL below. Glossary terms below define the ubiquitous language across all modules.

## Rule modules

| Module | Scope | Fetch URL |
|---|---|---|
| `rules/general.md` | All projects | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/general.md` |
| `rules/nestjs.md` | NestJS API | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/nestjs.md` |
| `rules/frontend.md` | Web/portal/miniapp | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/frontend.md` |
| `rules/linting.md` | All TS/JS projects | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/linting.md` |
| `rules/libraries.md` | All TS/JS projects | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/libraries.md` |
| `rules/upload.md` | APIs with uploads | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/upload.md` |

Machine-readable tool configs ship in `configs/` of the same repo (`prettier.config.mjs`, `.oxlintrc.json`, `eslint.config.mjs`).

## Terms

- **Rule module** — one file under `rules/` (`general.md`, `nestjs.md`, `frontend.md`, `linting.md`), consumed as a unit by agents.
- **Consumer** — a repo that lists one of our rule files in its `opencode.json` `instructions` array.
- **Instruction** — a single URL entry in a consumer's `instructions` array.
- **Lint baseline** — the standard tool+rule configuration for the org, encoded in `rules/linting.md`. One accepted configuration; alternatives are not accommodated.
- **Tool config** — a machine-readable config file shipped in `configs/` (`prettier.config.mjs`, `.oxlintrc.json`, `eslint.config.mjs`) that a consumer copies into its own repo.
- **Config drift** — a config inside a consumer repo that contradicts the lint baseline (e.g. a stale app-level `.prettierrc`). Resolution is unification, not accommodation.
- **Library baseline** — the fixed library-per-concern table in `rules/libraries.md`, chosen by framework. A substitute library for a covered concern is a violation.
- **Inline multipart upload** — the upload model in `rules/upload.md`: files ride `multipart/form-data` on authenticated business endpoints; the `mediaUpload` interceptor validates and stores, injecting public URLs into `req.body` before DTO validation. Anti-pattern: a dedicated presign-then-PUT upload service.
- **Media lifecycle** — create/replace/delete of stored media in `rules/upload.md`; replaces persist new URLs first, then fire-and-forget `deleteDropped` (a failed GC never fails the update); orphaned objects from failed mid-update writes are accepted until a GC job exists.
- **`_`-prefix convention** — intentionally-unused bindings are named with a leading underscore and exempted from unused-variable rules via the three `^_` ignore patterns.

## Terms (2026-08-08 agent-plugins design session — provisional)

- **Team library** — the repo of rule modules and plugin packages the team publishes and shares.
- **Plugin package** — the distributable unit of the team library: a directory with `plugin.json` (Agent Plugins 1.0.0 format) plus optional `skills/`, `mcp.json`, and client-extension namespaces. Distribution, installation, and updates are client-managed — outside the format.
- **Sync model** — the four ways the team library reaches a library client: rolling fetch (always-latest, the current rule-module URL model), versioned distribution (semver-tagged packages, pinned consumers), managed install (CLI materializes packages into client skill directories), upstream contribution (PR-based, the repo's existing workflow). Session decision: all four modes are in scope.
- **Library client** — a machine consuming the team library; target is any Agent Plugins-compatible client, today opencode and Claude Code read skills from shared SKILL.md discovery directories.
- **On-demand activation** — a plugin package's skills are discovered and loaded by the client's skill tool at the moment of need; no package content enters the session context at startup. Contrast with the instruction model: rule modules are fetched into context at session start. Session decision: packages activate on demand only — the library never injects all package content.
- **Resonance plugin** — the team's single plugin package (Agent Plugins 1.0.0). Name: `resonance` (schema requires lowercase `[a-z0-9][a-z0-9.-]*[a-z0-9]`). One monolith, no domain split: every team member works across all domains. The repo root is the plugin root (`plugin.json` + `skills/` at root; `rules/`, `scripts/`, `CONTEXT.md` are extra files clients ignore). Validated against the vendored 1.0.0 schemas in CI.
- **Skill-level vs bundle-level management** — `npx skills add` manages single skills (or skill packs) and is the team's path for ad-hoc third-party skills. The resonance plugin is the bundle-level unit: it carries all team skills, pins versions, and is installed as one package. A client loading a plugin presents each `skills/<name>/SKILL.md` as an individually-activated skill.
- **Native loader vs SKILL.md client** — a native loader (VS Code, Cursor) reads `plugin.json` and installs the package through its own mechanism (VS Code "Install Plugin From Source" with the repo URL; Cursor local `~/.cursor/plugins/local`). A SKILL.md client (opencode, Claude Code, Antigravity) has no plugin loader; the team installer materializes `skills/` into that client's discovery directories: opencode `~/.config/opencode/skills`, Claude Code `~/.claude/skills`, Antigravity `~/.gemini/config/skills`. Codex is a cloud store (manual publish, documented only).
- **Vendored skill** — a skill copied into a client's discovery dirs by `scripts/install.mjs` from an upstream source (mattpocock engineering set, ponytail, context-mode skills); refreshed by re-running the script. Never edited in place — edit upstream or add a wrapper skill.
- **Team MCP stack** — the five servers defined in `mcp.json`: context7, chrome-devtools, context-mode (stdio) and github, firecrawl (streamable-http). `scripts/install.mjs` merges them into each client's config, skipping existing entries; backups are `*.resonance.bak`. Secret-bearing fields are `${VAR}` placeholders translated per client env rules; real keys are never committed.
