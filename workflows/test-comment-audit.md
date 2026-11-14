---
name: test-comment-audit
description: Audit the codebase for low-value tests and comment-code slop, then fix from an approved report. Use when asked to audit tests for value, remove low-value tests, clean narrating comments or suppression directives, or run a test/comment audit pass.
---

# Low-Value Test & Comment-Code Audit Workflow

Audit every test file and comment against `rules/test-comment-audit.md`. Fetch the rules first:

```
https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/test-comment-audit.md
```

## Process

### 1. Inventory → slices

List test files and source directories (`find`, `package.json` workspaces). Partition into slices: one package or directory subtree per subagent. Record every test path.

### 2. Dispatch subagents

Run one subagent per slice in parallel. Each prompt carries:
1. The slice's paths.
2. The rules above (paste or URL).
3. The report format below.
4. The slice type (frontend, API, package, worker).

Each subagent returns a findings table. Completion criterion: every test file in the slice carries a verdict, and every finding cites `file:line`.

### 3. Merge

Dedupe findings shared across slices. Merge into one table:

| Category | Location | Finding | Action | Status |
| -------- | -------- | ------- | ------ | ------ |

Categories: `test` (low-value test), `slop` (narrating comment / commented-out code), `suppression`.

### 4. Report gate

Present the merged report. Wait for approval before editing.

### 5. Implement

Apply fixes per the rules:
- Replace slop tests covering live behavior with behavioral tests in the same pass; delete only duplicates and constant pins.
- Remove narrating comments and commented-out code.
- Remove or reason suppression directives; move legitimate carve-outs to scoped config overrides.

Re-run format, lint, typecheck, and tests after applying. Update the audit file's status column.

### 6. Retro (optional)

Run `retro` to capture new rules or checks the audit exposed.