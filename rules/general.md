# General Rules — cross-project, framework-agnostic

Applies to every project in the organization. Include this file in `opencode.json` `instructions` for any repo.

## Language

1. **STE100 Simplified Technical English** — Always talk in ASD-STE100. Use only approved STE100 vocabulary. One meaning per word. Short sentences.
2. **CONTEXT.md is the glossary** — Always read `CONTEXT.md` files and use their ubiquitous language. When a term conflicts with the glossary, call it out immediately.
3. **Vietnamese diacritics** — Always use correct thanh điệu (diacritics) in Vietnamese content. Verify before commit.

## API clients (axios)

4. **Generic type parameter, never manual unwrap** — Use the axios generic type parameter to declare response types:

   ```ts
   const { data } = await api.get<MyType>("/endpoint");
   return data;
   ```

   NEVER write `data?.data as Type`. NEVER create duplicate `unwrap()`/`_unwrap()` helpers. The response interceptor in `client.ts` auto-unwraps the `{ data: T }` envelope; callers just type `T`. If an endpoint returns `{ data: T }` or `T` directly, the interceptor handles it.

5. **Multipart uploads use native axios helpers** — Use `postForm`/`putForm`/`patchForm` for multipart. Do NOT hand-roll a `toFormData` helper: native semantics skip undefined/null/empty, repeat `File` arrays per key, and match what the server serializer expects.

## Tailwind v4

6. **Check utility availability before use** — Tailwind v4 resized/renamed utilities. `max-w-sm` no longer exists; use `max-w-[24rem]`. When a utility is uncertain, check AGENTS.md or the project's Tailwind config before using it.

## Trust boundaries

7. **Validate input at trust boundaries** — Any handler receiving `@Body()`, or multiple `@Query()`/`@Param()` values, must use a DTO class with `class-validator` decorators. Validation lives in the DTO, not in the service/controller. Inline/mapped types (`{ x: string }`, `Omit<Dto, K>`, `Record<string, unknown>`) as a body param bypass the ValidationPipe (the `Object` metatype is excluded from validation) — for the pipe to run, the param must be a DTO class (it may `extends` another DTO to inherit metadata).

## Rule maintenance

10. **Suggest rule updates** — These rules are a living document, not a fixed contract. When a rule is wrong, outdated, or missing for the task at hand, say so and suggest an update. Ask the user whether to update the rules, then edit `rules/*.md` in the `The-Resonance-Team/skills` repo and push to `main` when allowed. Do not silently deviate from a rule — propose the change instead.

## Conventions (repo-level)

11. **DTOs pass intact through the controller→service seam** — DTOs (`@Body()`/`@Query()`) pass intact into the service (`service.method(dto)`), imported with `import type`; no field-by-field destructuring in the controller. Exceptions: service→service calls and transport composites (cookies + body) still use primitives.
12. **Time handling uses date-fns** — All time processing (parse, arithmetic, boundary, relative, display) uses `date-fns` + `@date-fns/tz`. Sole exception: serialization to the wire format keeps `toISOString()`. Boundaries (`startOfDay`/`startOfMonth`) always go through `new TZDate(d, TZ)` — never `new Date(y, m, d)` constructor arithmetic.
13. **Keep identifiers short** — A hand-written identifier over ~30 characters is a smell. Drop the qualifier the module or file context already carries (`ictReportingWeekBoundsInstantAt` inside `ict.ts`, `findAvailabilityTemplateForSlot` inside the appointments repo, `FeedbackReportTransitionPayload` inside the feedback module). Exempt: generated types (`*UncheckedUpdateManyInput`), DB constraint names, wire-format error codes (`INCOMPATIBLE_FUTURE_APPOINTMENTS`), and SCREAMING_CASE constants — unless a word is redundant (`MAX_OPEN_PENDING_ORDERS_PER_CITIZEN` → `MAX_PENDING_ORDERS_PER_CITIZEN`). Scan with: `grep -rhoE "[a-zA-Z_][a-zA-Z0-9_]{34,}" src --include="*.ts"`.
