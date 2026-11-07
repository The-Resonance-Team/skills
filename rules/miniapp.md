# Miniapp Rules — Zalo Mini App

Applies to Zalo Mini App clients (`zmp-ui` / ZMP, `apps/miniapp` shape). Browser-client baselines live in `rules/frontend.md`; repos with message catalogs additionally include `rules/i18n.md`.

## Capsule zone & header actions (mandatory)

1. **One left action group per header row: back first, title second, no lone far-right action** — All icon buttons on a header row form a single group on the left: the back button leftmost, every other action (calendar, bookmark, bell, share) directly right of it, then the title in the remaining space (`flex-1`). A lone action button on the far right is a layout error: it drifts from the back button and risks the host capsule. The same grouping applies to overlay headers on gallery/hero art. Use the shared header primitive's beside-back slot (`afterBack`), never the right slot, for row actions (Precedent: Ecopick 2026-11 — court-list calendar, court-gallery bookmark, tournament-list bell each moved left).
2. **Capsule inset comes only from the host variables** — The top inset is `var(--statusbar-h)` and nothing else (no spacer blocks). The horizontal capsule reservation is `var(--capsule-gutter)` on the top row itself, never on the wrapping container (a container padding also shortens full-width content below the row). Drop the reservation when no control reaches the right edge (`right-[18px]`); keep it when the title does.
3. **Empty numeric summaries render an explicit zero, never a bare dash** — A `0`-valued total (estimate before selection, empty count) displays `0đ`, not `—`; a dash reads as missing data (Precedent: Ecopick 2026-11 — detail footer estimate).

## Zalo host constraints (mandatory)

4. **Persist sessions through device storage, never Web Storage directly** — The Zalo webview has no `sessionStorage`. A storage abstraction writes to the host SDK's native store on-device and to a `localStorage`-equivalent on web; session code touches only the abstraction (Precedent: Ecopick `device-storage` / `ep_session`).
5. **No URL navigation: ZMP keeps a memory router** — Screens change via store `push`/`go`, never `page.goto`. Deep links are read once from `window.location` at boot through a `PUBLIC_SCREENS` allowlist; state-changing screens stay unreachable by link. Validate every param the allowlist admits.
6. **Mock login must not break session restore** — A mock-mode flag that short-circuits `restoreSession()` silently breaks token-injection testing. Keep the mock at the login UI, never on the restore path (Precedent: Ecopick 2026-11 — `VITE_ZALO_MOCK=true` broke every `localStorage` session injection in e2e).

## Copy & verification (mandatory)

7. **Every i18n key must render text in both locales** — A raw key on screen is a bug: verify label lookups against the real catalog keys (no guessed prefixes) and scan the rendered page in VI and EN after any catalog change (Precedent: Ecopick 2026-08 — `miniapp.` prefix rendered raw keys in quick actions).
8. **Screenshot the real component over mocked routes** — Serve the `zmp` dev server, intercept API routes with `**` globs (`*` does not cross `/`), fulfill CORS headers on every mock including `OPTIONS`, drive in-app navigation by tapping (the app renders inside an iframe on a different port), and hide the simulator chrome before capture (Precedent: Ecopick 2026-11 — court/tournament header shots).
