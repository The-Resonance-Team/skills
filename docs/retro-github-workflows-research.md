# Retro: GitHub Workflows Research

## What I did

Searched the 20 biggest repos on GitHub by stars and analyzed their `.github/workflows/` directories to distill common patterns for CI/CD, automation, testing, sync, and release management.

## Repos analyzed

| Repo | Stars | Workflow count | Notable patterns |
|------|-------|----------------|------------------|
| vercel/next.js | 130k+ | 30+ | Reusable workflows, triage bot, backport sync, Rspack integration tests |
| facebook/react | 230k+ | ~10 | CI, release, fuzzer |
| microsoft/vscode | 160k+ | ~15 | CI, codeql, telemetry |
| microsoft/TypeScript | 100k+ | 8 | Cherry-pick PR automation, issue auto-close, wiki sync |
| denoland/deno | 97k+ | ~15 | Binary builds, bench, lint, release |
| withastro/astro | 48k+ | 20+ | Changeset release, branch sync, examples sync, benchmark |
| sveltejs/svelte | 80k+ | 4 | Autofix command, ecosystem CI trigger, release |
| vitejs/vite | 69k+ | 13 | Ecosystem CI, issue management, preview release |
| nodejs/node | 108k+ | 30+ | Commit queue, coverage, flaky test labeling, WPT sync |
| rust-lang/rust | 98k+ | 3 | CI, GHCR, post-merge |
| tensorflow/tensorflow | 187k+ | 17 | Release cherry-pick, nightly update, ARM CI |
| pytorch/pytorch | 89k+ | 30+ | Runner determinator, binary builds, multi-platform test |
| home-assistant/core | 73k+ | 20+ | Translation sync, stale close, codeql |
| torvalds/linux | 185k+ | 2 | Minimal (mostly external tooling) |
| flutter/flutter | 166k+ | 20 | Dart roll, engine sync, cherry-pick, localization |
| angular/angular | 98k+ | ~10 | CI, release, caretaker |
| moby/moby (Docker) | 69k+ | 21 | Release branch sync, Windows CI, DCO check |
| kubernetes/kubernetes | 112k+ | ~5 | Minimal (mostly external Prow) |
| golang/go | 124k+ | ~5 | Minimal (mostly external buildlets) |

## Patterns distilled (26 rules)

### CI / Build & Test (5 rules)
1. **One `ci.yml` for the happy path** — single entry point for lint + typecheck + build + test
2. **Reusable workflows for DRY** — extract shared build/test logic to `_*` files
3. **Concurrency: cancel stale CI, never cancel deploys** — `cancel-in-progress: true` for CI, `false` for deploy
4. **Path-based filtering** — skip docs-only, skip component-only
5. **Matrix builds** — cross-platform, cross-version with `strategy.matrix`

### Release Automation (2 rules)
6. **Changesets for library releases** — automated versioning + publishing
7. **Manual dispatch for application releases** — `workflow_dispatch` with version input

### Cherry-Pick / Backport (1 rule)
8. **Automated cherry-pick PRs** — manual dispatch + `peter-evans/create-pull-request`

### Branch Sync (2 rules)
9. **Sync main to release branches** — scheduled or manual merge
10. **Sync examples to latest branch** — `auto-branch-sync-action`

### Issue Triage (3 rules)
11. **Auto-label issues by area** — parse issue body for area checkboxes
12. **Auto-close stale labeled issues** — close `duplicate`, `wontfix`, etc. after N days
13. **Require reproduction links** — close issues without repro links

### Dependency Roll (1 rule)
14. **Automated dependency updates** — manual dispatch + PR creation

### Ecosystem CI (1 rule)
15. **Comment-triggered downstream testing** — `/ecosystem-ci` command with permission check

### Autofix (1 rule)
16. **Comment-triggered autofix** — `/autofix` command, lint fix + push

### Code Quality / Security (2 rules)
17. **CodeQL for security scanning** — scheduled + PR-triggered
18. **Pin action versions with SHA** — never use mutable tags

### PR Management (2 rules)
19. **Auto-label PRs by file path** — `dorny/paths-filter` + `addLabels`
20. **Enforce conventional commits** — `amannn/action-semantic-pull-request`

### VPS Deploy (6 rules)
21-26. Existing rules for self-hosted runner deploys (SCP over curl, IPv4 health checks, etc.)

## Key insights

### 1. Most repos have 5-20 workflows
The sweet spot is:
- 1 CI workflow (lint + typecheck + build + test)
- 1 release workflow (changeset or manual)
- 1-2 issue management workflows (triage, stale close)
- 1 code quality workflow (CodeQL or similar)
- Optional: cherry-pick, sync, autofix, ecosystem CI

### 2. Reusable workflows are the DRY mechanism
Next.js uses `build_reusable.yml` called by `build_and_test.yml`, `integration_tests_reusable.yml`, etc. This avoids duplicating build logic across workflows.

### 3. Comment commands are the maintainer UX
Svelte, Vite, and others use `/autofix`, `/ecosystem-ci` commands. This is better than manual workflow dispatch because:
- It's discoverable (in the PR thread)
- It's auditable (comment history)
- It's permission-gated (check collaborator level)

### 4. Changesets dominate library releases
Astro, Svelte, Vite, and many others use changesets for automated versioning. The pattern:
- Changeset files in `.changeset/` describe bumps
- `changesets/action` creates version PRs
- Merging the version PR triggers publish

### 5. Cherry-pick automation is universal
Every large repo with release branches has cherry-pick automation. The pattern:
- Manual dispatch with `release-branch` + `commit-sha` inputs
- `git cherry-pick` + `peter-evans/create-pull-request`
- Sometimes label-triggered (Flutter's `easy-cp.yml`)

### 6. Path filtering saves CI minutes
Next.js detects docs-only and turbopack-only changes to skip irrelevant jobs. This is critical for large repos where full CI takes 30+ minutes.

### 7. SHA pinning is non-negotiable
Every top repo pins actions to full commit SHAs with version comments:
```yaml
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
```
This prevents supply-chain attacks from tag mutation.

## What I skipped

- **Benchmark workflows** — every large repo has them, but they're repo-specific (Turbopack bench, Deno bench, etc.)
- **Fuzzer workflows** — React has a fuzzer, but it's domain-specific
- **External CI systems** — Kubernetes uses Prow, Go uses buildlets, Linux uses external tooling. Out of scope for GitHub Actions rules.

## Files created/modified

- `rules/github-workflows.md` — expanded from 118 lines to ~500 lines with 26 rules
- `CONTEXT.md` — updated scope description, added 4 new terms
- `docs/retro-github-workflows-research.md` — this file
