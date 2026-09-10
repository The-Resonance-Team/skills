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

### 3. Never use corepack to manage pnpm

Node removed corepack in v25 (it ships in 22/24, gone in 25/26 — verified on installer bins), so any workflow or Dockerfile that calls it breaks the day the image moves past Node 24. Even where it exists, every invocation pays shim overhead.

Anti-pattern: `corepack enable`, `corepack prepare`, or documenting corepack as the install path. Incident 2026-09: a repo-wide grep found zero references only because an earlier PR had removed them; anything left would have died on the Node 26 bump.

### 4. Fetch the pnpm binary directly from GitHub Releases

Favor a direct release-tarball fetch over `npm install -g pnpm`, a `pnpm` setup action, or `curl | sh https://get.pnpm.io/install.sh`:

```yaml
- name: Install pnpm
  shell: bash
  run: |
    set -euo pipefail
    PNPM_VERSION="$(node -p "require('./package.json').packageManager.split('@')[1]")"
    BIN="$RUNNER_TEMP/pnpm-bin"
    mkdir -p "$BIN"
    curl -fsSL "https://github.com/pnpm/pnpm/releases/download/v${PNPM_VERSION}/pnpm-linux-x64.tar.gz" \
      | tar -xz -C "$BIN" pnpm
    chmod +x "$BIN/pnpm"
    echo "$BIN" >> "$GITHUB_PATH"
```

Three traps, all paid for in 2026-09:

- The release asset is a `.tar.gz` with `pnpm` at the top level, not a bare `pnpm-linux-x64` binary — the bare name 404s (`curl: (22)`, exit 22).
- Extract into `$RUNNER_TEMP`, never `$HOME/.local/bin`. Self-hosted runners share `$HOME` across parallel jobs, and two tar processes collide on the same path (`chmod: cannot access '.../pnpm'`, exit 126 `Text file busy` — typecheck failed while test passed on the same push). This is the same race that makes `pnpm` setup actions take a per-job `dest`.
- `get.pnpm.io/install.sh` is a Node ESM script — it needs Node 18+ and dies on a runner with an older system Node (`SyntaxError: Invalid or unexpected token`). The direct fetch never invokes system Node, and never touches the npm registry.

In Docker the same fetch applies, but the asset must match libc and alpine has no curl — use `pnpm-linux-x64-musl.tar.gz` and busybox `wget`:

```dockerfile
RUN wget -qO- "https://github.com/pnpm/pnpm/releases/download/v$(node -p "require('./package.json').packageManager.split('@')[1]")/pnpm-linux-x64-musl.tar.gz" \
  | tar -xz -C /usr/local/bin pnpm
```
