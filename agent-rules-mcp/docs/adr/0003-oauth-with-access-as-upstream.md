# Run the OAuth authorization server in the rules Worker with Access as IdP

The rules MCP issues its own OAuth 2.1 tokens and uses Cloudflare Access as the
upstream identity provider. OpenCode registers through CIMD with DCR as fallback.

Cloudflare Access for SaaS authenticates the user but its tokens carry no
`scope` claim, so they cannot express `rules:read` and `rules:write`. Our token
endpoint issues scoped tokens after the Access sign-in. The Worker is both the
authorization server and the resource server, with one KV namespace for OAuth
state.

Bearer tokens remain valid for read-only calls from CI and subagents. They
cannot call write tools. This keeps the non-interactive path that cannot
complete a browser login.

## Considered options

- Accept raw Access tokens. Rejected because there is no scope claim and the
  audience is the callback URI, so future write tools could not be restricted.
- Use Cloudflare's team-level OAuth server. Rejected because it is beta, issues
  opaque tokens, and needs a network introspection call.
- Pre-registered client. Rejected because every new device would need a client
  secret transferred to it.

## Consequences

A new device signs in through the browser once. The Worker now owns token
storage, refresh rotation, and revocation. The KV namespace is a new binding,
so CD must provision and bind it. Losing the KV namespace invalidates all
sessions.
