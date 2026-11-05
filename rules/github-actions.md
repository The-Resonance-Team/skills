# GitHub Actions Rules

Applies to any repo running CI on GitHub Actions. Action refs in workflows must stay SHA-pinned with a trailing version comment (`rules/github-supply-chain.md` #2).

## Entry point, reuse & concurrency

1. **One `ci.yml` entry point for the happy path** — Run lint, typecheck, test, and build from a single top-level `ci.yml` triggered on `push` (`main`) and `pull_request` (`main`), provisioned via `pnpm/setup@v2` (`runtime: node@26`, `install: false`, `cache: false` → `pnpm install --frozen-lockfile --ignore-scripts`) or `oven-sh/setup-bun@v2` with `bun-version-file: package.json` in Bun-native repos (so the version comes from `packageManager`/`devEngines`, never a hand-typed tag).
2. **Extract shared build/test logic into reusable workflows (`workflow_call`)** — When CI, release, or deploy workflows share steps, extract a `_*.yml` / `*-reusable.yml` workflow triggered by `on: workflow_call` instead of copying job blocks.
3. **Concurrency — cancel stale CI/PR runs, queue CD runs** — Every workflow declares a `concurrency` block:
   - **CI/PR checks (prevent waste)** — cancel superseded runs and skip while the PR is a draft:
     ```yaml
     on:
       pull_request:
         types: [opened, synchronize, reopened, ready_for_review, converted_to_draft]
     concurrency:
       group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
       cancel-in-progress: true
     ```
     - Keep keys stable across commits: a unique workflow prefix plus PR number or ref. Never use a commit SHA or run ID. Reusable workflows inherit the caller's `github.workflow`; keep caller and callee concurrency keys distinct.
     - Add `github.event.pull_request.draft != true` to each check job's existing `if`, including reusable-workflow callers and aggregate jobs. Job guards prevent runner allocation; step guards still allocate runners.
     - Preserve existing triggers when adding `ready_for_review` and `converted_to_draft`. The former starts checks when review begins; the latter lets a replacement run cancel old work before its jobs skip.
     - Concurrency cancellation needs a new run in the same group. If path filters prevent that run, use a trusted cleanup workflow on PR updates to cancel only older heads, rechecking the current head before cancellation. Never check out PR code in privileged cleanup.
   - **CD / deploys** — serialize instead of cancelling so an in-flight release is never killed mid-flight:
     ```yaml
     concurrency:
       group: <target>-deploy   # e.g. production-deploy
       queue: max              # up to 100 pending runs, FIFO
       cancel-in-progress: false
     ```
     Never combine `queue: max` with `cancel-in-progress: true` (workflow validation error).
   - **Key shape** — use the full `github.ref` (not `github.ref_name`) in keys so PR merge refs (`refs/pull/42/merge`) cannot collide with a branch of the same short name.

## Path filtering

4. **Skip unaffected surfaces with `dorny/paths-filter@v4`** — Gate `test` and `build` jobs on changed surfaces:
   - Grant `permissions: { contents: read, pull-requests: read }` and run `actions/checkout` only on `github.event_name == 'push'` (`fetch-depth: 2`) so PR runs query the GitHub PR Files API directly (~3s, no clone).
   - Always set `predicate-quantifier: 'some-with-excludes'` when combining positive globs with `!` exclusions (the default `'some'` matches if *any* positive pattern hits, ignoring the exclusion).
   - Carve leaf-only files (e.g. `!packages/i18n/src/messages/*/miniapp.json`) out of `api` and `web` filters so copy-only PRs skip 10+ minutes of unrelated builds (Precedent: Ecopick 2026-10, PR #453 — miniapp PR CI dropped from `12m 22s` to `39s`).
   - Include `.github/actions/**` and `.github/workflows/**` in the `app` filter (or document `workflow_dispatch` as the validation path). A CI-only PR matches no app glob, so its run skips every job and exercises none of the workflow it changes (Precedent: Ecopick 2026-11, PRs #560/#561).

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

5. **Set `timeout-minutes` on every job** — A hung job on a self-hosted runner blocks the shared runner until GitHub's 6-hour default expires. Set explicit bounds (`changes: 10`, `lint/typecheck/test/build/deploy: 15–30`, matching any inner SSH `command_timeout`). A job that reaches the bound is a hang, not a slow job: do not raise it before you know the cause. If a step is `completed` but the job is still `in_progress`, the runner is uploading logs — read `~/actions-runner*/_diag/blocks/<job-id>.*` on the runner instead of retrying `gh run view --log`. Precedent: Ecopick 2026-11 — step done at 11:20, job still uploading at 11:33.
6. **Schedule an uncached `--force` gate run** — Remote/Turbo cache hits replay old logs without running `tsc` or `bun lint --no-script --allow-unsupported`, hiding rot on stable packages until an unrelated branch busts the cache (Precedent: Ecopick 2026-09, PR #392 — `main` replayed cached green logs over two live `tsc` errors). Schedule a weekly `pnpm exec turbo run lint typecheck --force` job. A cached task can replay a *successful* broken run (e.g. a recursive lint that exits 0); after a cache-poisoning incident, run `turbo run lint typecheck --force` before merging the fix.
7. **Cap test workers in CI on self-hosted runners** — Vitest defaults to 1 worker per CPU, which OOMs (`exit 137`) or stalls 10× when sibling jobs compile concurrently on a small runner (Precedent: Ecopick 2026-09, PR #392). Cap workers in CI only (`pnpm exec turbo run test --concurrency=1 -- --maxWorkers=2`) and leave local runs at default parallelism.
8. **Disable Turborepo TUI in CI, and tell redraw noise from script recursion** — Turborepo's interactive TUI (`"ui": "tui"` in `turbo.json`) redraws the full command line on every task update, producing duplicate log noise. In CI/CD set `TURBO_UI=0` (or pass `--ui=stream`), or set `"ui": "stream"` as the default and opt in to TUI locally via `--ui=tui`. A different symptom — one `$ <script>` line whose argument list grows — is a script that re-invokes its own task name (e.g. `lint` → `bun lint`), not the TUI; check the script body and the runtime flag. Precedent: Ecopick 2026-11 — `TURBO_UI=0` was already set and the lint job still repeated the command; the cause was a recursive `bun lint` script.

9. **Strip duplicate passes and dead cache flushes from Next.js 16+ CI builds** — When CI runs a dedicated `typecheck` job and discards `.next/cache` after the run:
   - Run default Turbopack (`next build`, never `--webpack`) with `experimental.turbopackRustReactCompiler: true`.
   - Set `typescript: { ignoreBuildErrors: Boolean(process.env.CI) }` in `next.config.ts` to skip running `tsc` a second time inside `next build`.
   - Set `experimental: { turbopackFileSystemCacheForBuild: !process.env.CI }` to skip the ~45s end-of-build SSTable disk flush on ephemeral CI checkouts (Precedent: Ecopick 2026-10, PR #453 — `CI/build` dropped from `12m 22s` to `1m 40s`).

## Step-level parallelism (GitHub Actions 2026-06)

Run independent steps inside one job concurrently instead of splitting jobs. Four keywords:

```yaml
steps:
  - name: Start server
    id: server
    run: npm start
    background: true

  - run: ./scripts/wait-ready.sh
  - run: npm run test:e2e

  - name: Stop server
    cancel: server
```

- `background: true` — start a step asynchronously and continue to the next step immediately (long-running service/db).
- `wait: <id>` (or `wait: [a, b]`) — block until the named background step(s) finish.
- `wait-all` — block until every earlier background step finishes.
- `cancel: <id>` — gracefully stop a background step (e.g. the service) and wait for it to exit.
- `parallel` — group concurrent steps and wait for the group; shorthand for background steps followed by a wait.
- Each background step gets its own log stream. Prefer job-level parallelism when steps need different runners or isolation; use step-level for "start service, run tests, stop service" flows.

## Pre-commit hook scope (mechanical)

- **Keep the hook fast**: the hook runs `lint-staged` + `bun fmt --staged` only. Full `lint`/`typecheck`/`test` run in CI (`lint`, `typecheck`, `test`, `build` jobs). Heavy hooks push developers to `--no-verify` and defeat the guard.
- **Commit messages**: keep body lines ≤ 100 chars; relax to 120 if the repo's commitlint config allows. Avoid angle brackets in subjects if commitlint rejects them.

## Bundle regression (mechanical)

- **Bundle size budget in CI** — run `next build` + `next analyze` (or a size-limit check) on PRs and fail on regressions in client source paths or attributed compressed size. Catches catalog leaks and accidental barrel imports before merge. Precedent: VibeHost 2026-10 bundle audit.
