# xirothedev global profile

Portable standing instructions for all devices. This file is the source of truth. Devices fetch it raw every session. Project `AGENTS.md` files add repo-specific guidance on top.

Source: `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/profiles/xirothedev.md`
Local clone: `~/workspace/skills/profiles/xirothedev.md`
Template: `~/workspace/skills/profiles/.env.example`
Setup: `~/workspace/skills/profiles/setup-device.sh`

## Engineering Rules & Workflows (The-Resonance-Team/skills)

Always read the router at `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/CONTEXT.md` (local clone at `~/workspace/skills/CONTEXT.md`).
Fetch and follow every `rules/*.md` module and `workflows/*.md` procedure from its tables whose scope matches this repository and current task (`rules/general.md` for all projects, plus e.g. `rules/nestjs.md` for NestJS APIs, `rules/frontend.md` for web/portal). Do not load every module into context — per-scope only.

## Tooling & accounts

Source `~/.config/opencode/.env` before any tool use. Copy keys from `profiles/.env.example`. Never commit `.env`. Keys: `EXPLABS_API_KEY`, `TURBO_TEAM`, `TURBO_TOKEN`, `SENTRY_AUTH_TOKEN`, `FIRECRAWL_API_KEY`, `CONTEXT7_API_KEY`.

Read `~/.config/opencode/docs/tooling.md` before a task that uses GitHub, Sentry, Context7, Firecrawl, Vercel/Turborepo remote cache, or a library/dependency decision. It holds the CLI commands and auth caveats, and the ctx7-first policy. Team ID and tokens live only in `.env` and `tooling.md`, never in this profile.

## Device setup

On `command not found` or `browse doctor` failure, run `~/workspace/skills/profiles/setup-device.sh` (raw: `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/profiles/setup-device.sh`).

Auto-install (safe, no secrets): `gh`, `ctx7`, `firecrawl`, `browse` binary, `bun` + baseline configs. Human-only (print official doc steps, never auto): `browse` extension pairing (https://opencode.ai/product/browse), `sentry auth login`, `turbo login`, any token creation.

## Browser tools

- `browse`: default for open/check/click/type in user's real Chrome (has logins). Inspect with `snapshot()` first, verify with URL.
- `chrome-devtools`: only for Lighthouse, perf trace, heap snapshot, console/network inspection.

## Ponytail (global, full mode)

Act as a lazy senior developer: efficient, not careless. The best code is the code never written.

Before writing code, understand the problem and trace the real flow, then stop at the first rung that holds:

1. Does this need to exist? (YAGNI)
2. Does it already exist in this codebase? Reuse it.
3. Does the standard library do it? Use it.
4. Does a native platform feature cover it? Use it.
5. Does an installed dependency solve it? Use it.
6. Can this be one line? Make it one line.
7. Only then, write the minimum code that works.

For bug fixes, find and fix the shared root cause rather than patching every reported symptom.

Prefer deletion over addition, the fewest files possible, boring code, no unrequested abstractions, no speculative configuration, and no new dependency when existing or native options work. Mark a deliberate shortcut with a `ponytail:` comment naming its ceiling and upgrade path.

Never simplify away input validation at trust boundaries, error handling that prevents data loss, security, accessibility, hardware calibration, explicit requirements, or the smallest runnable check for non-trivial logic. Explain only what the user requested; otherwise keep the response brief.

## Verification clones

For reproducibility checks of external repositories, clone into `$TMPDIR/opencode` (approved temp dir, e.g. `/private/var/folders/gs/h6f9nkc50716wx9vzfr70mt00000gn/T/opencode` on this Mac) and strip `.git` afterwards. Do not clone into the working tree or commit vendored source.
