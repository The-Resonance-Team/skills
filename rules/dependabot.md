# Dependabot & Override Hygiene Rules

Applies to every repo with `.github/dependabot.yml` (copy `configs/dependabot.yml` as the starting baseline). Every version source in the repo must be covered by a matching ecosystem entry.

## Ecosystem coverage

1. **Match the ecosystem to the actual lockfile and container manifest** — Mismatched ecosystems fail the Dependabot job outright with `dependency_file_not_found` rather than skipping cleanly (Precedent: VibeHost 2026-10 — `npm` on a `bun.lock` repo and `docker` on a compose-only repo both aborted):

   | Version source                      | Ecosystem        | Condition                                   |
   | ----------------------------------- | ---------------- | ------------------------------------------- |
   | `package.json` dependencies         | `bun`            | repo uses `bun.lock`                        |
   | `package.json` dependencies         | `npm`            | repo uses `pnpm-lock.yaml`, `package-lock.json`, or `yarn.lock` |
   | `.github/workflows/*` action refs   | `github-actions` | always                                      |
   | `FROM <image>:<tag>` in Dockerfiles | `docker`         | `Dockerfile` or Kubernetes YAML exists (list plain `directories:`, never globs) |
   | `image:` in `docker-compose*.yml`   | `docker-compose` | compose file exists                         |

2. **Bump `packageManager` manually in one PR** — Dependabot has no `package-manager-versions` ecosystem (its validator rejects that string — Precedent: 2026-09). Update `package.json#packageManager`, refresh the lockfile (`pnpm install --lockfile-only` or `bun install`), update `engines`/`devEngines` if needed, and verify `git grep <old-version>` returns zero hits outside changelogs.

## Update policy & overrides

3. **Group `minor` + `patch`; keep `major` PRs individual (`open-pull-requests-limit: 5`)** — Group routine updates under `groups.minor-and-patch` (`patterns: ["*"]`, `update-types: ["minor", "patch"]`) so each major breaking upgrade gets its own isolated CI run.
4. **Never `ignore` a major without a rationale comment** — Security PRs bypass `ignore` anyway and land on the old major; document any mandatory major pin right above its `ignore:` block.
5. **Keep workflow actions SHA-pinned** — Use `uses: owner/repo@<40-char-sha> # v1.2.3`; Dependabot updates both the commit SHA and the trailing version comment.
6. **Single source of truth for `overrides` in `pnpm-workspace.yaml`** — `pnpm-workspace.yaml#overrides` completely shadows root `package.json#overrides`; delete any duplicate root `package.json` `overrides` block so edits never silently no-op. To bump a pinned transitive dependency for `pnpm audit`, update the pin in `pnpm-workspace.yaml` first, then run bare `pnpm update <pkg>` (passing an explicit `@version` is rejected when a pin exists) and confirm `pnpm audit --audit-level=high` exits `0` (Precedent: XaDaoXa 2026-09, PRs #257–#259).

## Supply-chain release age gate (`pnpm`)

7. **Enforce `minimumReleaseAge: 10080` (7 days) in `pnpm-workspace.yaml`** — Since pnpm v11, non-auth settings live in `pnpm-workspace.yaml` (not `.npmrc`). `minimumReleaseAge: 10080` blocks under-age versions during both Dependabot and CI `--frozen-lockfile` installs (Precedent: 2026-09 — caught 4 packages <7d old on first run). Exempt manually reviewed upgrades with exact `name@version` or name-only wildcard `"@oxfmt/binding-*"` and enable auto-pruning:

   ```yaml
   # pnpm-workspace.yaml
   minimumReleaseAge: 10080
   minimumReleaseAgeExclude:
     - cn@0.2.3
     - "@oxfmt/binding-*"
   minimumReleaseAgeExcludePrune: true
   ```
