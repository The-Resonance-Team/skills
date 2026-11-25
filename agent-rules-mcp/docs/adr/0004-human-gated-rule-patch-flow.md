# Gate agent-written rule patches through a dashboard and a draft PR

`propose_rule_patch` stores a draft in KV and gives the human a dashboard URL
with a short-lived token. `apply_rule_patch` needs a one-use approval record
bound to the patch digest and creates a draft pull request. It never pushes to
`main` and never merges.

The dashboard lists undecided, approved and denied patches. This repo's
`AGENTS.md` is changed so a human editing from a local clone is asked whether
to push directly or open a PR; a patch coming from the Worker always opens a PR.
That is a deliberate exception to the repo's trunk-based default for
agent-proposed changes.

## Considered options

- Direct commit to `main`. Rejected because it removes the review gate.
- OpenCode permission prompt only. Rejected because there is no durable record.
- Separate approval token given to the human. Rejected because it reintroduces
  the token-transfer problem on a new device.

## Consequences

Two credentials exist: a dashboard token that expires in one day or when all
patches are decided, and a one-use approval ID per patch. A GitHub failure is
recorded as `unknown` and needs human inspection before retry; no blind retry
is allowed. The Worker needs a fine-grained GitHub PAT with Contents:write and
Pull requests:write. The `rules:write` scope is required for both write tools.
