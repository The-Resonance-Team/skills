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

## Oxlint baseline (non-Next.js projects)

4. **Config** — copy `configs/.oxlintrc.json` (file must be named `.oxlintrc.json`). Structure:
   - `categories`: `correctness: "error"`, `perf: "error"`, `suspicious: "warn"`.
   - `plugins`: `typescript`, `react`, `react_perf`, `import`, `jest`, `vitest`.
   - `ignorePatterns`: `node_modules`, `dist`, `.next`, `.turbo`, `coverage`, `build`, `.expo`, `www`.
5. **Type-aware linting (mandatory)** — install `oxlint-tsgolint`, set `options.typeAware: true` and `options.typeCheck: true`. This runs typescript-eslint's semantic rules at ~20-40x the speed of eslint+tseslint. The high-impact rules are `typescript/no-floating-promises: "error"` and `typescript/no-misused-promises: "error"`.
6. **`_`-prefix convention** — `no-unused-vars` is `"error"` with `varsIgnorePattern`/`argsIgnorePattern`/`caughtErrorsIgnorePattern` all `"^_"`. Intentionally-unused bindings are named with a leading underscore, never deleted or lint-suppressed.
7. **Discipline rules**: `no-console: "warn"`, `no-debugger: "warn"`, `no-explicit-any: "error"`, `no-non-null-assertion: "warn"`, `react/no-array-index-key: "warn"`, `import/no-duplicates: ["error", {"prefer-inline": true}]` (parity with the Next.js ESLint config; this rule is **not** on by default in oxlint — it must be listed explicitly).
8. **Test leniency is scoped, never global** — test files (`**/*.{test,spec}.{ts,tsx}`) get an `overrides` block that adds `jest`/`vitest` plugins and turns off their noise rules (`expect-expect`, `no-conditional-expect`, `valid-title`, `require-mock-type-parameters`) plus `no-explicit-any: "off"`. App code never inherits test leniency.
9. **NestJS** additionally sets `typescript/no-extraneous-class: ["warn", {"allowWithDecorator": true}]` — see `rules/nestjs.md`.

## ESLint baseline (Next.js apps only)

10. **Next.js apps do not run oxlint.** Linting is ESLint only, via flat config `configs/eslint.config.mjs`:
    - `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`, `tseslint.configs.recommended`.
    - `_`-prefix convention: `@typescript-eslint/no-unused-vars` with the three `^_` ignore patterns.
    - `import/no-duplicates: ["error", {"prefer-inline": true}]`.
    - `eslint-config-prettier` last — turns off every stylistic rule; Prettier owns formatting.
11. **`react-hooks` rules stay ON** — `react-hooks/set-state-in-effect`, `react-hooks/immutability`, `react-hooks/refs` are not disabled in the baseline. Disable a rule per-project only with a `// ponytail:` comment naming the pervasive pattern, and only after re-running the lint to confirm the rule genuinely fails.

## Pre-commit

12. **lint-staged** runs `prettier --write` + `oxlint --fix` (`eslint --fix` in Next.js apps) on staged files. A commit that fails lint must be fixed, not pushed around the hook.
