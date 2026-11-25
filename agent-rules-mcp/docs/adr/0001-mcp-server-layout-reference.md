# Use Cloudflare MCP server layout as the reference shape

The rules MCP server follows the public `cloudflare/mcp-server-cloudflare`
layout for tool registration, file naming and evaluation, while keeping the
local `opencode-codemode-mcp` stack (Bun, Zod, stateless `/mcp`).

We cloned `cloudflare/mcp-server-cloudflare` into the approved temp directory
and read its guides and app layout on 2026-11-25. The reusable patterns are a
stateless Streamable HTTP handler at `/mcp`, a fresh request-scoped SDK server
per request, Zod input schemas with short "when to use" descriptions, read-only
annotations, `*.app.ts` / `*.context.ts` / `*.spec.ts` file naming, and `evals/`
files built with `describeEval`. The docs server also shows a managed `ai_search`
binding; that binding is not used here.

## Considered options

- **Local `opencode-codemode-mcp` template only.** Already wired to the same
  OpenCode config, but it has no evaluation convention.
- **Cloudflare MCP repository layout.** Adds request-scoped registration and
  eval practices without adopting its monorepo tooling.
- **Minimal Worker.** Fewest files, but no reusable pattern for the next MCP
  server we add.

We picked the second option because the user asked for a layout we can reuse on
later updates. We do not adopt pnpm workspaces, the internal `@repo/mcp-common`
package, Sentry, or Cloudflare's deployment environments.

## Consequences

New MCP projects in this repo use the same file names and eval layout. The
runtime stack stays Bun and Zod. Changing the shared layout later means
updating every MCP project that copied it.
