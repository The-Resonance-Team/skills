# Release Workflow Rules

Rules for shipping: library releases, app release dispatches, cherry-picks, branch sync, and dependency rolls. Scope: any repo cutting releases on GitHub.

## Release Automation

### 1. Changesets for library releases


For libraries with multiple packages or frequent releases, use changesets. The workflow detects changesets, versions, and publishes.

```yaml
name: Release
on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
      - run: npm ci
      - name: Create Release PR or Publish
        uses: changesets/action@v1
        with:
          publish: npm run release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 2. Manual dispatch for application releases


For applications, use `workflow_dispatch` to trigger releases manually.

```yaml
name: Trigger Release
on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to release (e.g., v1.2.3)'
        required: true
        type: string

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./scripts/release.sh ${{ inputs.version }}
```

## Cherry-Pick / Backport

### 3. Automated cherry-pick PRs


For release branches, automate cherry-picks with a manual-dispatch workflow that creates a PR.

```yaml
name: Cherry-Pick to Release
on:
  workflow_dispatch:
    inputs:
      release-branch:
        description: 'Release branch (e.g., release/v1.2)'
        required: true
        type: string
      commit-sha:
        description: 'Commit SHA to cherry-pick'
        required: true
        type: string

jobs:
  cherry-pick:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ inputs.release-branch }}
          fetch-depth: 0
      - name: Cherry-pick commit
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git cherry-pick ${{ inputs.commit-sha }}
      - name: Create PR
        uses: peter-evans/create-pull-request@v6
        with:
          title: 'Cherry-pick ${{ inputs.commit-sha }} to ${{ inputs.release-branch }}'
          base: ${{ inputs.release-branch }}
          branch: cherry-pick/${{ inputs.commit-sha }}
```

## Branch Sync

### 4. Sync main to release branches


Keep release branches in sync with main using a scheduled or manual workflow.

```yaml
name: Sync Release Branch
on:
  workflow_dispatch:
  schedule:
    - cron: '0 0 * * 1'  # Weekly

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Sync main to release
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git checkout release/v1.2
          git merge origin/main --no-edit
          git push origin release/v1.2
```

### 5. Sync examples to latest branch


For repos with examples, sync them to a `latest` branch when stable releases land.

```yaml
name: Sync Examples
on:
  push:
    branches: [main]

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Sync to latest branch
        uses: bluwy/auto-branch-sync-action@v1
        with:
          map: |
            / -> latest
            /examples/* -> examples/*
```

## Dependency Roll

### 6. Automated dependency updates


For critical dependencies (e.g., Dart SDK in Flutter), automate rolls with a manual-dispatch workflow.

```yaml
name: Roll Dependency
on:
  workflow_dispatch:
    inputs:
      dep-version:
        description: 'Version or commit to roll to'
        required: true
        type: string

jobs:
  roll:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Update dependency
        run: ./scripts/update-dep.sh ${{ inputs.dep-version }}
      - name: Create PR
        uses: peter-evans/create-pull-request@v6
        with:
          title: 'Roll dependency to ${{ inputs.dep-version }}'
          branch: roll/dep-${{ inputs.dep-version }}
```
