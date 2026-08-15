# Frontend Rules — web, portal, miniapp

Applies to browser clients in the organization (React/Next.js web apps, admin portals, mobile-web miniapps). Include this file for any frontend repo.

## Scope

Client-side standards: API consumption, uploads, styling, forms, i18n. Backend-only repos should omit this file.

## API consumption (mandatory)

1. **Axios generic type parameter** — Declare response types via the generic parameter, never manual unwrap:

   ```ts
   const { data } = await api.get<MyType>("/endpoint");
   return data;
   ```

   NEVER write `data?.data as Type`. NEVER create duplicate `unwrap()` helpers — the interceptor handles the envelope.

2. **Native multipart helpers** — Use axios `postForm`/`putForm`/`patchForm` for uploads. Do NOT write a custom `toFormData` helper: native semantics skip undefined/null/empty, repeat `File` arrays per key, and match the server serializer.

## Styling (Tailwind v4)

3. **Check utility availability** — Tailwind v4 resized/renamed utilities. `max-w-sm` no longer exists; use `max-w-[24rem]`. When unsure, check AGENTS.md or the project's Tailwind config before using a utility.

## Barrel imports (mandatory)

4. **Barrels** — A folder with ≥2 non-test files (`components/`, `lib/`, `hooks/`, `features/`, ...) gets an `index.ts` `export *`-ing all members. New files added to a folder are added to its `index.ts` manually. Cross-folder imports go through the barrel (e.g. `@/components/ui`), never a deep file path. Imports **within the same folder** stay relative — never import the folder's own barrel (self-barrel cycles).

## Data fetching & forms setup (mandatory)

Library choices are fixed in `rules/libraries.md` (axios, react-hook-form, @tanstack/react-query). The wiring below is the structure every web app follows:

5. **Axios client** — exactly one instance in `lib/client.ts`: `axios.create({ baseURL, headers })` with:
   - a **request interceptor** injecting auth (Bearer token or Basic from storage — never inline in call sites, never `localStorage` for passwords),
   - a **response error interceptor** normalizing error messages to `` `${method} ${path} → ${status}` `` so callers and error UI read a consistent shape,
   - an unwrap interceptor **only if the API wraps responses** in `{ data: T }` — if the API returns payloads directly, no unwrap.
     Endpoint functions live in `lib/api.ts` and call `api.get<T>()` / `api.post<T>()` / `api.patch<T>()` / `api.delete<T>()` with the response generic, returning `r.data` (`api.get<SessionDto>(...).then((r) => r.data)`). Never `fetch`, never a second instance.
   - **Exception — SSE streams**: axios in the browser is XHR-based with no streaming-reader API, and `EventSource` cannot set auth headers. Streaming endpoints (SSE/NDJSON) stay on `fetch`, reusing the instance's `baseURL` and the same auth helper (`authHeader()`) the interceptor uses.

6. **Query provider** — `QueryClientProvider` wrapped once at the root layout through a `QueryProvider` component (`lib/query-provider.tsx`). No per-page providers, no new `QueryClient` per render (create it in `useState(() => new QueryClient())`).

7. **Query/mutation hooks** — typed hooks in `lib/use-<resource>.ts`, one per resource. Queries: `useQuery({ queryKey: ['resource', id], queryFn })`. Mutations: `useMutation({ mutationFn, onSuccess: () => invalidateQueries({ queryKey: [...] }) })`. Set `retry: false` on auth/session queries (401s must surface immediately, not retry 3×). Errors render from the hook's `error` — never swallowed into `useState`.

8. **Forms** — react-hook-form + `zodResolver`, one zod schema as the single source of truth (typed via `z.infer`). `useForm({ resolver: zodResolver(schema) })`, inputs via `{...register('field')}`, errors from `formState.errors`. No hand-rolled `useState` per field, no validation logic inside `onSubmit`.

   - **Schema mirrors the API DTO** — the zod schema encodes exactly what the backend DTO enforces (same required/optional set, same value constraints). Colocate it as `<form>-schema.ts` next to the form, with a comment pointing at the DTO file path as source of truth; update both whenever either changes. Never invent rules the DTO lacks (e.g. no enum for a backend free-text field).
   - **i18n error messages** — the schema is a factory taking the translator: `const schema = (msg: TranslatorLike) => z.object({ ... })` with messages under `<ns>.errors.*`, wired via `zodResolver(schema(t))`.
   - **Skip RHF for trivial forms** — a few fields with only `required` checks may stay on native `required` + plain state. Adopt RHF when the first rule beyond `required` lands (pattern, min/max, cross-field, dirty tracking) or when the form must mirror a non-trivial DTO.

## i18n (mandatory)

9. **Every UI string lives in the catalog** — messages live in `packages/i18n/src/messages/{vi,en}/<ns>.json` (one file per namespace per locale, merged at `locales.ts`). Components use the app translator (`useTranslations` on next-intl apps, `useI18n()` on the miniapp) and render `t('<ns>.key')`. A hardcoded string in a file that already calls `t()` is still a violation — sweep stragglers, not just files with no translator. When converting, reuse existing keys before adding new ones; never ship a second key for the same string.

10. **en ≡ vi parity is a build rule** — every new key goes into BOTH locale files in the same commit. A parity test (en ≡ vi key sets) guards it; missing keys return the key itself at runtime, so a bare key is a typo signal, not a fallback.

11. **Interpolation only, no rich text** — the miniapp translator substitutes `{name}` placeholders only; it does not render markup. For emphasis inside a message, split the message so the styled segment arrives as a param value and wrap the param in JSX: `t('court.cancelFree', { days: '≥ 2 ngày' })` rendered inside `<b>{days}</b>`. Next-intl apps may use `t.rich` where the message needs inline markup.

12. **Label maps hold keys, not strings** — when display labels live in a data/constant map (`AMENITY`, `BOOKING_STATUS`, status/sort enums), the map stores i18n keys (`'courtList.amenityLight'`), never user-facing text, and the render site calls `t(label as I18nKey)` (the typed key union). Translation happens at the render boundary, not inside data.

13. **Not everything is chrome** — do not translate: content (articles, wiki, help pages), demo/mock data, proper nouns (venue names, zones, cities, person names), locale labels (`Tiếng Việt`), currency suffixes (`đ`) and other formatting (use the shared `vnd()`/`VND()` formatters), and strings embedded in API payloads (`desc` fields) — those are data, not UI. Dead label maps with no consumers are not an i18n gap; fix or delete them, don't translate them.
