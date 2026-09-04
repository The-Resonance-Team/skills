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


Detect docs-only or component-only changes and skip irrelevant jobs.

```yaml
jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      docs-only: ${{ steps.filter.outputs.docs }}
      turbopack-only: ${{ steps.filter.outputs.turbopack }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            docs:
              - 'docs/**'
              - '**/*.md'
            turbopack:
              - 'turbopack/**'

  test:
    needs: changes
    if: needs.changes.outputs.docs-only != 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test
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
