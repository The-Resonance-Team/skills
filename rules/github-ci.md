# CI Workflow Rules — GitHub Actions

Applies to any repo running CI on GitHub Actions. Action refs in workflows must stay SHA-pinned with a trailing version comment (`rules/github-supply-chain.md` #2).

## Entry point, reuse & concurrency

1. **One `ci.yml` entry point for the happy path** — Run lint, typecheck, test, and build from a single top-level `ci.yml` triggered on `push` (`main`) and `pull_request` (`main`), provisioned via `pnpm/setup@v2` (`runtime: node@26`, `install: false`, `cache: false` → `pnpm install --frozen-lockfile --ignore-scripts`) or `oven-sh/setup-bun` in Bun-native repos.
2. **Extract shared build/test logic into reusable workflows (`workflow_call`)** — When CI, release, or deploy workflows share steps, extract a `_*.yml` / `*-reusable.yml` workflow triggered by `on: workflow_call` instead of copying job blocks.
3. **Concurrency: cancel stale CI on `github.ref`, key CD on `github.ref_name`** — Every workflow declares a `concurrency` block:
   - **CI (`group: ci-${{ github.ref }}`, `cancel-in-progress: true`)**: `github.ref` (`refs/heads/main`, `refs/pull/42/merge`, `refs/tags/v1.0.0`) isolates branch pushes, PR merges, and tags so a newer push cancels its own stale run without colliding across trigger types (`github.ref_name` `42/merge` can collide with a branch name).
   - **CD (`group: cd-${{ github.ref_name }}`, `cancel-in-progress: false` or slot-serialized)**: deployments track per target ref name (`main`, `v1.0.0`) so tags and branches targeting the same environment never deploy concurrently.

## Path filtering

4. **Skip unaffected surfaces with `dorny/paths-filter@v4`** — Gate `test` and `build` jobs on changed surfaces:
   - Grant `permissions: { contents: read, pull-requests: read }` and run `actions/checkout` only on `github.event_name == 'push'` (`fetch-depth: 2`) so PR runs query the GitHub PR Files API directly (~3s, no clone).
   - Always set `predicate-quantifier: 'some-with-excludes'` when combining positive globs with `!` exclusions (the default `'some'` matches if *any* positive pattern hits, ignoring the exclusion).
   - Carve leaf-only files (e.g. `!packages/i18n/src/messages/*/miniapp.json`) out of `api` and `web` filters so copy-only PRs skip 10+ minutes of unrelated builds (Precedent: Ecopick 2026-10, PR #453 — miniapp PR CI dropped from `12m 22s` to `39s`).

   ```yaml
   - uses: dorny/paths-filter@de90cc6fb38fc0963ad72b210f1f284cd68cea36 # v4.0.3
     id: filter
     with:
       predicate-quantifier: 'some-with-excludes'
       filters: |
         api:
           - 'apps/api/**'
           - 'packages/i18n/**'
           - '!packages/i18n/src/messages/*/miniapp.json'
   ```

## Runner protection, cache busting & Next.js 16 build speed

5. **Set `timeout-minutes` on every job** — A hung job on a self-hosted runner blocks the shared runner until GitHub's 6-hour default expires. Set explicit bounds (`changes: 10`, `lint/typecheck/test/build/deploy: 15–30`, matching any inner SSH `command_timeout`).
6. **Schedule an uncached `--force` gate run** — Remote/Turbo cache hits replay old logs without running `tsc` or `oxlint`, hiding rot on stable packages until an unrelated branch busts the cache (Precedent: Ecopick 2026-09, PR #392 — `main` replayed cached green logs over two live `tsc` errors). Schedule a weekly `pnpm exec turbo run lint typecheck --force` job.
7. **Cap test workers in CI on self-hosted runners** — Vitest defaults to 1 worker per CPU, which OOMs (`exit 137`) or stalls 10× when sibling jobs compile concurrently on a small runner (Precedent: Ecopick 2026-09, PR #392). Cap workers in CI only (`pnpm exec turbo run test --concurrency=1 -- --maxWorkers=2`) and leave local runs at default parallelism.
8. **Strip duplicate passes and dead cache flushes from Next.js 16+ CI builds** — When CI runs a dedicated `typecheck` job and discards `.next/cache` after the run:
   - Run default Turbopack (`next build`, never `--webpack`) with `experimental.turbopackRustReactCompiler: true`.
   - Set `typescript: { ignoreBuildErrors: Boolean(process.env.CI) }` in `next.config.ts` to skip running `tsc` a second time inside `next build`.
   - Set `experimental: { turbopackFileSystemCacheForBuild: !process.env.CI }` to skip the ~45s end-of-build SSTable disk flush on ephemeral CI checkouts (Precedent: Ecopick 2026-10, PR #453 — `CI/build` dropped from `12m 22s` to `1m 40s`).
