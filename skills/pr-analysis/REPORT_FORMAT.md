# Report Format

The PR analysis report is posted as a GitHub PR comment and Linear/Jira ticket comment.

## Template

```markdown
## PR Analysis

### Summary

<1-2 sentences. What this PR does in plain English. Business stakeholder readable.>

### What Changed

- <change 1 in plain English>
- <change 2 in plain English>
- <change N>

### Business Impact

<How this affects users/customers. Written in "sale terms" — what the feature/fix means for the business, not how it was implemented.>

### AC Status

<If a linked ticket exists:>

| AC | Status | Notes |
|---|---|---|
| <criterion 1> | ✅ Covered | <evidence from diff> |
| <criterion 2> | ⚠️ Partial | <what's missing> |
| <criterion 3> | ❌ Missing | <no implementation found> |

<If no ticket linked:>

> No linked ticket found. AC validation skipped.

### Risk Level

**<Low | Medium | High>**

<Reasoning: file count, auth/security paths touched, breaking changes, test coverage>

### Action Items

- [ ] <item that needs attention before merge>
- [ ] <another item>
```

## Rules

- Summary: max 2 sentences. No jargon.
- What Changed: bullet list, max 10 items. Each item is one sentence.
- Business Impact: max 3 sentences. Write for a VP of Sales, not a developer.
- AC Status: table format. If no ticket, skip entirely.
- Risk Level: one word + one sentence reasoning.
- Action Items: max 5 items. Each is a concrete next step.
- Total report length: max 50 lines.
- Language: Simplified Technical English (ASD-STE100). One meaning per word.
