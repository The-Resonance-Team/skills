# Codebase Audit Rules — team-rule compliance, slop, dead code, production risk

Applies to any repo running a full-codebase audit (`workflows/codebase-audit.md`) or a diff/slice audit.

## Verdicts & evidence

1. **Every source file gets a verdict** — `clean` or one or more findings. A slice audit completes when every file in the slice carries a verdict.
2. **Every finding cites `file:line` evidence** — Include `file:line`, category, and a one-line description. Re-verify dead-code claims with a repo-wide exact-word `rg -w` count before flagging (re-exports and test seams count as live).
3. **Report before fixing** — Present the merged report and wait for human approval before editing. Re-run `bun fmt`, `oxlint`, typecheck, and tests after applying fixes.

## Slop checklist (`category: slop`)

4. **Comments carry what code cannot** — Flag comments that restate the adjacent line or narrate obvious steps; keep only intent, rationale, or gotchas.
5. **Trusted paths run bare** — Flag defensive null-checks, try/catch wrappers, and fallback defaults on internal calls whose contract we control end to end.
6. **Types are real types** — Flag `as any`, `as unknown as T`, `@ts-ignore`, and bare `!` non-null assertions that silence the compiler instead of validating or typing the boundary.
7. **Abstractions earn their second use** — Flag single-implementation interfaces, single-product factories, and pass-through wrappers; inline them.
8. **Early returns over deep nesting** — Flag nesting past three levels that guard clauses flatten.
9. **The file reads as one hand** — Flag naming, error handling, or import conventions that clash with the surrounding file.

## Suppression & test checklists (`category: suppression` / `test`)

10. **Zero inline suppression directives** — Grep each slice for `eslint-disable`, `oxlint-disable`, `oxlint-ignore`, `biome-ignore`, `ts-ignore`, `ts-expect-error`, and `prettier-ignore`. In baseline `oxlint`, inline disables are ignored dead code (`rules/linting.md` #10): fix the code or move legitimate framework carve-outs into a scoped config `overrides` block with a reason comment. In ESLint/typecheck where directives run, any surviving directive must be single-line with a blocker reason.
11. **Every test fails on a real regression** — Flag tests with no assertions, tautologies (`expect(true).toBe(true)`), and mock-echoes (asserting what a mock was stubbed to return). Replace slop tests covering live behavior with behavioral tests in the same pass — never just delete coverage.

## Production-risk & dead-code checklists (`category: risk` / `dead-code`)

12. **No secrets in the tree** — Flag keys, tokens, and connection strings in source, committed env files, or git history; rotate first, clean second.
13. **Dependency health** — Flag known CVEs (`pnpm audit --audit-level=high`), deprecated packages, duplicate library versions, and incompatible licenses.
14. **Failures surface & logs stay PII-free** — Flag empty catches, swallowed promise rejections, log-and-continue on money/data paths, and personal identifiers (emails, tokens, phone numbers) in logs or telemetry.
15. **Bounded state & resource cleanup** — Flag unbounded in-memory `Map`/`Set` collections (missing `MAX_ENTRIES`/TTL/FIFO eviction), SSE endpoints missing `res.once('close')`, dangling stream readers/timers on unmount, and render-phase `URL.createObjectURL` calls (`rules/frontend.md` #18, `rules/nestjs.md` #24).
16. **No dead exports, unreachable branches, commented-out code, or stale config refs** — Flag exports with zero repo-wide consumers, conditions no caller can satisfy, commented-out code blocks, and env vars/scripts/paths missing from `package.json` or `.env.example`.

## Team-rule, baseline & slice-type checklists (`category: rule` / `config-drift` / `library`)

17. **Rule, config, and library compliance** — Fetch the project's applicable modules from `CONTEXT.md` and check every file against them (`rule`), compare local lint/format/Dependabot configs against `configs/` (`config-drift`), and verify every covered concern uses its assigned library in `rules/libraries.md` (`library`).
18. **Slice-type checks**:
    - **Frontend**: interactive controls carry accessible names (`aria-hidden="true"` on icon-font ligatures), keyboard/focus flows work, WCAG AA contrast passes, object URLs revoke on unmount, no unlayered CSS resets overriding Tailwind v4 `@layer utilities`, and UI/UX tokens, responsive layouts, component naming, and copy adhere to root `DESIGN.md` (`rules/frontend.md` #21).
    - **Prisma**: migrations checked for destructive ops, queried columns indexed, `select` shapes include required relations (`rules/prisma.md`).
    - **API**: every route enforces auth guards, every trust boundary validates with a DTO class, stateful maps bounded, streaming endpoints handle disconnect (`rules/nestjs.md`).
    - **i18n**: all UI chrome strings live in `{vi,en}` catalogs with parity, zero machinery or enum leaks in catalogs or `.tsx` sources (`rules/i18n.md`).
    - **Infra & Docker**: all `Dockerfile`s (`infra/docker/api.Dockerfile`, parameterized `infra/docker/portal.Dockerfile`) and reverse-proxy configs (`infra/nginx/default.conf`) live under `infra/` with a single root `.dockerignore` and zero scattered `apps/*/Dockerfile` or `apps/*/.dockerignore` files (`rules/github-vps-deploy.md` #9).
