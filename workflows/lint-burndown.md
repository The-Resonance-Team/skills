---
name: lint-burndown
description: >-
  Take a repo from thousands of lint findings to a zero-findings ceiling
  without a big-bang diff or silenced rules: park the backlog, ratchet each
  package's --max-warnings, burn it down in subagent waves, un-park rules
  only at repo-wide zero. Use when asked to adopt the lint baseline,
  clear a lint backlog, lower --max-warnings, or make a codebase lint-clean.
---

# Lint Burn-down Workflow

A codebase that fires thousands of lint findings enforces nothing — the signal is gone. Burn the backlog to zero, then keep it there with a ceiling. This procedure was run end-to-end on a four-app monorepo (5.2k findings → 0, 78 rules un-parked, one surface at a time).

Fetch `rules/linting.md` first and set the repo up per its scope and config rules:

```
https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/linting.md
```

## Doctrine: park → ratchet → un-park

1. **Set the ceiling** — each package's lint script runs `oxlint . --max-warnings N` at the current finding count. CI stays green and cannot regress.
2. **Ratchet** the ceiling down as tranches land. The ceiling stops debt from growing back; the config only reports.
3. **The ledger is one tracking issue** — never maintain finding counts in config comments (they go stale immediately).

## Baseline config

Copy `configs/.oxlintrc.json` into the repo root (or root `oxlint.config.ts` in Ultracite repos):
- Permanent disagreements are **anti-goals**: set them `"off"` in config with a rationale comment (`typescript/parameter-properties` for NestJS DI, `unicorn/filename-case` for PascalCase components).
- Build/runtime conflicts (SWC decorator metadata, ES target limits, Next.js linter split) go into a scoped `overrides` block in config **with a reason** — off in config, never inline comments (`rules/linting.md` #10: baseline `oxlint` ignores inline `oxlint-disable-next-line` comments).

## Process

### 1. Measure → ledger

Run `npx oxlint . --format json`. Build the ledger as **rule × surface** (`api`, `web`, `miniapp`, `portal`, `scripts`, `packages`) with a total per rule in the tracking issue. A rule is un-parkable only when every surface reaches zero.

### 2. Set the ceiling and the scope

- Per package: `"lint": "oxlint . --max-warnings N"` — scope `.`, not `src`, so e2e specs, seeds, configs, and scripts are covered too. Exclude generated dirs once in `ignorePatterns`.
- Keep `lint-staged` active (`oxfmt` first, then `oxlint --fix` / `eslint --fix`). Never pass `--no-verify`.

### 3. Slices → waves of subagents

Partition by directory into disjoint slices of ~60–140 findings (one directory = one subagent owner, 3–5 slices per wave). Every subagent dispatch enforces:
- Edit only your slice's files. Never run repo-wide fixers or `--fix-suggestions`.
- Run `oxfmt <paths> && oxlint --max-warnings=0 <paths>`, typecheck, and the slice's tests before reporting (`oxfmt` runs first because formatting expands lines 1.4×–2.5× and exposes `max-lines: 300` violations).
- Do not add inline `oxlint-disable-next-line` comments (ignored by baseline `oxlint`, `rules/linting.md` #10). Report genuine framework/target conflicts so the coordinator can record a scoped `overrides` entry in config; in ESLint/Ultracite profiles where directives run, use a single-line disable with `-- <reason>` only for true framework conflicts.
- Never weaken assertions or change runtime behavior to satisfy a rule.

### 4. Gates

- **After every wave**: run `oxfmt`, `oxlint`, full typecheck, and full test suite on the merged tree (`rules/general.md` #15). Re-count and rebalance the next wave.
- **Before the ceiling hits 0**: boot the real production build (`pnpm build && node dist/main.js` for NestJS; `next build` for Next.js) to verify DI metadata and Swagger schema generation at runtime, then run `format:check` and e2e suites.
- **One PR per surface/tranche** with the ratcheted ceiling, un-parked rules, and any ADR updates.

### 5. Close out

Delete each parked rule override as it hits zero, set every package ceiling to `--max-warnings 0`, and close the tracking issue with the final table.

## Hazards (all observed on a real burn-down)

| # | Hazard | Why green tests miss it | Guard |
| - | --- | --- | --- |
| 1 | Stripping annotations from decorated properties (`: boolean = false` → `= false`) | SWC emits `design:type` **only from explicit annotations**; Swagger crashes at boot | Keep annotations on decorated properties; boot the built app before shipping |
| 2 | `import type` for constructor-injected deps | Erased import → `design:paramtypes` is `undefined` → `UnknownDependenciesException` at boot | Keep value imports for DI; turn the specifier-style rule off for the API in config |
| 3 | Downgrading a rule with a bare `'warn'` | Replaces the config entry and **drops its options** (e.g. `namedComponents: 'arrow-function'`) | Repeat the rule's options array in every `warn` entry |
| 4 | Fix uses syntax above `tsconfig` `target`/`lib` | Named capture groups (ES2018) or `toSorted` (ES2023) fail downstream typecheck | Check `target`/`lib` first; use compatible syntax |
| 5 | Two linters on one surface (`oxlint` + `ESLint`) | Fixers fight over import specifiers and side-effect imports | Scope `lint-staged` and `oxlint` `ignorePatterns` per `rules/linting.md` #11, #13 |
| 6 | Removing a live barrel file | Breaks cross-repo importers | Count importers first; delete 0-importer barrels in place, migrate live ones in a dedicated slice |
| 7 | Blunt `--fix-suggestions` | Applies unsafe semantic rewrites (`toSorted` breaking in-place mutation callers) | Never use `--fix-suggestions`; fix per rule with tests as oracle |
| 8 | Running `oxlint` before `oxfmt` | `oxfmt` expands single-line JSX/objects past `max-lines: 300` at commit time | Always run `oxfmt` before `oxlint` (`rules/linting.md` #9) |

## Fix playbook (high-volume rules)

- **func-style / react/function-component-definition** — convert declarations to `const fn = (...) => {}` (preserve rule options when parked, Hazard 3).
- **require-await / promise/prefer-await-to-then** — drop `async` when no `await` exists (unless caller chains `.catch`/`.rejects` or interface requires `Promise`); convert `.then` chains to `async`/`await`.
- **require-unicode-regexp / prefer-named-capture-group** — add `u` flag and remove invalid escapes (`\-`, `\/`); check ES target before adding named capture groups (Hazard 4).
- **no-await-in-loop** — `Promise.all(items.map(...))` when independent; sequential-by-design loops get a scoped config override or single-reasoned directive.
- **vitest/max-expects / vitest/require-top-level-describe** — split into focused tests (never delete assertions); wrap hooks and tests in one top-level `describe`.
- **class-methods-use-this / typescript/no-extraneous-class** — convert stateless methods/classes to pure functions; NestJS `@Module()`/`@Injectable()` classes use `allowWithDecorator: true`.
- **typescript/no-non-null-assertion / eqeqeq** — replace `x!` with a guard, `??`, or typed test helper; replace `x == null` with `x === null || x === undefined`.
