# QA & UI Consistency Rules

For projects with Next.js-style frontends (server + client component split), a seeded dev database, and a
screenshot-based QA harness (full-page sweeps at multiple device widths reviewed by agents or humans).
Rules proven by a full-app QA pass that found ~35 defects; each rule cites its incident.

## Server → client component boundaries

1. **Serializable props only.** A server component must never pass a function prop to a client component —
   it renders fine in isolation but throws "Functions cannot be passed directly to Client Components" when
   the page composes (found live: a log list took `levelLabel: (lv) => string` and its server page passed a
   closure over `getTranslations()`; the whole page 500'd). Type client props as plain data —
   `Record<Level, string>` built by the caller from translations — so both server and client callers compile
   against the same shape. The type system accepts the function; the review check is "does any server page
   hand a closure across a client boundary?".

2. **Page status codes hide runtime 500s.** An error boundary answers 200, so a sweep manifest can pass a
   broken page. QA tooling must also flag error-boundary copy in the body, and dev-server logs must be
   tee'd to a file — the log is where the 500 actually surfaced.

## Copy and i18n

3. **Interpolation slots take the value their grammar says.** A destination slot got a full sentence and
   rendered "Tới Sau khi đăng nhập, bạn quay lại" on three screens (the label meant "after sign-in you
   return to …"). When a message is only ever rendered one way, hardcode the context into the message and
   keep the count/time slots only.

4. **One source of truth for numbers in copy.** A hardcoded "100.000đ" inside a message drifted from the
   code's `WITHDRAW_MIN = 200_000` and contradicted the page's own rules text. Parameterize
   (`"đạt {min} — còn thiếu {amount}"`) and pass the constant.

5. **Every locale catalog gets every key.** New user-facing copy lands in all locale files in the same
   commit; the i18n key checker fails the build otherwise. A 404 page shipped hardcoded English on a
   Vietnamese-default product for its whole life because nobody ran the check on static pages.

## State rendering

6. **One predicate per visual state.** Every indicator answering the same question must derive from one
   predicate: the inbox shipped "2 unread" against four unread dots because dots counted status tiles
   (`type === "attention" || readAt === null`) while the counter, filter, and mark-all counted notification
   rows only. Status tiles are not unread mail.

7. **Empty values render as designed states.** Missing data renders as a placeholder — avatar initials, an
   image-icon tile, "—", "Chưa có" — never as: `<Image src="">` (a console error per row), a "— › —"
   breadcrumb, a dangling "• Label" with no value, a "·" line with both sides empty, or a date formatted
   without an explicit locale (US "11/15/2026" on a vi product). Null expires-at maps to "—", not to a
   negative number or a crash.

8. **Disabled keeps its silhouette.** A disabled CTA keeps its enabled styling (solid primary / outlined
   secondary) at reduced opacity with `cursor-not-allowed`. `border-transparent opacity-50` reads as broken
   text; staff could not tell a disabled button from missing markup.

9. **Raw validation/dev strings never reach the UI.** An env-var row rendered its rule as
   "nullable|string|max:64" — the developer's schema leaked into staff-facing copy. Human text only
   ("Tuỳ chọn · tối đa 64 ký tự").

## Fixture and seed discipline

10. **Live-or-fixture, never half-blank.** Server pages read live data through a cookie+contract fetch that
    returns null on any failure, falling back to the seeded fixture — a logged-out preview never blanks.
    Mind identity spaces when wiring a fixture page live: live row ids are usernames, fixture ids may differ
    (`linh.d` vs `qa-rs-01`) — match on the live id. If no endpoint exists, keep the fixture and name the
    missing endpoint in the docstring.

11. **Seed identity links are load-bearing.** Admin-style guards that match an env-pinned ID list against a
    linked identity (Discord `providerId`) break silently when the seed reshapes: every privileged endpoint
    403s while pages still render shells, and screenshots look almost normal. The seed must recreate the
    identity links on every run, and the QA harness must smoke-test one privileged endpoint before sweeping.

12. **Migrations must replay from zero and match the schema.** A committed migration ALTERed two tables no
    migration creates, and two schema models shipped without any migration — both landed with CI green
    (lint/typecheck/test/build do not catch it). A shadow-database replay diff is the standing check.

## QA harness discipline

13. **Ground truth is the DOM.** Full-page screenshots are downscaled during review; fused text, phantom
    truncations, and wrong-glyph reads are common (three audit findings retracted after DOM checks). A claim
    made from pixels is low-confidence until verified in the DOM or source.

14. **Triage the manifest before reading screenshots.** Statuses, per-shot console errors, and final URLs
    carry the infra failures (broken seed → 403s everywhere, stale route lists → redirects, empty-src
    images → per-row warnings). Auditing a half-broken stack wastes the entire pass.

15. **Archive the previous sweep.** Before/after trees are how a fix is proven; overwriting loses the
    comparison and the re-shoot becomes assertion instead of evidence.
