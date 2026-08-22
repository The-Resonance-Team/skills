# Codebase Audit Rules — team-rule compliance, slop, dead code, production risk

Applies to any repo running a full-codebase audit. The audit workflow (`workflows/codebase-audit.md`) fetches this file as the per-slice checklist. Load it directly when auditing a diff or a single file.

## Verdicts & evidence

1. **Every source file gets a verdict** — `clean` or one or more findings. A slice audit completes when every file in the slice carries a verdict.
2. **Every finding cites evidence** — `file:line`, category, one-line description. A finding without a line number is speculation; drop it.
3. **Report before fixing** — collect all findings into one report. Fixes happen after the human approves the report; a fix pass re-runs lint and typecheck before claiming done.

## Slop checklist

AI-generated slop patterns. Each item states the target state; flag files that miss it.

4. **Comments carry what the code cannot say** — a comment holds intent, a reason, or a gotcha. Flag comments that restate the adjacent line (`// set the value` above `value = x`) or narrate obvious steps.
5. **Trusted paths run bare** — internal calls between our own modules take the happy path. Flag defensive null-checks, try/catch wrappers, and fallback defaults on paths we control end to end.
6. **Types are real types** — data crosses boundaries through schemas and declared shapes. Flag `as any`, `@ts-ignore`, bare non-null assertions (`!`), and casts that silence the compiler instead of describing the shape.
7. **Abstractions earn their second use** — an interface, factory, strategy, or config object exists because a second implementation exists or is scheduled. Flag single-use scaffolding; inline it.
8. **Early returns over nesting** — guards exit first; the happy path sits at indent level one. Flag nesting past three levels that early returns flatten.
9. **The file reads as one hand** — naming, error style, import order match the surrounding file. Flag passages that read like a different author dropped in.

## Suppression checklist

10. **Zero suppression directives** — search each slice for `eslint-disable`, `oxlint-disable`, `biome-ignore`, `ts-ignore`, `ts-expect-error`, and `prettier-ignore`. Every hit is a finding under category `suppression`: resolve the underlying violation and delete the directive. A directive that survives review sits on exactly one line and carries a reason comment naming the blocker; block-level or reason-less suppressions resolve now.

## Test checklist

11. **Every test fails on a real regression** — break the behavior under test mentally; a test that still passes carries no value. That is the bar for both existing tests and replacements.
12. **Flag test slop** — tests with no assertions, tautologies (`expect(true).toBe(true)`), and mock-echoes (the test asserts what the mock was stubbed to return). Category `test`.
13. **Replace, never just delete** — a slop test covering live behavior gains a behavioral replacement in the same pass: real input, real output asserted, mocks only at true externals.

## Production-risk checklist

14. **No secrets in the tree** — keys, tokens, and connection strings stay out of source, committed env files, and git history. A hit rotates the credential first and cleans the tree second; treat it as an incident, not a style finding. Category `risk`.
15. **Dependencies carry current risk ratings** — flag known CVEs, deprecated packages, duplicate versions of one library, and licenses incompatible with the repo's. Category `risk`.
16. **Failures surface** — empty catches, swallowed promise rejections, and log-and-continue handlers on money and data paths are findings. Category `risk`.
17. **Logs stay free of personal data** — emails, tokens, and personal identifiers never reach log lines, telemetry payloads, or error reporters. Category `risk`.

## Dead code checklist

18. **Every export has a consumer** — search imports/usages before flagging; a hit anywhere in the repo keeps it alive.
19. **Every branch is reachable** — trace the callers; flag conditions no caller can satisfy.
20. **Commented-out code is deleted** — git history remembers; the working tree stays clean.
21. **Config references resolve** — every env var, script name, and path referenced in code exists in the environment (`package.json`, `.env.example`, configs). Flag stale references.

## Team-rule compliance checklist

22. **Apply the loaded rule modules** — fetch the modules this project needs via the `CONTEXT.md` router URLs, then check every file in the slice against every rule they contain. A rule violated anywhere in the slice is a finding under category `rule`.
23. **Configs match the baseline** — compare local lint/format configs against `configs/` of the skills repo. Drift resolves by unification, never by accommodation.
24. **Libraries match the baseline** — a concern covered by `rules/libraries.md` uses its assigned library; substitutes are findings.

## Slice-type checklists

Each slice applies the entry matching its dominant type; a mixed slice applies every matching entry.

25. **Frontend slices** — interactive elements carry accessible names, flows complete by keyboard, focus order follows reading order, contrast passes WCAG AA.
26. **Prisma slices** — migrations reviewed for destructive operations, queried columns carry indexes, schema matches the deployed state.
27. **API slices** — every route enforces authorization, every trust boundary validates input against a schema.
28. **i18n slices** — user-facing strings come from message catalogs; literals inside components are findings.
