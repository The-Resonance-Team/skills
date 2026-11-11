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

## Review gate

4. **CI and migration PRs get a second review before merge** — A PR that changes `.github/workflows/**`, `.github/actions/**`, or `prisma/migrations/**` has a blast radius outside its diff: a workflow edit can break every job, and a migration edit can break production data. Require the `reviewer` agent or a human review on those paths; green CI alone is not enough. Precedent: Ecopick 2026-11 — a missing migration reached `main` and broke the e2e seed, and CI-only PRs skipped the pipeline entirely.

## Branch cleanup on merge

5. **Always merge with `gh pr merge --delete-branch` and prune local refs** — Merge PRs with:

   ```sh
   gh pr merge <number> --squash --delete-branch
   git branch -d <branch>
   git fetch --prune
   ```

   GitHub's `delete_branch_on_merge` repo setting only removes the remote ref once at merge time (leaving local branches behind, and never re-deleting a branch if a stale local push recreates `head_ref_restored`). Never push to a branch after its PR merges; open follow-up work on a fresh branch.

## Agent PR discipline (after opening a PR)

6. **Wait for CI and fix it before declaring a PR done** — After opening a PR, poll `gh pr checks <n>` until every required check reaches a terminal state (success/failure/cancelled). On failure, read the failing job log (`gh run view <run> --log-failed`), fix the **root cause** (not the symptom), push, and re-poll. Never paper over a red check with `test.skip`, deleting a marker, a blind retry, or weakening an assertion. Stop and escalate to the user after **2 failed fix attempts on the same check**, or on any failure needing a design decision, secret, or infra change. A PR is not "ready" while a required check is red or pending, unless the user explicitly waives it in-session (record the waiver in the PR body).

7. **No auto-merge without explicit user permission** — The agent must not run `gh pr merge`, enable auto-merge (`gh pr merge --auto`), or otherwise merge a PR unless the user explicitly says so in this session ("merge it", "auto-merge when green", "you can merge"). Green CI, a label, a PR-body note, or an issue reference never authorizes a merge. Even when all checks are green and review comments are resolved, report the PR URL + check summary and wait for the user's go-ahead.

8. **Prefer squash merge** — When the user authorizes a merge, use `gh pr merge <n> --squash --delete-branch` (per #5) unless the user specifies another strategy. Never switch to merge-commit or rebase without an explicit request.

## Agent suggestions on workflows

9. **Ask before suggesting or applying workflow optimizations** — Full rule in `rules/github-actions.md` (agent suggestions section): when the agent finds something optimizable in `.github/workflows/**` or `.github/actions/**`, it must ask the user before suggesting or applying the change. Never silently rewrite a workflow or open an "optimization" PR without explicit permission.
