# Lint & Format Baseline — Oxfmt, Oxlint, Ruff (Python)

Applies to every TypeScript/JavaScript and Python project in the organization. Machine-readable configs ship in `configs/`.

## Scope & tool split

| Tool   | Applies to                                                             | Job             |
| ------ | ---------------------------------------------------------------------- | --------------- |
| Oxfmt  | all TS/JS/JSON/YAML/CSS projects (`configs/.oxfmtrc.json`)             | formatting only |
| Oxlint | all TS/JS projects, Next.js included (`configs/.oxlintrc.json`)        | linting only    |
| Ruff   | Python packages (`ruff format` + `ruff check`, plus `mypy` & `pytest`) | format + lint   |

Formatting is never linted; linting is never formatted (zero stylistic rules in any linter).

## Oxfmt baseline (all projects)

1. **One root `.oxfmtrc.json`, no per-app overrides** — Copy `configs/.oxfmtrc.json` (`singleQuote: true`, `sortPackageJson: false`, `ignorePatterns: ["*.md"]`, plus `"**/next-env.d.ts"` in Next.js repos) to the repo root. Delete any app-level `.oxfmtrc.json` (config drift) and reformat from root.
2. **Tailwind class sorting** — Set `"sortTailwindcss": true` in Tailwind projects (built-in, no plugin).
3. **Markdown is never auto-formatted** — `*.md` stays in `ignorePatterns` so hand-wrapped rules, ADRs, and specs are not reflowed.

## Oxlint baseline (all TS/JS projects)

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

## Next.js linting (`oxlint` `nextjs` plugin)

11. **Root `oxlint` (`plugins: ["nextjs"]`) owns every Next.js app — no per-app `eslint.config.mjs`** — Lint all workspaces, Next.js included, with root `oxlint --max-warnings=0` (`.oxlintrc.json` or `oxlint.config.ts` with `plugins: ["nextjs"]`) and forbid per-app ESLint/Prettier configs. Repos still on per-app `eslint.config.mjs`: port the rules to scoped `overrides` (keep `// ponytail:` trigger comments), delete `apps/<app>/eslint.config.mjs`, drop `eslint*` devDeps (Precedent: VibeHost 2026-10 — root `oxlint --max-warnings=0` lints all six Next.js apps clean).
12. **`react-hooks` rules stay ON** — Keep `react-hooks/set-state-in-effect`, `react-hooks/immutability`, and `react-hooks/refs` enabled; disable per-project only with a `// ponytail:` trigger comment after confirming a genuine pervasive conflict.

## Pre-commit & dead exports

13. **`lint-staged` carries lint-fix tasks only — the formatter runs exactly once, after it** — Keep `oxlint --fix` in `lint-staged`. Never list the formatter there when the hook also runs `bun fmt --staged`: one `--staged` run formats every staged file idempotently, a second run only slows the hook (Precedent: VibeHost 2026-10 — `bun fmt` in `lint-staged` duplicated hook-level `bun fmt --staged`). Fix-then-format: `--fix` mutates code, so a fix applied after formatting can leave unformatted code that nothing later catches (formatting is never linted). Hook shape:
    ```sh
    bunx lint-staged   # oxlint --fix only — no formatter entry
    bun fmt --staged   # single format pass, re-stages
    bun run lint
    bun run typecheck
    ```
    - Scope workspace-owned formatters to their workspace and swallow appended file args: `"*.prisma": "bash -c 'pnpm --filter @acme/api exec prisma format' --"`.
13b. **Pre-commit runs lint-staged → fmt → full `lint` → `typecheck`; full `test` stays in CI** — The hook must be deterministic and DB-free: staged fix first, then `bun fmt --staged` (formats and re-stages — the committed shape), then the repo's own gates (`lint:boundaries` plus custom checks — not just the linter binary CI also runs) on that final shape so `max-lines` is enforced after `bun fmt` expansion, then typecheck. Keep the full test suite in CI, where the database is guaranteed: a DB-dependent hook red-bars behavior-untouched commits on a cold cache (Precedent: Gia Su Anh Minh 2026-10 — hook ~5s with `lint` 3.4s cold and `typecheck` 1.3s cached; `test` runs in the CI `test` + `verify` jobs).

14. **Orphan-export check after symbol swaps** — No linter flags unused `export` bindings. Whenever an edit removes the last reference to an exported constant, type, or helper, grep the repo for its name and delete the orphan definition in the same commit.

## Python baseline

15. **One root `ruff.toml`: `ruff format` + `ruff check` + `mypy` + `pytest`** — Select `E`, `F`, `I`, `UP`, `B`, `SIM`, `PTH`, `RUF` and ignore `E501`. Disable `RUF001`–`RUF003` in `ruff.toml` for projects carrying Vietnamese copy or mathematical symbols (en-dash `–`, `×`, `−`, Greek letters θ/α). Never create per-package `ruff.toml` files.
