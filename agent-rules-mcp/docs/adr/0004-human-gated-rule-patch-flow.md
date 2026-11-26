# Gate agent-written rule patches through a dashboard and a draft PR

`propose_rule_patch` stores a draft in a SQLite-backed Durable Object and gives the human a short-lived dashboard URL; `apply_rule_patch` requires a one-use approval bound to the patch digest and opens a draft PR, never pushing to `main` or merging. We chose Durable Object transactions over KV because the review decision and the one-use approval claim must be atomic, while KV has only eventual visibility; KV stays the OAuth store. Opening a PR is a deliberate exception to the repo's trunk-based default for agent-proposed changes.

## Consequences

Authorization has two independent layers: a renewable browser review session and a one-use approval ID per decision. A failed GitHub write is recorded as `unknown` and reconciled from the branch/PR, never retried blindly. The lifecycle, retention, and recovery decisions are recorded in [handoff resolution](../handoff-resolution.md).
