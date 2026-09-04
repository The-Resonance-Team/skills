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

# Good — pinned version + per-job dest avoids both the registry lookup
# and the shared-HOME race (exit 254) on self-hosted runners
- uses: pnpm/action-setup@v4
  with:
    version: 12.3.1
    run_install: false
    dest: ${{ runner.temp }}/setup-pnpm
```

### 4. Never use corepack to manage pnpm

Node removed corepack in v25 (it ships in 22/24, gone in 25/26 — verified on installer bins), so any workflow or Dockerfile that calls it breaks the day the image moves past Node 24. Even where it exists, every invocation pays shim overhead.

Anti-pattern: `corepack enable`, `corepack prepare`, or documenting corepack as the install path. Incident 2026-09: a repo-wide grep found zero references only because an earlier PR had removed them; anything left would have died on the Node 26 bump.

### 5. Use `curl | sh` for pnpm in CI

Favor the official pnpm installer over `npm install -g pnpm` or `pnpm/action-setup`:

```yaml
# Good — fetches the pnpm binary directly; survives an npm registry outage
- name: Install pnpm
  run: curl -fsSL https://get.pnpm.io/install.sh | sh -
- name: Add pnpm to PATH
  run: echo "$HOME/.local/share/pnpm" >> "$GITHUB_PATH"
```

`get.pnpm.io/install.sh` downloads a pre-built binary from GitHub Releases — it never touches the npm registry, so it stays up when the audit endpoint or package registry is down (incident 2026-09: `pnpm/setup` fetches its own tarball from `registry.npmjs.org`; when the registry is degraded, CI fails even though the binary itself is healthy). The script auto-reads the `packageManager` field from `package.json` in the checked-out repo, so no explicit version is needed.

Avoid `npm install -g pnpm` — it adds an npm dependency resolution layer, is slower, and is the first thing to break when npm is degraded. Avoid `pnpm/action-setup` for the same reason (it too fetches from the npm registry). If you must use `pnpm/action-setup`, pass `version: <exact>` so the action resolves the tarball URL at GitHub Releases rather than querying the npm registry; combine with `dest: ${{ runner.temp }}/setup-pnpm` on shared-home runners to avoid the race described in §3.
