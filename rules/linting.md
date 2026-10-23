# Lint & Format Baseline — Oxfmt, Oxlint, ESLint (Next.js), Ruff (Python)

Applies to every TypeScript/JavaScript and Python project in the organization. Machine-readable configs ship in `configs/`.

## Scope & tool split

| Tool   | Applies to                                                             | Job             |
| ------ | ---------------------------------------------------------------------- | --------------- |
| Oxfmt  | all TS/JS/JSON/YAML/CSS projects (`configs/.oxfmtrc.json`)             | formatting only |
| Oxlint | every non-Next.js TS/JS project (`configs/.oxlintrc.json`)             | linting only    |
| ESLint | Next.js apps (`configs/eslint.config.mjs`, unless Ultracite root-only) | linting only    |
| Ruff   | Python packages (`ruff format` + `ruff check`, plus `mypy` & `pytest`) | format + lint   |

Formatting is never linted; linting is never formatted (zero stylistic rules in any linter).

## Oxfmt baseline (all projects)

1. **One root `.oxfmtrc.json`, no per-app overrides** — Copy `configs/.oxfmtrc.json` (`singleQuote: true`, `sortPackageJson: false`, `ignorePatterns: ["*.md"]`, plus `"**/next-env.d.ts"` in Next.js repos) to the repo root. Delete any app-level `.oxfmtrc.json` (config drift) and reformat from root.
2. **Tailwind class sorting** — Set `"sortTailwindcss": true` in Tailwind projects (built-in, no plugin).
3. **Markdown is never auto-formatted** — `*.md` stays in `ignorePatterns` so hand-wrapped rules, ADRs, and specs are not reflowed.

## Oxlint baseline (non-Next.js projects)

4. **Root config (`configs/.oxlintrc.json` or Ultracite `oxlint.config.ts`)** —
   - `categories`: `correctness: "error"`, `suspicious: "warn"`, `perf: "warn"`.
   - `plugins`: `["react", "react_perf", "typescript", "import", "jest", "vitest"]`.
   - `ignorePatterns`: `node_modules/**`, `dist/**`, `.next/**`, `coverage/**`, `.turbo/**`, `build/**`, `www/**`, `test-results/**`, `.expo/**`, `**/next-env.d.ts`.
5. **No type-aware linting** — Keep `typeAware`/`typeCheck` off so lint stays a fast save-time pass; semantic type checking belongs to `tsc` / `bun check`.
6. **`_`-prefix convention (never a silencer for real input)** — `no-unused-vars: ["error", { varsIgnorePattern: "^_", argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }]`. Prefixing a real input (a DTO, route param, or state setter) with `_` to silence lint is a **suppressed binding** bug — wire it or remove it. Valid `_` uses are signature-required placeholders only (guard params, `validate(_value, args)`, react-query `(_data, ...)`, test stubs).
7. **Discipline rules & NestJS decorator allowance** — `no-console: ["warn", { "allow": ["warn", "error"] }]`, `no-debugger: "warn"`, `no-explicit-any: "error"`, `eslint/no-underscore-dangle: "off"`, `react/no-array-index-key: "warn"`, `react/react-in-jsx-scope: "off"`, `import/no-duplicates: ["error", { "prefer-inline": true }]`, `import/no-named-as-default-member: "off"`, `import/no-unassigned-import: "off"`. NestJS repos add `typescript/no-extraneous-class: ["warn", { "allowWithDecorator": true }]`.
8. **Scoped test leniency** — Only `**/*.{test,spec}.{ts,tsx}` overrides disable `no-explicit-any`, `expect-expect`, `no-conditional-expect`, `valid-title`, and `require-mock-type-parameters`. App code never inherits test leniency.
9. **300-line cap (`max-lines: ["error", 300]`) — always run the formatter BEFORE the linter** — `oxfmt` expands compact single-line JSX props, objects, and destructuring by **1.4×–2.5×**. Running the linter before the formatter gives a false-green that fails at commit time under `lint-staged`. Always run the formatter first (`oxfmt <paths> && oxlint --max-warnings=0 <paths>`). Target **≤250 formatted lines** when authoring new components and **≤290 formatted lines** on near-cap edits (Precedent: Gia Su Anh Minh 2026-10 — 65 subagent files expanded past 300 lines on `oxfmt`).
9b. **Bun 1.4.4+ `bun fmt` may replace the `oxfmt` binary — never the config** — `bun fmt` reads the repo's oxfmt config and matches its output, but only with that config present. Verify per repo with a bidirectional check (`bun fmt` output passes `oxfmt --check` and vice versa) on the full tree. Do not migrate the config into `bunfig.toml [fmt]`: without the oxfmt config Bun falls back to its own printer, which reformatted 510 of 806 files on Gia Su Anh Minh 2026-10 (same tree: 3 files under oxfmt config), including lines over print width. `bun fmt --staged` (formats and re-stages staged files) may replace the formatter entry in `lint-staged`; keep the linter entry.
10. **Resolve findings in code or config `overrides`, never inline disable comments** — Baseline `oxlint` ignores inline comments (`eslint-disable-next-line`, `oxlint-ignore-next-line`, `oxlint-disable-next-line`), so inline comments are dead code wearing a disguise. Fix the code, or place legitimate framework/target carve-outs in a scoped `overrides` block in config with a comment explaining why. Grep for `disable-next-line|oxlint-ignore` before claiming zero findings.

## ESLint baseline (Next.js apps only)

11. **App-level `eslint.config.mjs` (or root Ultracite `oxlint.config.ts`)** — Standard monorepos place `configs/eslint.config.mjs` at `apps/<app>/eslint.config.mjs` (`eslint-config-next/core-web-vitals`, `eslint-config-next/typescript`, `tseslint.configs.recommended`, `^_` unused-vars patterns, `import/no-duplicates` inline, `eslint-config-prettier` last). *Exception*: Ultracite root-only repos (`ultracite/oxlint/nextjs`, ADR-0005) lint all workspaces with root `oxlint --max-warnings=0` and forbid per-app ESLint configs.
12. **`react-hooks` rules stay ON** — Keep `react-hooks/set-state-in-effect`, `react-hooks/immutability`, and `react-hooks/refs` enabled; disable per-project only with a `// ponytail:` trigger comment after confirming a genuine pervasive conflict.

## Pre-commit & dead exports

13. **`lint-staged` isolation** — Run `oxfmt` + `oxlint --fix` (`eslint --fix` for Next.js) on staged files:
    - Exclude ESLint-owned Next.js apps from the `oxlint` glob (`"!(apps/web|apps/portal)/**/*.{ts,tsx,js,jsx}"`) so Next-only commits never fail with `No files found to lint` (Precedent: Ecopick 2026-10, PR #453).
    - Scope workspace-owned formatters to their workspace and swallow appended file args: `"*.prisma": "bash -c 'pnpm --filter @acme/api exec prisma format' --"`.
14. **Orphan-export check after symbol swaps** — Neither `oxlint` nor `ESLint` flags unused `export` bindings. Whenever an edit removes the last reference to an exported constant, type, or helper, grep the repo for its name and delete the orphan definition in the same commit.

## Python baseline

15. **One root `ruff.toml`: `ruff format` + `ruff check` + `mypy` + `pytest`** — Select `E`, `F`, `I`, `UP`, `B`, `SIM`, `PTH`, `RUF` and ignore `E501`. Disable `RUF001`–`RUF003` in `ruff.toml` for projects carrying Vietnamese copy or mathematical symbols (en-dash `–`, `×`, `−`, Greek letters θ/α). Never create per-package `ruff.toml` files.
