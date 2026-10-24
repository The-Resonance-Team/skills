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

### 1. Design intake & workspace mapping

Inspect both the `.dc.html` markup and any companion `data.js` / `design/tokens.css` files (`rules/frontend.md` #20 — motion, timers, and computed display values live in `<script type="text/x-dc" data-dc-script>` and `data.js`, not HTML):
- **One-command `x-dc` scan first**: Claude Design `.dc.html` files store markup in `<x-dc>`, screen/modal names in `data-screen-label`, component props in `<script type="text/x-dc" data-dc-script data-props="...">`, and shared imports in `<dc-import>`. Before reading multi-thousand-line `.dc.html` files, run `rg -n 'data-screen-label=|data-props=|<dc-import|state\s*=|const\s+(NAV|TABS|ST|SEED)' *.dc.html data.js` and read only the line ranges of target `data-screen-label` sections and script methods. (If the `.dc.html` archive has not been audited for full `C/R/U/D` and lifecycle state completeness yet, run Step 4 of `workflows/claude-design-prompting.md` first.)
- **Incremental drops (v2 `.zip`)**: extract to a sibling folder and run `diff -rq <old_dir> <new_dir>` + `diff -u` first so you only inspect changed screens/tokens.
- **Surface-to-workspace matrix**: run `find apps packages -maxdepth 2` to map each `.dc.html` file to its owning workspace app (`apps/web`, `apps/auth`, `apps/client`, `apps/student`, `apps/tutor`, `apps/admin`) and shared package entry points (`packages/ui`, `packages/shared`, `packages/contracts`, `packages/i18n`).
- **Animations**: extract `@keyframes` bodies and `animation:` use-counts by script (`rules/frontend.md` #19), never by eye.
- **Completion criterion**: `.dc.html` → `apps/*` / `packages/*` file matrix, component inventory, route map, and data model sketch produced.

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
- **`.dc.html` mechanical translation gates (`lint:tokens`, `lint:icons`, `leak.test.ts`)**:
  - **No raw `#hex` or bracketed `[Npx]` utilities (`lint:tokens`, `rules/frontend.md` #6)**: `.dc.html` templates use inline hex and pixel styles (`style="background:#FFFCF6;font-size:13.5px"`). Translate every color and dimension to `@theme inline` semantic tokens in `packages/ui/tokens.css` (`bg-paper`, `bg-surface`, `border-line-strong`, `text-ink-3`, `bg-brand-700`, `bg-accent-600`, `font-serif`, `font-mono`) or `var(--am-*)`.
  - **Unicode glyphs → shared `ICON` vocabulary (`lint:icons`, `rules/frontend.md` #17)**: `.dc.html` templates draw icons as Unicode characters and emojis (`✓`, `×`, `→`, `★`, `♥`, `🔒`). Replace every JSX glyph with `<AmIcon icon={ICON.<concept>} size="sm|md|lg" />` (or `<AmRichIcon icon={RICH_ICON.<concept>} />` on decorative landing/empty cards) imported from `@scope/ui`. Keep arrows as characters only inside sentence strings (`"5.5 → 7.0"`, `↔`, `⇔`) and `<option>` bodies; strip leading `✓` glyphs from toast strings; add `aria-label` to every icon-only `<button>` or `<a>`.
  - **No prototype enum/machinery leaks (`rules/i18n.md` #7, #10)**: strip raw enum badges (`PENDING_REVIEW`, `TRIAL_IN_PROGRESS`) and internal terms (`SLA`, `Platform Fee`, `Billing Cycle`, `Tutor Rank`) from `.dc.html` copy before adding strings to `packages/i18n`.
- **Data & forms (`rules/frontend.md` #3, #11–#13)**: use Ponytail mock hooks (`// ponytail: ... Upgrade if: ...` inside `useQuery`/`useMutation`) only when the API endpoint does not exist yet; wire real endpoints immediately when available. Mirror backend DTOs in `<form>-schema.ts` (`react-hook-form` + `zodResolver`).
- **Route structure**: full-page create/edit uses a shared route editor across `/path/new` and `/path/[id]/edit` (`rules/frontend.md` #9); escape literal JSX entities (`&apos;`, `&quot;`, `&lt;`, `&gt;`).
- **Completion criterion**: `oxfmt`, `oxlint --max-warnings=0`, `lint:boundaries`, `lint:tokens`, `lint:icons`, typecheck (`bun check` / `tsc --noEmit`), and unit tests pass with zero warnings.

### 5. Two-axis code review

Run `/code-review` against the base SHA along **Standards** (`rules/frontend.md`, `rules/i18n.md`, `rules/general.md`, Fowler smells) and **Spec** (missing, scope creep, wrong).
- **Completion criterion**: every finding resolved and re-verified with `oxfmt` + `oxlint`.

### 6. Live Chrome DevTools verification & UX refinement

Verify the live rendered app against the `.dc.html` reference using Chrome DevTools MCP (`rules/frontend.md` #20):
1. `navigate_page(url)` and `list_console_messages(types: ["error"])` → confirm **0 runtime/hydration errors**.
2. `evaluate_script()` → assert `getComputedStyle(el)` box-model (`paddingTop`, `paddingLeft`, `marginLeft`, `maxWidth`, `width`, `backgroundImage`, `color`) on `<main>`, `<aside>`, and `<header>` matches the design (catches unlayered CSS reset collisions where `px-8 py-7` computes to `0px`).
3. `take_snapshot()` & `take_screenshot()` → verify spacing, typography, token colors, responsive breakpoints, keyboard/focus flows, loading/empty/error states, and both VI/EN locales for leaked untranslated words. (Save screenshots inside workspace-local `.tmp-screenshots/` and delete `.tmp-screenshots/` plus any Next 16 generated `apps/*/AGENTS.md` before committing.)
- **Completion criterion**: pixel-perfect computed layout verified in Chrome DevTools, 0 console errors, clean `git status`, and all verification gates green.
