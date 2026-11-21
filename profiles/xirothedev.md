# xirothedev global profile

Portable standing instructions for all devices. Loaded via native `instructions[]`; do not re-fetch this file. Project `AGENTS.md` files add repo-specific guidance on top.

## Engineering Rules & Workflows (The-Resonance-Team/skills)

Router `CONTEXT.md` is already loaded via native `instructions[]`; do not re-fetch it.
Fetch and follow every `rules/*.md` module and `workflows/*.md` procedure from its tables whose scope matches this repository and current task (`rules/general.md` for all projects, plus e.g. `rules/nestjs.md` for NestJS APIs, `rules/frontend.md` for web/portal). Use raw URLs from its tables so guidance stays up to date. Offline fallback: `~/workspace/skills/CONTEXT.md`. Do not load every module into context — per-scope only.

## Tooling & accounts

Source `~/.config/opencode/.env` before any tool use. Copy keys from `profiles/.env.example`. Never commit `.env`. Keys: `EXPLABS_API_KEY`, `TURBO_TEAM`, `TURBO_TOKEN`, `SENTRY_AUTH_TOKEN`, `FIRECRAWL_API_KEY`, `CONTEXT7_API_KEY`.

Read `~/.config/opencode/docs/tooling.md` before a task that uses GitHub, Sentry, Context7, Firecrawl, Vercel/Turborepo remote cache, or a library/dependency decision. It holds the CLI commands and auth caveats, and the ctx7-first policy. Team ID and tokens live only in `.env` and `tooling.md`, never in this profile.

## Device setup

On `command not found` or `browse doctor` failure, fetch and run `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/profiles/setup-device.sh` (offline fallback: `~/workspace/skills/profiles/setup-device.sh`).

Auto-install (safe, no secrets): `gh`, `ctx7`, `firecrawl`, `browse` binary, `bun` + baseline configs. Human-only (print official doc steps, never auto): `browse` extension pairing (https://opencode.ai/product/browse), `sentry auth login`, `turbo login`, any token creation.

## Browser tools

- `browse`: default for open/check/click/type in user's real Chrome (has logins). Inspect with `snapshot()` first, verify with URL.
- `chrome-devtools`: for Lighthouse, perf trace, heap snapshot, console/network inspection, and real-browser runtime debugging. Use these instead of editing source or faking data: `set_logpoints` (log runtime variables at a source location via source maps, output in `list_console_messages`, no source edits), `mock_network` / `remove_network_mock` (replace a response body from a local fixture file, or redirect `upstream` to a test server serving real statuses — a 5xx body or a dead endpoint — to exercise error/edge states; needs `--categoryNetworkMocks=true` in `opencode.jsonc`). Configure mocks before navigating; remove them after (mocks disable the HTTP cache and break perf measurements); service workers can bypass mocks. Keep the version in `opencode.jsonc` at the latest release (`npm view chrome-devtools-mcp version`).

## Verification clones

For reproducibility checks of external repositories, clone into `$TMPDIR/opencode` (approved temp dir, e.g. `/private/var/folders/gs/h6f9nkc50716wx9vzfr70mt00000gn/T/opencode` on this Mac) and strip `.git` afterwards. Do not clone into the working tree or commit vendored source.
