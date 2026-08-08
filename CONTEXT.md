# CONTEXT.md — skills repo glossary

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
