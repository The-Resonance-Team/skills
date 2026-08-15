# Frontend Rules — web, portal, miniapp

Applies to browser clients in the organization (React/Next.js web apps, admin portals, mobile-web miniapps). Include this file for any frontend repo.

## Scope

Client-side standards: API consumption, uploads, styling, forms. Backend-only repos should omit this file. Repos with an i18n feature additionally include `rules/i18n.md` (catalog discipline lives there, not here).

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
   - **i18n error messages** — the schema is a factory taking the translator: `const schema = (msg: TranslatorLike) => z.object({ ... })` with messages under `<ns>.errors.*`, wired via `zodResolver(schema(t))`. (Key placement follows `rules/i18n.md`.)
   - **Skip RHF for trivial forms** — a few fields with only `required` checks may stay on native `required` + plain state. Adopt RHF when the first rule beyond `required` lands (pattern, min/max, cross-field, dirty tracking) or when the form must mirror a non-trivial DTO.

## Route editors vs modal forms (mandatory)

9. **Route editor vs modal form** — A full-page create/edit form is a **route editor**: one component split across `/path/new` + `/path/[id]`, deriving `isNew = !id || id === 'new'`. Never gate create vs edit with `useState` on a page. A **modal form** (`*FormModal`, list page + `editId` state → Dialog) is allowed only for inline editing _from_ a list page. New multi-mode flows needing a dedicated page become routes, not state.
