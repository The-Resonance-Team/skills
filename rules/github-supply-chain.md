# Supply-Chain & Toolchain Rules — GitHub Actions

Applies to any repo running GitHub Actions and installing packages from registries. Dependency update scheduling and grouping live in `rules/dependabot.md`.

## Security scanning & SHA pinning

1. **CodeQL security scanning (verify GHAS entitlement on private repos first)** — Run `github/codeql-action/{init,analyze}@v3` on `push`/`pull_request` to `main` and weekly cron (`0 0 * * 1`) with `permissions: { actions: read, contents: read, security-events: write }`. On private repos without GitHub Advanced Security (GHAS), analysis succeeds but `upload-sarif` fails with `Advanced Security must be enabled` — confirm entitlement before adding the workflow (Precedent: 2026-09 private-repo revert).
2. **Pin every action to a full 40-char commit SHA with a version comment** — Never reference mutable tags (`@v4`, `@main`). Pin security scanners first so a moving tag cannot subvert the scanner itself (Precedent: 2026-09 `trufflesecurity/trufflehog` pinned to SHA):

   ```yaml
   # Bad — mutable tag
   - uses: actions/checkout@v4

   # Good — immutable commit SHA + tag comment (Dependabot updates both)
   - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
   ```

## Self-hosted runner & Node 26 toolchain isolation

3. **Isolate `pnpm/setup@v2` per job on shared-`$HOME` self-hosted runners** — By default `pnpm/setup` installs into `~/setup-pnpm`, causing parallel jobs on the same runner to race while linking binaries (`ENOENT ... chmod '.../pnpm/pnpm'`, Precedent: 2026-09). Always set `dest: ${{ runner.temp }}/setup-pnpm` on self-hosted runners:

   ```yaml
   - uses: pnpm/setup@<sha> # v2
     with:
       runtime: node@26
       install: false
       cache: false
       dest: ${{ runner.temp }}/setup-pnpm
   ```

4. **Never use `corepack` to manage `pnpm`** — Node removed `corepack` in v25+ (gone in Node 25/26), and its shim adds per-command overhead. Derive the `pnpm` version from `package.json#packageManager` across every surface:
   - **Dev machine**: pnpm ≥10 `manage-package-manager-versions` (on by default).
   - **CI**: `pnpm/setup@v2` with no `version` input (`pnpm/action-setup` is legacy pnpm ≤10 only).
   - **Docker**: derive `PNPM_MAJOR` from `package.json` in the `base` stage (`rules/github-vps-deploy.md` #9).
