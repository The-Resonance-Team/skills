# NestJS Rules — API engineering

Applies to `apps/api`-style NestJS services in the organization. Include this file only for NestJS repos.

## Scope

This module encodes the NestJS coding standards: DTO validation, folder layout, import discipline, time handling, and the repository seam. Consumers not running NestJS should omit this file from `instructions`.

## DTO validation (mandatory)

1. **DTO for every body / multi-param** — A handler receiving `@Body()`, or multiple `@Query()`/`@Param()` values, must use a DTO class with `class-validator` decorators. Validation lives in the DTO, not in the service/controller.
2. **No inline/mapped types for body** — `{ x: string }`, `Omit<Dto, K>`, `Record<string, unknown>`, or an intersection like `BaseDto & { extra: X }` as a body/query param will **bypass ValidationPipe** (the `Object` metatype is excluded from validation). For the pipe to run, the param must be a DTO class. To extend a base DTO, `extends` it (`AdminListQueryDto extends ListQueryDto` adds properties _with_ their class-validator metadata).

## Folder layout (mandatory)

3. **`services/` folder** — A module with 2+ `*.service.ts` files (or a related service group) must be placed in `module_name/services/`. DTOs stay in `module_name/dto/`.
4. **Split types from DTOs** — A module separates what it _receives_ from what it _returns_:
   - Request contracts (`@Body()`/`@Query()` DTOs, validated by class-validator) live as kebab-case files in `module_name/dto/` (`create-video.dto.ts`, `video-list-query.dto.ts`).
   - Response shapes, pagination wrappers, and cross-module shared types live in a single `module_name/<module>.types.ts` (plural suffix, e.g. `video.types.ts`).
   - Both are re-exported through `index.ts` barrels (`dto/index.ts`, and the module's own `index.ts` when the module has ≥2 non-test files) — consumers import from the barrel, never from the deep file path.

## Controller→service seam (mandatory)

5. **DTOs pass intact** — DTOs (`@Body()`/`@Query()`) pass **intact** into the service (`service.method(dto)`), imported with `import type`; no field-by-field destructuring in the controller. Exceptions: service→service calls and transport composites (cookies + body) still use primitives.

## Module composition (mandatory)

17. **`@Global` infra modules are imported once — never re-imported** — A module decorated `@Global()` (PrismaInfraModule, ClsModule, `ConfigModule.forRoot({ isGlobal: true })`) exposes its exports app-wide; listing it in a child module's `imports` adds nothing. `AppModule` is the single import site. Do not re-import a `@Global` module in `common.module.ts` or any feature module — import only modules whose exports the module actually re-exports or whose load order matters.
18. **Break module cycles with a neutral core module — never re-provide another module's tokens** — A `X → Y → X` module cycle (e.g. `BillingModule → PaymentModule → SubscriptionActivationProcessor → BillingModule` tokens) must not be worked around by re-registering the far module's `{ provide: TOKEN, useClass: Impl }` bindings in the cycle-junction module. That block is the cycle's price tag: Nest requires every dep of a registered provider to resolve in the registering module, so every token the hoisted provider injects must be duplicated there (same-name `Symbol()` tokens from different modules make it worse — they cannot dedupe). Fix: extract the dependency-free subset into a neutral `*CoreModule` (no imports, or infra-only imports) that both sides import (`PaymentCoreModule` owns `VcbHttpService`/`VcbMerchantConfig`/`VcbPaymentService`; `PaymentModule` then imports `BillingModule` + `InventoryModule` for the activation processors, which are registered in their home modules and exported). The module graph must stay a DAG. Do not introduce `forwardRef()` as a substitute — extract the core instead (precedent: `infra/payment-vcb` TaxEasy 2026-08).

## DTO owns the wire contract (mandatory)

12. **Normalization is a DTO concern** — Case transforms (`.toUpperCase()` for DB enums), CSV→array splits, `@Type(() => Number)` coercion, and wire-label→DB-value maps (e.g. `active` → `PUBLISHED_VENDOR`) all live in the DTO via `@Transform`/`@Type`. The service receives values already in DB shape: no `toEnum` identity calls, no manual `.toUpperCase()`, no `isNaN` guards, no redundant format checks.
13. **Cross-field rules are DTO custom validators** — Field-relation rules (e.g. `expiresAt` after `issuedAt`) are `@ValidatorConstraint` classes used via `@Validate(Constraint, [otherField])`. Shared ones live in `common/validators/`. The service keeps only rules that need DB access or state.
14. **Conditional requiredness** — `@ValidateIf((dto) => dto.type === 'TOPUP')` makes a field required for one branch. Do not hand-check in the service.
15. **Error messages in the validator** — Pass `{ message: '...' }` options to the validator instead of throwing from the service.
16. **Invalid enum values fail fast** — Status/tab filters validate with `@IsIn([...Object.values(Enum), 'all'])` after a `@Transform` to upper case; an invalid value is a **400 from the pipe**, never silently dropped.

## Barrel + relative-when-shorter imports (mandatory)

6. **Barrels** — Every leaf folder with ≥2 non-test files (`dto/`, `services/`, `controllers/`, `common/decorators`, ...) must have an `index.ts` `export *`-ing all members. New files added to a folder must be added to its `index.ts` manually.
7. **Import routing** — Cross-folder imports go through the alias `@/<folder>` (e.g. `@/domain/commerce/booking/dto`), **unless the relative path is shorter than the alias** (e.g. from `domain/admin/controllers/` import `../dto` instead of `@/domain/admin/dto`); no deep file imports. Imports **within the same folder** stay relative (never import the folder's own barrel — avoid self-barrel cycles).

## Time handling (mandatory)

8. **date-fns only** — All time processing (parse, arithmetic, boundary, relative, display) uses `date-fns` + `@date-fns/tz`. Sole exception: serialization to the wire format keeps `toISOString()`. Display uses fixed timezone wrappers (`dateVi`/`formatVi`, timezone `Asia/Ho_Chi_Minh`); boundaries (`startOfDay`/`startOfMonth`) always go through `new TZDate(d, TZ)` — never `new Date(y, m, d)` constructor arithmetic.

## Repository seam (mandatory for Prisma-backed services)

9. **Domain-verb repos, never raw Prisma in services** — A Prisma-backed service does not inject `PrismaService` for its own queries. Each module owns one `<module>.repo.ts` that exposes domain verbs (`createFeedbackReport`, `raceSafeTransition`, `findCloseCandidates(now)`) — never Prisma query shapes. The repo is the only persistence surface; the repo→Prisma mapping is thin and untested. Specs fake the repo (`makeFakeRepo()`) instead of Prisma call shapes, so they assert on behavior and survive Prisma refactors. One repo per module; split at ~400 lines (precedent: `feedback.repo` / `appointments.repo`). Existing Prisma-level specs are migrated to the fake when a module adopts the seam — the constructor swap forces the spec rewrite anyway, and behavior-level assertions are the payoff. Adopting the seam on a module with heavy working specs is a recorded trade-off: do it once, not piecemeal (see XaDaoXa ADR-0040). Where filters are genuinely DTO-driven, a `where` argument of the Prisma input type may cross the seam (precedent: `feedback.repo.listManage`) — the verb still owns the select and the pagination shape.
10. **In-tx side-effects ride callbacks or client handles — never a leaked tx** — When a domain side-effect must commit atomically with a repo transition (outbox enqueue, notification broadcast), one of two shapes: (a) the repo verb runs its own `$transaction` and takes a `(tx, row) => Promise<unknown>` callback it invokes inside it (`transitionWithBroadcast`); (b) the caller owns the transaction and the service method takes a `PrismaTx` client handle scoped to that one insert (`enqueueInTx(client, ...)`). The service never issues arbitrary queries against a leaked tx. Race-safe claims use `updateMany` with the expected status (plus an extra predicate like `closedNotificationSentAt: null`) in WHERE; `count === 0` means a concurrent actor won — skip or throw `STATE_CHANGED_CONCURRENTLY`, never re-read blindly.
11. **Shared Prisma SELECT shapes live in `<module>/repos/<entity>.selects.ts`** — When 2+ repos in a module share row shapes, extract the `select` objects into a single `*.selects.ts` file next to the repos. Export each shape as `UPPER_SNAKE_SELECT` with `as const` (`APPOINTMENT_LIST_SELECT`), composing detail shapes from list shapes via spread (`{ ...LIST_SELECT, citizen: {...} }`). Re-export the row types those shapes produce from the same file (`export type { AppointmentListRow } from '<module>.types.ts'`) so repos import select + row type from one place. Keep single-use selects inline in the repo — the file exists only when 2+ repos share the shape; do not duplicate a shared shape per-repo, and do not extract descriptor-local shapes (precedent: `cultural-content/descriptor.ts` keeps its selects inline).

19. **Repo files live in `module_name/repo/` — flat, class is the contract, no interfaces** — The repo layer per module is one flat directory: `modules/<m>/repo/<name>.repo.ts` for the Prisma-backed class (named `<Entity>Repo` — no `Prisma` prefix, no `Repository` suffix; e.g. `PaymentIntentRepo` in `repo/payment-intent.repo.ts`) and `repo/index.ts` as the barrel. Consumers import the class from the barrel or `@/modules/<m>/repo`; cross-module non-DI consumers (pure functions, rule engines) type params with the concrete class too. There are **no `I*Repository` interfaces** — the class is the contract (Ecopick pattern; migrated 2026-08, TaxEasy `refactor/api-architecture`). Row shapes that must cross the seam live in one module-level file `module_name/<module>.types.ts` (e.g. `accounting.types.ts` exporting `InvoiceData`; per-repo `*.repo.types.ts` files are banned). The repo barrel (`repo/index.ts`) exports **classes only** — it never re-exports row types; consumers import classes from the barrel and row types directly from `../<module>.types`. Specs fake repos by casting the object literal `as unknown as <Entity>Repo`, or by typing each mock fn via `typeof Class.prototype['method']` — never through a deleted interface. Do NOT create `repositories/prisma/prisma-x.repo.ts`, `repositories/interfaces/`, `prisma-` file prefixes, `.repository.interface.ts` files, or `Prisma<X>Repository` class names — all banned (migrated 2026-08: 298 files moved to `repo/`, 137 interfaces deleted, 327 files renamed). Shared base: `BaseRepo` in `common/repo/base.repo.ts`. Files at `repo/` depth import siblings with `./name.repo`, the barrel with `'.'`.

## Env config access (mandatory)

12. **Secrets and required keys use `getOrThrow`, never `get` + hand-rolled guard** — `ConfigEnvService.getOrThrow(key)` throws at call time when the key is missing; a boot-time missing secret must fail the app, not degrade silently. Do NOT write a local `requireString(...)` helper wrapping `config.get(...)` (pattern seen twice in XaDaoXa: `oauth-token.service.ts`, `zalo-webhook.service.ts`) — `getOrThrow` is the one helper, delete the rest. `get(key)` is allowed only with an explicit default that is a non-secret (`config.get('OA_TOKEN_REFRESH_INTERVAL_MS') ?? 300_000`, `config.get('NODE_ENV') ?? 'development'`) or for a deliberately optional credential with a documented graceful-absence path (precedent: `zns-client.resolveToken` falls back to `config.get('ZALO_ACCESS_TOKEN')` and throws `ZnsClientNotConfiguredError` — the DB row is the primary source). A missing value that surfaces as a 500 mid-request (S3 keys `?? ''`, empty-string fallbacks) is the failure mode this rule forbids: prefer failing at boot.

## Linting (when applicable)

10. **Decorated classes** — oxlint sets `typescript/no-extraneous-class: ["warn", {"allowWithDecorator": true}]` (see `rules/linting.md`): NestJS entities, providers, and controllers are decorated classes and must not trip the rule.
11. **DI-injected properties use `!:`** — Constructor-less dependency injection writes `private service!: Service` (definite assignment) and keeps `strict: true`. `no-non-null-assertion` does not flag `!:` property declarations, only expression-position `x!` (verified against oxlint). Do not "fix" `!:` to `:` by disabling `strictPropertyInitialization` — that removes the compiler guarantee. No `@ts-ignore` on DI properties.

## Uploads (when applicable)

9. **Built-in interceptor + allowlists** — Uploads validate with the built-in `FileInterceptor` (multer) and the built-in `file.mimetype`: extension allowlist + declared-mimetype allowlist + canonicalization. Do not hand-roll a separate MIME-validation interceptor. Keep ESM-only deps out of CJS builds.
