# Design MCP Proxy

Proxy Claude's Design MCP (`api.anthropic.com/v1/design/mcp`) to stdio. Use with opencode, cursor, or any MCP client.

## Prerequisites

1. Run `/design-login` in Claude Code to grant design scopes
2. Verify: `cat ~/.claude/.credentials.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('claudeAiOauth',{}).get('scopes',[]))"` — should include `user:design:read` + `user:design:write`

## Install

```bash
cd design-mcp-proxy
npm install
```

## Run

```bash
# Option A: reads token from ~/.claude/.credentials.json
npm start

# Option B: export token first
eval $(./scripts/export-token.sh)
npm start
```

## Configure opencode

Add to `opencode.json` (adjust path relative to your project root):

```json
{
  "mcp": {
    "claude-design": {
      "type": "stdio",
      "command": "npm",
      "args": ["--prefix", "./skills/design-mcp-proxy", "start"]
    }
  }
}
```

Or with env var:

```json
{
  "mcp": {
    "claude-design": {
      "type": "stdio",
      "command": "bash",
      "args": ["-c", "eval $(./skills/design-mcp-proxy/scripts/export-token.sh) && npm --prefix ./skills/design-mcp-proxy start"],
      "env": {}
    }
  }
}
```

## Configure Claude Code (local test)

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "design-proxy": {
      "command": "npm",
      "args": ["--prefix", "./skills/design-mcp-proxy", "start"]
    }
  }
}
```

**Note:** Paths are relative to where you run `opencode` or `claude`. Adjust if your layout differs.

## Debug

```bash
# Check token
./scripts/export-token.sh

# Test connection
DEBUG=1 npm start 2>&1 | head -20
```

## Notes

- Token expires — re-run `/design-login` if proxy fails with 401
- Design scopes are separate from main OAuth — `/design-login` creates them
- Base URL: `https://api.anthropic.com/v1/design/mcp` (override via `DESIGN_MCP_URL` env)
