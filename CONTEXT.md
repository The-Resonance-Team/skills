# CONTEXT.md — skills repo glossary & rule router

Consumers add **only this file** to `opencode.json` `instructions`. It is the router: fetch the rule modules your project needs by URL below. Glossary terms below define the ubiquitous language across all modules.

## Rule modules

| Module               | Scope                       | Fetch URL                                                                             |
| -------------------- | --------------------------- | ------------------------------------------------------------------------------------- |
| `rules/general.md`   | All projects                | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/general.md`   |
| `rules/nestjs.md`    | NestJS API                  | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/nestjs.md`    |
| `rules/prisma.md`    | TS/NestJS repos on Prisma 7 | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/prisma.md`    |
| `rules/frontend.md`  | Web/portal/miniapp          | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/frontend.md`  |
| `rules/i18n.md`      | Projects with i18n (message catalogs, multi-locale UI) | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/i18n.md` |
| `rules/linting.md`   | All TS/JS projects          | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/linting.md`   |
| `rules/libraries.md` | All TS/JS projects          | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/libraries.md` |
| `rules/upload.md`    | APIs with uploads           | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/upload.md`    |
| `rules/issues.md`    | Repos with a GitHub issue tracker | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/issues.md` |
| `workflows/claude-design-to-nextjs.md` | Converting Claude Design HTML to Next.js/React | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/workflows/claude-design-to-nextjs.md` |

**Condition trigger for workflow**: Use `workflows/claude-design-to-nextjs.md` when:
- User provides Claude Design HTML export and asks to convert to Next.js/React
- User asks to implement feature from design spec
- User asks to review design against spec for missing/partial/wrong features
- User asks for pixel-perfect implementation from design

**Suggested tools/skills for workflow**:
- `/code-review` — two-axis code review (Standards + Spec) after implementation
- `/tdd` — test-driven development for critical business logic
- `/domain-modeling` — challenge terms, sharpen glossary, test edge cases
- `/codebase-design` — design deep modules, find clean seams
- `/implement` — execute implementation plan from spec
- Chrome DevTools MCP — visual verification, pixel-perfect comparison
- PostHog MCP — analytics integration, user behavior tracking (optional)

Machine-readable tool configs ship in `configs/` of the same repo (`prettier.config.mjs`, `.oxlintrc.json`, `eslint.config.mjs`).

## Language rules (all consumers)

- **Always talk in ASD-STE100 Simplified Technical English.** Use only approved STE100 vocabulary. One meaning per word, short sentences.
- **Always read `CONTEXT.md` files** and use their ubiquitous language.

## Terms

- **Rule module** — one file under `rules/` (`general.md`, `nestjs.md`, `frontend.md`, `i18n.md`, `linting.md`, `issues.md`), consumed as a unit by agents.
- **Consumer** — a repo that lists one of our rule files in its `opencode.json` `instructions` array.
- **Instruction** — a single URL entry in a consumer's `instructions` array.
- **Lint baseline** — the standard tool+rule configuration for the org, encoded in `rules/linting.md`. One accepted configuration; alternatives are not accommodated.
- **Tool config** — a machine-readable config file shipped in `configs/` (`prettier.config.mjs`, `.oxlintrc.json`, `eslint.config.mjs`) that a consumer copies into its own repo.
- **Config drift** — a config inside a consumer repo that contradicts the lint baseline (e.g. a stale app-level `.prettierrc`). Resolution is unification, not accommodation.
- **Library baseline** — the fixed library-per-concern table in `rules/libraries.md`, chosen by framework. A substitute library for a covered concern is a violation.
- **Inline multipart upload** — the upload model in `rules/upload.md`: files ride `multipart/form-data` on authenticated business endpoints; the `mediaUpload` interceptor validates and stores, injecting public URLs into `req.body` before DTO validation. Anti-pattern: a dedicated presign-then-PUT upload service.
- **Media lifecycle** — create/replace/delete of stored media in `rules/upload.md`; replaces persist new URLs first, then fire-and-forget `deleteDropped` (a failed GC never fails the update); orphaned objects from failed mid-update writes are accepted until a GC job exists.
- **`_`-prefix convention** — intentionally-unused bindings are named with a leading underscore and exempted from unused-variable rules via the three `^_` ignore patterns.
- **Suppressed binding** — a `_`-prefixed binding that swallowed real input (a DTO, a param, a state setter): real input silently discarded, a bug in hiding. The `_` is valid only for signature-required placeholders (guard params, validator args, react-query callbacks, test stubs) — otherwise wire it or remove it (`rules/linting.md`).
