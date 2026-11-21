---
name: delete-comment
description: Purge low-value code comments and keep new ones out. Use when asked to delete comments, shrink a comment baseline, or apply the comment rubric to a new area.
---

# Delete Comment

Purge low-value comments from first-party source. Keep comments that carry non-obvious information, promote qualifying decisions to ADRs, and gate new comments so the count only falls.

Read the canonical rubric before starting: rule 4 in `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/audit.md`. Do not restate the rubric here.

## Scope

- First-party source in the repo's source roots. Exclude dependencies, build output, generated/codegen trees, and comment syntax in config files.
- Functional comments are exempt: lint/type directives, coverage ignores, `@generated` / "DO NOT EDIT", license headers, and shebangs.
- When a comment is ambiguous and deletion would lose information, keep it and open an issue.

## Workflow

1. Inventory the source files with `git ls-files` and classify every comment. If the repo has a comment codemod, use its dry run. Otherwise add a checked-in script under `scripts/` with `--check` / `--apply` and per-file assertions.
2. Dry run: review the exact blocks proposed for deletion. Reject any design block classified as an excuse by a marker deep inside it.
3. Apply: delete tautology, stale and excuse comments. Delete the source comment of any decision promoted to an ADR.
4. Promote decisions only when hard to reverse, surprising without context, and a real trade-off. Use the ADR format from `/domain-modeling` and the repo's `docs/adr/` convention.
5. File one aggregate issue for the excuse markers. Use `gh issue create --label needs-triage` and the repo's issue-tracker convention.
6. Verify: the comment gate compares the tree with a pinned commit through `git diff` and fails on a new comment. After bulk edits, inspect `git diff --check` and the diff numstat, then run the repo's lint, typecheck and tests.

## Ratchet

Pin the audit commit in the gate script. Git holds the baseline, so no generated file needs maintenance when code changes. Deleting a comment shrinks the ratchet. Moving the pin forward is a deliberate, reviewed decision.
