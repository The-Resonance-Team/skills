# Source-file metadata for the rules catalog

## Status

Accepted.

## Context

The separate router repeated the scope and trigger of each source file. Agents
also needed individual rule retrieval and an index of mandatory guidance.

## Decision

Rule modules and workflows own their catalog metadata in YAML frontmatter.
Numbered rules have stable slug anchors independent of display order. The build
validates metadata, references, rule and workflow token limits, and generated
artifacts. PR checks use committed embeddings without production credentials.

The generated catalog remains bundled with the Worker and is published by a
successful deployment from `main`. The former `CONTEXT.md` router is removed.
Known consumers migrate to the MCP; unknown consumers must migrate separately.
Individual source URLs remain available.

## Consequences

Metadata and guidance change together, and agents can enumerate mandatory
entries instead of relying on semantic search recall. The old router URL is a
breaking change. Client-safe long-workflow retrieval and Pi setup are deferred
to issue #21. A separate database is justified only when independent updates,
catalog size, or query needs make the bundled snapshot insufficient.
