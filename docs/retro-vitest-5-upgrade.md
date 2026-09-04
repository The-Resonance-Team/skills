# Retro: Vitest 5 Upgrade (Ecopick PR #392)

## What I did

Upgraded `vitest` 4.1.10 (miniapp 3.2.1) → 5.0.0 across 7 package owners in
Ecopick-Platform, bumped miniapp `vite` 5.4.21 → 8.2.0 (v5 needs `vite>=6.4.0`),
audited v5 breaking changes with `rg`, validated with `vitest doctor`, fixed two
CI failures on the self-hosted runner. Merged as `84f6babc`, all checks green.

## Baseline facts

| Fact | Source |
| ---- | ------ |
| `vitest@5.0.0` released 2026-09-03; registry `latest` tag = `5.0.0`, no patch yet | `npm view vitest version`, 2026-09-04 |
| 7 `vitest` owners, 10 `vitest*.ts` configs, 161 test files; no `pool/isolate/maxWorkers` set anywhere | repo sweep, 2026-09-04 |
| Breaking-change grep clean: no `bench`, no `.sequential`, no `toThrow('')`, no `expect.poll`, no unawaited `resolves`/`rejects`; all `vi.mock` top-level | `rg` over `apps/ packages/`, 2026-09-04 |
| `vitest doctor` on api (128 files/1221 tests): `threads` −8%, `fsModuleCache` −5%, `maxWorkers:4` +25%, `isolate:false` fails 21 tests | `vitest doctor`, 2026-09-04 |
| TS 5.9.3 in lockfile both before (`b4b75f54`) and after the upgrade | `git show b4b75f54:pnpm-lock.yaml` vs current |
| Main CI typecheck job: 10/10 tasks `cache hit, replaying logs` — `tsc` never ran | run `33836800615`, job `100910941912` |
| Miniapp typecheck errors (`Promise.allSettled` needs `es2020`; `URLSearchParams` iteration needs `dom.iterable`) in files the upgrade never touched | pre-commit hook log, 2026-09-04 |
| CI `test` on self-hosted runner: timeouts at 511s wall-clock (local ~30s), then OOM `137` under `pool:threads` | runs `33857821672`, `33859294289` |
| Final shape: `forks` + `fsModuleCache:true` + CI `--maxWorkers=2` → test 2m50s, typecheck 28s, all green | run `33860724912` |

## 1. Remote cache replays green over broken tools (highest severity)

Main showed green typecheck while two live `tsc` errors sat in miniapp: every task
in the main job replayed cached logs, so the tool never executed. The errors only
surfaced when this branch changed miniapp's `package.json` (a typecheck input) and
forced a real run — then the pre-commit hook failed on files the branch never
touched, with an unchanged TS version. A cache hit is a claim that inputs are
unchanged, not that the tree is healthy: any task whose inputs rarely change
(`typecheck` on a stable package) can stay green indefinitely over rot.
→ Rule 7 in `rules/github-ci.md` (this commit).

## 2. Default worker counts assume a bigger box than self-hosted gives

Vitest defaults to `os.availableParallelism()` workers. On the small shared box,
with `typecheck`/`tsc` running concurrently in a sibling job, the api suite died
twice: first timeouts (511s vs 30s local — CPU contention, not a code problem),
then OOM-killed `137` under `pool:threads` (threads share one process; the
"lighter" pool was the heavier one here). Fix was empirical because runner RAM is
undocumented: `forks` + CI-only `--maxWorkers=2`. Two failed CI cycles were the
price of guessing.
→ Rule 8 in `rules/github-ci.md` (this commit). Standing gap: publish runner
specs (RAM/CPU) where agents can read them; sizing is still guesswork.

## 3. Age-gated registries block fresh majors; exempt exact pins

`minimumReleaseAge: 10080` rejected `vitest@5.0.0` (published <7d). Fix followed
the existing mechanism (`dependabot.md` rule 72): exact-pin exempts for the
requested versions only (`vitest`, `@vitest/coverage-v8`, `@vitest/mocker`,
`@vitest/spy`, `tinybench`), so future releases stay gated. No new rule — applied
the old one. Gotcha for next time: the error lists every under-age transitive dep,
exempt all of them or the install still fails.

## 4. `vitest doctor` earns its cost; `isolate:false` failures are diagnostic

Doctor runs the full suite ~10× (api: ~26s each) and its verdict held: nothing
cleared 10%, so no pool change shipped. The `isolate:false` failure (21 tests,
e.g. `tier.service.spec` mock bleed) proved isolation is load-bearing here, not
optional. `fsModuleCache:true` (−5% on reruns) was the only keeper. Negative
results recorded so nobody re-measures: `threads` −8% alone, `maxWorkers:4` +25%.

## 5. No rule home for these two — recorded, not encoded

- Miniapp `tsconfig.lib` lacked `es2020`/`dom.iterable` while `src/` used
  `Promise.allSettled` and `Object.fromEntries(url.searchParams)`. Fixed with a
  one-line lib widening. No `frontend.md` section covers lib-vs-API drift; too
  narrow for a mandatory rule, left as precedent here.
- Web `vitest.config.ts` used `__dirname` in an ESM config; v5 warns
  (`configLoader: 'native'` coming). One-line fix to `import.meta.dirname`.
- `vi.when` (new v5 API) fits exactly one site (`assistant.service.test.ts:31`)
  and reads longer than the generic `mockImplementation` it would replace —
  deliberately skipped. New syntax is readability-only; speed comes from config.
