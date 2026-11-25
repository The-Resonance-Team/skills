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
