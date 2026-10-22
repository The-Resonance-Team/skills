# VPS Deploy & Dockerfile Rules — self-hosted runners & SSH

Applies to repos deploying from self-hosted GitHub Actions runners to a VPS over SSH and building production Docker images.

## SSH & self-hosted runner deploys

1. **SCP deploy files from the runner — never `curl` the GitHub Contents API inside SSH** — `curl` to `api.github.com/repos/.../contents/...` inside an `appleboy/ssh-action` session fails intermittently with `curl: (23) Failure writing output to destination`. Copy checked-out files from the runner to the VPS via `appleboy/scp-action`:

   ```yaml
   - uses: appleboy/scp-action@<sha> # v0.1.7
     with:
       source: "deploy/docker-compose.prod.yml,deploy/scripts/deploy.sh,deploy/scripts/rollback.sh"
       target: "/tmp/deploy-stage/"
   ```

2. **Health checks target `127.0.0.1`, never `localhost`** — `localhost` can resolve to IPv6 `::1` while Docker binds `127.0.0.1` (IPv4 only), causing false healthcheck failures:

   ```sh
   curl -fsS -o /dev/null -w '%{http_code}' "http://127.0.0.1:3401/v1/health"
   ```

3. **Always copy a fresh `rollback.sh` from `/tmp/deploy-stage/`** — Never guard rollback script provisioning with `if [ ! -x /tmp/rollback.sh ]`, which reuses a stale script from an earlier deploy.
4. **Explicitly pass all required env vars into `appleboy/ssh-action`** — SSH sessions do not inherit workflow environment variables; pass `TAG`, `REPO_OWNER`, `GHCR_TOKEN`, and `GH_ACTOR` explicitly inline or via `envs:`.
5. **Prune Docker disk space before writing deploy files** — Run `docker system prune -af || true && docker builder prune -af || true` before staging files so image/build caches never exhaust VPS disk.
6. **Authenticate `ghcr.io` before running docker-pulling actions on self-hosted runners** — Self-hosted runners share a single IP across all jobs; anonymous third-party image pulls (`trufflesecurity/trufflehog`) hit GHCR's per-IP limit and fail with a bare `denied`. Run `docker/login-action` (`registry: ghcr.io`, `username: ${{ github.actor }}`, `password: ${{ secrets.GITHUB_TOKEN }}`) beforehand to move pulls onto the authenticated quota.
7. **Gate rollback on `steps.<id>.outcome == 'failure'`, never `conclusion`** — When a deploy step sets `continue-on-error: true`, `conclusion` reports `success` even when SSH fails; `outcome` reflects the real failure.
8. **Derive CLI tool versions from `package.json`, never hardcode in workflows** — Hardcoded versions (`prisma@7.9.1` inside SSH scripts) are invisible to Dependabot and drift from `apps/api/package.json`:

   ```yaml
   - id: prisma
     run: echo "version=$(node -p 'require("./apps/api/package.json").dependencies.prisma.replace("^","")')" >> "$GITHUB_OUTPUT"
   ```

## Multi-stage Node 26 + pnpm Dockerfile shape

9. **Install `pnpm` once in `base`, copy into `runner`, and `--chown` every runtime copy** — Derive `PNPM_MAJOR` from `package.json#packageManager` in `base`, reuse `/root/.local/share/pnpm` in `runner` without a second download, pass `--chown=nestjs:nodejs` on every `COPY --from=`, target `127.0.0.1` in `HEALTHCHECK`, and use exec-form `CMD`:

   ```dockerfile
   FROM node:26-alpine AS base
   RUN apk add --no-cache libc6-compat curl
   ENV PNPM_HOME="/root/.local/share/pnpm" PATH="/root/.local/share/pnpm:$PATH"
   COPY package.json ./
   RUN PNPM_MAJOR="$(node -p "require('./package.json').packageManager.split('@')[1].split('.')[0]")" \
     && curl -fsSL https://get.pnpm.io/install.sh | env PNPM_VERSION="latest-$PNPM_MAJOR" sh -

   FROM node:26-alpine AS runner
   RUN apk add --no-cache curl \
     && addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
   ENV PNPM_HOME="/root/.local/share/pnpm" PATH="/root/.local/share/pnpm:$PATH"
   COPY --from=base /root/.local/share/pnpm /root/.local/share/pnpm
   COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
   USER nestjs
   HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
     CMD curl -f http://127.0.0.1:6200/health || exit 1
   CMD ["node", "dist/main.js"]
   ```
