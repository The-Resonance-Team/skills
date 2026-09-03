# VPS Deploy Rules

Rules for deploying from self-hosted runners to a VPS over SSH, and for deriving tool versions from the repo instead of hardcoding them. Scope: repos with self-hosted runners and SSH deploys.

## VPS Deploy via Self-Hosted Runners

### 1. Never curl files from GitHub API inside SSH sessions


`curl` to `api.github.com/repos/.../contents/...` inside an SSH session on a self-hosted runner fails with `curl: (23) Failure writing output to destination`. The `GHCR_TOKEN` (PAT with `read:packages` scope) can authenticate to the API, but the write fails intermittently across different runner instances.

**Fix**: Use `appleboy/scp-action` to SCP files from the runner (which already has the repo via `actions/checkout`) to the VPS. Files exist locally after checkout — no API download needed.

```yaml
# Bad — fails on some runners
- name: Deploy
  uses: appleboy/ssh-action@v1
  with:
    script: |
      curl -fsSL -H "Authorization: token $GHCR_TOKEN" \
        -o /tmp/deploy.sh \
        "https://api.github.com/repos/.../contents/deploy/scripts/deploy.sh?ref=$TAG"

# Good — SCP from runner to VPS
- name: Copy deploy files
  uses: appleboy/scp-action@v0.1.7
  with:
    source: "deploy/docker-compose.prod.yml,deploy/scripts/deploy.sh"
    target: "/tmp/deploy-stage/"
```

### 2. Health checks: use `127.0.0.1`, not `localhost`


`localhost` may resolve to IPv6 `::1` first on some systems, while Docker port bindings use `127.0.0.1` (IPv4 only). This causes health check failures even when the service is running.

```bash
# Bad — may resolve to IPv6
curl -s -o /dev/null -w '%{http_code}' "http://localhost:3401/v1/health"

# Good — explicit IPv4
curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3401/v1/health"
```

### 3. Always re-download deploy scripts in rollback


The `if [ ! -x /tmp/rollback.sh ]` guard reuses stale scripts from previous runs. A rollback needs the latest script version.

```yaml
# Bad — reuses stale file
- name: Rollback
  script: |
    if [ ! -x /tmp/rollback.sh ]; then
      curl -o /tmp/rollback.sh ...
    fi

# Good — always fresh
- name: Rollback
  script: |
    cp /tmp/deploy-stage/deploy/scripts/rollback.sh /tmp/rollback.sh
    chmod +x /tmp/rollback.sh
```

### 4. Pass all required env vars to deploy scripts


`appleboy/ssh-action` does not inherit workflow env vars. Every variable the deploy script reads must be explicitly passed:

```yaml
# Bad — TAG not passed
- name: Run deploy
  uses: appleboy/ssh-action@v1
  with:
    script: /tmp/deploy.sh

# Good — all vars explicit
- name: Run deploy
  uses: appleboy/ssh-action@v1
  with:
    script: |
      TAG="${{ github.ref_name }}" \
      REPO_OWNER="${{ secrets.DEPLOY_OWNER }}" \
      GHCR_TOKEN="${{ secrets.GHCR_TOKEN }}" \
      GH_ACTOR="${{ github.actor }}" \
        /tmp/deploy.sh
```

### 5. Pre-deploy: free disk space before writing files


Docker images and build cache can fill the disk. Run `docker system prune` before downloading or writing deploy files:

```yaml
script: |
  docker system prune -af || true
  docker builder prune -af || true
```

### 6. Authenticate docker-pulling actions on self-hosted runners


A third-party action that `docker run`s its own image (e.g. `trufflesecurity/trufflehog@main` pulling `ghcr.io/trufflesecurity/trufflehog`) pulls anonymously by default. GitHub-hosted runners get a fresh pooled IP per job and rarely hit registry rate limits; a self-hosted runner shares one IP across every job in the repo, so anonymous pulls hit the registry's per-IP limit and fail with a bare `denied` — not a rate-limit message, just a pull denial that looks like a real problem with the action.

**Fix**: authenticate the pull with `docker/login-action` before the step, moving it onto the token's own (much higher) limit:

```yaml
- name: Log in to GHCR
  uses: docker/login-action@v3
  with:
    registry: ghcr.io
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}

- name: Scan for leaked secrets (TruffleHog)
  uses: trufflesecurity/trufflehog@main
```

`GITHUB_TOKEN` works here even against a public image the repo doesn't own — authenticated pulls get a separate, larger quota than anonymous ones, regardless of the token's access scope to that image. Symptom to recognize: a step that pulls a third-party docker image starts failing on every branch (not just one PR) at the same time, with a bare `denied` from the registry.

### 7. `continue-on-error` hides failures


When using `appleboy/ssh-action` with `continue-on-error: true`, the step shows as passed even when the SSH command fails. Use `steps.<id>.outcome` (not `conclusion`) in downstream `if` conditions to detect actual failures:

```yaml
- name: Deploy
  id: deploy
  uses: appleboy/ssh-action@v1
  continue-on-error: true
  with:
    script: ...

- name: Rollback
  if: steps.deploy.outcome == 'failure' # outcome = actual result
  uses: appleboy/ssh-action@v1
```

### 8. Derive tool versions from the repo, never hardcode them in workflows


A version literal in a workflow is a version source Dependabot cannot see (dependabot.md §1: every source needs an entry, and workflow-inline tool versions have none). Read it from the manifest that owns it and pass it through.

```yaml
# Bad — rots when apps/api/package.json moves past prisma 7.9.1
sh -c "npm install -g dotenv prisma@7.9.1 && ..."

# Good — single source is apps/api/package.json
- name: Resolve Prisma version from repo
  id: prisma
  run: echo "version=$(node -p 'require("./apps/api/package.json").dependencies.prisma.replace("^","")')" >> "$GITHUB_OUTPUT"

- name: Run Prisma migrate deploy
  uses: appleboy/ssh-action@v1.0.3
  with:
    envs: PRISMA_VER
    env:
      PRISMA_VER: ${{ steps.prisma.outputs.version }}
    script: |
      sh -c "npm install -g dotenv prisma@$PRISMA_VER && ..."
```
