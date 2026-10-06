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

5. **Config** — copy `configs/.oxlintrc.json` (file must be named `.oxlintrc.json`). Structure:
   - `categories`: `correctness: "error"`, `suspicious: "warn"`, `perf: "warn"`.
   - `plugins`: `typescript`, `react`, `react_perf`, `import`, `jest`, `vitest`.
   - `ignorePatterns`: `node_modules`, `dist`, `.next`, `.turbo`, `coverage`, `build`, `.expo`, `www`, `test-results`.
6. **No type-aware linting** — `typeAware`/`typeCheck` are off. Semantic type checking is the project's own `tsc` job; lint stays a fast save-time pass. Rules that require type info (`typescript/no-floating-promises`, `typescript/no-misused-promises`) are not part of the baseline.
7. **`_`-prefix convention** — `no-unused-vars` is `"error"` with `varsIgnorePattern`/`argsIgnorePattern`/`caughtErrorsIgnorePattern` all `"^_"`. Intentionally-unused bindings are named with a leading underscore, never deleted or lint-suppressed.
   - **`_` is a signature placeholder, never a silencer** — a `_` that swallowed real input (a DTO, a param, a state setter) is a **suppressed binding**: real input silently discarded, a bug in hiding. Wire it or remove it, never leave it `_`-prefixed. Valid uses are interface-required placeholders only: guard params, `validate(_value, args)` in class-validator constraints, react-query `(_data, ...)` callbacks, `getNextPageParam` placeholders, test stubs.
8. **Discipline rules**: `no-console: ["warn", {"allow": ["warn", "error"]}]`, `no-debugger: "warn"`, `no-explicit-any: "error"`, `eslint/no-underscore-dangle: "off"`, `react/no-array-index-key: "warn"`, `react/react-in-jsx-scope: "off"`, `import/no-duplicates: ["error", {"prefer-inline": true}]`, `import/no-named-as-default-member: "off"`, `import/no-unassigned-import: "off"`.
9. **Test leniency is scoped, never global** — test files (`**/*.{test,spec}.{ts,tsx}`) get an `overrides` block that adds `jest`/`vitest` plugins and turns off their noise rules (`expect-expect`, `no-conditional-expect`, `valid-title`, `require-mock-type-parameters`) plus `no-explicit-any: "off"`. App code never inherits test leniency.
10. **300-line cap per file** — `max-lines: ["error", 300]` is part of the baseline (see `configs/.oxlintrc.json`). A source file over 300 lines fails lint. Split the file — never raise the cap, never ignore the file.
    - **Leave headroom** — lint-staged runs the formatter on staged files before the cap is checked, and a reflow can add lines. Editing a file near the cap lands it over the limit at commit time. Finish near-cap edits ≤290 lines: extract a section to a sibling instead of squeezing whitespace.
11. **NestJS** additionally sets `typescript/no-extraneous-class: ["warn", {"allowWithDecorator": true}]` — see `rules/nestjs.md`.
12. **Suppression comments are dead code** — the baseline oxlint does not honor inline disables (`eslint-disable-next-line`, `oxlint-ignore-next-line`, `oxlint-disable-next-line`: all ignored, warning still fires). A finding is resolved in code or in rule config (scoped `overrides` block / rule options like `allowWithDecorator`) — never as a comment. Grep for `disable-next-line\|oxlint-ignore` before claiming zero findings; hits are unfixed findings wearing a comment.


## ESLint baseline (Next.js apps only)

11. **Next.js apps do not run oxlint.** Linting is ESLint only, via flat config `configs/eslint.config.mjs`:
    - `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`, `tseslint.configs.recommended`.
    - `_`-prefix convention: `@typescript-eslint/no-unused-vars` with the three `^_` ignore patterns.
    - `import/no-duplicates: ["error", {"prefer-inline": true}]`.
    - `eslint-config-prettier` last — turns off every stylistic rule; the formatter owns formatting (the package is standalone, no Prettier dependency).
    - **Monorepos place the config at the Next app level** (`apps/<app>/eslint.config.mjs`), where `next` resolves; the repo root keeps the oxlint baseline for non-Next apps.
12. **`react-hooks` rules stay ON** — `react-hooks/set-state-in-effect`, `react-hooks/immutability`, `react-hooks/refs` are not disabled in the baseline. Disable a rule per-project only with a `// ponytail:` comment naming the pervasive pattern, and only after re-running the lint to confirm the rule genuinely fails.

## Pre-commit

13. **lint-staged** runs `oxfmt` + `oxlint --fix` (`eslint --fix` in Next.js apps) on staged files. A commit that fails lint must be fixed, not pushed around the hook.
14. **Workspace-owned formatters scope their lint-staged command to the workspace** — a command like `"*.prisma": "prisma format"` runs from the repo root, where no `schema.prisma` exists in a monorepo, and every commit touching that file type fails. Point it at the owning workspace and swallow lint-staged's appended paths: `"*.prisma": "bash -c 'pnpm --filter @acme/api exec prisma format' --"`. Run the formatter after hand-editing config files (`.prisma` alignment drift fails CI's `format --check` otherwise).

## Dead code

15. **Orphan-export check after a symbol swap** — replacing the last in-repo usage of an exported symbol (constant, type, helper) orphans its definition, and neither oxlint nor ESLint flags exported bindings (`no-unused-vars` ignores exports). After every edit that removes a reference, grep the repo for the symbol; if the only hit is the defining file, delete the definition in the same pass. Never leave the orphan "for later".
    - Worked example: inbox list cards switched `REPORT_CATEGORY_SHORT[p.category]` (`'GD'`) to `REPORT_CATEGORY_LABEL[p.category]` (`'Giáo dục'`). A repo-wide grep then showed one hit — the `REPORT_CATEGORY_SHORT` map itself — so the map was deleted in the same pass instead of lingering as dead code.
