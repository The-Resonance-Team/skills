# Lint & Format Baseline — Ultracite (Oxlint + Oxfmt), ESLint (Next.js only)

Applies to every TypeScript/JavaScript project in the organization. Include this file in `opencode.json` `instructions` for any TS/JS repo. Machine-readable configs ship in `configs/` of this repo.

## Scope

Strict tool split — three tools, non-overlapping jobs:

| Tool   | Applies to                                                             | Job             |
| ------ | ---------------------------------------------------------------------- | --------------- |
| Oxfmt  | all projects                                                           | formatting only |
| Oxlint | every non-Next.js project (web, miniapp, Vite/React, plain TS, NestJS) | linting         |
| ESLint | Next.js apps only (`eslint-config-next`)                               | linting         |

Linting and formatting are powered by the [Ultracite](https://www.ultracite.ai/) presets. Ultracite is a rule preset, not an extra tool: the commands stay `oxlint` and `oxfmt`. Formatting is never linted; linting is never formatted. A TS/JS project without this tooling must set it up.

Install the toolchain as devDependencies: `ultracite` (preset), `oxlint`, `oxfmt`. Move all three together with `npx ultracite upgrade` — the preset is pinned to specific linter releases.

## Formatting baseline (all projects)

1. **One root config, no app-level overrides** — copy `configs/oxfmt.config.ts` into the repo root. It wraps `ultracite/oxfmt` and restores the org settings where the preset disagrees: `semi: true`, `singleQuote: true`, `trailingComma: "all"`, `printWidth: 100`, `tabWidth: 2`, `arrowParens: "always"`, `endOfLine: "lf"`, `sortPackageJson: false`.
2. **No per-app formatter config** — an app-level config is a stale fork that silently contradicts the standard (config drift). When found, delete it and reformat with the root config; do not accommodate it.
3. **Import sorting and Tailwind class sorting stay off** (`sortImports: false`, `sortTailwindcss: false`). Both are Ultracite opinions outside this baseline; enabling either is a repo-wide reorder and belongs in its own change.
4. **Docs are never formatted** — `configs/oxfmt.config.ts` ignores `**/*.md` and `docs/**`: markdown documents (rules, ADRs, specs, tickets, READMEs) are hand-maintained prose, not code. The formatter must skip them — auto-formatting churns history and fights hand-wrapping. The `format` script and lint-staged pick the ignore up from the config.

## Oxlint baseline (Ultracite, non-Next.js projects)

5. **Config** — copy `configs/oxlint.config.ts` into the repo root. It extends `ultracite/oxlint/core` plus the framework presets that apply (`nestjs`, `react`, `vitest`). Do not copy the preset's rules by hand: it carries hundreds of rules and is updated by `ultracite upgrade`.
   - The `vitest` preset rules sit inside the preset's own override block, and extended overrides win over local ones. Adjust the preset object in the config (as `configs/oxlint.config.ts` does) — a second local `overrides` block cannot relax them.
   - `excludeFiles: ['**/e2e/**']` keeps the vitest preset away from Playwright specs.
6. **No type-aware linting** — `typeAware`/`typeCheck` are off and the `ultracite check --type-aware`/`--type-check` flags are not used. Semantic type checking is the project's own `tsc` job; lint stays a fast save-time pass.
7. **`_`-prefix convention** — `no-unused-vars` is `"error"` with `varsIgnorePattern`/`argsIgnorePattern`/`caughtErrorsIgnorePattern` all `"^_"`. The Ultracite preset ships the rule without those patterns, so the org config re-states them. Intentionally-unused bindings are named with a leading underscore, never deleted or lint-suppressed.
   - **`_` is a signature placeholder, never a silencer** — a `_` that swallowed real input (a DTO, a param, a state setter) is a **suppressed binding**: real input silently discarded, a bug in hiding. Wire it or remove it, never leave it `_`-prefixed. Valid uses are interface-required placeholders only: guard params, `validate(_value, args)` in class-validator constraints, react-query `(_data, ...)` callbacks, `getNextPageParam` placeholders, test stubs.
8. **Org opinions the preset does not carry**: `sort-keys: "off"` (alphabetical keys are not the house style), `no-console: ["warn", {"allow": ["warn", "error"]}]`, `max-lines: ["error", 300]`.
9. **Test leniency is scoped, never global** — the preset's test-file block is adjusted for the org: `no-explicit-any` and `max-lines` off, and the vitest matcher rules whose autofix changes test meaning stay off (`prefer-strict-equal`, `prefer-called-with`, `prefer-comparison-matcher`, `prefer-called-exactly-once-with`), see `configs/oxlint.config.ts` for the full list with reasons. App code never inherits test leniency.
10. **300-line cap per file** — `max-lines: ["error", 300]` is part of the baseline (see `configs/oxlint.config.ts`). A source file over 300 lines fails lint. Split the file — never raise the cap, never ignore the file.
    - **Leave headroom** — lint-staged formats staged files before the cap is checked, and a reflow can add lines. Editing a file near the cap lands it over the limit at commit time. Finish near-cap edits ≤290 lines: extract a section to a sibling instead of squeezing whitespace.
11. **NestJS** projects extend `ultracite/oxlint/nestjs`; decorator-aware class rules (`typescript/no-extraneous-class` and friends) come from the preset — see `rules/nestjs.md`.
12. **Suppression comments are hidden findings** — the linter honors inline disables (`eslint-disable-next-line`, `oxlint-disable-next-line`, file-level `oxlint-disable`), so a suppression does not resolve a finding, it hides it from every future count. Resolve a finding in code or in rule config (scoped `overrides` block / rule options). A suppression is acceptable only for a framework conflict, carries a one-line reason after `--`, and is reviewable debt — grep for `disable-next-line\|oxlint-disable` before claiming zero findings; hits are unfixed findings wearing a comment.
13. **Rules whose Ultracite autofix is unsafe are off** — verified by `tsc --noEmit` plus the test suites after a repo-wide `oxlint --fix`. The current list (see `configs/oxlint.config.ts` for the reasons): `typescript/consistent-type-imports` (NestJS DI metadata), `typescript/consistent-type-definitions` (Prisma assignability), `prefer-arrow-callback` (mocked constructors), `unicorn/no-useless-undefined`, `unicorn/no-useless-spread`, `unicorn/prefer-set-has`, `unicorn/prefer-single-call`, `unicorn/prefer-string-replace-all`.
   - **An autofix that needs newer syntax than the project's `lib` is unsafe too** — a named capture group requires ES2018, `toSorted` requires ES2023; the fix type-errors for consumers that compile the file (`tsc` catches it, unit tests do not). Check `target`/`lib` first: use the non-capturing form, or suppress with the target reason.
14. **Adopting on legacy code — park, do not silence** — rules the preset enforces that existing code has not adopted yet go to `"warn"` in a repo-local `migrationWarnings` map (with one comment per rule and a follow-up issue). New code gets warned, CI stays green, and the map shrinks over time. Never turn a rule off globally just because the old code fails it.
   - **Repeat the preset's options in the parked entry** — a bare `"warn"` replaces the preset rule and drops its options: `react/function-component-definition` lost `namedComponents: 'arrow-function'` this way, then demanded function declarations while `func-style` demanded expressions — no component style satisfied both (precedent: XaDaoXa 2026-09).
   - **The ledger is one tracking issue** — a one-line comment naming the follow-up issue is fine; a hand-maintained count in config is not (it goes stale on arrival and nothing validates it).

## ESLint baseline (Next.js apps only)

15. **Next.js apps do not run oxlint.** Linting is ESLint only, via flat config `configs/eslint.config.mjs`:
    - `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`, `tseslint.configs.recommended`.
    - `_`-prefix convention: `@typescript-eslint/no-unused-vars` with the three `^_` ignore patterns.
    - `import/no-duplicates: ["error", {"prefer-inline": true}]`.
    - `eslint-config-prettier` last — turns off every stylistic rule; Oxfmt owns formatting.
    - **Monorepos place the config at the Next app level** (`apps/<app>/eslint.config.mjs`), where `next` resolves; the repo root keeps the oxlint baseline for non-Next apps.
    - **Ultracite's ESLint toolchain is not adopted** — it requires ESLint 10 plus a Prettier-coupled plugin set, and it would conflict with Oxfmt owning formatting. Revisit only with a dedicated plan.
16. **`react-hooks` rules stay ON** — `react-hooks/set-state-in-effect`, `react-hooks/immutability`, `react-hooks/refs` are not disabled in the baseline. Disable a rule per-project only with a `// ponytail:` comment naming the pervasive pattern, and only after re-running the lint to confirm the rule genuinely fails.

## Pre-commit

17. **lint-staged** runs `oxfmt --write` + `oxlint --fix` (`eslint --fix` in Next.js apps) on staged files: `"*.{ts,tsx,js,jsx}": ["oxlint --fix", "oxfmt"]`, `"*.{json,md,yaml,yml}": "oxfmt"`. A commit that fails lint must be fixed, not pushed around the hook.
18. **Workspace-owned formatters scope their lint-staged command to the workspace** — a command like `"*.prisma": "prisma format"` runs from the repo root, where no `schema.prisma` exists in a monorepo, and every commit touching that file type fails. Point it at the owning workspace and swallow lint-staged's appended paths: `"*.prisma": "bash -c 'pnpm --filter @acme/api exec prisma format' --"`. Run the formatter after hand-editing config files (`.prisma` alignment drift fails CI's `format --check` otherwise).
