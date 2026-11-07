---
name: codebase-audit
description: Audit the whole codebase in parallel subagent slices against the team-rule checklist — rule compliance, AI slop, dead code, suppressed linters, type safety, test slop, production risk. Use when asked to audit the codebase, check team-rule compliance repo-wide, find and remove AI slop and dead code across the repo, or scan for leaked secrets and risky dependencies.
---

# Codebase Audit Workflow

Audit every source file against `rules/audit.md` using one subagent per slice, then fix from an approved report. Fetch the checklist first:

```
https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/audit.md
```

## Process

### 1. Inventory → slices

List source directories and packages (`ls`, `package.json` workspaces). Partition them into **slices**: groups of paths that fit one subagent's context. One slice ≈ one package or directory subtree. Record every source path — the audit ends when each path sits in exactly one slice.

### 2. Dispatch subagents

Run one subagent per slice, in parallel. Each dispatch prompt carries three things:

1. The slice's paths.
2. The checklist (paste the fetched `rules/audit.md`, or its URL).
3. The report format below.
4. The slice's type (frontend, Prisma, API, i18n, or general) so the subagent applies the matching slice-type checklist entries.

Each subagent returns a findings table for its slice. Its completion criterion: **every source file in the slice carries a verdict**, and every finding cites `file:line` evidence.

### 3. Merge

Dedupe findings that two slices share (one symbol flagged twice). Merge into one table:

| Category | Severity | Location | Finding | Fix |
| -------- | -------- | -------- | ------- | --- |

Categories come from the checklist: `slop`, `suppression`, `test`, `dead-code`, `risk`, `rule`, `config-drift`, `library`, `ownership`.

### 4. Report gate

Present the merged table plus a count per category and the total files audited. Wait for approval before editing anything.

### 5. Fix pass

On approval, apply fixes slice by slice. After all fixes: run lint, typecheck, and tests; the pass completes when they pass and the diff contains no new findings. Deleted dead code stays deleted — restore only what a failing test proves alive.

### 5a. Wave gates & two-axis review

Do not run one large fix pass. Partition the approved findings into **waves** by dependency risk (safety → contracts → money → API boundaries → frontends → fixtures → deletions). Each wave lands in one commit per slice.

- **Per slice**: run the owning package's formatter, typecheck, lint, and targeted tests before moving on.
- **Per wave**: run the root gate (`bun fmt --check`, `bun lint`, `bun typecheck`, the full unit suite) and, where the repo has them, the composed API e2e and production builds.
- **Per wave review**: dispatch two read-only reviewers against the wave's fixed point. One checks **standards** (the repo's `rules/*.md` and design/copy contracts); one checks **spec** (the approved audit report and the plan). Each reports hard violations and judgement calls, quoting `file:line`.
- **Fix hard findings before the next wave.** Record a checkpoint with the fixed point and review range in the plan. A wave is done only when the root gate and both reviews are green.

This is the cheapest place to catch a wrong abstraction: the review agent has the diff and no exploration cost, while the implementation agent still holds the wave context.

### 6. Operating rhythm

Run when asked, or on a standing arrangement:

- **Tickets** — findings become issues per `rules/issues.md`: one issue per category batch, labeled `critical` (secrets, missing authorization), `high` (PII exposure, data-loss paths), or `normal`.
- **Scorecard** — append one line per run to `AUDIT.md` at the repo root: date, files audited, count per category. The trend is the deliverable.
- **Cadence** — quarterly full audits; weekly runs scope slices to paths changed since the last release tag.
- **Ownership** — every package in the inventory maps to a `CODEOWNERS` entry; unowned packages surface as findings under category `ownership`.
