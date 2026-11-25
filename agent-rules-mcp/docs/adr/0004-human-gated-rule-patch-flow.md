# Gate agent-written rule patches through a dashboard and a draft PR

`propose_rule_patch` stores a draft in a SQLite-backed Durable Object and gives
the human a dashboard URL with a short-lived token. `apply_rule_patch` needs a
one-use approval record bound to the patch digest and creates a draft pull
request. It never pushes to `main` and never merges.

The dashboard lists undecided, approved and denied patches. This repo's
`AGENTS.md` is changed so a human editing from a local clone is asked whether
to push directly or open a PR; a patch coming from the Worker always opens a PR.
That is a deliberate exception to the repo's trunk-based default for
agent-proposed changes.

`ApprovalStore` uses Durable Object transactions to make a review decision and a
one-use approval claim atomic. Workers KV has eventual visibility and cannot
provide that claim boundary. KV remains the OAuth store. SQLite-backed Durable
Objects are available on Workers Free; the patch store does not require a Paid
plan or a separate D1 database.

## Considered options

- Direct commit to `main`. Rejected because it removes the review gate.
- OpenCode permission prompt only. Rejected because there is no durable record.
- Separate approval token given to the human. Rejected because it reintroduces
  the token-transfer problem on a new device.

## Consequences

Authorization has two independent layers: a renewable browser review session for
the stable board, and a one-use approval ID per decision. Both expire in one day
without deleting proposals. A GitHub failure is recorded as `unknown` and is
reconciled from the matching branch/PR; no blind retry is allowed. The Worker
needs a fine-grained GitHub PAT with Contents:write and Pull requests:write. The
`rules:write` scope is required for both write tools.

## Selected lifecycle update

The next lifecycle uses signed-in Access reviewers for decisions and access
renewal, with reviewer identity recorded. Access expiry does not delete
proposals. Pending review lasts 30 days; final history lasts 90 days; uncertain
submissions remain until resolved. Unused approval lasts 24 hours and can be
replaced by a fresh review of the same unchanged proposal.

A changed target file requires a refreshed proposal and human review. Accepted
submissions must finish independently of the client and recover their existing
draft PR after a lost response. Recovery must establish the original outcome
before any further write; it is separate from ongoing PR-status sync, which is
out of scope. The implementation uses one durable job per proposal, an alarm for
bounded phases, and one hourly repair Cron for lost wake-ups; see
[the handoff resolution](../handoff-resolution.md).
