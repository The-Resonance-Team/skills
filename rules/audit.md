---
id: "audit"
name: "Codebase Audit Rules — team-rule compliance, slop, dead code, production risk"
kind: "rule"
description: "Applies to any repo running a full-codebase audit (`workflows/codebase-audit.md`) or a diff/slice audit."
scope: "Any repo or slice under audit"
priority: "mandatory"
---
# Codebase Audit Rules — team-rule compliance, slop, dead code, production risk

<!-- rule: module-context -->
0. **Module context** — Apply this context when the module applies.

Applies to any repo running a full-codebase audit (`workflows/codebase-audit.md`) or a diff/slice audit.

## Verdicts & evidence

<!-- rule: every-source-file-gets-a-ver -->
1. **Every source file gets a verdict** — `clean` or one or more findings. A slice audit completes when every file in the slice carries a verdict.
<!-- rule: every-finding-cites-fileline -->
2. **Every finding cites `file:line` evidence** — Include `file:line`, category, and a one-line description. Re-verify dead-code claims with a repo-wide exact-word `rg -w` count before flagging (re-exports and test seams count as live).
<!-- rule: report-before-fixing -->
3. **Report before fixing** — Present the merged report and wait for human approval before editing. Re-run `bun fmt`, `bun lint --no-script --allow-unsupported`, typecheck, and tests after applying fixes.

## Slop checklist (`category: slop`)

<!-- rule: comments-carry-what-code-can -->
4. **Comments carry what code cannot** — Classify every comment and keep only the ones that carry non-obvious information:
   - **Tautology** — restates the adjacent code; delete it.
   - **Stale** — names removed code or a past implementation; delete it.
   - **Excuse** — justifies a hack (`TODO:`, `FIXME`, `ponytail:`, `workaround`); delete it and file one aggregate issue for the fix.
   - **Decision** — records a non-obvious choice; keep it in place, and move it to an ADR only when it is hard to reverse, surprising without context, and the result of a real trade-off.
   When a comment is ambiguous and deletion would lose information, keep it and open an issue. Never delete a whole design block because a marker appears deep inside it. Ratchet removals against a pinned commit with `git diff`, so no generated baseline file needs maintenance when code changes.
<!-- rule: trusted-paths-run-bare -->
5. **Trusted paths run bare** — Flag defensive null-checks, try/catch wrappers, and fallback defaults on internal calls whose contract we control end to end.
<!-- rule: types-are-real-types -->
6. **Types are real types** — Flag `as any`, `as unknown as T`, `@ts-ignore`, and bare `!` non-null assertions that silence the compiler instead of validating or typing the boundary.
<!-- rule: abstractions-earn-their-seco -->
7. **Abstractions earn their second use** — Flag single-implementation interfaces, single-product factories, and pass-through wrappers; inline them.
<!-- rule: early-returns-over-deep-nest -->
8. **Early returns over deep nesting** — Flag nesting past three levels that guard clauses flatten.
<!-- rule: the-file-reads-as-one-hand -->
9. **The file reads as one hand** — Flag naming, error handling, or import conventions that clash with the surrounding file.

## Suppression & test checklists (`category: suppression` / `test`)

<!-- rule: zero-inline-suppression-dire -->
10. **Zero inline suppression directives** — Grep each slice for `eslint-disable`, `oxlint-disable`, `oxlint-ignore`, `biome-ignore`, `ts-ignore`, `ts-expect-error`, and `prettier-ignore`. In baseline `bun lint`, inline disables are ignored dead code (`rules/linting.md` #10): fix the code or move legitimate framework carve-outs into a scoped config `overrides` block with a reason comment. In ESLint/typecheck where directives run, any surviving directive must be single-line with a blocker reason.
<!-- rule: every-test-fails-on-a-real-r -->
11. **Every test fails on a real regression** — Flag tests with no assertions, tautologies (`expect(true).toBe(true)`), and mock-echoes (asserting what a mock was stubbed to return). Replace slop tests covering live behavior with behavioral tests in the same pass — never just delete coverage.

## Production-risk & dead-code checklists (`category: risk` / `dead-code`)

<!-- rule: no-secrets-in-the-tree -->
12. **No secrets in the tree** — Flag keys, tokens, and connection strings in source, committed env files, or git history; rotate first, clean second.
<!-- rule: dependency-health -->
13. **Dependency health** — Flag known CVEs (`pnpm audit --audit-level=high`), deprecated packages, duplicate library versions, and incompatible licenses.
<!-- rule: failures-surface-and-logs-st -->
14. **Failures surface & logs stay PII-free** — Flag empty catches, swallowed promise rejections, log-and-continue on money/data paths, and personal identifiers (emails, tokens, phone numbers) in logs or telemetry.
<!-- rule: bounded-state-and-resource-c -->
15. **Bounded state & resource cleanup** — Flag unbounded in-memory `Map`/`Set` collections (missing `MAX_ENTRIES`/TTL/FIFO eviction), SSE endpoints missing `res.once('close')`, dangling stream readers/timers on unmount, and render-phase `URL.createObjectURL` calls (`rules/frontend.md` #18, `rules/nestjs.md` #24).
<!-- rule: no-dead-exports-unreachable -->
16. **No dead exports, unreachable branches, commented-out code, or stale config refs** — Flag exports with zero repo-wide consumers, conditions no caller can satisfy, commented-out code blocks, and env vars/scripts/paths missing from `package.json` or `.env.example`. Extend the sweep to ADR/PRD/README/CI comments and framework shortcuts that still describe a deleted symbol (`rules/general.md` #21).

## Team-rule, baseline & slice-type checklists (`category: rule` / `config-drift` / `library`)

<!-- rule: rule-config-and-library-comp -->
17. **Rule, config, and library compliance** — Discover the project's applicable modules through the rules MCP and check every file against them (`rule`), compare local lint/format/Dependabot configs against `configs/` (`config-drift`), and verify every covered concern uses its assigned library in `rules/libraries.md` (`library`).
<!-- rule: slice-type-checks -->
18. **Slice-type checks**:
    - **Frontend**: interactive controls carry accessible names (`aria-hidden="true"` on icon-font ligatures), keyboard/focus flows work, WCAG AA contrast passes, object URLs revoke on unmount, no unlayered CSS resets overriding Tailwind v4 `@layer utilities`, and UI/UX tokens, responsive layouts, component naming, and copy adhere to root `DESIGN.md` (`rules/frontend.md` #21). Scan slices with Modern Web Guidance (`npx modern-web-guidance legacy-scan <slice> --json`) and assert: custom Enter keydown listeners are IME-safe (`rules/frontend.md` #28), scrollbars declare standard `scrollbar-color` in `@layer base` (`rules/frontend.md` #29), text controls style `:user-invalid` and `aria-invalid` (`rules/frontend.md` #30), and primary above-the-fold media declares `priority` (`rules/frontend.md` #31).
    - **Prisma**: migrations checked for destructive ops and schema drift (`prisma migrate diff --from-migrations prisma/migrations --to-schema prisma --exit-code`), queried columns indexed, `select` shapes include required relations (`rules/prisma.md`).
    - **API**: every route enforces auth guards, every trust boundary validates with a DTO class, stateful maps bounded, streaming endpoints handle disconnect (`rules/nestjs.md`).
    - **i18n**: all UI chrome strings live in `{vi,en}` catalogs with parity, zero machinery or enum leaks in catalogs or `.tsx` sources, generated index/error-code files current (`rules/i18n.md` #18–22).
    - **Fixtures**: seed/fixture paths typechecked and excluded from the runtime build, production algorithms imported (not copied), one model registry, per-domain RNG and timezone anchor, one persona registry, schema-coupled defaults asserted, destructive guard fail-closed (`rules/fixtures.md`).
    - **E2E**: one env/port module, one persona registry, one coverage fixture, no hardcoded origins, skip-not-pass on missing fixtures, asserted cleanup, gated-route parity, no bare `test.fail()` removal (`rules/e2e-testing.md` #16–20).
    - **Infra & Docker**: all `Dockerfile`s (`infra/docker/api.Dockerfile`, parameterized `infra/docker/portal.Dockerfile`) and reverse-proxy configs (`infra/nginx/default.conf`) live under `infra/` with a single root `.dockerignore` and zero scattered `apps/*/Dockerfile` or `apps/*/.dockerignore` files (`rules/github-vps-deploy.md` #9).
