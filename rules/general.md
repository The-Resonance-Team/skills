# General Rules — cross-project, framework-agnostic

Applies to every project in the organization. Fetch this module for any repo via `CONTEXT.md`.

> **Moved to domain modules**: Axios generics & `postForm` → `rules/frontend.md` (#1–#2); Ponytail React Query mock hooks → `rules/frontend.md` (#3); Tailwind v4 utility names → `rules/frontend.md` (#4); `DESIGN.md` design & copy contract → `rules/frontend.md` (#21); NestJS DTO validation, controller→service seam & `@ApiProperty` → `rules/nestjs.md` (#1, #6, #8); GitHub Actions concurrency (`ci-${{ github.ref }}` / `cd-${{ github.ref_name }}`) → `rules/github-ci.md` (#3); centralized `infra/docker/` & Dockerfile shapes → `rules/github-vps-deploy.md` (#9–#11).

## Environment & language

1. **Postgres: always Docker, never native install** — Run `docker compose up -d postgres` from the repo's `docker-compose.yml` for any test, migration, or local-DB work; tear down with `docker compose down`. Never suggest `brew install postgresql*`, `/opt/homebrew/bin/psql`, or a Homebrew Postgres service.
2. **STE100 Simplified Technical English** — Always communicate in ASD-STE100. Use approved vocabulary, one meaning per word, and short sentences.
3. **`CONTEXT.md`, `GLOSSARY.md` & `DESIGN.md` separation of concerns** — Read the repo's `GLOSSARY.md` first and use its exact domain terms; call out any term conflict immediately. Keep every `GLOSSARY.md` strictly a pure glossary of domain concepts (never dump CSS tokens, responsive rules, component folder conventions, or copy tables into `GLOSSARY.md`). Put all UI/UX design specifications, tokens, icon rules, component naming, responsive rules, and user-facing copy tables in root `DESIGN.md` and point `AGENTS.md` to `DESIGN.md` (`rules/frontend.md` #21).
4. **Vietnamese diacritics** — Always use accurate thanh điệu (diacritics) in Vietnamese copy and comments. Verify before committing.

## Ponytail audit & debt ledger (mandatory)

5. **Ladder: `delete → stdlib → native → search → dep → one-liner → minimal code`** — Stop at the first rung that holds, and never skip the search rung. For any concern with locale, Unicode, date/time, cryptography, parsing, or money edge cases, check `rules/libraries.md` first: when edge cases are non-trivial and enumerable, the baseline library wins (`slugify` for Vietnamese slugs; `motion` for staggered/interruptible/scroll-linked sequences vs plain CSS for a single keyframe; `getPageItems()` + CSS over `react-paginate`). Never add speculative abstractions (an interface with one implementation, a factory for one product). Deletion beats addition; shortest diff wins. Mark every deliberate simplification with `// ponytail: <ceiling>, <upgrade if ...>`.
6. **Zero `no-trigger` debt before merge** — Every `ponytail:` comment is tracked tech debt. Harvest before merge with `grep -rnE '(#|//) ?ponytail:' . --exclude-dir={node_modules,.git,.next,dist}`, group as `<file>:<line> — <what>. ceiling: <limit> upgrade: <trigger>`, and tag any marker lacking `if`/`when`/`Upgrade` as `no-trigger`. Fix or add the trigger so `0 no-trigger` remains before shipping.

## Cross-app impact & rule maintenance

7. **Check affected apps before editing** — In a monorepo, grep sibling apps before changing any shared contract, and fix or document both sides in the same PR:
   - **Backend edit (`apps/api/`)** → grep `apps/web/`, `apps/portal/`, `apps/miniapp/`, `packages/api-client/` for the route, response shape, field name, or error code.
   - **Frontend edit** → verify the endpoint, DTO shape, and error codes in `apps/api/`.
   - **Shared package edit (`packages/utils`, `packages/ui`)** → grep all `apps/` for imports of the changed export.
8. **Suggest rule updates, never deviate silently** — When a rule is wrong, outdated, or missing for the task at hand, tell the user and propose an update to `rules/*.md` in `The-Resonance-Team/skills` (`main`). Never silently ignore a rule.

## Time, identifiers & imports

9. **Time handling uses `date-fns` + `@date-fns/tz`** — All parsing, arithmetic, boundaries, and display use `date-fns` + `@date-fns/tz` (target timezone `Asia/Ho_Chi_Minh`). Wire serialization is the sole exception (`toISOString()`). Compute day/month boundaries via `new TZDate(d, TZ)` — never `new Date(y, m, d)`, `.toISOString().slice(0, 10)`, `.getUTCDay()`, or `.getDay()` (timestamps between 00:00 and 07:00 ICT fall on the previous UTC day). Date-fns-exempt miniapps use `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })`.
10. **Keep hand-written identifiers ≤ ~30 characters** — Drop qualifiers the file or module already implies (`findAvailabilityTemplateForSlot` inside `appointments.repo.ts`, `FeedbackReportTransitionPayload` inside `feedback`). Exempt: generated Prisma types, DB constraint names, wire error codes, and `SCREAMING_CASE` constants (unless a word is redundant: `MAX_OPEN_PENDING_ORDERS` → `MAX_PENDING_ORDERS`). Audit with `grep -rhoE "[a-zA-Z_][a-zA-Z0-9_]{34,}" src --include="*.ts"`.
11. **Import specifiers never carry file extensions** — Write `from './portal'`, never `from './portal.ts'` or `from './portal/index.js'`. Keep `allowImportingTsExtensions` off.

## Refactoring (mandatory)

12. **Incremental strangle, behavior identical** — Ship one page, component, or module slice per PR (ADR-0039 rejected big-bang rewrites). A refactor preserves exact runtime behavior; visual drift is allowed only when explicitly documented in the ADR/plan, and behavior changes require a separate feature PR.
13. **Deletion over addition & single canonical signature** — Delete dead routes, dead exports, unused CSS, and obsolete mock layers during the refactor. Never add union-parameter overloads (`Options | Mode`), runtime shape branches (`instanceof Set`, `'field' in obj`), dual field-name fallbacks (`a.start ?? a.startTime`), or pass-through re-exports (`export { X } from ...`) to keep old in-repo call shapes alive — update every in-repo caller in the same slice. Leave zero lint suppressions (`oxlint-disable max-lines`).

## Subagents (orchestration)

14. **Partition subagents by directory path, never by rule** — Never let two subagents edit the same directory concurrently (prevents mid-file merge corruption, duplicate imports, and `git checkout` clobbers). One directory = one owner.
15. **Run the verification gates yourself in strict order (`bun fmt` first)** — A subagent's "done" report is a claim, not proof. On the merged tree, run: (1) `bun fmt`, (2) `bun lint --no-script --max-warnings=0 --allow-unsupported`, (3) typecheck (`bun check` / `tsc --noEmit`), (4) targeted tests. Running `bun fmt` first is mandatory because formatting expands single-line JSX/objects and exposes `max-lines: 300` overruns. Check `git status` and delete tool-generated untracked files (`apps/*/AGENTS.md` from Next.js 16, `.tmp-screenshots/`) before staging. In network/FS-sandboxed shells, invoke `bun fmt` and `./node_modules/.bin/{vitest,tsc}` directly, and use `bun run --filter '*' typecheck` / `bun run --filter '*' test` when `turbo` fails reading host `~/Library/Application Support/turborepo/auth.json`. Keep conventional commit headers ≤100 characters (`commitlint` `header-max-length`).

## Debugging & fix verification (mandatory)

16. **Trace blank/wrong renders and ellipses backward through the full pipeline** — Before patching a component with a fallback or CSS tweak: (a) verify whether the DB `select`/projection, server response, and client mapper actually send the field, comparing against a working sibling endpoint/screen; (b) check whether a visible `…` truncation is literal seed/DB data rather than CSS `truncate`/`line-clamp`.
17. **Sweep the root-cause class & lock every fix with a regression test** — A missing lookup-map key, missing DTO validator, or missing `.env` default is rarely a one-off: grep for the same shape across the repo and fix all sibling instances in the same pass (Precedent: XaDaoXa 2026-08). Every bug fix ships in the same PR with a unit or e2e test that fails before and passes after, naming the incident.

## Package manager, tool replacement & session hygiene (mandatory)

18. **Toolchain profile: `pnpm@12.3.1` or `bun@1.x` from `packageManager` (never corepack)** —
    - **pnpm repos**: Pin `pnpm@12.3.1` in `package.json#packageManager`. In `pnpm-workspace.yaml`, declare `allowBuilds` for native/postinstall packages (`@node-rs/argon2`, `@prisma/client`, `@swc/core`, `sharp`, `esbuild`, `@parcel/watcher`, `unrs-resolver`) and set `strictDepBuilds: false` (never use removed v10 `onlyBuiltDependencies`). When `minimumReleaseAge` is enabled, list intentional fresh upgrades in `minimumReleaseAgeExclude` using exact `name@version` or name-only wildcard `"@oxfmt/binding-*"` (never versioned wildcards `"@scope/pkg-*@1.2.3"`).
    - **Bun-native repos** (`packageManager: "bun@1.x"` declared in `AGENTS.md`): use `bun install` (`--frozen-lockfile` in CI/Docker), `bun fmt` (`bun fmt --check` in CI, reading static root `.oxfmtrc.json` with `oxfmt` package removed and verified via `bun fmt --doctor`), `bun check` for typechecking, and `bun test --check` by default (`vitest` only when `vi.hoisted`, browser mode, or branch coverage is required). Workspace packages whose `exports` point at source (`./index.ts`, never `dist/`) set `"build": "bun check"`, `"typecheck": "bun check"`, `"format": "bun fmt"`, and `"format:check": "bun fmt --check"` — never `tsc -b` or `oxfmt` (there is nothing to emit, and dead emit measured 11.6× slower cold: 3326ms `tsc -b --force` vs 287ms `bun check` over six packages on Gia Su Anh Minh 2026-10). Restore `tsc -b` for one package only when it publishes declarations (`dist/` in `exports`).
19. **Finish every tool swap with a repo-wide grep for the old tool's name** — Remove stale dotfiles (`.lintstagedrc` shadowed by `package.json`), per-app scripts, sub-package `devDependencies`, and README rows in the same PR; prove completion with a second grep returning zero hits (Precedent: XaDaoXa 2026-09 Prettier→Oxfmt).
20. **Kill dev servers by process name & never nest git worktrees** — `pkill -f "next start --port NN"` misses `next-server` processes and leaves stale servers answering checks; use a port-bound `dev:stop` script or verify zero survivors with `ps` (Precedent: VibeHost 2026-10). Keep git worktrees as sibling directories — never inside the source repo tree, where `git add -A` stages them as mode `160000` gitlinks (reject `160000` in pre-commit).
