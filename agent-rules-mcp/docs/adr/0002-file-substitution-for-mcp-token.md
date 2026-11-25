# Use file substitution for the OpenCode MCP token

OpenCode loads the MCP bearer token with
`{file:~/.config/opencode/agent-rules-token.txt}`, not `{env:AGENT_RULES_MCP_TOKEN}`.

On 2026-11-25 the server failed version negotiation with HTTP 401. A local
proxy that forwarded the real OpenCode request showed `Authorization: Bearer`
with no token, even when the variable was exported in the CLI shell. The
persistent `opencode serve --service` process had started before the variable
existed, so its environment could not supply it. File substitution reads the
token at config load and does not depend on the daemon's environment.

Considered options: export the variable before starting the daemon; put the
token directly in `opencode.jsonc`; use `{env:...}`; use `{file:...}`. We chose
the file because it survives daemon restarts and keeps the secret out of the
config file. The GitHub Actions secret `AGENT_RULES_MCP_TOKEN` is separate and still
holds the same value for CD.

Verification seam: `opencode mcp list` must print `rules connected`. No unit
test can cover this, because the failure happens between the CLI and the
persistent service process.
