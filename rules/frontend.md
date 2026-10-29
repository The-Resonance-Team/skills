# Frontend Rules — web, portal, miniapp

Applies to browser clients in the organization (React/Next.js web apps, admin portals, mobile-web miniapps). Repos with i18n additionally include `rules/i18n.md`.

## API consumption & Ponytail mock hooks (mandatory)

1. **Axios generic type parameter, never manual unwrap** — Declare response types via `const { data } = await api.get<MyType>('/endpoint')` and return `data`. Never write `data?.data as Type` or custom `unwrap()` helpers — the `lib/client.ts` response interceptor unwraps `{ data: T }` envelopes.
2. **Native multipart helpers & `FormData` passthrough** — Use `api.postForm<T>()` / `putForm` / `patchForm` for uploads; never hand-roll `toFormData` (native helpers skip `undefined`/`null`, repeat `File[]` per key, and match the server serializer). *Sole exception*: a single port-boundary `toFormData` inside a transport-agnostic `RequestPort` (`@repo/api-client` / `@scope/contracts`) shared with a `fetch` adapter, which **must** accept `Record<string, unknown> | FormData` and pass pre-built `FormData` instances through untouched (`body instanceof FormData ? body : toFormData(body)` — passing `FormData` into `Object.entries` yields `{}` and sends an empty upload body; Precedent: Gia Su Anh Minh 2026-10).
3. **Wire real API data once the endpoint exists; use Ponytail mock hooks only before it lands** — Hardcoded counts, badges, or rows that contradict a live endpoint are bugs to fix in the same pass, not TODOs (Precedent: XaDaoXa 2026-09 sidebar vs header counts). When the backend endpoint does not exist yet, put module-level mutable mock state behind standard `useQuery`/`useMutation` hooks so component signatures never change on swap:

   ```ts
   // ponytail: module-level mutable mock store. Upgrade if: GET/POST /v1/items lands.
   const MOCK_ITEMS: Item[] = [...];
   export const useItems = () => useQuery({ queryKey: ['items'], queryFn: async () => MOCK_ITEMS });
   ```

## Styling, Tailwind v4 & Colors (mandatory)

4. **Tailwind v4 utilities only** — No hand-rolled CSS files or inline `style={{}}` objects. Use v4 utility names (`shadow-xs`, `shadow-sm`, `rounded-xs`, `rounded-sm`, `shrink-0`, `outline-hidden`, `max-w-[24rem]`, `bg-linear-<angle> from-x to-y`; `ring-offset-*` is removed; `shadow-md/lg/xl` and `tracking-wider` remain valid). Check `AGENTS.md` or the theme config when unsure.
5. **Cascade-layer hygiene & `@source` in Tailwind v4** — In CSS Cascade Layers, **any unlayered rule beats every `@layer` rule** regardless of specificity (`* { margin: 0; padding: 0; }` unlayered zeroes out every `@layer utilities` `p-*`/`px-*`/`m-*`/`mx-auto` class). When porting `.dc.html` / `tokens.css` into a Tailwind v4 app (`@import "tailwindcss"`), drop duplicate resets or wrap element resets in `@layer base` and custom classes in `@layer components`. When `globals.css` sits in `apps/*/src/app/globals.css`, add `@source "../";` plus `@source` paths for shared UI packages (`@source "../../../../packages/ui/src";`) so Turbopack scans all components (Precedent: Gia Su Anh Minh 2026-10).
6. **Colors and dimensions are `@theme` design tokens, never literals (`lint:tokens` zero-baseline ratchet)** — Define shared tokens in `tokens.css` and app tokens in `globals.css` (`@theme inline`); reference them via generated classes (`bg-ph-bg`, `text-tier-low-strong`) or `var(--color-x)` in JS style maps. Replace Tailwind v3 arbitrary pixel values (`backdrop-blur-[2px]`, `max-w-[1280px]`, `text-[10px]`, `tracking-[0.2em]`) with Tailwind v4 tokens (`backdrop-blur-xs`, `max-w-7xl`, `text-xs`, `tracking-widest`). Once `scripts/tokens-baseline.json` reaches `{}` (`0` files holding legacy leaks), lock the baseline at zero so `lint:tokens` rejects any new `#hex` or `[...px]` literal immediately (Precedent: Gia Su Anh Minh 2026-10). Keep raw hex **only** where CSS variables cannot resolve: token definitions, `var(--color-x, #hex)` fallbacks, `themeColor` meta tags, `<canvas>`, SVG `fill`/`stroke` attributes, and brand/chart-series data maps.

## Module boundaries, file shape & Next.js 16 (mandatory)

7. **Deep-module boundaries by default (`oxc/no-barrel-file: "error"`)** — Import workspace packages only through declared `package.json#exports` entry points (`@scope/pkg`, `@scope/pkg/subpath`) and import app-internal modules directly by file path (use relative paths when shorter than `@/` alias; keep same-folder imports relative). Forbid `export *` folder barrels. *Legacy exception*: in repos that have not enabled `oxc/no-barrel-file`, folders with ≥2 non-test files maintain an `index.ts` barrel and never import their own barrel from within the same folder.
8. **300-line hard cap (`max-lines: 300`), one screen = one file, fold into shared UI** — Target **≤250 formatted lines** when authoring new files and split >300-line monoliths in-place (behavior identical): multi-view screens → thin shell + per-view files; `hooks.ts` → per-domain `use-<resource>.ts`; `lib/data` → per-domain `<domain>.ts` (delete dead exports/mocks during the split). Shared multi-variant components live **once** in the shared UI package using `cva` + `import { cn } from 'cn'` — fold new tones/variants (`Badge`, `Input`) into the shared component and delete app-local copies (`Pill`, `Btn`, `INPUT_CLASS`).
9. **Route editor vs modal form** — Full-page create/edit flows share one route-editor component across `/path/new` + `/path/[id]` (`isNew = !id || id === 'new'`), never page-level `useState`. Use `*FormModal` dialogs only for inline edits triggered from a list page.
10. **Next.js 16 conventions (`src/proxy.ts` & default Turbopack)** — Name request hooks `src/proxy.ts` exporting `export function proxy(request: NextRequest)` (Next.js 16 ignores deprecated `middleware.ts`). Run `next dev` and `next build` with default Turbopack (never `--webpack`). Ignore `**/next-env.d.ts` in `.gitignore`, `.oxfmtrc.json`, and `.oxlintrc.json` so dev/build route-type switches never dirty git; delete any tool-scaffolded `apps/*/AGENTS.md`. In Bun multi-app monorepos, symlink `apps/<app>/node_modules/.bin -> ../../../node_modules/.bin` in `postinstall` (Precedent: Gia Su Anh Minh 2026-10).

## Data fetching, React Query & Forms (mandatory)

11. **Single Axios client in `lib/client.ts` & controller route/verb parity in `lib/api.ts`** — Configure `axios.create({ baseURL, headers })` with: (a) auth request interceptor, (b) response error interceptor normalizing messages to `` `${method} ${path} → ${status}` ``, and (c) response unwrap interceptor only if the API wraps `{ data: T }`. Endpoint functions live in `lib/api.ts`. Before wiring portal `lib/api.ts` functions against a backend module, verify the exact `@Controller('prefix')` + `@Get/@Post/@Patch/@Delete` path and verb in `apps/api` (e.g. plural `/tutors/me` vs `/tutor/me`, `/classes/client` vs `/client/classes`, `POST /finance/checkout` vs `GET`, `/admin/tutors/verification-queue` vs `/kyc-queue` — Precedent: Gia Su Anh Minh 2026-10). Use `fetch` (sharing `baseURL` + `authHeader()`) **only** for SSE/NDJSON streaming endpoints. **Miniapp exemption**: Zalo miniapp keeps its local `fetch` client (`api/client.ts`) and local components (ADR-0039).
12. **`QueryProvider` & typed `use-<resource>.ts` hooks** — Wrap `QueryClientProvider` once at the root layout (`useState(() => new QueryClient())`); never fetch in `useEffect`. Centralize keys in `lib/query-keys.ts` and include `userId ?? 'anon'` on user-private caches; set `retry: false` on auth/session queries; update cache in a single layer (hook `onSuccess` OR form callback, never both); type `qc.setQueryData<MyType>(key, ...)` via generic; extract multi-query cache transitions into pure unit-tested `apply<Domain>Event(qc, event)` helpers in `lib/data/<domain>-cache.ts`.
13. **Forms (`react-hook-form` + `zodResolver`) mirror the backend DTO** — Colocate `<form>-schema.ts` next to the form with a comment citing the backend DTO path; wire i18n error messages via `const schema = (t: TranslatorLike) => z.object(...)`. Skip RHF only for trivial `required`-only forms.
    - **Zod v4 input ≠ output (`z.coerce` / `.transform()`)**: pass three generics `useForm<z.input<S>, unknown, z.output<S>>()` (and `Control<In, unknown, Out>`) — never cast `as unknown as Resolver<...>`. Render coerced inputs as `value={field.value == null ? '' : String(field.value)}`.
    - **Input normalization parity**: strip formatting separators (`value.replace(/[\s.-]/gu, '')`) before regex checks (e.g. VN phone `/^0\d{9,10}$/`) and pair positive-number constraints with HTML `min="1"` (Precedent: Ecopick 2026-10, PR #452).

## JSX, React hooks & UI reliability (mandatory)

14. **Escape JSX entities & data-drive repeated blocks/collections** — Escape literal `'`, `"`, `<`, `>`, `{`, `}` in JSX text (`&apos;`, `&quot;`, `&lt;`, `&gt;`, `&lbrace;`, `&rbrace;`). Render repeated option/tab/field rows from module-level `{ value, labelKey } as const` arrays via `.map`. Replace accumulator loops (`out.push(...)`) with `.map` / `.flatMap` / `Array.from` / `Object.fromEntries` (keep `for`/`while` only for early-exit scans, sequential state machines, or side-effect loops), and extract duplicate loop bodies into a shared helper.
15. **Hooks run unconditionally before any early return** — Place every `useState`/`useEffect`/`useMemo` above all `if (isLoading) return ...` guards; a hook after an early return crashes React the instant `isLoading` flips (Precedent: tournament live-tracker crash).
16. **Verify untyped route registries, shared lookup maps, modal flags & sibling screens** —
    - **Dispatch tables (`params: unknown`)**: grep every real `go('screen', ...)` / `push(...)` caller to confirm the passed payload shape instead of trusting the handler's `as` cast (Precedent: blank `trainerProfile` screen).
    - **Shared lookup maps (`STATUS_COLOR`, `TEMPLATE_LABELS`, icon maps)**: when adding a missing key, enumerate every backend enum value and caller string constant so zero keys fall through silently.
    - **Modal confirm actions**: verify the overlay library does not process `close: true` before `onClick: onConfirm` (silently turning Confirm into Cancel).
    - **Sibling-screen sweep**: when fixing shared cards, currency format (`vnd()`), or Zalo Mini App native capsule right-padding clearance (`SubHeader`), grep and update every sibling screen in the same commit.
17. **Shared icon vocabulary (`AmIcon` / `ICON`), zero Unicode icon glyphs, and `lint:icons` accessibility gate** —
    - **Concept-keyed registry in `packages/ui`**: render icons exclusively via `<AmIcon icon={ICON.<concept>} size="md" />` (and `<AmRichIcon icon={RICH_ICON.<concept>} />` on decorative hero/empty-state surfaces). If a domain concept lacks a key, add the concept key to `ICON` in `packages/ui` — never import `lucide-react` in app code or draw Unicode characters, fullwidth symbols, or emojis (`✓`, `✕`, `→`, `★`, `▣`, `＋` `\uFF0B`, `🔒`) in JSX.
    - **Guard shared keys in unit tests**: record every pair of concepts that intentionally share one icon component in `ICON_SHARED_KEYS` and assert in `packages/ui/tests/icon.test.ts` that unrecorded duplicates fail the build (Precedent: Gia Su Anh Minh 2026-10, ADR-0008).
    - **Text vs. icon boundary (`scripts/lint-icons.mjs`)**:
      - Arrows inside string literals or `<option>` bodies that join two words in a sentence (`"Từ 5.5 → 7.0"`, `↔`, `⇔`) and currency marks (`₫`) remain plain text.
      - Standalone arrows, action suffixes (`Xem hồ sơ` + `<AmIcon icon={ICON.next} />`), badge ticks, and separators in JSX must use `<AmIcon>`.
      - Toast messages (`role="status"`) carry plain text only — strip leading `✓` characters so screen readers do not announce `"check mark"`.
    - **Accessibility gate**: `<AmIcon>` and `<AmRichIcon>` always set `aria-hidden="true" focusable="false"` (and ligature spans set `<span className="material-symbols-rounded" aria-hidden="true">upload_file</span>`). Every icon-only `<button>` or `<a>` (containing `<AmIcon>` with no text label) must carry an `aria-label` or `aria-labelledby`, enforced in CI by `bun run lint:icons`.
18. **Encapsulate `URL.createObjectURL` & abort streams/timers on unmount** — Never call `URL.createObjectURL` during render or track preview URLs in a parent `useRef(Map)`. Isolate each file preview in a `<PhotoThumbnail file={file} />` child whose `useEffect` creates the URL and revokes it in cleanup:

    ```tsx
    useEffect(() => {
      const objectUrl = URL.createObjectURL(file);
      setUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }, [file]);
    ```

    Components consuming SSE/NDJSON streams or intervals must register an unmount cleanup calling `AbortController.abort()` / `stop()` (Precedent: XaDaoXa 2026-09).

## Design-prototype porting & live verification (mandatory)

19. **Port animations by script, preserve library motion, and key page-enter by pathname** — Extract `@keyframes` and usage counts from `.dc.html` by script (never eyeball or rebuild unimported CSS files) and audit all 3 layers (keyframes exist, utility class exists, markup carries class). Keep native motion on library-owned surfaces (`zmp-ui`, `sonner`, `recharts`) unless applying a verified property delta without geometry coupling. Wire route-change animations once via `<div key={pathname} className="cms-in ...">{children}</div>` and assert `getComputedStyle(el).animationName` in e2e (Precedent: XaDaoXa 2026-09).
20. **Assert scripted edits, inspect companion `.js` specs, and verify live `getComputedStyle` + both locales** —
    - Every scripted find-and-replace must assert the file changed (formatter reflows turn silent no-ops into false "done" reports — Precedent: VibeHost 2026-10).
    - Read both `.dc.html` and its companion `.js` files (motion, timers, and computed display values often live in scripts).
    - Verify live `getComputedStyle(el)` (`paddingTop`, `paddingLeft`, `marginLeft`, `maxWidth`, `width`, `backgroundImage`, `color`) on `<main>`, `<aside>`, and `<header>` in the browser rather than trusting source class strings.
    - Scan rendered page text in both VI and EN for leaked function words of the other language after any i18n change.
21. **Centralize UI/UX specifications in root `DESIGN.md` & wire `AGENTS.md` to it** —
    - **Single design & copy source of truth (`DESIGN.md`)**: keep tier `GLOSSARY.md` files strictly as pure glossaries of domain/presentation terms. Co-locate all UI/UX design rules in a root `DESIGN.md` and link it from `AGENTS.md` and `GLOSSARY-MAP.md` so every frontend or design-porting agent loads it on demand:
      1. Aesthetic direction & `@theme inline` token system (`packages/ui/tokens.css`, enforced by `lint:tokens`).
      2. Shared UI primitive inventory & concept-keyed icon vocabulary (`@scope/ui`, enforced by `lint:icons`).
      3. Component naming by domain role (e.g. `request-subject-step.tsx`, `request-done-screen.tsx` — never sequential wizard step numbers `step-1.tsx`..`step-4.tsx` that rot when steps reorder), flat domain-grouped folder structure, and `≤ 300`-line file size cap without prop-drilling screen shells.
      4. Responsive & adaptive layout rules (`375px` Mobile, `768px` Tablet, `1024px–1440px` Desktop) — 100% navigation reachability below `1024px`, responsive drawer/sheet drilldowns for multi-column split panes, `overflow-x-auto` for dense schedule/comparison grids, and CSS-first breakpoints (`md:`/`lg:`/`xl:`) over `window.innerWidth` state.
      5. User-facing copy voice/pronouns per surface, the canonical **Term table** (internal term → displayed VI/EN), and the **End-User vs Admin Console copy boundary** (`rules/i18n.md` #8, #10, enforced by `packages/i18n/tests/leak.test.ts`).

## Purity wall for pure modules (mechanical)

22. **Pure modules must not import UI or React-query hooks** — Files named `*-vm.ts`, `*-api.ts`, `*-model.ts`, or `*-model.tsx` must stay free of `@giasuanhminh/ui` (and any UI package) and of `@tanstack/react-query` hooks, so `bun test` can import them: the UI package pulls `next/font`, which crashes the Bun test runner. Enforce with a deterministic check (`no-restricted-imports` scoped to those globs, or a depcruise rule) rather than review. If a pure module needs an icon or component, return a discriminator (`"success" | "failure"`) and map it to the icon in the consuming component. Precedent: giasuanhminh refactor 2026-10.
