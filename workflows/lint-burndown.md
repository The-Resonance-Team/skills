---
name: lint-burndown
description: >-
  Take a repo from thousands of lint findings to a zero-findings ceiling
  without a big-bang diff or silenced rules: park the backlog, ratchet each
  package's --max-warnings, burn it down in subagent waves, un-park rules
  only at repo-wide zero. Use when asked to adopt the Ultracite baseline,
  clear a lint backlog, lower --max-warnings, or make a codebase lint-clean.
---

# Lint Burn-down Workflow

A codebase that fires thousands of lint findings enforces nothing — the signal is gone. Burn the backlog to zero, then keep it there with a ceiling. This procedure was run end-to-end on a four-app monorepo (5.2k findings → 0, 78 rules un-parked, one surface at a time).

The tool baseline itself lives in `rules/linting.md` — fetch it first and set the repo up per its scope and config rules:

```
https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/linting.md
```

## Doctrine: park → ratchet → un-park

1. **Park** every pre-existing violation at `warn` in the repo-local `migrationWarnings` map (`rules/linting.md` §14) — a severity downgrade, never an ignore. Adoption lands green, and new code is flagged from day one.
2. **Ratchet** each package's lint script (`oxlint . --max-warnings N`) down as tranches land. The ceiling is what stops the debt growing back; the config only reports.
3. **Un-park** a rule only when it reports **zero findings repo-wide — every surface, including apps not yet in CI**. Delete its entry; the preset severity (`error`) takes over. Never add an entry back: new code satisfies the preset, it does not extend the map.
4. **The ledger is one tracking issue** (per the park rule). A one-line comment next to an entry may point at that issue; a hand-maintained **count** in config must not exist — counts in comments go stale on arrival and nothing validates them.
5. Leave the (now empty) park map in the config as the adoption mechanism for the next tool or preset.

## Ultracite specifics

The org baseline already ships the Ultracite setup: copy `configs/oxfmt.config.ts` and `configs/oxlint.config.ts` from this repo (`rules/linting.md` §5, §14). What matters during a burn-down:

- The root config extends `ultracite/oxlint/core` plus the framework presets that apply (`nestjs`, `react`, `vitest`). Extended **overrides win over local rules** — to relax a rule that sits in a preset's own override block (e.g. the vitest preset), adjust the preset object in the config; a second local `overrides` block cannot reach it.
- Permanent disagreements are **anti-goals**: set them `off` with a written rationale rather than parking them as debt (e.g. `typescript/parameter-properties` for the NestJS DI idiom, `unicorn/filename-case` for PascalCase components).
- Anything the build system cannot survive (SWC decorator metadata, an ES target the rule's syntax needs, a competing Next.js linter) gets an `overrides` entry **with a reason** — off, not parked. Record the tool split and carve-outs in the repo's ADR + agent guide.
- Rules whose Ultracite autofix is unsafe are already off in the baseline config (`rules/linting.md` §13). Read that list before a mass `--fix`; the next unsafe fixer is discovered by exactly the hazards below.

## Process

### 1. Measure → ledger

`npx oxlint . --format json` (or the tool's equivalent). Build the ledger as **rule × surface** (api, web, miniapp, portal, scripts, packages) with a total per rule. Open the tracking issue with that table; update it each tranche. A rule is un-parkable only when every surface it appears in is zero.

### 2. Set the ceiling and the scope

- Per package: `"lint": "oxlint . --max-warnings N"` — scope `.`, not `src`, so e2e specs, seeds, configs and scripts are covered too. Findings in generated dirs are excluded once in config (`excludeFiles`), never per-run.
- Keep the pre-commit hook in the loop: `lint-staged` runs the fixer on staged files, and a staged file with error-severity findings fails the commit. Fix the code; never `--no-verify`.

### 3. Slices → waves of subagents

Partition by directory into slices of ~60–140 findings, one subagent per slice with **disjoint file sets** (no two agents may touch one file). Run 3–5 slices per wave. Every dispatch carries the slice paths, the shared playbook (below), and this contract:

- Only your slice's files. Never run repo-wide fixers. `--fix` on your own paths is allowed only if you review the full diff after; never `--fix-suggestions`.
- Verify before reporting: `oxlint <paths>` → 0 findings, typecheck, and the slice's tests.
- A suppression is a last resort and carries a reason (`// oxlint-disable-next-line <rule> -- <reason>`), for framework conflicts only. A genuinely sequential loop gets **one** file-level disable with the reason, not fifty line ones.
- Never weaken an assertion or change behavior to silence a rule; adapt a mock to the real contract instead.
- Report: files, suppressions + reasons, tests run + result, anything left + why.

Waves are restart-safe: state lives in git, agents work from the current tree, and the coordinator integrates between waves.

### 4. Gates

- **After every wave**: full typecheck + full test suite + repo-wide finding count. Re-count, rebalance the next wave. Never stack waves on a red integration.
- **Before the ceiling hits 0**: boot the real app (`pnpm build && node dist/main.js` for a Nest API; `next build` for web). DI resolution and Swagger schema generation are runtime checks that unit tests and `tsc` do not cover — see Hazards. Run the format check and both e2e suites.
- **One PR per surface/tranche**, with the ratchet, the un-parks and any ADR/agent-guide updates in it. CI e2e is the truth; the unit suite is the fast gate.

### 5. Close out

Delete each rule's entry as it hits zero, drop every ceiling to `--max-warnings 0`, update the ADR + agent guide, and close the tracking issue with the final table.

## Hazards (all observed on a real burn-down)

| # | Hazard | Why green tests miss it | Guard |
| - | --- | --- | --- |
| 1 | Stripping annotations from decorated properties (`: boolean = false` → `= false`) | SWC emits `design:type` **only from explicit annotations**; Swagger then crashes at boot ("circular dependency … property key") | Keep annotations on decorated properties; carve the rule out for the SWC-built app; boot the app before shipping |
| 2 | `import type` for constructor-injected deps | The import is erased → `design:paramtypes` is undefined → `UnknownDependenciesException` at boot | Value imports for DI; turn the specifier-style rule off for that app with a rationale |
| 3 | Downgrading a preset rule with a bare `'warn'` | It replaces the preset entry and **drops its options** (e.g. `react/function-component-definition` loses `namedComponents: 'arrow-function'`) → the rule demands the opposite of `func-style`; no style can satisfy both | Repeat the preset's options in every `warn` entry |
| 4 | A fix demands syntax the tsconfig lib can't compile | Named capture groups need ES2018; `toSorted` needs ES2023 — the fix type-errors for consumers | Check target/lib first; use the non-capturing form, or suppress with the target reason |
| 5 | Two linters on one surface (oxlint + ESLint in Next apps) | Their fixers fight: one inlines type specifiers, the other's side-effect rule forbids the result | One owner per rule; turn the rule off in the tool that cannot express the policy, with the reason in config |
| 6 | Removing a barrel file | Importers across the repo break — and many barrels are dead weight | Count importers first; delete dead barrels in place, give live ones their own pass |
| 7 | Blunt `--fix-suggestions` | It applies semantically loaded rewrites (`spyOn` on a missing property, `toSorted` breaking in-place expectations) | Revert a blunt pass; fix per rule with the tests as the oracle |
| 8 | Autofixers vs. decorator metadata | `consistent-type-specifier-style` rewrote DI imports; `no-inferrable-types` stripped SWC types — both pass `tsc` and unit tests | Rule-level carve-outs, not one-off cleanup passes (Hazards 1–2); keep the baseline's unsafe-autofix list current (`rules/linting.md` §13) |

## Fix playbook (rules that carry most of the backlog)

- **func-style / react/function-component-definition** — declarations → `const fn = (...) => {}`; arrow components (repeat the rule's options if parked, Hazard 3).
- **require-await** — drop `async` when the body has no `await`; keep it when callers use `.catch`/`.rejects` or the declared type is `Promise`.
- **require-unicode-regexp** — add `u`; drop escapes `u` forbids (`\-`, `\/` → character class).
- **no-await-in-loop** — `Promise.all(items.map(...))` when iterations are independent; sequential-by-design gets one reasoned file-level disable.
- **vitest/max-expects** — split the test; never delete an assertion.
- **class-methods-use-this** — make the method `static` and update call sites; methods using injected deps suppress with the reason.
- **no-use-before-define** — hoist the definition; mutual recursion suppresses.
- **unicorn/no-await-expression-member** — `const x = await f(); use x.y`.
- **max-classes-per-file** — one class per file; DTO files that group classes get a file-level disable per the DTO convention.
- **typescript/no-extraneous-class** — static-only classes → functions; Nest `@Module()` classes get the framework rationale.
- **prefer-destructuring / unicorn/prefer-export-from / import/first / no-plusplus / no-shadow / logical-assignment-operators / default-case** — mechanical.
- **prefer-named-capture-group** — name the group, or suppress with the lib reason (Hazard 4).
- **vitest/require-top-level-describe** — wrap hooks + tests in one top-level `describe`.
- **promise/prefer-await-to-then** — async/await with try/catch; effects use an inner async function and keep cleanup.
- **typescript/no-non-null-assertion** — guard, `??`, or a test helper (five `mock.calls[0]!` casts become one typed helper).
- **eqeqeq / no-eq-null** — `x == null` → `x === null || x === undefined`.
- **oxc/no-barrel-file** — a separate pass (Hazard 6).

## Done when

`oxlint .` is zero on every surface, every package ceiling is `--max-warnings 0`, every rule entry is deleted, and the tracking issue is closed with the final table.
