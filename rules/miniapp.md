---
id: "miniapp"
name: "Miniapp Rules — Zalo Mini App"
kind: "rule"
description: "Applies to Zalo Mini App clients (`zmp-ui` / ZMP, `apps/miniapp` shape). Browser-client baselines live in `rules/frontend.md`; repos with message catalogs additionally include `rules/i18n.md`."
scope: "Zalo Mini App (`apps/miniapp`)"
priority: "mandatory"
---
# Miniapp Rules — Zalo Mini App

<!-- rule: module-context -->
0. **Module context** — Apply this context when the module applies.

Applies to Zalo Mini App clients (`zmp-ui` / ZMP, `apps/miniapp` shape). Browser-client baselines live in `rules/frontend.md`; repos with message catalogs additionally include `rules/i18n.md`.

## Capsule zone & header actions (mandatory)

<!-- rule: one-left-action-group-per-he -->
1. **One left action group per header row: back first, title second, no lone far-right action** — All icon buttons on a header row form a single group on the left: the back button leftmost, every other action (calendar, bookmark, bell, share) directly right of it, then the title in the remaining space (`flex-1`). A lone action button on the far right is a layout error: it drifts from the back button and risks the host capsule. The same grouping applies to overlay headers on gallery/hero art. Use the shared header primitive's beside-back slot (`afterBack`), never the right slot, for row actions (Precedent: Ecopick 2026-11 — court-list calendar, court-gallery bookmark, tournament-list bell each moved left).
<!-- rule: capsule-inset-comes-only-fro -->
2. **Capsule inset comes only from the host variables** — The top inset is `var(--statusbar-h)` and nothing else (no spacer blocks). The horizontal capsule reservation is `var(--capsule-gutter)` on the top row itself, never on the wrapping container (a container padding also shortens full-width content below the row). Drop the reservation when no control reaches the right edge (`right-[18px]`); keep it when the title does.
<!-- rule: empty-numeric-summaries-rend -->
3. **Empty numeric summaries render an explicit zero, never a bare dash** — A `0`-valued total (estimate before selection, empty count) displays `0đ`, not `—`; a dash reads as missing data (Precedent: Ecopick 2026-11 — detail footer estimate).

## Zalo host constraints (mandatory)

<!-- rule: persist-sessions-through-dev -->
4. **Persist sessions through device storage, never Web Storage directly** — The Zalo webview has no `sessionStorage`. A storage abstraction writes to the host SDK's native store on-device and to a `localStorage`-equivalent on web; session code touches only the abstraction (Precedent: Ecopick `device-storage` / `ep_session`).
<!-- rule: no-url-navigation-zmp-keeps -->
5. **No URL navigation: ZMP keeps a memory router** — Screens change via store `push`/`go`, never `page.goto`. Deep links are read once from `window.location` at boot through a `PUBLIC_SCREENS` allowlist; state-changing screens stay unreachable by link. Validate every param the allowlist admits.
<!-- rule: mock-login-must-not-break-se -->
6. **Mock login must not break session restore** — A mock-mode flag that short-circuits `restoreSession()` silently breaks token-injection testing. Keep the mock at the login UI, never on the restore path (Precedent: Ecopick 2026-11 — `VITE_ZALO_MOCK=true` broke every `localStorage` session injection in e2e).

## Copy & verification (mandatory)

<!-- rule: every-i18n-key-must-render-t -->
7. **Every i18n key must render text in both locales** — A raw key on screen is a bug: verify label lookups against the real catalog keys (no guessed prefixes) and scan the rendered page in VI and EN after any catalog change (Precedent: Ecopick 2026-08 — `miniapp.` prefix rendered raw keys in quick actions).
<!-- rule: screenshot-the-real-componen -->
8. **Screenshot the real component over mocked routes** — Serve the `zmp` dev server, intercept API routes with `**` globs (`*` does not cross `/`), fulfill CORS headers on every mock including `OPTIONS`, drive in-app navigation by tapping (the app renders inside an iframe on a different port), and hide the simulator chrome before capture (Precedent: Ecopick 2026-11 — court/tournament header shots).
<!-- rule: qa-a-miniapp-at-phone-width -->
9. **QA a miniapp at phone width only** — Capture and review every miniapp screen at `360x760` and `430x932`. Use these two sizes for screenshots, the coverage matrix in `rules/real-user-qa.md`, and the visual audit. Anti-pattern: a `768px` or `1280px` row for a miniapp. A wide sweep hides the capsule gutter and the header inset (rules #2 and #8). If a QA harness owns device profiles, set its miniapp profiles to these two sizes before the sweep (Precedent: Ecopick 2026-11 — capsule gutter and header actions are phone-width concerns; rules #2 and #8).
