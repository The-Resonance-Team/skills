# NestJS Rules — API engineering

Applies to `apps/api`-style NestJS services in the organization. Include this file only for NestJS repos.

## Scope

This module encodes the NestJS coding standards: DTO validation, folder layout, import discipline, and time handling. Consumers not running NestJS should omit this file from `instructions`.

## DTO validation (mandatory)

1. **DTO for every body / multi-param** — A handler receiving `@Body()`, or multiple `@Query()`/`@Param()` values, must use a DTO class with `class-validator` decorators. Validation lives in the DTO, not in the service/controller.
2. **No inline/mapped types for body** — `{ x: string }`, `Omit<Dto, K>`, `Record<string, unknown>` as a body param will **bypass ValidationPipe** (the `Object` metatype is excluded from validation). For the pipe to run, the param must be a DTO class (it may `extends` another DTO to inherit metadata).

## Folder layout (mandatory)

3. **`services/` folder** — A module with 2+ `*.service.ts` files (or a related service group) must be placed in `module_name/services/`. DTOs stay in `module_name/dto/`.

## Controller→service seam (mandatory)

4. **DTOs pass intact** — DTOs (`@Body()`/`@Query()`) pass **intact** into the service (`service.method(dto)`), imported with `import type`; no field-by-field destructuring in the controller. Exceptions: service→service calls and transport composites (cookies + body) still use primitives.

## Barrel + relative-when-shorter imports (mandatory)

5. **Barrels** — Every leaf folder with ≥2 non-test files (`dto/`, `services/`, `controllers/`, `common/decorators`, ...) must have an `index.ts` `export *`-ing all members. New files added to a folder must be added to its `index.ts` manually.
6. **Import routing** — Cross-folder imports go through the alias `@/<folder>` (e.g. `@/domain/commerce/booking/dto`), **unless the relative path is shorter than the alias** (e.g. from `domain/admin/controllers/` import `../dto` instead of `@/domain/admin/dto`); no deep file imports. Imports **within the same folder** stay relative (never import the folder's own barrel — avoid self-barrel cycles).

## Time handling (mandatory)

7. **date-fns only** — All time processing (parse, arithmetic, boundary, relative, display) uses `date-fns` + `@date-fns/tz`. Sole exception: serialization to the wire format keeps `toISOString()`. Display uses fixed timezone wrappers (`dateVi`/`formatVi`, timezone `Asia/Ho_Chi_Minh`); boundaries (`startOfDay`/`startOfMonth`) always go through `new TZDate(d, TZ)` — never `new Date(y, m, d)` constructor arithmetic.

## Uploads (when applicable)

8. **Built-in interceptor + allowlists** — Uploads validate with the built-in `FileInterceptor` (multer) and the built-in `file.mimetype`: extension allowlist + declared-mimetype allowlist + canonicalization. Do not hand-roll a separate MIME-validation interceptor. Keep ESM-only deps out of CJS builds.
