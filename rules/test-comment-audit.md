# Low-Value Test & Comment-Code Audit Rules

Applies to any repo running a test/comment-code audit (see `workflows/test-comment-audit.md`).

## Verdicts

1. **Every source file gets a verdict** — `clean` or one or more findings with `file:line` evidence.
2. **Report before fixing** — present the merged report and wait for approval before editing. Re-run format, lint, typecheck, and tests after applying fixes.

## Low-value tests (`category: test`)

A test is low-value when it fails to catch a real regression. Flag and fix:

3. **No assertions** — a test body with zero `expect`/`assert`.
4. **Tautologies** — `expect(true).toBe(true)`, or comparing a value to itself or to a recomputation of the same input.
5. **Mock-echoes** — asserting a mock returns the value it was stubbed to return.
6. **Mock-wiring** — asserting only that a stubbed collaborator was called with stubbed args; no behavior exercised.
7. **Trivial projections** — asserting a mapper copies fields 1:1 with no branching, transformation, or boundary.
8. **Constant pins** — asserting a named constant equals its literal value; cover the threshold through behavior instead.
9. **Weak assertions** — `typeof x === "string"` for every element, `.toHaveLength(1)` with no shape check, `.success` booleans only.
10. **Repeated scripted cases** — multiple tests asserting the identical branch for distinct but equivalent inputs; collapse to a table-driven case.
11. **Single-branch gates** — a boolean gate tested on one of four combinations.

Fix rule: **never just delete coverage for live behavior.** Replace a slop test with a behavioral test in the same pass; deletion is allowed only when the scenario is a duplicate or a constant pin with no behavior to assert.

## Comment code (`category: slop` / `suppression`)

12. **Narrating comments** — comments that restate the adjacent line or narrate obvious steps. Keep intent, rationale, gotchas, and non-obvious invariants.
13. **Commented-out code** — dead blocks left in source; delete them.
14. **Suppression directives without reason** — inline `eslint-disable`/`oxlint-disable`/`ts-ignore` with no blocker reason, and file-level disables. Fix the code, or move a legitimate carve-out into a scoped config `overrides` block with a reason comment.

## Evidence

15. **Re-verify** dead-code and unused-symbol claims with a repo-wide exact-word count before flagging (re-exports and test seams count as live).
16. **Slice-type checks** still apply: frontend, Prisma, API, i18n, fixtures, e2e per `rules/audit.md` §18.