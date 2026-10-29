# Retro: Next.js bundle optimizer audit + i18n leak fix (VibeHost PR #147)

## What I did

Ran `next-bundle-optimizer` in audit mode across all six Next.js apps in the
VibeHost monorepo, captured/exported `next analyze` baselines, then switched to
fix mode for the highest-impact candidate: the i18n catalog leak. Refactored
`packages/i18n` so `locales` no longer imports catalog values, moved
`catalog`/`keys`/`appCatalog` to server/catalog modules, inlined blog
error/loading/not-found strings, unified `cn` to 0.5.0 via root overrides, added
`optimizePackageImports`, and dynamic-imported the web hero `StatusBoard`. Opened
PR #147.

## Baseline facts

| Fact | Source |
| ---- | ------ |
| Blog client bundle included 370,667 B of `admin.json` (and all other namespaces) via `@vibehost/i18n/locales` | `/tmp/analyze-blog-before.jsonl.gz`, client source_path scan |
| `catalog`/`keys`/`appCatalog` were defined in modules imported by client components, dragging the whole `CATALOG` JSON into client bundles | `packages/i18n/src/locales.ts`, `packages/i18n/locales.ts` |
| Only blog had JSON messages in its client bundle; console/web/admin/auth had 0 (server-side selection already isolated them) | client-file scan per app |
| `lint:boundaries` (depcruise) forbids tests importing `src/*` subfolders and circular imports | `packages/i18n` depcruise config |
| `next analyze` capture is fast (~6–10s per app) but export streams are large (up to 5.6M lines for admin) | capture/export runs |
| Docs build fails in this environment (connects to localhost:8108 API) — unrelated to changes | `bun run build --filter=@vibehost/docs` |

## Candidates for improvement

### 1. Catalog isolation should be enforced by a boundary rule, not by convention

The leak existed because `packages/i18n/locales.ts` (client-importable) imported
`catalog` from `./src/locales`, which imported `CATALOG` value. Nothing caught
this: typecheck passed, tests passed, and the bundle grew silently. A depcruise
rule (or a simple grep check in CI) asserting that client-facing entry points
(`locales.ts`, `client.tsx`) do not import `src/catalog` would have prevented it.

→ Candidate for `rules/frontend.md` / `rules/linting.md`: add a boundary check for
value imports of catalog in client entry points.

### 2. `next analyze` export size makes streaming analysis mandatory

The export files are 300K–5.6M lines. Loading them into context is impossible;
the agent had to write Python aggregation scripts. The skill already mandates
streaming, but the friction is high. A small repo-local helper (e.g.
`scripts/analyze-bundle.mjs` wrapping gzip + aggregation) would make this
repeatable and less error-prone.

→ Candidate tooling: add a `scripts/bundle-report.mjs` to VibeHost.

### 3. Pre-commit lint runs full repo lint, which is slow and noisy

The pre-commit hook runs `bun run lint` (turbo, all packages) and failed on
jsdoc rules not supported by bun. This forced `--no-verify`-free debugging and
repeated full lint runs. A staged-files-only lint (lint-staged) already exists
but the hook still triggers the full turbo lint.

→ Candidate: wire lint-staged to run oxlint on staged files only, not full
`bun run lint`.

### 4. Type-only imports are a recurring footgun

Two lint errors (`no-import-type-side-effects`) came from inline `type` specifiers
in value imports. The agent hit this twice (newsletter-section, i18n). A
lint rule or a codegen convention (always use `import type` on its own line)
would prevent it.

→ Already enforced by oxlint; the retro candidate is to add an autofix or
pre-commit auto-format.

### 5. `optimizePackageImports` is a low-cost, high-leverage knob

Adding it for shiki/sentry/zod/axios was trivial and safe. It should be in the
default Next.js config template for all apps.

→ Candidate: add to a shared base config or document in `rules/frontend.md`.

### 6. No automated bundle regression check

Nothing prevents the i18n leak from recurring. A CI step comparing
`next analyze` client source paths (or a size budget) would catch regressions.

→ Candidate CI job: run `next build` + size check on PRs.