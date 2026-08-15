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
