# Retro: codebase audit — dead code, duplication, complexity (XaDaoXa PRs #257–#259)

## What I did

Audited XaDaoXa-Platform for dead code, duplicated business logic, and complex
logic via three parallel explore subagents, grilled the user through two
question rounds (12 decisions), then executed as three branches: `chore/dead-code`
(+5/−536, pure deletions), `refactor/shared-labels-drift` (stacked; canonical Vi
labels + shared helpers in `@xadaoxa/types`, CMS inbox state-machine deletion),
`refactor/api-complexity` (10 mechanical simplifications + FAQ repo split). Opened
PRs #257/#258/#259. CI failed on the `pnpm audit` gate — a pre-existing main
breakage (new multer/js-yaml/svgo advisories) — fixed via workspace overrides.
#257's CMS E2E failed 3 tests once, passed on rerun with zero code changes.

## Baseline facts

| Fact | Source |
| ---- | ------ |
| Scan claimed "23 dead types, HIGH confidence"; 3+ were live (portal re-exports `DirectoryCluster`, `DirectoryStaff`, `PublicProductListItem`) | `apps/portal/src/types.ts` re-export list vs scan report, 2026-09-10 |
| `pnpm-workspace.yaml` `overrides` fully shadows root `package.json` `overrides` | installed fast-uri 3.1.6 / nanoid 3.3.18 match workspace pins, not package.json's 3.1.5 / 3.3.17 |
| `@nestjs/platform-express@12.0.1` pins `multer` exact `2.2.0`; zmp-cli wants v1 (forced to v2 by old `multer@^1` pin) | `pnpm view`, lockfile, 2026-09-10 |
| `pnpm install` after pin bumps: "Already up to date", lockfile untouched; `pnpm update multer@2.3.0` rejected ("drop the version"); bare `pnpm update multer` obeyed pins | terminal transcripts, 2026-09-10 |
| CI triggers `pull_request: branches: [main]` only; #258 (base `chore/dead-code`) ran zero CI jobs | `.github/workflows/ci.yml:1-9`, PR #258 checks page |
| CMS E2E: 3 tests failed 4/4 attempts (initial + `retries: 3`) on #257, passed on rerun, no code delta | runs `34444334973` (fail) vs rerun (success) |
| Playwright config comment says `retries: 2`; code says `retries: 3` | `apps/cms/playwright.config.ts:40` vs `:72` |
| `minimumReleaseAgeExclude` already listed `multer@2.3.0` before this session | `pnpm-workspace.yaml`, pre-existing line |
| `gh run view --job --log` refuses while a run is in progress; `gh api .../jobs/{id}` step conclusions work anytime | terminal transcripts, 2026-09-10 |

## 1. Stacked PRs silently skip CI (highest severity)

`ci.yml` triggers `pull_request` on `branches: [main]` only, so #258 — targeting
`chore/dead-code` — ran no Lint/Typecheck/Test/Build at all. A stacked PR can be
reviewed and merged into its base with zero checks ever executing; the failure
only surfaces after rebase onto `main`. Either extend the trigger to stacked
bases or adopt "stacked PRs still target main" as policy.
→ Candidate rule for `rules/github-ci.md`.

## 2. Scan-agent confidence is not verification

The dead-code scan's HIGH-confidence list contained live symbols; only a
per-symbol `rg -w` re-check before each deletion caught it (including one
`CaseFileListRow` re-export the scan's own exclusion filter had hidden from
itself). Trusting the report would have broken the portal build.
→ Two options: add `knip` (unused-export checker) as a CI gate so the machine
does the counting, or keep the verify-before-delete discipline and say so in
`rules/audit.md`. The former removes the human loop; prefer it.

## 3. Root `package.json` `overrides` is dead config

Workspace overrides win outright (fact table), so the root block
(`brace-expansion`, `js-yaml`, `fast-uri`, `uuid`, …) is a cache that lies —
my first fix attempt edited it and `pnpm install` no-op'd. An agent reading the
repo will make the same mistake.
→ Delete the root block; `pnpm-workspace.yaml` is the single source of truth.
Small, safe, kills a variance trap.

## 4. CMS E2E failure was state, not timing — retries can't fix that class

Three specs (appointments reschedule, inbox assign, change-password) failed
every attempt on one run and passed on rerun untouched. `retries: 3` already
exists and burned 4 attempts per test without helping: retrying a poisoned
seed/state just fails slower. All three depend on seeded staff/appointment rows.
→ Investigate seed isolation for those specs, not higher timeouts. Drive-by:
fix the stale `retries: 2` comment at `playwright.config.ts:72`.

## 5. Override-pin bump procedure is tribal knowledge

Correct sequence: bump the pin in `pnpm-workspace.yaml`, then bare
`pnpm update <pkg>` (explicit versions are rejected when a pin exists;
`install` alone re-resolves nothing). I found this by trial and error across
four commands, including one edit to the wrong file (§3).
→ One-line rule candidate for `rules/dependabot.md`: pins first, then
`pnpm update`, then `pnpm audit --audit-level=high` to confirm exit 0.

## 6. Pre-existing red main blocked every PR at once

The audit gate failed identically on all three branches because the advisories
postdated the lockfile — main itself was red. The repo's mechanisms are good
(range-selector pins, `auditConfig.ignoreGhsas` with reasons,
`minimumReleaseAgeExclude` — which even pre-staged `multer@2.3.0`), but nothing
surfaces new advisories until a PR happens to run.
→ Consider a scheduled audit run (or confirm Dependabot covers transitive
security bumps) so main never sits red unnoticed.

## 7. Editor format-on-save fought the edit tool

Early file edits came back reformatted to Prettier-default style (double
quotes, ~70-col wrap) instead of the repo's oxfmt, breaking subsequent
exact-match edits until I reverted with `git checkout -- apps/` and switched to
read-then-edit with a final `pnpm format`. CI gates `format:check`, so the end
state was clean, but one revert cycle was pure waste.
→ Align any format-on-save with `oxfmt`, or make "run `pnpm format` after edit
batches" an explicit step. Cannot fully diagnose from here — flagging the
symptom.

## Footnotes (low severity, no action proposed)

- `rg -rl "pattern"` parses as `-r l` (replace with "l" in stdout): misleading
  output that cost one verification detour. Prefer `rg -l`.
- The three scan reports landed fully in-context (~tens of KB). For future
  audits, have subagents write findings to a scratch file and return the top N.
- Grilling structure worked: two rounds, 12 questions, zero rework downstream;
  the one factual question (login-failure clearing) was self-resolved by grep
  rather than asked. CONTEXT.md glossary write-down held up through
  implementation. No change.
