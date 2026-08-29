# E2E Testing Rules — Playwright against a real API

Applies to any repo running Playwright (or similar) e2e tests against a real backend and real seeded data, not mocks. Consumers running only unit/component tests should omit this file.

## Scope

Locator precision, correlating live-fetched entities with rendered UI, environment/infra setup that blocks a suite from running at all, coverage-manifest design, parallel-worker isolation, and how to document a real bug found mid-suite without turning CI red.

## Locators (mandatory)

1. **`getByText(str)` is substring + case-insensitive by default** — it matches any element whose text contains `str`, including unrelated headings/paragraphs that happen to contain it as a substring. On a page with more than one plausible match, add `{ exact: true }` or scope to a specific ancestor; never trust `.first()` on a bare page-wide text search to land on the element you mean.

   ```ts
   // Bad — "Kiểm định" matches the actual badge AND any heading/paragraph
   // that contains the substring case-insensitively (e.g. "Vợt kiểm định
   // tương tự")
   const badge = page.getByText("Kiểm định").first();

   // Good — exact text, or scoped to a locator unique to the element
   const badge = page.getByText("Kiểm định", { exact: true }).first();
   const badge = page.locator('[class*="bg-scrim/86"]'); // unique to this badge
   ```

   Proven by a real incident: a regression guard comparing a cert badge's text on two pages matched the wrong element on each side (a related-content heading, then a different entity's card reused via a shared component) — the test passed or failed for reasons unrelated to what it claimed to check, in both directions, before the locator was scoped precisely.

2. **A generic locator's first match is not guaranteed to be the entity you fetched** — when a test fetches a specific entity via the API (`GET /things?limit=1`) and then asserts something about "that entity" on a page, a `.first()` text match can silently land on a *different* instance of the same component if the page renders more than one (a "related items" grid reusing the same card, a list where sort order differs from the API's default order). Scope the UI-side locator to the specific entity's known container/id, or assert against a value unique to that entity (its title, its id in an href), not a generic shared string.

3. **Mirror the app's own mapper, not the raw API response, when feeding data into a component under test** — real navigation almost always transforms an API response before handing it to a screen (renaming fields, defaulting missing ones, dropping fields the screen never reads). Passing the raw response directly to a component/handler under test can crash on fields real usage never actually passes — a false-positive bug that only exists in the test, not the app.

   ```ts
   // Bad — raw API shape, may crash on fields the real mapper strips/defaults
   const raw = (await api.get("/v1/items?limit=1")).data[0];
   await page.evaluate((p) => store.go("itemDetail", p), raw);

   // Good — replicate the real mapper's output shape
   const item = {
     id: raw.id,
     name: raw.name,
     images: raw.photos ?? [], // mapper renames photos -> images
     // ...only the fields the real mapper actually produces
   };
   await page.evaluate((p) => store.go("itemDetail", p), item);
   ```

   Before writing the synthetic object, read the real mapper function (or the real call site) and match its output — do not guess the shape from the component's prop types alone.

## Sparse or conditional seed data (mandatory)

4. **Search, don't assume, when only some seeded entities carry the data you need** — `?limit=1` (or `list[0]`) only works when every entity in the list qualifies. When a feature (articles, videos, a specific status) is seeded onto a subset (e.g. "only the first 3 trainers get content"), fetch a wider page and loop until a qualifying entity is found; assert the search actually found one rather than assuming index 0 did.

   ```ts
   const trainers = (await api.get("/v1/trainers?limit=20")).data;
   let match;
   for (const t of trainers) {
     const videos = (await api.get(`/v1/trainers/${t.id}/videos?limit=1`)).data;
     if (videos[0]) {
       match = { trainer: t, video: videos[0] };
       break;
     }
   }
   expect(match, "seed must have a trainer with at least one video").toBeTruthy();
   ```

## Documenting a real bug found mid-suite (mandatory)

5. **A test that discovers a real, un-fixed app bug uses `test.fail()`, not a weakened assertion** — when closing a coverage gap or writing a new test surfaces a genuine bug that is out of scope to fix in the same pass (a deliberate product/wording decision, a larger refactor scheduled separately), keep the strict assertion and wrap the test in `test.fail()`. This keeps the run green while preserving the exact signal — the test starts failing the build the moment someone fixes the assertion's premise without removing `test.fail()`, which is the intended trigger to also delete the annotation. Do not: delete the assertion, invert it to always pass, or loosen it to match current (broken) behavior — any of those destroys the regression signal instead of preserving it.

   ```ts
   test("REGRESSION GUARD: badge text stays consistent across pages", async ({ page }) => {
     // Confirmed live: the two components use different i18n keys entirely.
     // Dedupe is a separate follow-up task — this documents the drift
     // without failing CI until it's fixed.
     test.fail();
     // ...the real, strict assertion, unchanged...
   });
   ```

## Environment before assertions (mandatory)

Before touching a single assertion in a suite that "won't pass," rule these out — in a full-repo QA pass they outnumbered actual test-logic bugs:

6. **Dev server ≠ prod build.** A framework's dev-mode validations (e.g. Next.js cache-components "instant navigation" checks) can abort navigation on nearly every route in dev while a production build serves them fine. If CI builds+starts the app, a local Playwright config that runs the plain `dev` script is not testing what CI tests — match CI's server command locally, even though it's slower.
7. **`localhost` and `127.0.0.1` are different origins to a browser**, though they resolve to the same host. An httpOnly cookie set for one origin never reaches pages served from the other. Login's own `POST` can still succeed (a direct fetch, not origin-gated the same way) and even redirect correctly — but every *subsequent* authenticated page load then silently bounces back to the login page, and every test on it reads as a generic "element not found" with no visible cause, because the page under test genuinely is the login page, just never asserted against by name. Pin `baseURL`, `webServer.url`, and every API-base env var to the same literal host.
8. **Seed data must be idempotent, or reset before every run.** A fixed-seed faker run with sequential IDs collides with itself on a second run with no reset in between; a partially-completed seed (stopped mid-way by one stale/colliding row) leaves fixtures the suite's own global-setup then crashes on before a single test runs. If a suite does real, unrollback-able mutations (password changes, account creation, content submissions), state that explicitly — **it is not safely re-runnable back-to-back** — and reset+reseed before every fresh full run, not just the first one.
9. **Free known ports before every full run, and again before isolating one failing test.** A webServer considers a port "ready" the instant something answers on it, including a stale server from a previous run holding the wrong state — `lsof -tiTCP:<port> -sTCP:LISTEN | xargs -r kill` first. An isolation rerun with a stale `BASE_URL`/`PORTAL_BASE_URL` pointing at a now-dead port fails every test with a connection error that looks like a mass regression but is only a leftover env var.

## Coverage manifests (mandatory, if the repo tracks one)

A script that claims "route/endpoint X is tested" by checking whether a literal string appears somewhere in the spec corpus lies in both directions unless designed against these:

10. **A screenshot-only spec over-claims coverage.** A spec that visits every route to capture a `.png` for a visual review contains every route's literal path string, so a naive corpus makes the manifest report near-100% "tested" regardless of whether anything was ever clicked. Exclude screenshot/pure-smoke specs from the interaction-tested corpus.
11. **A helper-file exclusion under-claims coverage.** If the corpus only reads `*.spec.ts` files, a route exercised through a shared helper (`helpers/flows.ts`) that specs import and call is invisible — the literal path string lives in the helper, not the spec file. Include the helper files specs actually route through, not just the spec files themselves.
12. **Ship two matchers, not one, and triage every disagreement by hand.** A loose substring matcher over-matches (`seller/orders/:id/confirm` "passes" because the word "confirm" appears in an unrelated comment somewhere); a strict matcher built from a real regex of the full path (`:param` → `[^/'"\`]+`, everything else escaped) under-matches (misses a route built from a template literal). Run both, print every row where they disagree, and manually check each one — a disagreement is a candidate for review, not an automatic verdict either way.

## More locators (mandatory)

13. **`.first()` is correct, not a shortcut, when multiple targets legitimately share a display value.** Two different staff both having a free slot at the same displayed time is real, valid data, not a bug — the flow only needs to book *a* slot at that time. A `getByRole(..., {exact: true})` strict-mode-violating on two identical labels here is a test bug (locator too specific for the domain), not a signal to add more scoping.
14. **A plain `.click()` on a sheet/overlay-portal option can silently no-op in headless mode even though it works visually.** If a click on a focused, visible element does nothing and the element itself is confirmed correct (not a locator problem), try `.focus()` followed by `keyboard.press('Enter')` before assuming the app is broken — some overlay libraries' hit-testing behaves differently headless.

## Parallel workers (mandatory)

15. **`beforeAll` runs once per worker, and `fullyParallel` scatters one `describe` block's tests across workers by default.** Any spec file with more than the simple one-test-per-describe pattern — several tests sharing fixtures a `beforeAll` sets up once, meant to run in sequence — needs `test.describe.configure({ mode: "serial" })`, or the tests race each other against not-yet-ready fixtures on different workers.
16. **A failure that disappears under `--workers=1` is shared-DB parallel contention, not a bug.** Confirm with an isolation rerun (same file or same test, `--workers=1`, a fresh/known-good server) before spending time "fixing" the assertion; once confirmed, document it and stop chasing it further. **A failure that still reproduces in isolation is real** — fix it even if it lives in a test helper rather than app code; a red suite fails the acceptance bar regardless of which side of the test/app boundary the bug is on.
