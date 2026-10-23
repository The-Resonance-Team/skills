# CONTEXT.md — skills repo glossary & rule router

Consumers wire **only this file** as their standing router (in `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `SOUL.md`, editor rule files, or `opencode.jsonc`). It is the router: fetch the rule modules and workflows your project needs by URL below. Glossary terms below define the ubiquitous language across all modules.

## Rule modules

| Module                          | Scope                                                                    | Fetch URL                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `rules/general.md`              | All projects                                                             | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/general.md`              |
| `rules/nestjs.md`               | NestJS API (`apps/api`)                                                  | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/nestjs.md`               |
| `rules/prisma.md`               | TS/NestJS repos on Prisma 7                                              | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/prisma.md`               |
| `rules/frontend.md`             | Web, portal, miniapp                                                     | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/frontend.md`             |
| `rules/i18n.md`                 | Projects with message catalogs, multi-locale UI, user-facing copy        | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/i18n.md`                 |
| `rules/e2e-testing.md`          | Repos with Playwright e2e tests against a real API                       | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/e2e-testing.md`          |
| `rules/linting.md`              | All TS/JS and Python projects                                            | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/linting.md`              |
| `rules/libraries.md`            | All TS/JS projects                                                       | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/libraries.md`            |
| `rules/upload.md`               | APIs and clients with file uploads / object storage                      | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/upload.md`               |
| `rules/issues.md`               | Repos with a GitHub issue tracker                                        | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/issues.md`               |
| `rules/github-ci.md`            | Repos running CI on GitHub Actions                                       | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/github-ci.md`            |
| `rules/github-releases.md`      | Repos cutting releases or maintaining release branches                   | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/github-releases.md`      |
| `rules/github-vps-deploy.md`    | Self-hosted runners deploying to a VPS over SSH                          | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/github-vps-deploy.md`    |
| `rules/github-pr-automation.md` | Repos with PR automation (`/autofix`, path labels, semantic titles)      | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/github-pr-automation.md` |
| `rules/github-supply-chain.md`  | Actions + registries (CodeQL, SHA pinning, `pnpm/setup` isolation)       | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/github-supply-chain.md`  |
| `rules/dependabot.md`           | Repos with `.github/dependabot.yml`                                      | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/dependabot.md`           |
| `rules/audit.md`                | Any repo or slice under audit                                            | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/audit.md`                |

## Workflows

| Workflow                               | When to fetch (trigger)                                                                                                          | Fetch URL                                                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `workflows/codebase-audit.md`          | Full-codebase audit in package/directory slices against `rules/audit.md` (team-rule compliance, slop, dead code, risk, secrets). | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/workflows/codebase-audit.md`          |
| `workflows/themed-codebase-audit.md`   | Three-theme audit (dead code, duplicated business logic, complex logic) with a grill gate and wave branches.                     | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/workflows/themed-codebase-audit.md`   |
| `workflows/lint-burndown.md`           | Adopt strict lint preset, clear a lint backlog to zero, ratchet `--max-warnings` down in subagent waves.                         | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/workflows/lint-burndown.md`           |
| `workflows/claude-design-prompting.md` | Grill the user on design demand, generate multi-surface Claude Design prompts with full CRUD/state coverage, and audit `.dc.html` exports. | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/workflows/claude-design-prompting.md` |
| `workflows/claude-design-to-nextjs.md` | Convert Claude Design (`.dc.html`) exports or specs into pixel-perfect Next.js/React pages verified with Chrome DevTools MCP.   | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/workflows/claude-design-to-nextjs.md` |

Machine-readable tool configs ship in `configs/` of this repo (`.oxfmtrc.json`, `.oxlintrc.json`, `eslint.config.mjs`, `dependabot.yml`).

## Language rules (all consumers)

- **Always talk in ASD-STE100 Simplified Technical English.** Use only approved STE100 vocabulary. One meaning per word, short sentences.
- **Always read `CONTEXT.md` files** and use their ubiquitous language.

## Terms

- **Router** (`CONTEXT.md`) — this single entry-point file wired by consumers, mapping rule modules and workflows to their scope and raw URLs alongside the shared glossary.
- **Rule module** — one self-contained markdown file under `rules/`, fetched by URL into an agent's context.
- **Consumer** — any repository or global agent profile (OpenCode, Claude Code, Codex, Antigravity, Hermes, Cursor, Windsurf, Copilot) that wires this router or `rules/*.md` URLs.
- **Instruction** — a standing rule entry or remote URL loaded into an agent's context on every session.
- **Lint baseline** — the standard formatter + linter setup (`Oxfmt` + `Oxlint` / Next.js `ESLint`, `max-lines: 300`) in `rules/linting.md`. Alternatives are not accommodated.
- **Tool config** — a machine-readable config in `configs/` (`.oxfmtrc.json`, `.oxlintrc.json`, `eslint.config.mjs`, `dependabot.yml`) copied into consumer repos.
- **Config drift** — a local or per-app config in a consumer repo that contradicts the baseline. Resolved by unification, never accommodation.
- **Library baseline** — the fixed library-per-concern table in `rules/libraries.md`, chosen by framework. A substitute library for a covered concern is a violation.
- **Ponytail marker** — a `// ponytail: <ceiling>, <upgrade if ...>` comment marking a deliberate simplification or mock store (`rules/general.md`). A marker without an upgrade trigger is **`no-trigger` debt** and blocks merge.
- **`_`-prefix convention** — intentionally-unused signature placeholders carry a leading `_` (`^_` ignore pattern). A `_`-prefixed binding that swallows real input (DTO, route param, state setter) is a **suppressed binding** (`rules/linting.md`).
- **Deep-module boundary** — the default monorepo boundary regime (`oxc/no-barrel-file: "error"` + `.dependency-cruiser.cjs`) where workspace packages are imported only via `package.json#exports` entry points and `export *` folder barrels are forbidden (`rules/frontend.md`, `rules/nestjs.md`).
- **Inline multipart upload** — the upload model in `rules/upload.md`: files ride `multipart/form-data` on authenticated business endpoints into `@nestjs/storage` (`StorageDisk` / `uploadToDisk`), with best-effort delete on replace or removal (**media lifecycle**).
- **Term table** — the User-Facing Copy section of a consumer repo's `GLOSSARY.md` mapping internal terms to displayed VI and EN strings (`rules/i18n.md`).
- **Machinery leak** — an internal mechanism (`webhook`, `HMAC`, `SLA`, `RLS`), raw enum, status code, or parenthesized English original leaked into a user-facing message value (`rules/i18n.md`).
- **Slop** — an AI-generation artifact flagged by `rules/audit.md`: narrating comments, defensive checks on trusted paths, type-bypass casts, single-use abstractions, deep nesting, suppression directives, and value-free tests.
- **Slice** — a partition of source paths small enough for one subagent's context in `workflows/codebase-audit.md`; every file in a slice receives a **verdict** (`clean` or `file:line` findings).
