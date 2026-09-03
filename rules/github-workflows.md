# GitHub Workflows Rules

Rules for GitHub Actions CI/CD, automation, and workflow design. Distilled from patterns in the top 20 starred repos (Next.js, React, VSCode, TypeScript, Deno, Astro, Svelte, Vite, Node.js, Rust, TensorFlow, PyTorch, Home Assistant, Linux, Flutter, Angular, Docker, Kubernetes, Go).

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

## Release Automation

### 6. Changesets for library releases

For libraries with multiple packages or frequent releases, use changesets. The workflow detects changesets, versions, and publishes.

```yaml
name: Release
on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
      - run: npm ci
      - name: Create Release PR or Publish
        uses: changesets/action@v1
        with:
          publish: npm run release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 7. Manual dispatch for application releases

For applications, use `workflow_dispatch` to trigger releases manually.

```yaml
name: Trigger Release
on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to release (e.g., v1.2.3)'
        required: true
        type: string

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./scripts/release.sh ${{ inputs.version }}
```

## Cherry-Pick / Backport

### 8. Automated cherry-pick PRs

For release branches, automate cherry-picks with a manual-dispatch workflow that creates a PR.

```yaml
name: Cherry-Pick to Release
on:
  workflow_dispatch:
    inputs:
      release-branch:
        description: 'Release branch (e.g., release/v1.2)'
        required: true
        type: string
      commit-sha:
        description: 'Commit SHA to cherry-pick'
        required: true
        type: string

jobs:
  cherry-pick:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ inputs.release-branch }}
          fetch-depth: 0
      - name: Cherry-pick commit
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git cherry-pick ${{ inputs.commit-sha }}
      - name: Create PR
        uses: peter-evans/create-pull-request@v6
        with:
          title: 'Cherry-pick ${{ inputs.commit-sha }} to ${{ inputs.release-branch }}'
          base: ${{ inputs.release-branch }}
          branch: cherry-pick/${{ inputs.commit-sha }}
```

## Branch Sync

### 9. Sync main to release branches

Keep release branches in sync with main using a scheduled or manual workflow.

```yaml
name: Sync Release Branch
on:
  workflow_dispatch:
  schedule:
    - cron: '0 0 * * 1'  # Weekly

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Sync main to release
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git checkout release/v1.2
          git merge origin/main --no-edit
          git push origin release/v1.2
```

### 10. Sync examples to latest branch

For repos with examples, sync them to a `latest` branch when stable releases land.

```yaml
name: Sync Examples
on:
  push:
    branches: [main]

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Sync to latest branch
        uses: bluwy/auto-branch-sync-action@v1
        with:
          map: |
            / -> latest
            /examples/* -> examples/*
```

## Issue Triage

### 11. Auto-label issues by area

Label issues based on their content or template section.

```yaml
name: Triage Issues
on:
  issues:
    types: [opened]

jobs:
  triage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@v7
        with:
          script: |
            const body = context.payload.issue.body || '';
            const labels = [];
            
            if (body.includes('### Area\n\n- [X] API')) labels.push('area:api');
            if (body.includes('### Area\n\n- [X] Frontend')) labels.push('area:frontend');
            
            if (labels.length > 0) {
              await github.rest.issues.addLabels({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
                labels
              });
            }
```

### 12. Auto-close stale labeled issues

Close issues marked with specific labels after a period of inactivity.

```yaml
name: Close Stale Issues
on:
  schedule:
    - cron: '0 0 * * *'

jobs:
  close:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@v7
        with:
          script: |
            const labels = ['duplicate', 'wontfix', 'invalid'];
            const daysOld = 7;
            const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
            
            for (const label of labels) {
              const { data: issues } = await github.rest.issues.listForRepo({
                owner: context.repo.owner,
                repo: context.repo.repo,
                state: 'open',
                labels: label,
                since: cutoff.toISOString()
              });
              
              for (const issue of issues) {
                await github.rest.issues.createComment({
                  owner: context.repo.owner,
                  repo: context.repo.repo,
                  issue_number: issue.number,
                  body: `Closing as ${label} due to inactivity.`
                });
                await github.rest.issues.update({
                  owner: context.repo.owner,
                  repo: context.repo.repo,
                  issue_number: issue.number,
                  state: 'closed'
                });
              }
            }
```

### 13. Require reproduction links

Close issues that do not include a reproduction link.

```yaml
name: Check Reproduction
on:
  issues:
    types: [opened]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@v7
        with:
          script: |
            const body = context.payload.issue.body || '';
            const hasLink = /https?:\/\/(github\.com|stackblitz\.com|codesandbox\.io)/.test(body);
            
            if (!hasLink) {
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
                body: 'Please provide a reproduction link. Closing for now.'
              });
              await github.rest.issues.update({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
                state: 'closed'
              });
            }
```

## Dependency Roll

### 14. Automated dependency updates

For critical dependencies (e.g., Dart SDK in Flutter), automate rolls with a manual-dispatch workflow.

```yaml
name: Roll Dependency
on:
  workflow_dispatch:
    inputs:
      dep-version:
        description: 'Version or commit to roll to'
        required: true
        type: string

jobs:
  roll:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Update dependency
        run: ./scripts/update-dep.sh ${{ inputs.dep-version }}
      - name: Create PR
        uses: peter-evans/create-pull-request@v6
        with:
          title: 'Roll dependency to ${{ inputs.dep-version }}'
          branch: roll/dep-${{ inputs.dep-version }}
```

## Ecosystem CI

### 15. Comment-triggered downstream testing

Allow maintainers to trigger ecosystem CI on PRs with a comment command.

```yaml
name: Ecosystem CI Trigger
on:
  issue_comment:
    types: [created]

jobs:
  trigger:
    if: github.event.issue.pull_request && startsWith(github.event.comment.body, '/ecosystem-ci')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@v7
        with:
          script: |
            const comment = context.payload.comment.body;
            const user = context.payload.comment.user.login;
            
            // Check permissions
            const { data } = await github.rest.repos.getCollaboratorPermissionLevel({
              owner: context.repo.owner,
              repo: context.repo.repo,
              username: user
            });
            
            if (!data.user.permissions.push) {
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
                body: 'You do not have permission to trigger ecosystem CI.'
              });
              return;
            }
            
            // Trigger workflow
            await github.rest.actions.createWorkflowDispatch({
              owner: context.repo.owner,
              repo: context.repo.repo,
              workflow_id: 'ecosystem-ci.yml',
              ref: 'main',
              inputs: { pr_number: context.issue.number.toString() }
            });
```

## Autofix

### 16. Comment-triggered autofix

Allow maintainers to trigger lint autofix on PRs with a comment command.

```yaml
name: Autofix
on:
  issue_comment:
    types: [created]

jobs:
  autofix:
    if: github.event.issue.pull_request && github.event.comment.body == '/autofix'
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          ref: refs/pull/${{ github.event.issue.number }}/head
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint:fix
      - name: Commit and push
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add -A
          git diff --staged --quiet || git commit -m "chore: autofix lint"
          git push
```

## Code Quality / Security

### 17. CodeQL for security scanning

Enable CodeQL for security vulnerability scanning.

```yaml
name: CodeQL
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 1'

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: javascript
      - uses: github/codeql-action/analyze@v3
```

Code scanning upload needs Advanced Security enabled on the repo. On a private repo without it, analysis succeeds and the upload fails with `Advanced Security must be enabled ... to use code scanning` — check entitlement before adding this workflow (incident 2026-09: first CodeQL run on a private repo failed exactly there; the workflow was reverted until GHAS is enabled).

### 18. Pin action versions with SHA

Always pin actions to a full-length commit SHA, not a tag.

```yaml
# Bad — mutable tag
- uses: actions/checkout@v4

# Good — pinned SHA
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
```

Pin security tooling first: a secret scanner on a mutable ref (`trufflesecurity/trufflehog@main`) lets a tag move under the tool that guards the supply chain (incident 2026-09: pinned to `trufflesecurity/trufflehog@cc1fe982afc515d2991365ce8d4d0dd07170fcad # v3.97.2`).

## PR Management

### 19. Auto-label PRs by file path

Label PRs based on which files changed.

```yaml
name: Label PR
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  label:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            docs:
              - 'docs/**'
            frontend:
              - 'src/components/**'
              - 'src/pages/**'
            api:
              - 'src/api/**'
      - uses: actions/github-script@v7
        with:
          script: |
            const labels = [];
            if (${{ steps.filter.outputs.docs }}) labels.push('docs');
            if (${{ steps.filter.outputs.frontend }}) labels.push('frontend');
            if (${{ steps.filter.outputs.api }}) labels.push('api');
            
            if (labels.length > 0) {
              await github.rest.issues.addLabels({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
                labels
              });
            }
```

### 20. Enforce conventional commits

Require PR titles to follow conventional commit format.

```yaml
name: Semantic PR
on:
  pull_request:
    types: [opened, edited, synchronize]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: amannn/action-semantic-pull-request@v5
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## VPS Deploy via Self-Hosted Runners

### 21. Never curl files from GitHub API inside SSH sessions

`curl` to `api.github.com/repos/.../contents/...` inside an SSH session on a self-hosted runner fails with `curl: (23) Failure writing output to destination`. The `GHCR_TOKEN` (PAT with `read:packages` scope) can authenticate to the API, but the write fails intermittently across different runner instances.

**Fix**: Use `appleboy/scp-action` to SCP files from the runner (which already has the repo via `actions/checkout`) to the VPS. Files exist locally after checkout — no API download needed.

```yaml
# Bad — fails on some runners
- name: Deploy
  uses: appleboy/ssh-action@v1
  with:
    script: |
      curl -fsSL -H "Authorization: token $GHCR_TOKEN" \
        -o /tmp/deploy.sh \
        "https://api.github.com/repos/.../contents/deploy/scripts/deploy.sh?ref=$TAG"

# Good — SCP from runner to VPS
- name: Copy deploy files
  uses: appleboy/scp-action@v0.1.7
  with:
    source: "deploy/docker-compose.prod.yml,deploy/scripts/deploy.sh"
    target: "/tmp/deploy-stage/"
```

### 22. Health checks: use `127.0.0.1`, not `localhost`

`localhost` may resolve to IPv6 `::1` first on some systems, while Docker port bindings use `127.0.0.1` (IPv4 only). This causes health check failures even when the service is running.

```bash
# Bad — may resolve to IPv6
curl -s -o /dev/null -w '%{http_code}' "http://localhost:3401/v1/health"

# Good — explicit IPv4
curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3401/v1/health"
```

### 23. Always re-download deploy scripts in rollback

The `if [ ! -x /tmp/rollback.sh ]` guard reuses stale scripts from previous runs. A rollback needs the latest script version.

```yaml
# Bad — reuses stale file
- name: Rollback
  script: |
    if [ ! -x /tmp/rollback.sh ]; then
      curl -o /tmp/rollback.sh ...
    fi

# Good — always fresh
- name: Rollback
  script: |
    cp /tmp/deploy-stage/deploy/scripts/rollback.sh /tmp/rollback.sh
    chmod +x /tmp/rollback.sh
```

### 24. Pass all required env vars to deploy scripts

`appleboy/ssh-action` does not inherit workflow env vars. Every variable the deploy script reads must be explicitly passed:

```yaml
# Bad — TAG not passed
- name: Run deploy
  uses: appleboy/ssh-action@v1
  with:
    script: /tmp/deploy.sh

# Good — all vars explicit
- name: Run deploy
  uses: appleboy/ssh-action@v1
  with:
    script: |
      TAG="${{ github.ref_name }}" \
      REPO_OWNER="${{ secrets.DEPLOY_OWNER }}" \
      GHCR_TOKEN="${{ secrets.GHCR_TOKEN }}" \
      GH_ACTOR="${{ github.actor }}" \
        /tmp/deploy.sh
```

### 25. Pre-deploy: free disk space before writing files

Docker images and build cache can fill the disk. Run `docker system prune` before downloading or writing deploy files:

```yaml
script: |
  docker system prune -af || true
  docker builder prune -af || true
```

### 26. Authenticate docker-pulling actions on self-hosted runners

A third-party action that `docker run`s its own image (e.g. `trufflesecurity/trufflehog@main` pulling `ghcr.io/trufflesecurity/trufflehog`) pulls anonymously by default. GitHub-hosted runners get a fresh pooled IP per job and rarely hit registry rate limits; a self-hosted runner shares one IP across every job in the repo, so anonymous pulls hit the registry's per-IP limit and fail with a bare `denied` — not a rate-limit message, just a pull denial that looks like a real problem with the action.

**Fix**: authenticate the pull with `docker/login-action` before the step, moving it onto the token's own (much higher) limit:

```yaml
- name: Log in to GHCR
  uses: docker/login-action@v3
  with:
    registry: ghcr.io
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}

- name: Scan for leaked secrets (TruffleHog)
  uses: trufflesecurity/trufflehog@main
```

`GITHUB_TOKEN` works here even against a public image the repo doesn't own — authenticated pulls get a separate, larger quota than anonymous ones, regardless of the token's access scope to that image. Symptom to recognize: a step that pulls a third-party docker image starts failing on every branch (not just one PR) at the same time, with a bare `denied` from the registry.

### 27. `continue-on-error` hides failures

When using `appleboy/ssh-action` with `continue-on-error: true`, the step shows as passed even when the SSH command fails. Use `steps.<id>.outcome` (not `conclusion`) in downstream `if` conditions to detect actual failures:

```yaml
- name: Deploy
  id: deploy
  uses: appleboy/ssh-action@v1
  continue-on-error: true
  with:
    script: ...

- name: Rollback
  if: steps.deploy.outcome == 'failure' # outcome = actual result
  uses: appleboy/ssh-action@v1
```

### 28. Every job gets `timeout-minutes`

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

### 29. Isolate `pnpm/action-setup` per job on shared-HOME runners

`pnpm/action-setup` self-installs to `~/setup-pnpm` by default. Self-hosted runners share `$HOME` across parallel jobs, and concurrent self-installers race linking bins (`ENOENT ... chmod '.../pnpm/pnpm'`, exit 1 — incident 2026-09: lint + typecheck failed while test passed on the same push). Point `dest` at the per-job temp dir. Drop when back on github-hosted runners.

```yaml
# Bad — shared dest races on parallel self-hosted jobs
- uses: pnpm/action-setup@v4

# Good — one installer per job
- uses: pnpm/action-setup@v4
  with:
    run_install: false
    dest: ${{ runner.temp }}/setup-pnpm
```

### 30. Derive tool versions from the repo, never hardcode them in workflows

A version literal in a workflow is a version source Dependabot cannot see (dependabot.md §1: every source needs an entry, and workflow-inline tool versions have none). Read it from the manifest that owns it and pass it through.

```yaml
# Bad — rots when apps/api/package.json moves past prisma 7.9.1
sh -c "npm install -g dotenv prisma@7.9.1 && ..."

# Good — single source is apps/api/package.json
- name: Resolve Prisma version from repo
  id: prisma
  run: echo "version=$(node -p 'require("./apps/api/package.json").dependencies.prisma.replace("^","")')" >> "$GITHUB_OUTPUT"

- name: Run Prisma migrate deploy
  uses: appleboy/ssh-action@v1.0.3
  with:
    envs: PRISMA_VER
    env:
      PRISMA_VER: ${{ steps.prisma.outputs.version }}
    script: |
      sh -c "npm install -g dotenv prisma@$PRISMA_VER && ..."
```
