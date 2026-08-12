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
