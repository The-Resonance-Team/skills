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

## Centralized `infra/` directory & multi-stage Dockerfile shapes

9. **Centralize all Dockerfiles and reverse-proxy configs under `infra/` (`infra/docker/`, `infra/nginx/`) with root build context (`context: .`)** —
   - **Never scatter `Dockerfile` or `.dockerignore` files inside `apps/*/`**: place the API image definition at `infra/docker/api.Dockerfile`, share a single parameterized `infra/docker/portal.Dockerfile` across all Next.js apps (`ARG APP_DIR`, `ARG APP_PACKAGE`, `ARG APP_PORT`), and keep reverse-proxy configs in `infra/nginx/default.conf`.
   - **One parameterized `portal.Dockerfile` for all Next.js apps**: pass `APP_DIR`, `APP_PACKAGE`, `APP_PORT`, and `NEXT_PUBLIC_API_URL` via `build.args` in `compose.prod.yml` so Bun version bumps, `--linker=hoisted` flags, BuildKit cache mounts (`--mount=type=cache,id=bun-install-cache,target=/root/.bun/install/cache`), and standalone runner stages are maintained in one file instead of duplicated across `apps/*/Dockerfile` (Precedent: Gia Su Anh Minh 2026-10 — 6 portal Dockerfiles collapsed into `infra/docker/portal.Dockerfile`).
   - **Single root `.dockerignore`**: Docker reads `.dockerignore` from the build context root (`context: .`), so per-app `apps/*/.dockerignore` files are silently ignored dead files — delete them and maintain a single root `.dockerignore`.

10. **Multi-stage Node 26 + pnpm Dockerfile shape (`pnpm` once in `base`, copy into `runner`, `--chown` every runtime copy)** — Derive `PNPM_MAJOR` from `package.json#packageManager` in `base`, reuse `/root/.local/share/pnpm` in `runner` without a second download, pass `--chown=nestjs:nodejs` on every `COPY --from=`, target `127.0.0.1` in `HEALTHCHECK`, and use exec-form `CMD`:

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

11. **Multi-stage `oven/bun` Dockerfile shape (`oven/bun:${BUN_VERSION}-alpine`, hoisted filtered install, BuildKit cache mount)** — `oven/bun:latest` is Debian/glibc and cannot load musl Prisma engines; keep one Alpine pin for both stages. A `--filter` install fails when it skips a manifest the closure needs (`workspace ... not on disk`), so copy every depended workspace's `package.json` (and its sources before build). Use `--linker=hoisted` with `--filter` and `--mount=type=cache,id=bun-install-cache,target=/root/.bun/install/cache` so `bun check` and Next output tracing see one flat `node_modules` tree without re-downloading packages across builds. Install the global Prisma CLI with `BUN_INSTALL=/usr/local bun install -g` so it lands on `PATH` for the non-root user (`node -p` version reads work through Bun's Node fallback; `bun pm cache rm` replaces `npm cache clean`). Verify with a full image build plus a boot-and-healthcheck run before merging (Precedent: Gia Su Anh Minh 2026-10 — `infra/docker/api.Dockerfile` and `infra/docker/portal.Dockerfile` on `oven/bun:1.4.4`).
