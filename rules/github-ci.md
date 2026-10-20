# CI Workflow Rules

Rules for GitHub Actions CI: the entry-point workflow, reuse, concurrency, change filtering, matrices, and timeouts. Scope: any repo running CI on GitHub Actions.

## CI / Build & Test

### 1. One `ci.yml` for the happy path


Every repo has a single entry-point workflow that runs lint, typecheck, build, and test. Do not scatter these across multiple top-level workflows.

```yaml
# Good — one entry point
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test
```

### 2. Use reusable workflows for DRY


When multiple workflows need the same build or test logic, extract it to a reusable workflow (file starting with `_` or in `.github/workflows/`).

```yaml
# .github/workflows/build-reusable.yml
name: Build (reusable)
on:
  workflow_call:
    inputs:
      node-version:
        required: false
        type: string
        default: '20'
    outputs:
      build-status:
        value: ${{ jobs.build.outputs.status }}

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      status: ${{ steps.build.outcome }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
      - run: npm ci
      - run: npm run build
        id: build

# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  build:
    uses: ./.github/workflows/build-reusable.yml
    with:
      node-version: '20'
```

### 3. Concurrency: cancel stale CI, never cancel deploys


For CI, cancel superseded runs on the same branch. For deploys, let every run complete.

```yaml
# CI — cancel stale
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

# Deploy — never cancel
concurrency:
  group: deploy-${{ github.ref_name }}
  cancel-in-progress: false
```

### 4. Path-based filtering: skip work that did not change


Detect docs-only or surface-scoped changes with `dorny/paths-filter@v4` (Node 24 native; pin to commit SHA) and gate downstream `test` and `build` jobs on the affected surfaces:

- **Avoid cloning on PRs** — grant `permissions: pull-requests: read` so `pull_request` runs query the GitHub PR Files API directly (~3s). Gate `actions/checkout` with `if: github.event_name == 'push'` (`fetch-depth: 2`) so only branch pushes touch git.
- **Set `predicate-quantifier: 'some-with-excludes'` when mixing globs and `!` exclusions** — the default `'some'` quantifier evaluates each pattern independently, so `packages/i18n/**` still matches even when an exclusion like `!packages/i18n/src/messages/*/miniapp.json` is present. `'some-with-excludes'` requires at least one positive match AND zero negative matches.
- **Carve leaf-only slices out of shared packages** — when a shared package (`packages/i18n`) contains files consumed only by a surface that has no CI build/test step (e.g., miniapp locale JSONs), exclude those paths from the `api` and `web` filters so copy/miniapp PRs skip 10+ minutes of unrelated API tests and Next.js builds (Ecopick 2026-10, PR #453: miniapp PR `CI/build` dropped from `12m 22s` to `39s`).

```yaml
permissions:
  contents: read
  pull-requests: read

jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      api: ${{ steps.filter.outputs.api }}
      web: ${{ steps.filter.outputs.web }}
    steps:
      - name: Checkout code (push only)
        if: github.event_name == 'push'
        uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - name: Detect affected surfaces
        uses: dorny/paths-filter@de90cc6fb38fc0963ad72b210f1f284cd68cea36 # v4.0.3
        id: filter
        with:
          predicate-quantifier: 'some-with-excludes'
          filters: |
            api:
              - 'apps/api/**'
              - 'packages/shared/**'
              - 'packages/i18n/**'
              - '!packages/i18n/src/messages/*/miniapp.json'
            web:
              - 'apps/web/**'
              - 'apps/portal/**'
              - 'packages/**'
              - '!packages/i18n/src/messages/*/miniapp.json'

  test:
    needs: changes
    if: needs.changes.outputs.api == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm exec turbo run test --filter=@acme/api
```

### 5. Matrix builds for cross-platform / cross-version


Test across OS and runtime versions with a matrix. Do not hardcode separate jobs.

```yaml
jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node-version: [18, 20, 22]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm test
```

## VPS Deploy via Self-Hosted Runners

### 6. Every job gets `timeout-minutes`


A hung job on a self-hosted runner burns the single shared runner until GitHub's 6-hour default kills it. CI jobs already carry timeouts; deploy and publish jobs need them too.

```yaml
# Good — bound the worst case per job shape
jobs:
  changes:
    timeout-minutes: 10
  build-push:
    timeout-minutes: 30
  migrate:
    timeout-minutes: 30 # match the SSH command_timeout below it
  deploy:
    timeout-minutes: 30
```

### 7. Distrust a green cache: force-run gates on a schedule


A cache hit replays old logs without running the tool. A task whose inputs rarely
change (typecheck on a stable package) can stay green indefinitely over live
errors — proven when a branch change forced a real `tsc` run and exposed two
pre-existing errors main had reported green for days
(Incident 2026-09, Ecopick PR #392). Schedule a periodic uncached run of the
gates so rot surfaces on its own, not on a random branch.

```yaml
# Weekly cache-busting gate (or: pass --force to the runner)
# turbo: pnpm exec turbo run lint typecheck --force
```

### 8. Cap test workers to the self-hosted box


Test runners default to one worker per CPU. On a small shared box, with a sibling
job compiling at the same time, the suite OOMs (`137`) or slows 10×+ — proven on
an api suite that runs in ~30s locally but timed out at 511s and then OOM-killed
under `pool:threads` in CI (Incident 2026-09, Ecopick PR #392). Cap workers in
CI only; leave local defaults alone.

```yaml
# CI only — local runs keep the default worker count
- run: pnpm exec turbo run test --concurrency=1 -- --maxWorkers=2
```

### 9. Strip duplicate passes and dead cache flushes from Next.js 16+ CI builds


When a repo runs Next.js 16+ in CI alongside a dedicated `typecheck` job and ephemeral checkouts (where `.next/cache` is not persisted across runs):

- **Use Turbopack (`next build`), never `next build --webpack`** — Webpack compiles client, server, and edge bundles sequentially through JS `babel-plugin-react-compiler` and spends minutes in `@vercel/nft` (`Collecting build traces`) for `output: 'standalone'`. Default Turbopack + `experimental.turbopackRustReactCompiler: true` runs the native Rust React Compiler and emits standalone traces in ~0s.
- **Skip duplicate TypeScript checking in `next build` when `CI/typecheck` already gates the PR** — set `typescript: { ignoreBuildErrors: Boolean(process.env.CI) }` in `next.config.ts`. Running `tsc` a second time inside `next build` adds 1–3+ minutes per Next.js app for zero extra safety.
- **Disable Turbopack disk cache flushing when `.next/cache` is discarded** — set `experimental: { turbopackFileSystemCacheForBuild: !process.env.CI }` when CI runs on fresh checkouts or `turbo.json` excludes `!.next/cache/**`. Otherwise Turbopack spends ~45–50s per app at the end of `next build` flushing gigabytes of SSTables to disk that are deleted immediately after the job (Ecopick 2026-10, PR #453: combined changes cut full `CI/build` on `main` from `12m 22s` to `1m 40s` — `@ecopick/web:build` `7m 58s` → `1m 23s`, `@ecopick/portal:build` `3m 33s` → `40s`).

```ts
// apps/web/next.config.ts
const nextConfig: NextConfig = {
  output: 'standalone',
  reactCompiler: true,
  // CI runs a dedicated `typecheck` job (`tsc --noEmit`); skip the duplicate pass in `next build`.
  typescript: {
    ignoreBuildErrors: Boolean(process.env.CI),
  },
  experimental: {
    turbopackRustReactCompiler: true,
    // `.next/cache` is not persisted across CI runs; skip the ~45s SSTable flush at build end.
    turbopackFileSystemCacheForBuild: !process.env.CI,
  },
}
```

