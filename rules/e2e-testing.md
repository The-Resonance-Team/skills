# E2E Testing Rules — Playwright against a real API

Applies to any repo running Playwright (or similar) e2e tests against a real backend and real seeded data, not mocks. Consumers running only unit/component tests should omit this file.

## Scope

Locator precision, correlating live-fetched entities with rendered UI, and how to document a real bug found mid-suite without turning CI red.

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
