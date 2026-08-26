---
name: pr-analysis
description: >-
  Analyze PRs and generate stakeholder-readable reports. Reads diff + context,
  maps changes to business impact, validates AC coverage, posts comments to
  Linear/GitHub. Triggered by GitHub Actions on PR open, weekly schedule, or CD.
model_invocation: true
---

# PR Analysis Agent

Analyze pull requests and produce reports that non-technical stakeholders can understand.

## What this agent does

1. Reads the PR diff and surrounding context
2. Checks for linked Linear/Jira tickets
3. Validates Acceptance Criteria coverage
4. Generates a business-readable report
5. Posts comments to GitHub PR + Linear/Jira ticket

## Input context

The GitHub Actions workflow provides:

- `PR_NUMBER` — the PR to analyze
- `REPO` — owner/repo format
- `BASE_SHA` / `HEAD_SHA` — diff range
- `LINKED_TICKET` — Linear/Jira ticket ID (if found)

## Analysis steps

### 1. Gather context

```bash
# Get PR metadata
gh pr view $PR_NUMBER --json title,body,author,additions,deletions,changedFiles,labels,reviews

# Get the diff
gh pr diff $PR_NUMBER

# Get changed files with status
gh pr diff $PR_NUMBER --stat

# Read surrounding context for key changed files
# (read the full file for each changed file, not just the diff)
```

### 2. Find linked ticket

```bash
# Search Linear for ticket linked to this PR
orca linear search "$PR_NUMBER" --json

# Or parse PR body for ticket references (PROJ-123, Linear URLs, Jira URLs)
```

### 3. If ticket exists, read AC

```bash
# Get ticket details including description/AC
orca linear issue <TICKET_ID> --json
```

### 4. Analyze

Compare the diff against:

- **Ticket AC**: Does the diff satisfy each acceptance criterion?
- **Business impact**: What user-facing behavior changes?
- **Risk level**: How many files? Auth/security paths? Breaking changes?
- **Test coverage**: Do changed files have corresponding test updates?

### 5. Generate report

Follow the format in `REPORT_FORMAT.md` (same directory as this skill).

Write in simplified technical English. One meaning per word. Short sentences.
Translate technical changes to business impact — this is for PMs, sales, execs.

### 6. Post results

```bash
# Post to GitHub PR
gh pr comment $PR_NUMBER --body-file report.md

# Post to Linear ticket (if linked)
orca linear comment add <TICKET_ID> --body-file report.md
```

## Output format

See `./REPORT_FORMAT.md` for the exact report structure.

## Rules

- Do NOT run lint, typecheck, or tests — this is a read-only analysis
- Do NOT modify any files in the repo
- Do NOT push commits or create new PRs
- Read context and docs only — follow Matt Pocock skill docs structure
- If no ticket is linked, skip AC validation section
- If analysis fails, post a minimal error comment so the PR is not silent
