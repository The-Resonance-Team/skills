# Lint & Format Baseline — Prettier, Oxlint, ESLint (Next.js only)

Applies to every TypeScript/JavaScript project in the organization. Include this file in `opencode.json` `instructions` for any TS/JS repo. Machine-readable configs ship in `configs/` of this repo.

## Scope

Strict tool split — three tools, non-overlapping jobs:

| Tool | Applies to | Job |
|---|---|---|
| Prettier | all projects | formatting only |
| Oxlint | every non-Next.js project (web, miniapp, Vite/React, plain TS, NestJS) | linting |
| ESLint | Next.js apps only (`eslint-config-next`) | linting |

Formatting is never linted; linting is never formatted (no stylistic rules in either linter). A TS/JS project without this tooling must set it up.

## Prettier baseline (all projects)

1. **One root config, no app-level overrides** — copy `configs/prettier.config.mjs` into the repo root. Settings: `semi: false`, `singleQuote: true`, `trailingComma: "all"`, `printWidth: 100`, `tabWidth: 2`, `arrowParens: "always"`, `endOfLine: "lf"`.
2. **No per-app `.prettierrc`** — an app-level config is a stale fork that silently contradicts the standard (config drift). When found, delete it and reformat with the root config; do not accommodate it.
3. **Tailwind projects** add `prettier-plugin-tailwindcss` to `plugins` — nothing else.
4. **Docs are never formatted** — copy `configs/.prettierignore` into the repo root (it ignores `*.md`): markdown documents (rules, ADRs, specs, tickets, READMEs) are hand-maintained prose, not code. Prettier must skip them — auto-formatting churns history and fights hand-wrapping. lint-staged's `prettier --write` and the `format` script already respect the ignore.

## Oxlint baseline (non-Next.js projects)

5. **Config** — copy `configs/.oxlintrc.json` (file must be named `.oxlintrc.json`). Structure:
   - `categories`: `correctness: "error"`, `suspicious: "warn"`, `perf: "warn"`.
   - `plugins`: `typescript`, `react`, `react_perf`, `import`, `jest`, `vitest`.
   - `ignorePatterns`: `node_modules`, `dist`, `.next`, `.turbo`, `coverage`, `build`, `.expo`, `www`, `test-results`.
6. **No type-aware linting** — `typeAware`/`typeCheck` are off. Semantic type checking is the project's own `tsc` job; lint stays a fast save-time pass. Rules that require type info (`typescript/no-floating-promises`, `typescript/no-misused-promises`) are not part of the baseline.
7. **`_`-prefix convention** — `no-unused-vars` is `"error"` with `varsIgnorePattern`/`argsIgnorePattern`/`caughtErrorsIgnorePattern` all `"^_"`. Intentionally-unused bindings are named with a leading underscore, never deleted or lint-suppressed.
8. **Discipline rules**: `no-console: ["warn", {"allow": ["warn", "error"]}]`, `no-debugger: "warn"`, `no-explicit-any: "error"`, `eslint/no-underscore-dangle: "off"`, `react/no-array-index-key: "warn"`, `react/react-in-jsx-scope: "off"`, `import/no-duplicates: ["error", {"prefer-inline": true}]`, `import/no-named-as-default-member: "off"`, `import/no-unassigned-import: "off"`.
9. **Test leniency is scoped, never global** — test files (`**/*.{test,spec}.{ts,tsx}`) get an `overrides` block that adds `jest`/`vitest` plugins and turns off their noise rules (`expect-expect`, `no-conditional-expect`, `valid-title`, `require-mock-type-parameters`) plus `no-explicit-any: "off"`. App code never inherits test leniency.
10. **NestJS** additionally sets `typescript/no-extraneous-class: ["warn", {"allowWithDecorator": true}]` — see `rules/nestjs.md`.

## ESLint baseline (Next.js apps only)

11. **Next.js apps do not run oxlint.** Linting is ESLint only, via flat config `configs/eslint.config.mjs`:
    - `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`, `tseslint.configs.recommended`.
    - `_`-prefix convention: `@typescript-eslint/no-unused-vars` with the three `^_` ignore patterns.
    - `import/no-duplicates: ["error", {"prefer-inline": true}]`.
    - `eslint-config-prettier` last — turns off every stylistic rule; Prettier owns formatting.
    - **Monorepos place the config at the Next app level** (`apps/<app>/eslint.config.mjs`), where `next` resolves; the repo root keeps the oxlint baseline for non-Next apps.
12. **`react-hooks` rules stay ON** — `react-hooks/set-state-in-effect`, `react-hooks/immutability`, `react-hooks/refs` are not disabled in the baseline. Disable a rule per-project only with a `// ponytail:` comment naming the pervasive pattern, and only after re-running the lint to confirm the rule genuinely fails.

## Pre-commit

13. **lint-staged** runs `prettier --write` + `oxlint --fix` (`eslint --fix` in Next.js apps) on staged files. A commit that fails lint must be fixed, not pushed around the hook.
