#!/bin/sh
# Device setup check for xirothedev profile. Safe to re-run.
# Auto-installs CLIs with no secrets. Human-only steps print official doc guidance.
set -eu

have() { command -v "$1" >/dev/null 2>&1; }

echo "== xirothedev device check =="

check_env() {
  if [ ! -f "$HOME/.config/opencode/.env" ]; then
    echo "missing ~/.config/opencode/.env (copy from profiles/.env.example, fill keys)"
  else
    echo "ok .env exists"
  fi
}

check_env

for tool in gh sentry ctx7 firecrawl browse bun; do
  if have "$tool"; then
    echo "ok $tool: $(command -v "$tool")"
  else
    echo "missing $tool"
  fi
done

if have browse; then
  browse doctor 2>&1 | head -n 20 || true
fi

install_safe() {
  # Called with --install to auto-install safe tools only.
  if [ "${1:-}" != "--install" ]; then
    echo ""
    echo "Run with --install to auto-install safe tools (gh, ctx7, firecrawl, browse, bun)."
    echo "Human-only (follow official docs):"
    echo "- browse extension pairing: run 'browse install', open the status page in Chrome"
    echo "- sentry: run 'sentry auth login' (persists refresh token in ~/.config/sentry/cli.db)"
    echo "- turbo/vercel: run 'turbo login' to link repo and enable Remote Caching"
    echo "- tokens: create in vendor dashboards, paste via clipboard into ~/.config/opencode/.env"
    return 0
  fi
  if ! have gh; then echo "install gh via official docs (cli.github.com manual install)"; fi
  if ! have ctx7; then echo "install ctx7 CLI per team tooling doc"; fi
  if ! have firecrawl; then echo "install firecrawl CLI per team tooling doc"; fi
  if ! have browse; then curl -fsSL https://opencode.ai/browse/install | bash; fi
  if ! have bun; then curl -fsSL https://bun.sh/install | bash; fi
  echo "Safe installs done. Human-only steps still need official docs (see above)."
}

install_safe "${1:-}"
