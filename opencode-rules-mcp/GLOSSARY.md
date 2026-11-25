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
mention. Router rows do not create citation relations.

## Rules MCP server

The Worker that exposes rule discovery and retrieval as MCP tools.

## Rule patch proposal

A proposed change to a rule or workflow that has not been approved.

## Patch approval

A human decision that permits one specific rule patch to become a pull request.

## Approval dashboard

The page where a human reviews undecided, approved and denied rule patches.

## Dashboard token

A capability that grants access to one approval dashboard until it expires or
until every patch there is decided.

## Authorization server

The component that signs a user in and issues access tokens.

## Resource server

The component that accepts access tokens and serves the protected tools.

## OAuth scope

A named permission attached to an access token.
