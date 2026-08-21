#!/usr/bin/env bash
# Export design token from ~/.claude/.credentials.json
# Usage: eval $(./scripts/export-token.sh)

set -e

CREDS="$HOME/.claude/.credentials.json"

if [ ! -f "$CREDS" ]; then
  echo "echo 'Error: $CREDS not found. Run /design-login in Claude Code first.' >&2" >&2
  exit 1
fi

# Try designOauth first, fallback to claudeAiOauth with design scopes
TOKEN=$(python3 -c "
import json, sys
d = json.load(open('$CREDS'))
if 'designOauth' in d and d['designOauth'].get('accessToken'):
    print(d['designOauth']['accessToken'])
elif 'claudeAiOauth' in d:
    scopes = d['claudeAiOauth'].get('scopes', [])
    if 'user:design:read' in scopes and 'user:design:write' in scopes:
        print(d['claudeAiOauth']['accessToken'])
    else:
        print('ERROR: design scopes missing. Run /design-login first.', file=sys.stderr)
        sys.exit(1)
else:
    print('ERROR: no design token. Run /design-login first.', file=sys.stderr)
    sys.exit(1)
" 2>&1)

if [ $? -ne 0 ]; then
  echo "echo '$TOKEN' >&2" >&2
  exit 1
fi

echo "export CLAUDE_DESIGN_TOKEN='$TOKEN'"
