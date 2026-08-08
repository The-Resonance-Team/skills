# Library Baseline — one library per concern, chosen by framework

Applies to every TypeScript/JavaScript project. One library per concern, fixed by framework. A substitute library is a violation, not a preference. Cross-project rules on usage (`axios` generics, `date-fns` time handling) live in `rules/general.md`.

## The table

| Concern | Web/React (portal, web, miniapp, mobile-rn) | NestJS (apps/api) |
|---|---|---|
| HTTP client | `axios` | `axios` |
| Runtime validation | `zod` | `class-validator` + `class-transformer` |
| Forms | `react-hook-form` | — |
| Server state | `@tanstack/react-query` | — |
| Time | `date-fns` + `@date-fns/tz` | `date-fns` + `@date-fns/tz` |

## Rules

1. **axios is the only HTTP client** — no `fetch`-wrapper hand-rolls, no got/ky/undici. Generic type parameter + interceptor unwrapping per `rules/general.md`; `postForm`/`putForm`/`patchForm` for uploads.
2. **zod is the only runtime validation for web clients** — forms, API-client input, config parsing. No yup/joi/io-ts. `z.infer` derives the shared type; the schema is the source of truth, never a hand-maintained duplicate interface.
3. **react-hook-form is the only form library** — with `zodResolver`, so the RHF schema and the zod schema are one. No formik, no react-final-form, no hand-rolled `useState` form state.
4. **@tanstack/react-query is the only server-state library** — data fetching, caching, and invalidation go through queries/mutations. No SWR, no RTK Query, no `useEffect` + `fetch` + manual `setState` caching.
5. **class-validator + class-transformer are the only validation for NestJS trust boundaries** — DTO classes with decorators, per `rules/nestjs.md` rule 1. `zod` is client-side; it never validates a `@Body()`. The two share no types: the wire contract is the DTO, the client contract is the zod schema.
6. **date-fns + @date-fns/tz are the only time library** — parse, arithmetic, boundaries, and display per `rules/general.md`. No dayjs, no luxon, no moment. The serialization exception stays `toISOString()`.
7. **No new library for a covered concern** — a library absent from the table may be proposed for a *new* concern, never for an existing row. Propose it as a rule update (`rules/general.md` rule 10) instead of adding it silently.
