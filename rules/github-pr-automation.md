# PR Automation Rules

Rules for PR automation: comment-triggered testing and fixes, path labels, and title conventions. Scope: any repo with pull requests on GitHub.

## Ecosystem CI

### 1. Comment-triggered downstream testing


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

### 2. Comment-triggered autofix


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

## PR Management

### 3. Auto-label PRs by file path


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

### 4. Enforce conventional commits


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
