# PR Automation Rules — `/autofix`, path labels, semantic titles & branch cleanup

Applies to any repo managing pull requests on GitHub. Pin all action refs to full commit SHAs (`rules/github-supply-chain.md` #2).

## Comment commands & PR hygiene

1. **Permission-gated `/autofix` comment command** — Allow collaborators with write access to trigger formatter/linter autofixes on a PR via an `issue_comment` (`created`) workflow when `github.event.issue.pull_request && github.event.comment.body == '/autofix'`:

   ```yaml
   permissions:
     contents: write
     pull-requests: write
   steps:
     - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
       with:
         ref: refs/pull/${{ github.event.issue.number }}/head
     - uses: pnpm/setup@<sha> # v2
       with:
         runtime: node@26
         install: false
         cache: false
         dest: ${{ runner.temp }}/setup-pnpm
     - run: pnpm install --frozen-lockfile --ignore-scripts
     - run: pnpm run format && pnpm run lint --fix
     - run: |
         git config user.name "github-actions[bot]"
         git config user.email "github-actions[bot]@users.noreply.github.com"
         git add -A
         git diff --staged --quiet || (git commit -m "chore: autofix format and lint" && git push)
   ```

2. **Auto-label PRs by changed file path** — Use `dorny/paths-filter@v4` (with `pull-requests: read` so no checkout is needed) + `actions/github-script@v7` on `pull_request: [opened, synchronize]` to apply surface labels (`api`, `web`, `portal`, `miniapp`, `docs`).
3. **Enforce conventional PR titles** — Validate `pull_request` titles (`[opened, edited, synchronize]`) with `amannn/action-semantic-pull-request@v5` so squash-merge commits always satisfy `commitlint`.

## Branch cleanup on merge

4. **Always merge with `gh pr merge --delete-branch` and prune local refs** — Merge PRs with:

   ```sh
   gh pr merge <number> --squash --delete-branch
   git branch -d <branch>
   git fetch --prune
   ```

   GitHub's `delete_branch_on_merge` repo setting only removes the remote ref once at merge time (leaving local branches behind, and never re-deleting a branch if a stale local push recreates `head_ref_restored`). Never push to a branch after its PR merges; open follow-up work on a fresh branch.
