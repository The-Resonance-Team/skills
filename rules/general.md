# General Rules — cross-project, framework-agnostic

Applies to every project in the organization. Include this file in `opencode.json` `instructions` for any repo.

## Environment

- **Postgres: always Docker, never native install** — Use `docker compose up -d postgres` from the repo's `docker-compose.yml` for any test, migration, or local-DB work; tear down with `docker compose down` when done. Do not suggest `brew install postgresql*`, do not use `/opt/homebrew/bin/psql` for app work, and do not start a Homebrew Postgres service.

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

## Mock data (ponytail pattern)

8. **Ponytail mock hooks** — When backend endpoints don't exist yet, use module-level mutable mock data with a `// ponytail:` comment documenting the ceiling and upgrade path. Pattern:

   ```ts
   // ponytail: module-level mutable mock store. Upgrade path: swap for real API when backend ready.
   const MOCK_ITEMS: Item[] = [...];

   export function useItems() {
     return useQuery({
       queryKey: ["items"],
       queryFn: async () => MOCK_ITEMS,
     });
   }

   export function useCreateItem() {
     return useMutation({
       mutationFn: async (item: Item) => {
         MOCK_ITEMS.push({ ...item, id: `item-${Date.now()}` });
         return item;
       },
       onSuccess: () => queryClient.invalidateQueries({ queryKey: ["items"] }),
     });
   }
   ```

   The `// ponytail:` comment signals this is temporary mock data, not production code. When the real API lands, replace the mock hooks with real API calls — the component interface stays the same.

## Ponytail audit (mandatory)

19. **Ladder: delete → stdlib → native → search → dep → one-liner → minimal code** — Stop at the first rung that holds, but never skip the search rung. Before writing native/one-liner code for a concern with locale, Unicode, date/time, cryptography, parsing, or money edge cases, check `rules/libraries.md`'s table and run its discriminator (rule 7): edge cases non-trivial and enumerable → the library wins, even one not yet in the table. `react-paginate`/`framer-motion` pass the discriminator toward manual — `getPageItems()`/CSS are provably correct on the app's real input, no hidden edge cases. Slug generation fails it toward the library (`rules/libraries.md` rule 10). No speculative abstractions (interface with one impl, factory for one product). Deletion over addition; shortest diff wins. Mark deliberate simplifications with `// ponytail: <ceiling>, <upgrade if ...>` — every shortcut names its ceiling and upgrade path; a marker without `if/when/Upgrade` is `no-trigger` debt that rots (harvest with `grep -rnE '(#|//) ?ponytail:' . --exclude-dir=node_modules/.git/.next/dist` and ledger it).

20. **Debt ledger** — Every `ponytail:` comment is tech debt. Harvest the whole tree before merge, group by file `<file>:<line> — <what>. ceiling: <limit> upgrade: <trigger>`, tag `no-trigger` if no `if/when/Upgrade`. 0 no-trigger before ship. DTOs must not re-add `@ApiProperty` when NestJS swagger plugin `classValidatorShim` is on (see `rules/nestjs.md` #22).

## Cross-app impact

9. **Check affected apps before edit** — In a monorepo, a backend change may break a frontend consumer and vice versa. Before any code edit, grep the other apps for the affected symbol, endpoint, type, or field name. Checklist:
   - **Backend edit** → search `apps/web/`, `apps/portal/`, `apps/miniapp/`, `packages/api-client/` for the changed route, response shape, field name, or error code.
   - **Frontend edit** → check `apps/api/` for the endpoint the component calls, the DTO shape it sends, and the error codes it catches.
   - **Shared package edit** (`packages/utils`, `packages/ui`) → search all `apps/` for imports of the changed export.
   - If the grep finds a consumer, verify the edit does not break it. If it does, fix both sides in the same PR or document the break in the PR description.

## Rule maintenance

10. **Suggest rule updates** — These rules are a living document, not a fixed contract. When a rule is wrong, outdated, or missing for the task at hand, say so and suggest an update. Ask the user whether to update the rules, then edit `rules/*.md` in the `The-Resonance-Team/skills` repo and push to `main` when allowed. Do not silently deviate from a rule — propose the change instead.

## GitHub Actions

11. **Cancel in-progress runs on new push** — Every workflow sets a `concurrency` block with `cancel-in-progress: true`. A newer push to the same ref cancels the stale run; CI time is never spent on superseded commits.

12. **CI keys the group on `github.ref`** — `group: ci-${{ github.ref }}`. `github.ref` is the fully-qualified ref (`refs/heads/main`, `refs/tags/v1.0.0`, `refs/pull/42/merge`) — unique per trigger context. CI fires on both `push` and `pull_request`, so `ref` keeps a branch push, a tag push, and a PR run in separate groups; a PR run is never cancelled by an unrelated push. `github.ref_name` is unsafe here: `42/merge` (a PR's short name) collides with a branch literally named `42/merge`.

13. **CD keys the group on `github.ref_name`** — `group: cd-${{ github.ref_name }}`. Deployment is tracked per ref _name_ (`main`, `v1.0.0`) in the deploy-environments UI: same branch/tag → same deployment slot → a newer push cancels the stale deploy. `github.ref` would treat a tag and a same-named branch as different slots, allowing two deploys of the same target to run concurrently.

## Conventions (repo-level)

11. **DTOs pass intact through the controller→service seam** — DTOs (`@Body()`/`@Query()`) pass intact into the service (`service.method(dto)`), imported with `import type`; no field-by-field destructuring in the controller. Exceptions: service→service calls and transport composites (cookies + body) still use primitives.
12. **Time handling uses date-fns** — All time processing (parse, arithmetic, boundary, relative, display) uses `date-fns` + `@date-fns/tz`. Sole exception: serialization to the wire format keeps `toISOString()`. Boundaries (`startOfDay`/`startOfMonth`) always go through `new TZDate(d, TZ)` — never `new Date(y, m, d)` constructor arithmetic.
13. **Keep identifiers short** — A hand-written identifier over ~30 characters is a smell. Drop the qualifier the module or file context already carries (`ictReportingWeekBoundsInstantAt` inside `ict.ts`, `findAvailabilityTemplateForSlot` inside the appointments repo, `FeedbackReportTransitionPayload` inside the feedback module). Exempt: generated types (`*UncheckedUpdateManyInput`), DB constraint names, wire-format error codes (`INCOMPATIBLE_FUTURE_APPOINTMENTS`), and SCREAMING_CASE constants — unless a word is redundant (`MAX_OPEN_PENDING_ORDERS_PER_CITIZEN` → `MAX_PENDING_ORDERS_PER_CITIZEN`). Scan with: `grep -rhoE "[a-zA-Z_][a-zA-Z0-9_]{34,}" src --include="*.ts"`.

## Imports (TypeScript)

14. **Import specifiers never carry file extensions** — No `.ts`/`.tsx`/`.js`/`.jsx` in import paths: `from './portal'`, never `from './portal/index.ts'` or `from './portal.js'`. Resolvers handle extensionless specifiers; `allowImportingTsExtensions` stays off. Barrel directories import by directory name (`./portal`), not by `./portal/index`.

## Refactoring (mandatory)

The discipline that shipped the 47K-line ADR-0039 frontend componentization. Applies to every refactor, on any surface:

15. **Incremental strangle, never big-bang** — one page/component per PR, each slice reviewable and shippable on its own. A "rewrite everything at once" refactor is unreviewable at scale (ADR-0039 rejected it); the plan is a sequence of slices, not one mega-branch.
16. **Behavior identical, drift documented** — visual drift (token shifts, one-notch shadow scale) is acceptable only where the ADR/plan says so. A refactor that changes behavior is a feature change and gets its own PR.
17. **Deletion over addition** — a refactor deletes dead routes (no navigation entry, no roadmap item), dead exports, unused CSS files, and mock layers. A refactor that only moves code and deletes nothing carries its debt forward.
18. **Zero suppression debt** — a refactor leaves no lint suppression for the rules it was meant to satisfy: no `oxlint-disable max-lines` in any split file. Complete means complete.

## Subagents (orchestration)

19. **Partition subagents by path, never by rule within one directory** — two agents editing the same directory concurrently overwrite each other: corrupted syntax from mid-file merges, duplicate imports, and restores-from-HEAD that discard a sibling agent's work. One directory, one owner; batch agents by route group or module.
20. **Run the gates yourself after every agent returns** — an agent's "done" report is a claim, not evidence. Re-run the full gate suite (`lint --max-warnings=0`, `typecheck`, targeted tests) on the merged tree before building on the result; agents have reported clean trees holding syntax errors, type errors, and cap overruns. A dropped brace survives `tsc` when the file sits outside its tsconfig — lint the tree, not the project graph alone.
