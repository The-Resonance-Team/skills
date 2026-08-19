# GitHub Workflows Rules

## VPS Deploy via Self-Hosted Runners

### Never curl files from GitHub API inside SSH sessions

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

### Health checks: use `127.0.0.1`, not `localhost`

`localhost` may resolve to IPv6 `::1` first on some systems, while Docker port bindings use `127.0.0.1` (IPv4 only). This causes health check failures even when the service is running.

```bash
# Bad — may resolve to IPv6
curl -s -o /dev/null -w '%{http_code}' "http://localhost:3401/v1/health"

# Good — explicit IPv4
curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3401/v1/health"
```

### Always re-download deploy scripts in rollback

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

### Pass all required env vars to deploy scripts

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

### Pre-deploy: free disk space before writing files

Docker images and build cache can fill the disk. Run `docker system prune` before downloading or writing deploy files:

```yaml
script: |
  docker system prune -af || true
  docker builder prune -af || true
```

### `continue-on-error` hides failures

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

### Concurrency group: `cancel-in-progress: false`

For deploys, set `cancel-in-progress: false` so every tag push runs to completion. Use `cancel-in-progress: true` only for CI where superseded runs are safe to cancel.

```yaml
concurrency:
  group: cd-${{ github.ref_name }}
  cancel-in-progress: false
```
