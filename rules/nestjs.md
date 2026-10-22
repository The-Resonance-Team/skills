# NestJS Rules — API engineering

Applies to `apps/api`-style NestJS services in the organization. Include this file only for NestJS repos.

> **Pointers**: Time handling (`date-fns` + `TZDate` in `Asia/Ho_Chi_Minh`) follows `rules/general.md` (#9). File upload & media lifecycle rules live in `rules/upload.md`. Full Prisma 7 setup lives in `rules/prisma.md`.

## DTO validation & wire contract (mandatory)

1. **DTO class for every `@Body()` and multi-value `@Query()`/`@Param()`** — Validate at the pipe with `class-validator` decorators on a class, never inside services/controllers. Inline/mapped/intersection types (`{ x: string }`, `Omit<Dto, K>`, `Record<string, unknown>`, `BaseDto & { x: T }`) erase `metatype` to `Object` and **bypass `ValidationPipe`**; use `class ChildDto extends BaseDto` instead. NestJS 12 `schema` (`StandardSchemaValidationPipe`) stays opt-in — keep `class-validator` DTO classes as the default.
2. **Route params ride a single `@Param() params: XParamsDto`** — Never repeat `@Param('storeId') storeId: string, @Param('departmentId') ...`. Decorate every property (whitelist strips undecorated props), compose depth via `extends` (`StoreDepartmentParamsDto extends StoreParamsDto`), put shared shapes in `common/dto/route-params.dto.ts`, and pass `params` intact to the service (Precedent: RestoSuite 2026-08).
3. **`whitelist: true, forbidNonWhitelisted: true` 422s on undeclared fields** — Confirm the DTO declares any new client query/body param before sending it, and grep every caller before removing a DTO field; swallowed 422s look like blank UI sections (Precedent: XaDaoXa 2026-08).
4. **Prisma `DateTime` columns require `@Type(() => Date) @IsDate()`, never `@IsDateString()`** — `@IsDateString()` accepts bare `"2026-08-15"` strings (e.g. from `<input type="date">`), which Prisma `DateTime` rejects at write time with an unhandled 500. `@Type(() => Date) @IsDate()` coerces both date-only and ISO strings into a `Date` at the pipe (Precedent: XaDaoXa 2026-08).
5. **Normalization & cross-field rules live in the DTO** — Keep `.toUpperCase()`, CSV splits, `@Type(() => Number)`, and wire-to-DB enum maps in `@Transform`/`@Type` so services receive DB-ready shapes. Implement cross-field checks via `@ValidatorConstraint` + `@Validate(Constraint, [otherField])` in `common/validators/`, conditional requiredness via `@ValidateIf`, custom messages via decorator `{ message }`, and filter enums via `@IsIn([...Object.values(Enum), 'all'])` (400 at pipe, never silently dropped).
6. **DTOs pass intact across the controller→service seam** — Call `service.method(dto)` (imported with `import type`) without destructuring fields in the controller. Service→service calls and transport composites (cookies + body) may pass primitives.

## Routing & Swagger (mandatory)

7. **Register literal routes before `:param` routes on the same base** — `GET /things/:id` declared before `GET /things/summary` swallows `"summary"` as `:id`. This applies both to method order inside one controller and to `@Module` import order when two controllers share a `@Controller('prefix')` base. Audit shared prefixes with `grep -hoE "@Controller\('[^']+'\)" src -r | sort | uniq -d` (Precedent: XaDaoXa 2026-08).
8. **No `@ApiProperty` when `classValidatorShim: true` is enabled** — With `@nestjs/swagger` plugin (`classValidatorShim: true`, `introspectComments: true`) in `nest-cli.json`, types/requiredness/enums come from `class-validator` and examples/descriptions come from JSDoc (`/** example: Sân Tao Đàn */`). Never duplicate `@ApiProperty`/`@ApiPropertyOptional` (Precedent: ponytail audit 2026-08, 634 decorators removed).

## Folder layout, imports & module composition (mandatory)

9. **Folder per file type when count ≥ 2** — A file type appearing **2+ times** in a module lives in a plural folder (`services/`, `controllers/`, `schedulers/`, `policies/`, `guards/`, `decorators/`, `strategies/`, `testing/`, plus `dto/`, `repo/`, `middleware/`); a lone file of its type stays at the module root:
   - **Strict membership & root vocabulary**: type folders hold only that type. `<module>.types.ts`, `<module>.errors.ts`, `<module>.http.ts`, `<module>.module.ts`, `index.ts`, and unsuffixed files (`permissions.ts`) stay at the module root.
   - **Spec placement**: unit `*.spec.ts` files sit beside the file they test (`services/foo.service.spec.ts`); module-booting `*.integration.spec.ts`, `*.e2e.spec.ts`, and `*.http.spec.ts` stay at the module root; 2+ `*.spec-setup.ts` / `*-mock.ts` files move to `testing/`.
   - **No barrel in type folders**: `module/index.ts` is the only surface; enforce layout counts via a lint script and migrate existing modules only in dedicated compliance commits (Precedent: VibeHost ADR-0024).
10. **Split request DTOs from response/shared types** — Request contracts live in `module_name/dto/*.dto.ts`; response shapes, pagination wrappers, and cross-module row types live in `module_name/<module>.types.ts`.
11. **Relative-when-shorter imports** — Import across folders via `@/<folder>/...` unless the relative path (`../dto/create-video.dto`) is shorter; import defining files directly and keep same-folder imports relative.
12. **Import `@Global()` infra modules once in `AppModule`** — Never re-import `PrismaInfraModule`, `ClsModule`, or `ConfigModule` in child modules.
13. **Break `X → Y → X` module cycles with a neutral `*CoreModule`** — Extract dependency-free providers into `*CoreModule` imported by both sides; never re-register foreign `{ provide: TOKEN, useClass }` bindings or reach for `forwardRef()` (Precedent: TaxEasy 2026-08).

## Repository seam & Prisma 7 (mandatory)

14. **Flat domain-verb repos (`module_name/repo/<name>.repo.ts`), class is the contract** — Services never inject `PrismaService` directly. Each repo class (`<Entity>Repo` — no `Prisma` prefix, no `Repository` suffix, no `I*Repository` interface, no `repo/index.ts` barrel, no `*.repo.types.ts`, no base repo class; split at ~400 lines) exposes domain verbs and owns the query shape. Specs fake `<Entity>Repo` (`as unknown as <Entity>Repo`). Lock migrated modules with `no-restricted-imports` banning `PrismaService` in `**/*.service.ts`. When 2+ repos in a module share `select` shapes, extract `<module>/repos/<entity>.selects.ts` exporting `UPPER_SNAKE_SELECT as const` and re-exporting row types from `<module>.types.ts`.
15. **Atomic side-effects & race-safe transitions** — Never leak a raw transaction to services: either the repo verb runs `$transaction` and invokes a `(tx, row) => Promise<unknown>` callback (`transitionWithBroadcast`), or the caller passes a scoped `PrismaTx` handle (`enqueueInTx(client, ...)`). Implement race-safe claims via `updateMany` with the expected status in `WHERE` and check `count === 0` (`STATE_CHANGED_CONCURRENTLY`).
16. **Prisma 7 `prisma-client` generator + `@prisma/client` alias** — Generate into `src/generated/prisma` and map `@prisma/client` via tsconfig/Vitest regex alias (`rules/prisma.md`); never use legacy `prisma-client-js`.

## NestJS 12, env config & linting (mandatory)

17. **Unified `@nestjs/*` 12.x versioning & explicit `forRootAsync` arrays** — Upgrade all `@nestjs/*` core and satellite packages together (`@nestjs/http-client` versions independently). Always include `imports: []` and `providers: []` in `forRootAsync({...})` options to satisfy v12's stricter types (Precedent: XaDaoXa 2026-08, PR #226).
18. **`getOrThrow` for secrets & single Zod `env.schema.ts` on `ConfigModule`** — Use `config.getOrThrow(key)` for required keys (never local `requireString` wrappers or `?? ''` mid-request fallbacks). Validate boot env via one Zod 4 Standard Schema passed to `ConfigModule.forRoot({ validationSchema: envSchema })` (never `validate` callback, which strips undeclared vars, and never Joi):
    - Schema owns types, requiredness, and defaults — config factories project/rename keys without re-declaring `||` fallbacks (Precedent: Ecopick 2026-10).
    - Preprocess empty `KEY=` strings (`'' → undefined`) so optional keys hit their schema default.
    - **Presence gates** (keys whose presence enables a vendor SDK/webhook) get **no default** (NestJS copies schema defaults into `process.env`); lock their absence in a spec. Put conditional rules (`FRONTEND_URL` https in prod) in `.superRefine`.
19. **Oxlint decorator config & `!: ` DI properties** — Set `typescript/no-extraneous-class: ["warn", { "allowWithDecorator": true }]`. Property DI uses `private service!: Service` under `strict: true` (never disable `strictPropertyInitialization` or add `@ts-ignore`).

## CSRF, HTTP client, Mail & Storage (mandatory)

20. **Native CSRF header check (`app.enableCsrfProtection`), never `csurf`** — Cookie-authenticated Nest apps call `app.enableCsrfProtection({ trustedOrigins })` (checks `Sec-Fetch-Site` / `Origin` vs `Host`; preserve `Host` behind proxies). Cookie-less APIs behind a Next 16 BFF enforce the `Origin` allowlist in BFF `src/proxy.ts` and keep zero CSRF middleware in the API. `csrf-csrf` requires an ADR (Precedent: VibeHost 2026-10, ADR-0018/0022).
21. **`@nestjs/http-client` only — never `axios`, `@nestjs/axios`, or raw `fetch`** — Configure `HttpClientModule.forRoot({ retry: false, timeout: 10_000 })` once and `.register({ name, baseUrl, retry: false })` per upstream; inject via `@InjectHttpClient(name)`:

    ```ts
    const { data } = await this.http.post<Created>('/users', { json: { email } });
    // Errors: branch via instanceof HttpResponseError / HttpNetworkError / HttpTimeoutError
    // Tests: pass `fetch: stubFetch` in register() or .overrideProvider(getHttpClientToken('name'))
    ```

    Pass `json` or raw `body` (never both), `query` for search params, `params` for `:segment` (Precedent: VibeHost 2026-10).
22. **`@nestjs/mail` for transactional email** — Configure `MailModule.forRootAsync()` once in `AppModule`. Send `Mailable<TData>` classes via `Mailer.send(MailClass, { to, data, locale })` using built-in transports (`ResendTransport`, `SmtpTransport`, `SesTransport`, `FileMailTransport`, `InMemoryMailTransport`) and `FileTemplateEngine` (register template assets in `nest-cli.json#compilerOptions.assets`). Outbox consumers pass `idempotencyKey: message.id` and `retry: false`. In tests, assert via `mailbox.assertSent({ mail: MailClass })` — never regex raw HTML.
23. **`@nestjs/storage` for disks & uploads** — Configure `StorageModule.forRootAsync()` once in `AppModule` (`LocalDisk`, `S3Disk`, `InMemoryDisk`) and inject `StorageDisk` / `@InjectDisk('name')`. Follow `rules/upload.md` for `uploadToDisk`, `serveFile`, `signedUrl`, and media lifecycle.

## Runtime bounds, choke-point invariants & Vitest isolation (mandatory)

24. **Bounded in-memory `Map`s & disconnect-aware SSE streams** — Every stateful `Map` (login failures, rate buckets, caches) must enforce `MAX_ENTRIES`, TTL pruning, and FIFO eviction (`if (this.cache.size >= MAX_ENTRIES) this.cache.delete(this.cache.keys().next().value)`). SSE/streaming endpoints must attach `res.once('close', () => abortController.abort())`, pass `AbortSignal` to registry waiters, and implement `OnModuleDestroy` (Precedent: XaDaoXa 2026-09).
25. **Issuance choke-point guards, self-sorting helpers & Vitest timer restore** —
    - Enforce principal status checks (blacklist, suspension, lockout) inside the shared token/session issuer (`AuthIssuerService.issueTokens`, `SessionService.rotate` *before* `session.create`), never per-strategy (Precedent: Ecopick 2026-10).
    - Pure progression/threshold helpers (`resolveTierProgression`) sort their own input or call a direction-named repo verb (`listTiersDesc`) rather than trusting implicit repo sort order.
    - When `vitest.config.ts` sets `isolate: false`, register `afterAll(() => { vi.useRealTimers() })` in `setupFiles` (never global `afterEach`, which breaks multi-`describe` specs sharing a `beforeEach` clock) AND pair every per-file `vi.useFakeTimers()` with `afterEach`/`afterAll` restore so leaked `@sinonjs/fake-timers` never hang stream or multi-file multer `setImmediate` cleanup in subsequent specs (Precedent: Ecopick 2026-10, PR #452).
