# Run the OAuth authorization server in the rules Worker with Access as IdP

The Worker issues its own scoped OAuth 2.1 tokens after Cloudflare Access signs the user in, because Access tokens carry no `scope` claim and cannot restrict future write tools. OpenCode registers through CIMD with DCR fallback; the Worker is both authorization and resource server with one KV namespace for OAuth state. Read-only bearer tokens stay for CI and eval (see ADR 0002); we rejected Cloudflare's beta team-level OAuth server (opaque tokens, network introspection) and pre-registered clients (per-device client secrets).

## Consequences

The new KV binding must be provisioned by CD, and losing that namespace invalidates all sessions.
