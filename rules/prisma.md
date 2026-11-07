# Prisma 7 — client setup & writing rules

Applies to every TypeScript/NestJS project on Prisma ORM 7. Overrides the legacy `prisma-client-js` principle (v6-era: client generated into `node_modules/@prisma/client`, no adapter). MongoDB projects stay on Prisma 6.x — do not apply this module to them.

## Generator output (mandatory)

1. **`prisma-client` generator + source-tree output, never `prisma-client-js` for new work** — `prisma-client-js` (generates into `node_modules/@prisma/client`) is a migration-only fallback. Canonical base `schema.prisma` (TaxEasy `apps/api` 2026-08):

```prisma
// prisma/schema.prisma — v7 base (no url/directUrl in datasource; they live in prisma.config.ts)
generator client {
  provider        = "prisma-client"
  output          = "../src/generated/prisma"
  moduleFormat    = "cjs"          // CJS apps; omit for ESM
  previewFeatures = ["partialIndexes"]
}

datasource db {
  provider   = "postgresql"
  extensions = [unaccent, vector] // postgresqlExtensions preview feature
}
```

2. **`prisma.config.ts` owns env + database URL** — the schema `datasource` block keeps only `provider` + extensions; `url`/`directUrl`/`shadowDatabaseUrl` move here:

```typescript
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
  migrations: {
    path: "prisma/migrations",
    seed: "pnpm tsx prisma/seed/index.ts",
  },
});
```

3. **Regenerate with `pnpm prisma generate`** — output goes to `src/generated/prisma` and must stay gitignored (`.gitignore`: `generated/` matches at any depth). At build time `nest build` (swc) compiles the generated TS and rewrites the alias to relative requires, so runtime `node dist/main.js` needs no tsconfig-paths shim.

## `@prisma/client` alias (mandatory)

4. **Import from the `@prisma/client` specifier via path alias** — nothing is generated into node_modules, so the specifier must be mapped in every resolver (tsc/swc keys are EXACT, so the generated client's internal `@prisma/client/runtime/client` falls through to node_modules untouched):

```jsonc
// tsconfig.json
"paths": {
  "@/*": ["./src/*"],
  "@prisma/client": ["./src/generated/prisma/client.ts"]
}
```

5. **Vitest aliases MUST use the regex form** — in `vitest.config.ts` AND `vitest.integration.config.ts`. Vite object-form keys are **prefix-matched**: a string key `'@prisma/client'` also swallows `@prisma/client/runtime/client` (imported by the generated client itself), rewriting it into `client.ts/runtime/client` and breaking every spec (159/159 failed until fixed):

```typescript
resolve: {
  alias: [
    { find: '@', replacement: path.resolve(__dirname, 'src') },
    { find: /^@prisma\/client$/, replacement: path.resolve(__dirname, 'src/generated/prisma/client.ts') },
  ],
},
```

6. **Files outside `src/` keep the same specifier** — seed and `scripts/*.ts` resolve via tsconfig paths under `tsx`, but are outside the compiled program; only `src/` files are guaranteed rewrites.

## Writing Prisma code on v7 (mandatory)

7. **Driver adapter is mandatory** — `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`; pool sizing lives on the adapter (`max`, `idleTimeoutMillis`, `connectionTimeoutMillis`), never in `datasource.url` query strings. One adapter per client instance — primary + bare/system client = two adapters, no shared pool.

8. **Type-safe query fragments use `satisfies`, never `Prisma.validator`** — `Prisma.validator` is removed; `{ id: true } satisfies Prisma.UserSelect` is the replacement.

9. **Middleware is gone** — `$use()` is removed; custom behavior rides Client Extensions (`$extends`) or query extension on the client type. Do not reintroduce middleware-style hooks.

10. **Tenant scoping on the client type** — extensions (`$extends`) compose on `PrismaClient` via the generated `client` entrypoint; `PrismaService extends PrismaClient` with a `bareClient` for system ops (cron, raw SQL) is the canonical shape; `$queryRaw`/`$executeRaw` stay on the bare instance.

11. **Transactions** — `$transaction` interactive callbacks are the standard; race-safe transitions use `updateMany` with expected-state predicates (see `rules/nestjs.md` rule 10).

12. **No runtime statutory config in DB** — tax rates/feature thresholds resolve from the hardcoded versioned ledger, not from `prisma` reads (ADR 0042 pattern).

## Migrations (mandatory)

13. **Every model change ships a migration in the same commit** — `prisma validate` and `prisma format` do not compare `prisma/models/**` with `prisma/migrations`. CI's `migrate reset` applies migrations only, so a model edit without a migration passes validation and fails at runtime on the first query that reads the new column (`P2022`). `db push` development hides this. Precedent: Ecopick 2026-11 — 13 columns, the e2e seed failed on `marketing_opt_in`.

14. **CI fails on schema/migration drift** — Add to the `prisma` job:
    ```sh
    bun x prisma migrate diff --from-migrations prisma/migrations --to-schema prisma --exit-code
    ```
    Exit `0` is in sync, `2` is drift. `migrate status` compares applied migration rows, not the schema, so it does not catch this.

## Diagnosing a blank/wrong client field (mandatory)

15. **A blank or wrong-looking field on the client is often a `select` that never joined the relation — check the server response before patching the client fallback.** A frontend `sellerName: raw.sellerName ?? ''` mapper is a symptom, not a bug, if `raw.sellerName` was never sent because the endpoint's `select` (a shared `MANAGE_SELECT`/`LIST_SELECT` object, or an inline one) never included `seller: { select: { citizen: { select: { fullName: true } } } }` in the first place. Compare against a peer endpoint that renders the same underlying data correctly (a detail vs. list variant of the same entity, an admin vs. public read) before assuming the bug is in the mapper — a `select` shape shared across list/detail/create/update endpoints (`rules/nestjs.md` rule 11) missing one relation produces the identical gap on every consumer of that shape, not just the one screen where it was first noticed.

## Projection ownership (mandatory)

16. **One select module per table with named variants** — Each table has one canonical projection module in its owning domain (`<table>.select.ts`) with named variants (`Public`, `Self`, `Admin`, `Search`) and `satisfies Prisma.<Model>Select`. Other modules import or extend that module; they never redefine the table's shape. One table must not have several private select copies that drift.
17. **No cross-domain Prisma writes; reads go through the owner** — A domain writes only its own tables. A cross-domain write goes through the owning domain's write port; a cross-domain read goes through an owner read function or port. Admin dashboards and reports are not an exception. Enforce with dependency-cruiser or a lint map when the repo has one; otherwise grep `prisma.<table>` outside the owner path in review.
18. **Consolidating a select is a behavior change until proven otherwise** — Replacing a local select with a shared variant must preserve the exact field set. An additive field is still a response change; state it in the PR and test the affected endpoint. Do not delete a field to make the shared shape fit.
