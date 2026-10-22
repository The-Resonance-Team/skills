---
name: claude-design-to-nextjs
description: >-
  Convert Claude Design (.dc.html) exports and product specs into pixel-perfect
  Next.js/React pages using team rules, domain modeling, two-axis code review,
  and live Chrome DevTools MCP verification. Use when converting a Claude Design
  export to Next.js/React, auditing design vs spec gaps, or verifying pixel-perfect
  UI parity.
---

# Claude Design to Next.js/React Workflow

Convert Claude Design (`.dc.html`) exports to production Next.js/React code while enforcing `rules/frontend.md`, `rules/i18n.md`, and `rules/linting.md`.

## Process

### 1. Design intake

Inspect both the `.dc.html` markup and any companion `.js` / `tokens.css` files (`rules/frontend.md` #20 — motion, timers, and computed display values often live in scripts, not HTML):
- **Incremental drops (v2 `.zip`)**: extract to a sibling folder and run `diff -rq <old_dir> <new_dir>` + `diff -u` first so you only inspect changed screens/tokens.
- **Animations**: extract `@keyframes` bodies and `animation:` use-counts by script (`rules/frontend.md` #19), never by eye.
- **Completion criterion**: component inventory, route map, and data model sketch produced.

### 2. Spec alignment

Diff the design inventory against the product spec (e.g. `docs/specs/...`):
- Classify every discrepancy as **Missing** (in spec, absent in design), **Partial**, or **Wrong** (contradicts spec).
- **Completion criterion**: gap report presented and scope confirmed by the user before writing app code.

### 3. Domain modeling

Cross-check all labels, statuses, and entity names against `CONTEXT.md` / `GLOSSARY.md` (`rules/i18n.md` #7–#8):
- Resolve overloaded terms, probe edge-case state transitions, and update the glossary's **Term table** (internal term → VI → EN) inline.
- **Completion criterion**: zero unresolved domain terms; `CONTEXT.md` / `GLOSSARY.md` updated.

### 4. Implementation

Build each screen/slice adhering strictly to `rules/frontend.md` and `rules/general.md`:
- **Tailwind v4 cascade layers & `@source` (`rules/frontend.md` #5)**: never copy unlayered `* { margin: 0; padding: 0; }` resets or unlayered custom classes from `.dc.html` / `tokens.css` alongside `@import "tailwindcss"` (unlayered rules override every `@layer utilities` `p-*`/`m-*`/`mx-auto` class). Put element resets in `@layer base`, custom classes in `@layer components`, and add `@source "../";` + shared UI package `@source` paths in `apps/*/src/app/globals.css`.
- **≤250-line post-`oxfmt` file budget (`rules/linting.md` #9)**: `oxfmt` expands single-line JSX props, objects, and destructuring by 1.4×–2.5×. Author each view, modal, hook, and data file under ~250 lines and always run `oxfmt <paths>` *before* `oxlint --max-warnings=0 <paths>`.
- **Deep-module boundaries (`rules/frontend.md` #7)**: import workspace packages only via `package.json#exports` entry points and app-internal files directly by path; do not create `export *` folder barrels unless the repo uses the legacy barrel convention.
- **Data & forms (`rules/frontend.md` #3, #11–#13)**: use Ponytail mock hooks (`// ponytail: ... Upgrade if: ...` inside `useQuery`/`useMutation`) only when the API endpoint does not exist yet; wire real endpoints immediately when available. Mirror backend DTOs in `<form>-schema.ts` (`react-hook-form` + `zodResolver`).
- **Route structure**: full-page create/edit uses a shared route editor across `/path/new` and `/path/[id]/edit` (`rules/frontend.md` #9); escape literal JSX entities (`&apos;`, `&quot;`, `&lt;`, `&gt;`); hide ligature icon spans with `aria-hidden="true"`.
- **Completion criterion**: `oxfmt`, `oxlint --max-warnings=0`, typecheck (`bun check` / `tsc --noEmit`), and unit tests pass with zero warnings.

### 5. Two-axis code review

Run `/code-review` against the base SHA along **Standards** (`rules/frontend.md`, `rules/i18n.md`, `rules/general.md`, Fowler smells) and **Spec** (missing, scope creep, wrong).
- **Completion criterion**: every finding resolved and re-verified with `oxfmt` + `oxlint`.

### 6. Live Chrome DevTools verification & UX refinement

Verify the live rendered app against the `.dc.html` reference using Chrome DevTools MCP (`rules/frontend.md` #20):
1. `navigate_page(url)` and `list_console_messages(types: ["error"])` → confirm **0 runtime/hydration errors**.
2. `evaluate_script()` → assert `getComputedStyle(el)` box-model (`paddingTop`, `paddingLeft`, `marginLeft`, `maxWidth`, `width`, `backgroundImage`, `color`) on `<main>`, `<aside>`, and `<header>` matches the design (catches unlayered CSS reset collisions where `px-8 py-7` computes to `0px`).
3. `take_snapshot()` & `take_screenshot()` → verify spacing, typography, token colors, responsive breakpoints, keyboard/focus flows, loading/empty/error states, and both VI/EN locales for leaked untranslated words. (Save screenshots inside workspace-local `.tmp-screenshots/` and delete `.tmp-screenshots/` plus any Next 16 generated `apps/*/AGENTS.md` before committing.)
- **Completion criterion**: pixel-perfect computed layout verified in Chrome DevTools, 0 console errors, clean `git status`, and all verification gates green.
