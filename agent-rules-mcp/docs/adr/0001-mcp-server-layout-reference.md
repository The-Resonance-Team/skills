# Use Cloudflare MCP server layout as the reference shape

We reviewed `cloudflare/mcp-server-cloudflare` on 2026-11-25 and adopted its tool-registration, file-naming, and eval layout for the rules MCP so later MCP servers can copy the same shape. We kept our Bun/Zod stack and stateless `/mcp` handler from `opencode-codemode-mcp`, and rejected that template alone (no eval convention) and a minimal Worker (no reusable pattern). We did not adopt its pnpm workspaces, shared package, Sentry, or deployment environments.
