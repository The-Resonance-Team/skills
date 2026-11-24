# Test Rules — determinism, low-value tests and comment audits

Applies to repos where CI runs a test command under a pinned runtime version, and to any repo running a test/comment-code audit. This module carries both the rules and the audit procedure. Consumers without a CI test job or a test/comment audit omit this file.

## Verdicts & evidence

1. **Every source file gets a verdict** — `clean` or one or more findings with `file:line` evidence.
2. **Report before fixing** — present the merged report and wait for approval before editing. Re-run format, lint, typecheck, and tests after applying fixes.
3. **Re-verify** dead-code and unused-symbol claims with a repo-wide exact-word count before flagging (re-exports and test seams count as live).
4. **Slice-type checks** still apply: frontend, Prisma, API, i18n, fixtures, e2e per `rules/audit.md` #18.

## Low-value tests (`category: test`)

A test is low-value when it fails to catch a real regression. Flag and fix:

5. **No assertions** — a test body with zero `expect`/`assert`.
6. **Tautologies** — `expect(true).toBe(true)`, or comparing a value to itself or to a recomputation of the same input.
7. **Mock-echoes** — asserting a mock returns the value it was stubbed to return.
8. **Mock-wiring** — asserting only that a stubbed collaborator was called with stubbed args; no behavior exercised.
9. **Trivial projections** — asserting a mapper copies fields 1:1 with no branching, transformation, or boundary.
10. **Constant pins** — asserting a named constant equals its literal value; cover the threshold through behavior instead.
11. **Weak assertions** — `typeof x === "string"` for every element, `.toHaveLength(1)` with no shape check, `.success` booleans only.
12. **Repeated scripted cases** — multiple tests asserting the identical branch for distinct but equivalent inputs; collapse to a table-driven case.
13. **Single-branch gates** — a boolean gate tested on one of four combinations.

Fix rule: **never just delete coverage for live behavior.** Replace a slop test with a behavioral test in the same pass; deletion is allowed only when the scenario is a duplicate or a constant pin with no behavior to assert.

## Comment code (`category: slop` / `suppression`)

14. **Narrating comments** — comments that restate the adjacent line or narrate obvious steps. Keep intent, rationale, gotchas, and non-obvious invariants.
15. **Commented-out code** — dead blocks left in source; delete them.
16. **Suppression directives without reason** — inline `eslint-disable`/`oxlint-disable`/`ts-ignore` with no blocker reason, and file-level disables. Fix the code, or move a legitimate carve-out into a scoped config `overrides` block with a reason comment.

## Runtime parity & child processes (mandatory)

17. **Run the gate with the CI-pinned runtime before push** — Use `npx -y bun@<pinned version> run verify` (or the Node version in `package.json#engines`), not the local binary. A local canary build hides stable-only failures. Completion: the gate passes under the same version CI installs. Precedent: Graveshift 2026-11 — local Bun canary passed 1336 tests; CI Bun 1.4.4 stable found four failures.

18. **Read failed CI checks before editing code** — Run `gh run view <id> --log-failed` and reproduce with the pinned runtime. Completion: each red check has a named root cause before a fix is written.

19. **Spawn test children with an env allowlist** — Pass `PATH` and the named boot variables only. Forwarding `process.env` leaks runner variables and secrets into the child and can stop boot. Completion: the child receives only listed names. Precedent: Graveshift 2026-11 — an MCP stdio smoke test exited in CI alone.

## Assertions (mandatory)

20. **Assert invariants, not incidental layout** — Exempt paths the runtime controls, such as the directory holding `process.execPath`, from checks that reject host-home paths. Completion: the assertion still rejects every other host-home path.

21. **Parse recorded call arguments with a schema before asserting** — Do not read a property after `toMatchObject` with `expect.stringContaining`; Bun 1.4.4 stable mutates the received value to `{}`. Completion: assertions read a parsed copy.

22. **Use `%#` in `test.each` titles when inputs hold BigInt or complex values** — `%j` calls `JSON.stringify` and throws an unhandled error between tests while every test still reports pass. Completion: the table runs with zero unhandled errors.

## Runner environment (mandatory)

23. **Run the gate in a clean runner-like environment before push** — Use the pinned runtime with a fresh empty `TMPDIR` and a `PATH` that excludes local-only tools. A rich developer environment hides host-only temp paths and locally installed CLIs. Completion: the gate passes with the pinned runtime and the reduced environment. Precedent: owobot-tools 2026-11 — `mkdtemp(join(tmpdir(), 'opencode', ...))` passed locally and failed on CI with `ENOENT`.

24. **Stub external CLI tools in tests** — A test must not require a host-installed binary. Inject a deterministic stub through the existing tool seam or a temp script. Completion: the test passes with that tool absent from `PATH`. Precedent: owobot-tools 2026-11 — an OCR conformance test needed ImageMagick 7, which the Ubuntu runner did not provide.

## Module isolation (mandatory)

25. **Isolate test files that mock shared modules** — Bun stable shares one module registry across test files. A mock in one file leaks into another and changes results by file order. Run the affected suite with `--isolate` when files mock the same module with different shapes. Completion: the suite passes under the pinned runtime with per-file isolation enabled, and no test depends on another file's mock. Precedent: owobot-tools 2026-11 — two TUI files mocked the settings client with different schemas; 11 tests failed on CI stable and passed with `--isolate`.

## Audit procedure

26. **Inventory → slices** — List test files and source directories (`find`, `package.json` workspaces). Partition into slices: one package or directory subtree per subagent. Record every test path.

27. **Dispatch subagents** — Run one subagent per slice in parallel. Each prompt carries: the slice's paths, the relevant rules in this module, the report format below, and the slice type (frontend, API, package, worker). Each subagent returns a findings table. Completion criterion: every test file in the slice carries a verdict, and every finding cites `file:line`.

28. **Merge** — Dedupe findings shared across slices. Merge into one table:

| Category | Location | Finding | Action | Status |
| -------- | -------- | ------- | ------ | ------ |

Categories: `test` (low-value test), `slop` (narrating comment / commented-out code), `suppression`.

29. **Report gate** — Present the merged report. Wait for approval before editing.

30. **Implement** — Apply fixes per the rules: replace slop tests covering live behavior with behavioral tests in the same pass; delete only duplicates and constant pins. Remove narrating comments and commented-out code. Remove or reason suppression directives; move legitimate carve-outs to scoped config overrides. Re-run format, lint, typecheck, and tests after applying. Update the audit file's status column.

31. **Retro (optional)** — Run `retro` to capture new rules or checks the audit exposed.
