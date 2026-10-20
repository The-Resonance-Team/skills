# Lint & Format Baseline — Oxfmt, Oxlint, ESLint (Next.js only)

Applies to every TypeScript/JavaScript project in the organization. Include this file in `opencode.json` `instructions` for any TS/JS repo. Machine-readable configs ship in `configs/` of this repo.

## Scope

Strict tool split — three tools, non-overlapping jobs:

| Tool   | Applies to                                                             | Job             |
| ------ | ---------------------------------------------------------------------- | --------------- |
| Oxfmt  | all projects                                                           | formatting only |
| Oxlint | every non-Next.js project (web, miniapp, Vite/React, plain TS, NestJS) | linting         |
| ESLint | Next.js apps only (`eslint-config-next`)                               | linting         |

Formatting is never linted; linting is never formatted (no stylistic rules in either linter). A TS/JS project without this tooling must set it up.

## Oxfmt baseline (all projects)

Oxfmt is the org formatter: Prettier-compatible output (passes Prettier's JS/TS conformance tests), ~30x faster, native coverage of JSON, YAML, CSS, and Markdown.

1. **One root config, no app-level overrides** — copy `configs/.oxfmtrc.json` into the repo root. Oxfmt's defaults already equal the old baseline (`semi: true`, `trailingComma: "all"`, `printWidth: 100`, `tabWidth: 2`, `arrowParens: "always"`, `endOfLine: "lf"`); the shipped config sets `singleQuote: true` and `sortPackageJson: false` (package.json key order stays hand-maintained).
2. **No per-app `.oxfmtrc.json`** — an app-level config is a stale fork that silently contradicts the standard (config drift). When found, delete it and reformat with the root config; do not accommodate it.
3. **Tailwind projects** set `"sortTailwindcss": true` — class sorting is built in; no plugin.
4. **Docs are never formatted** — the shipped `ignorePatterns` excludes `*.md`: markdown documents (rules, ADRs, specs, tickets, READMEs) are hand-maintained prose, not code. Auto-formatting churns history and fights hand-wrapping. lint-staged's `oxfmt` and the `format` script already respect the ignore.
5. **Migrating from Prettier** — only files that drifted from Prettier 3.6+ output reflow (mostly union-type wrapping). `format:check` after the swap is the proof; a big diff means the old tool ran stale, not that Oxfmt diverges.

## Oxlint baseline (non-Next.js projects)

5. **Config** — copy `configs/.oxlintrc.json` (file must be named `.oxlintrc.json`, or root `oxlint.config.ts` in Ultracite / ADR-0005 repos). Structure:
   - `categories`: `correctness: "error"`, `suspicious: "warn"`, `perf: "warn"`.
   - `plugins`: `typescript`, `react`, `react_perf`, `import`, `jest`, `vitest`.
   - `ignorePatterns`: `node_modules`, `dist`, `.next`, `.turbo`, `coverage`, `build`, `.expo`, `www`, `test-results`, `**/next-env.d.ts`.
6. **No type-aware linting** — `typeAware`/`typeCheck` are off. Semantic type checking is the project's own `tsc` / `bun check` job; lint stays a fast save-time pass. Rules that require type info (`typescript/no-floating-promises`, `typescript/no-misused-promises`) are not part of the baseline.
7. **`_`-prefix convention** — `no-unused-vars` is `"error"` with `varsIgnorePattern`/`argsIgnorePattern`/`caughtErrorsIgnorePattern` all `"^_"`. Intentionally-unused bindings are named with a leading underscore, never deleted or lint-suppressed.
   - **`_` is a signature placeholder, never a silencer** — a `_` that swallowed real input (a DTO, a param, a state setter) is a **suppressed binding**: real input silently discarded, a bug in hiding. Wire it or remove it, never leave it `_`-prefixed. Valid uses are interface-required placeholders only: guard params, `validate(_value, args)` in class-validator constraints, react-query `(_data, ...)` callbacks, `getNextPageParam` placeholders, test stubs.
8. **Discipline rules**: `no-console: ["warn", {"allow": ["warn", "error"]}]`, `no-debugger: "warn"`, `no-explicit-any: "error"`, `eslint/no-underscore-dangle: "off"`, `react/no-array-index-key: "warn"`, `react/react-in-jsx-scope: "off"`, `import/no-duplicates: ["error", {"prefer-inline": true}]`, `import/no-named-as-default-member: "off"`, `import/no-unassigned-import: "off"`.
9. **Test leniency is scoped, never global** — test files (`**/*.{test,spec}.{ts,tsx}`) get an `overrides` block that adds `jest`/`vitest` plugins and turns off their noise rules (`expect-expect`, `no-conditional-expect`, `valid-title`, `require-mock-type-parameters`) plus `no-explicit-any: "off"`. App code never inherits test leniency.
10. **300-line cap per file** — `max-lines: ["error", 300]` is part of the baseline (see `configs/.oxlintrc.json`). A source file over 300 lines fails lint. Split the file — never raise the cap, never ignore the file.
    - **Format with `oxfmt` BEFORE checking `oxlint`** — `oxfmt` expands compact single-line JSX props, object literals, and multi-element array destructuring (`const [a = '', b = '', ...] = str.split('|')`) by **1.4×–2.5×**. Running `oxlint` before `oxfmt` produces a false-green on `max-lines: 300` that fails only at commit time when `lint-staged` runs `oxfmt` first. Every local check and subagent verification gate must run `oxfmt <paths> && oxlint --max-warnings=0 <paths>`. Target **≤250 formatted lines** when authoring new components from a design export, and finish near-cap edits **≤290 formatted lines** (precedent: Gia Su Anh Minh 2026-10 — 65 subagent-authored files passed pre-format `oxlint` at 180–280 lines and expanded to 303–1053 lines on `oxfmt`).
11. **NestJS** additionally sets `typescript/no-extraneous-class: ["warn", {"allowWithDecorator": true}]` — see `rules/nestjs.md`.
12. **Suppression comments are dead code** — the baseline oxlint does not honor inline disables (`eslint-disable-next-line`, `oxlint-ignore-next-line`, `oxlint-disable-next-line`: all ignored, warning still fires). A finding is resolved in code or in rule config (scoped `overrides` block / rule options like `allowWithDecorator`) — never as a comment. Grep for `disable-next-line\|oxlint-ignore` before claiming zero findings; hits are unfixed findings wearing a comment.


## ESLint baseline (Next.js apps only)

11. **Next.js apps do not run oxlint (unless the repo uses the Ultracite root-only `oxlint.config.ts` profile).** In standard repos, Next.js linting is ESLint only, via flat config `configs/eslint.config.mjs`:
    - `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`, `tseslint.configs.recommended`.
    - `_`-prefix convention: `@typescript-eslint/no-unused-vars` with the three `^_` ignore patterns.
    - `import/no-duplicates: ["error", {"prefer-inline": true}]`.
    - `eslint-config-prettier` last — turns off every stylistic rule; the formatter owns formatting (the package is standalone, no Prettier dependency).
    - **Monorepos place the config at the Next app level** (`apps/<app>/eslint.config.mjs`), where `next` resolves; the repo root keeps the oxlint baseline for non-Next apps.
    - **Exception — Ultracite root-only profile (ADR-0005)**: Repos with a root `oxlint.config.ts` extending `ultracite/oxlint/core`, `ultracite/oxlint/react`, and `ultracite/oxlint/nextjs` lint **all** workspaces (including Next.js apps) with root `oxlint --max-warnings=0` and forbid subdirectory linter/formatter configs. Check the repo's `AGENTS.md` and root `oxlint.config.ts` before adding an `eslint.config.mjs`.
12. **`react-hooks` rules stay ON** — `react-hooks/set-state-in-effect`, `react-hooks/immutability`, `react-hooks/refs` are not disabled in the baseline. Disable a rule per-project only with a `// ponytail:` comment naming the pervasive pattern, and only after re-running the lint to confirm the rule genuinely fails.

## Pre-commit

13. **lint-staged** runs `oxfmt` + `oxlint --fix` (`eslint --fix` in Next.js apps) on staged files. A commit that fails lint must be fixed, not pushed around the hook.
    - **Next.js-only commits must not trip root `oxlint`** — in a monorepo where `oxlint.config.ts` ignores `apps/web/**` and `apps/portal/**`, a bare `"*.{ts,tsx,js,jsx}": ["oxlint --fix"]` rule in `.lintstagedrc.json` matches basename globs and passes staged Next.js files to `oxlint`, which filters all of them out and exits with code 1 (`No files found to lint`). Scope the `lint-staged` glob to exclude the ESLint-owned Next.js directories (`"!(apps/web|apps/portal)/**/*.{ts,tsx,js,jsx}"`) or strip those paths before invoking `oxlint` so Next.js-only commits pass pre-commit cleanly (precedent: Ecopick 2026-10, PR #453).
14. **Workspace-owned formatters scope their lint-staged command to the workspace** — a command like `"*.prisma": "prisma format"` runs from the repo root, where no `schema.prisma` exists in a monorepo, and every commit touching that file type fails. Point it at the owning workspace and swallow lint-staged's appended paths: `"*.prisma": "bash -c 'pnpm --filter @acme/api exec prisma format' --"`. Run the formatter after hand-editing config files (`.prisma` alignment drift fails CI's `format --check` otherwise).

## Dead code

15. **Orphan-export check after a symbol swap** — replacing the last in-repo usage of an exported symbol (constant, type, helper) orphans its definition, and neither oxlint nor ESLint flags exported bindings (`no-unused-vars` ignores exports). After every edit that removes a reference, grep the repo for the symbol; if the only hit is the defining file, delete the definition in the same pass. Never leave the orphan "for later".
    - Worked example: inbox list cards switched `REPORT_CATEGORY_SHORT[p.category]` (`'GD'`) to `REPORT_CATEGORY_LABEL[p.category]` (`'Giáo dục'`). A repo-wide grep then showed one hit — the `REPORT_CATEGORY_SHORT` map itself — so the map was deleted in the same pass instead of lingering as dead code.


## Python baseline

16. **`ruff` owns both jobs, `mypy` owns types, `pytest` owns tests** — for any Python package in the repo. Formatting and linting split the same way they do for TS/JS and never cross:
    - **`ruff format`** — formatting only, the Python counterpart of Oxfmt.
    - **`ruff check`** — linting only, no stylistic rules. Select from `E`, `F`, `I`, `UP`, `B`, `SIM`, `PTH`, `RUF`; ignore `E501` (the formatter owns line length).
    - **`mypy`** — semantic type checking, the counterpart of `tsc`. The same split as rule 6 applies: lint stays a fast pass, types are their own job.
    - **`pytest`** — tests, the counterpart of `vitest`.
17. **`RUF001`–`RUF003` are off in a project with Vietnamese or mathematical content** — the ambiguous-Unicode rules flag the en-dash the assignment mandates verbatim (`Fall detected – Please check`), the multiplication sign and minus sign in formulas, and Greek letters used as symbols (θ, α). Rewriting those characters changes meaning, so the finding is resolved in rule config, not in the string (rule 12).
18. **One `ruff.toml` per repository, at the root** — no per-package `ruff.toml`, for the same reason rule 2 forbids per-app formatter configs: an app-level copy is a stale fork that silently contradicts the standard.
