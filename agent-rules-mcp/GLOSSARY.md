# Glossary

## Rule catalog

The complete set of rule modules and workflows that the rules MCP serves.

## Rule descriptor

One catalog entry: a stable ID, source path, scope text, retrieval text, and
relations to other entries.

## Stable rule ID

A logical name that identifies a catalog entry without depending on its file
path.

## Retrieval text

The short text used to find a catalog entry for a task.

## Embedding cache

Stored vectors reused across snapshot builds.

## Semantic relation

A catalog entry ranked as similar to a query.

## Citation relation

A directed link from one catalog entry to another, derived from a file-path
mention in source content.

## Rules MCP server

The service through which agents discover and retrieve the team's rules and
workflows.

## Rule patch proposal

A proposed change to a rule or workflow, together with its review decision.
Approval permits submission but does not publish the change.

## Patch approval

A recorded reviewer decision that permits one specific rule patch to be submitted
once. It does not permit submission of a changed diff.

## Reviewer

A person authorized to decide rule patch proposals and renew review access.

## Patch submission

A rule patch proposal submitted as a draft pull request for human review.

## Submission attempt

An effort to turn one approved rule patch into its draft pull request. Its outcome
can remain uncertain until the submission is confirmed.

## Rule publication

A rule change becoming available through the rule catalog.

## Approval dashboard

The repository's review board for rule patch proposals and their decision
history.

## Dashboard token

A short-lived capability for one approval dashboard that also requires reviewer
authorization. Renewing access preserves the proposals and their decision
history.

## Authorization server

The component that signs a user in and issues access tokens.

## Resource server

The component that accepts access tokens and serves the protected tools.

## OAuth scope

A named permission attached to an access token.
