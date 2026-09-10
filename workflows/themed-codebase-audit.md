---
name: themed-codebase-audit
description: Audit a codebase along three themes — dead code, duplicated business logic, over-complex logic — via parallel scans, then grill the user to a shared understanding and execute in one branch per wave. Use when asked to find dead code, find duplication, simplify complex logic, or run "an audit like that one". For full rule-compliance sweeps sliced by package, use codebase-audit instead.
---

# Themed Codebase Audit

Three parallel theme scans, a grilling gate, then wave-branches. Fill the
bracketed variables per project before starting.

## 0. Variables

- `REPO` — absolute repo path. `STACK` — frameworks, package manager, workspace
  layout. `BASE` — base branch (usually `main`).
- Confirm the harness has: parallel subagents (or Task-style explore agents),
  `rg`, and the project's verify commands (typecheck / lint / format / test).

## 1. Scan (no edits)

Dispatch 3 explore subagents in parallel, one per theme. Each returns findings
only — no code changes.

1. **Dead code** — orphan files, exported symbols with zero repo-wide
   references, dead models/fields, dead dependencies, commented-out code. Cap
   ~25, highest confidence first. Per finding: file, symbol, evidence as a
   reference count ("N files reference it"), confidence high/med/low.
2. **Duplicated business logic** — the same rule in 2+ places (status labels,
   state machines, validators, formatters, API clients, constants). Cap ~15,
   drift-risk first. Per finding: concept, every `file:line` range, whether a
   shared home already exists, drift risk, and whether drift has ALREADY
   happened (quote the differing values).
3. **Complex logic** — files past the repo's split threshold, deep nesting,
   long functions, dead error paths, single-use abstractions. Cap ~12. Per
   finding: file, function + lines, what makes it hard to read, a ONE-LINE
   simplification.

Verification rules (bind all three): verify every symbol with a repo-wide
exact-word reference count — scan confidence is not truth. Read snippets, never
diagnose from filenames. Re-exports and same-name locals count as live until
proven otherwise. Test helpers and spec seams are not dead code.

## 2. Grill gate

Merge the three reports and dedupe. Then interview the user in rounds: numbered
questions (`❓ Q1…`), each with a recommended answer (`➡️`). Gather facts with
grep/subagents — never ask anything look-up-able. Genuine decisions only
(canonical wording, scope cuts, risk calls). **No edits until the user confirms
shared understanding.**

## 3. Execute

One branch per wave off `BASE` (stacked or independent — state which):
dead-code deletions, dedupe + drift fixes, complexity simplifications.
Per-edit rules:

- Re-verify each deletion at edit time. A re-fetch that looks dead may be
  load-bearing for freshness after an intervening write — read the surrounding
  writes first; when in doubt keep it with a comment.
- After each wave: typecheck + lint + format + full suites green, then commit.
- Open one PR per branch when all waves pass.

## 4. Report

Per branch: what was removed/unified/simplified, what was deliberately kept
(and why), what was deferred with the trigger for revisiting. Surface any CI
failure that is pre-existing on `BASE` separately from branch regressions —
verify by rerunning the failed job before blaming the diff.
