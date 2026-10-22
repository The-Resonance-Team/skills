# E2E Testing Rules — Playwright against a real API

Applies to any repo running Playwright e2e tests against a real backend and real seeded data. Consumers running only unit tests omit this file.

## Locators & data correlation (mandatory)

1. **`getByText(str)` is substring + case-insensitive by default — pass `{ exact: true }` or scope to a container** — Never trust `page.getByText('Kiểm định').first()` on a page where headings or related cards contain the same substring:

   ```ts
   const badge = page.getByText('Kiểm định', { exact: true }).first();
   ```

2. **Correlate API-fetched entities with their exact UI container** — When asserting on an entity fetched via `GET /things?limit=1`, scope the UI locator to that entity's unique id/href/title rather than `.first()` on a generic card class (sort order or related-item grids may render a different entity first).
3. **`.first()` IS valid when multiple domain items legitimately share a display label** — Booking *any* available slot at `"09:00"` across multiple staff uses `.first()`; a strict-mode failure on identical valid labels means the locator was over-constrained for the domain.
4. **Headless overlay click fallback** — When a `.click()` on a confirmed-visible sheet/portal option silently no-ops in headless mode, use `.focus()` followed by ` page.keyboard.press('Enter')`.
5. **Replicate the app's client mapper when injecting state directly** — Before calling `page.evaluate((p) => store.go('itemDetail', p), payload)`, transform the raw API response through the same field renames and defaults (`images: raw.photos ?? []`) the real client mapper applies so tests never trigger false-positive crashes on raw wire shapes.
6. **Search wider pages when seed data is sparse** — When only a subset of seeded entities carries a relation (e.g. videos on 3 of 20 trainers), fetch `?limit=20`, loop until a qualifying entity is found, and `expect(match).toBeTruthy()` before testing the flow.

## Documenting unfixed bugs & copy-dependent assertions (mandatory)

7. **Wrap genuine out-of-scope app bugs in `test.fail()`, never weaken assertions** — Keep the strict assertion intact and call `test.fail()` with a comment naming the bug/follow-up. CI stays green now and turns red automatically once the underlying bug is fixed (signaling removal of `test.fail()`).
8. **Avoid literal copy assertions where role/testid works; sweep `**/*.spec.ts` on copy rewrites** — Asserting literal UI text couples specs to wording changes. Prefer role/testid locators unless copy itself is under test; whenever `rules/i18n.md` (#14) renames catalog copy, grep and update `**/*.spec.ts` in the same commit (Precedent: "Trainer nổi bật" → "HLV nổi bật" broke 3 specs post-merge).

## Environment & parallel workers (mandatory)

9. **Match CI's production build+start command locally** — Framework dev-mode checks (e.g. Next.js instant-navigation validation) can abort routes that production builds serve cleanly.
10. **Pin `localhost` vs `127.0.0.1` identically across `baseURL`, `webServer.url`, and API env vars** — Browsers treat `localhost` and `127.0.0.1` as separate origins; an `httpOnly` login cookie set on one silently misses page loads on the other, bouncing every authenticated test back to `/login`.
11. **Idempotent seed data & pre-run reset** — Reset and reseed before every full run when specs perform unrollback-able mutations (password changes, account creation) or use sequential IDs.
12. **Free known ports before full and isolated runs** — Kill stale listeners (`lsof -tiTCP:<port> -sTCP:LISTEN | xargs -r kill`) and clear leftover `BASE_URL` env overrides so `webServer` never attaches to a stale server from a prior run.
13. **Configure `{ mode: 'serial' }` when tests in a `describe` share `beforeAll` state** — Under `fullyParallel`, Playwright scatters tests in one `describe` across workers (`beforeAll` runs once per worker); add `test.describe.configure({ mode: 'serial' })` whenever tests share setup or sequence.
14. **Distinguish `--workers=1` contention from real failures** — Re-run a suspect failure in isolation with `--workers=1` against a clean server: if it passes, it is shared-DB parallel contention (document it); if it still fails, fix the test helper or app code before shipping.

## Coverage manifests (mandatory, when tracked)

15. **Exclude screenshot-only smoke specs, include shared flow helpers (`helpers/flows.ts`), and triage dual-matcher disagreements** — Run both a loose substring matcher and a strict path-regex matcher (`:param` → `[^/'"\`]+`), print every row where they disagree, and inspect each disagreement by hand.
