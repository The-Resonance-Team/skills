# Supply-Chain Rules

Rules for trusting what CI runs and installs: vulnerability scanning, action pinning, and toolchain provisioning. Update policy (grouping, scheduling) lives in rules/dependabot.md.

## Code Quality / Security

### 1. CodeQL for security scanning

Enable CodeQL for security vulnerability scanning.

```yaml
name: CodeQL
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: "0 0 * * 1"

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

### 2. Pin action versions with SHA

Always pin actions to a full-length commit SHA, not a tag.

```yaml
# Bad — mutable tag
- uses: actions/checkout@v4

# Good — pinned SHA
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
```

Pin security tooling first: a secret scanner on a mutable ref (`trufflesecurity/trufflehog@main`) lets a tag move under the tool that guards the supply chain (incident 2026-09: pinned to `trufflesecurity/trufflehog@cc1fe982afc515d2991365ce8d4d0dd07170fcad # v3.97.2`).

## VPS Deploy via Self-Hosted Runners

### 3. Isolate `pnpm/action-setup` per job on shared-HOME runners

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

### 4. Never use corepack to manage pnpm

Node removed corepack in v25 (it ships in 22/24, gone in 25/26 — verified on installer bins), so any workflow or Dockerfile that calls it breaks the day the image moves past Node 24. Even where it exists, every invocation pays shim overhead. pnpm manages its own version since v10 — use that instead, per surface:

| Surface | Single version source                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------ |
| Dev box | `manage-package-manager-versions` (default-on: any pnpm ≥10 auto-switches to the `packageManager` pin) |
| CI      | `pnpm/action-setup` with no version input (reads the same field)                                       |
| Docker  | derive at build time — rules/github-vps-deploy.md §8                                                   |

Anti-pattern: `corepack enable`, `corepack prepare`, or documenting corepack as the install path. Incident 2026-09: a repo-wide grep found zero references only because an earlier PR had removed them; anything left would have died on the Node 26 bump.
