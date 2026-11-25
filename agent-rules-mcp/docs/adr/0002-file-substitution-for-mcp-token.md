# Authenticate OpenCode with OAuth; keep the bearer token for CI

OpenCode has one MCP entry, `agent-rules-mcp`, using OAuth with
`scope: rules:read rules:write` and CIMD with DCR fallback (see ADR 0003). The
disabled `agent-rules-mcp-ci` entry was removed on 2026-11-25, so OpenCode no
longer reads `{file:~/.config/opencode/agent-rules-token.txt}`. The static
read-only bearer token remains available as the GitHub Actions secret
`AGENT_RULES_MCP_TOKEN` for eval and CD, and as an environment variable for
local eval runs.

Earlier that day, the server failed version negotiation with HTTP 401. A local
proxy forwarding the real OpenCode request showed `Authorization: Bearer` with
no token, even when the variable was exported in the CLI shell: the persistent
`opencode serve --service` process had started before the variable existed.
File substitution read the token at config load and fixed the disabled CI entry
without depending on the daemon's environment.

Considered options: export the variable before starting the daemon; put the
token directly in the config; use `{env:...}`; use `{file:...}`. The file won
for that entry, but the duplicate CI entry is no longer needed now that OAuth
works on the interactive entry. Keeping two entries for the same Worker invited
the empty-token failure to recur, so the file-based entry was retired.

Verification seam: `opencode mcp list` from the skills repo must print
`agent-rules-mcp connected`. No unit test can cover this, because the failure
happens between the CLI and the persistent service process.
