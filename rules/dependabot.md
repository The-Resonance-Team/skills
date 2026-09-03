# Dependabot Rules

Rules for keeping every version source in a repo under Dependabot automation. Scope: any repo on GitHub with a `.github/dependabot.yml`. A dependency version that no ecosystem entry covers is a manual liability: it drifts silently until it rots (copy `configs/dependabot.yml` from the skills repo as the baseline).

## Coverage

### 1. One ecosystem entry per version source in the repo

List every place a version is declared, and give each one an entry in `dependabot.yml`. A typical TS monorepo needs all three:

| Version source                      | Ecosystem        |
| ----------------------------------- | ---------------- |
| `package.json` dependencies         | `npm`            |
| `.github/workflows/*` action refs   | `github-actions` |
| `FROM <image>:<tag>` in Dockerfiles | `docker`         |

Anti-pattern: an `npm`-only config. The `npm` ecosystem does **not** touch the `packageManager` field, and it never reads `RUN npm i -g <tool>@<ver>` lines. The result is CI on the new version while Docker images and the local toolchain build on the old one — drift nobody sees until a lockfile refuses to install.

### 2. The package manager binary is manual — no ecosystem covers it

There is no `package-manager-versions` ecosystem value (Dependabot rejects it — incident 2026-09: the team baseline shipped it and the config validator failed the PR). Bumping the binary means, by hand, in one PR:

- the `packageManager` field in `package.json` plus `pnpm install --lockfile-only` for the lockfile block;
- `RUN npm i -g pnpm@<ver>` lines inside Dockerfiles — or better, derive pnpm from `package.json` at build time so nothing manual remains (github-workflows.md §30);
- `engines` / `devEngines` runtime fields if the bump changes the required runtime;
- the developer's locally installed toolchain — outside the repo, say so in the PR body.

A version bump is landed only when `git grep <old-version>` returns nothing outside the changelog.

## Update policy

### 3. Group minor and patch; keep majors individual

```yaml
groups:
  minor-and-patch:
    patterns: ["*"]
    update-types: ["minor", "patch"]
```

One grouped PR for routine bumps; one PR per major so a breaking bump gets its own build-and-test signal. Cap the noise: `open-pull-requests-limit: 5`.

### 4. Never `ignore` a major to dodge work

Security-update PRs bypass `ignore` conditions anyway, so ignoring a major hides only the planned upgrade; the emergency patch still lands on top of the old major. If a major must stay pinned, say why in a comment above the `ignore:` block.

### 5. Keep action SHA pins pinned

Workflow action refs stay pinned to an exact commit hash with the tag in a trailing comment (`uses: owner/repo@<sha> # v1.2.3`). Dependabot updates the SHA and syncs the comment for SHA-pinned refs. Anti-pattern: re-pinning a Dependabot PR back to a tag ref, or letting a tag ref stay a tag ref — tag drift is a supply-chain hazard.

## Safety

### 6. Gate fresh releases with `minimumReleaseAge` (pnpm)

Dependabot proposes the newest matching version, including one published an hour ago — the exact window supply-chain hijacks exploit. pnpm's `minimumReleaseAge` (minutes, in `pnpm-workspace.yaml` — not `.npmrc`: since pnpm v11 only auth/registry settings are read from `.npmrc`) makes every install, including frozen CI installs, fail on versions younger than the cutoff. The default is 1440 (1 day) since v11; an explicit value is strict (fail, never fall back).

```yaml
# pnpm-workspace.yaml — 10080 minutes = 7 days
minimumReleaseAge: 10080
```

Manually-reviewed upgrades exempt themselves with exact-version pins (future releases stay gated); `minimumReleaseAgeExcludePrune` drops stale pins on the next add/update/remove:

```yaml
minimumReleaseAgeExclude:
  # manual upgrades, one line per reviewed version
  - cn@0.2.3
  - zod@4.5.2
minimumReleaseAgeExcludePrune: true
```

Worked incident (2026-09): enabling the gate failed CI on four lockfile entries younger than 7 days (`cn@0.2.3` at 1 day old among them) — the gate doing its job on the first run. Dependabot PRs that resolve to under-age versions now fail the CI install until they mature; no human triage needed.
