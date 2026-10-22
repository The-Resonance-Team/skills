# Release Workflow Rules — shipping, cherry-picks & branch sync

Applies to any repo cutting library/application releases or maintaining release branches on GitHub Actions. Pin all action refs to full commit SHAs (`rules/github-supply-chain.md` #2).

## Release automation

1. **Changesets for multi-package library releases** — Trigger `changesets/action` on `push` to `main` (`fetch-depth: 0`) to open version PRs and publish packages when merged:

   ```yaml
   - uses: changesets/action@<sha> # v1
     with:
       publish: pnpm run release
     env:
       GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
       NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
   ```

2. **Manual `workflow_dispatch` for application releases** — Trigger application releases explicitly via `workflow_dispatch` with a required `version` input (`v1.2.3`) rather than on every push to `main`.

## Cherry-pick & release branch sync

3. **Automated cherry-pick PRs (`workflow_dispatch`)** — Backport commits to a release branch via a dispatch workflow taking `release-branch` and `commit-sha`, running `git cherry-pick`, and opening a PR with `peter-evans/create-pull-request`:

   ```yaml
   - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
     with:
       ref: ${{ inputs.release-branch }}
       fetch-depth: 0
   - run: |
       git config user.name "github-actions[bot]"
       git config user.email "github-actions[bot]@users.noreply.github.com"
       git cherry-pick ${{ inputs.commit-sha }}
   - uses: peter-evans/create-pull-request@<sha> # v6
     with:
       base: ${{ inputs.release-branch }}
       branch: cherry-pick/${{ inputs.commit-sha }}
       title: "chore(release): cherry-pick ${{ inputs.commit-sha }} to ${{ inputs.release-branch }}"
   ```

4. **Scheduled/manual sync from `main` to active release branches** — Where long-lived release branches must track `main`, sync them via a weekly cron (`0 0 * * 1`) + `workflow_dispatch` job (`fetch-depth: 0`, `git checkout release/vX.Y && git merge origin/main --no-edit && git push`).
