# CONTEXT.md — skills repo glossary & rule router

Consumers add **only this file** to `opencode.json` `instructions`. It is the router: fetch the rule modules your project needs by URL below. Glossary terms below define the ubiquitous language across all modules.

## Rule modules

| Module                                 | Scope                                                  | Fetch URL                                                                                               |
| -------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `rules/general.md`                     | All projects                                           | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/general.md`                     |
| `rules/nestjs.md`                      | NestJS API                                             | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/nestjs.md`                      |
| `rules/prisma.md`                      | TS/NestJS repos on Prisma 7                            | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/prisma.md`                      |
| `rules/frontend.md`                    | Web/portal/miniapp                                     | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/frontend.md`                    |
| `rules/i18n.md`                        | Projects with i18n (message catalogs, multi-locale UI) | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/i18n.md`                        |
| `rules/e2e-testing.md`                 | Repos with Playwright e2e tests against a real API     | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/e2e-testing.md`                 |
| `rules/linting.md`                     | All TS/JS projects                                     | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/linting.md`                     |
| `rules/libraries.md`                   | All TS/JS projects                                     | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/libraries.md`                   |
| `rules/upload.md`                      | APIs with uploads                                      | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/upload.md`                      |
| `rules/issues.md`                      | Repos with a GitHub issue tracker                      | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/issues.md`                      |
| `rules/github-workflows.md`            | All GitHub Actions CI/CD and automation                | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/github-workflows.md`            |
| `rules/audit.md`                       | Any repo under audit                                   | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/audit.md`                       |
| `workflows/codebase-audit.md`          | Full-codebase audit with subagent slices               | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/workflows/codebase-audit.md`          |
| `workflows/claude-design-to-nextjs.md` | Converting Claude Design HTML to Next.js/React         | `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/workflows/claude-design-to-nextjs.md` |

**Condition triggers for workflows**:

- Use `workflows/codebase-audit.md` when the user asks to audit the codebase, check team-rule compliance repo-wide, find and remove AI slop and dead code across the repo, or scan for leaked secrets and risky dependencies.
- Use `workflows/claude-design-to-nextjs.md` when:

- User provides Claude Design HTML export and asks to convert to Next.js/React
- User asks to implement feature from design spec
- User asks to review design against spec for missing/partial/wrong features
- User asks for pixel-perfect implementation from design

**Suggested tools/skills for workflow**:

- `/code-review` — two-axis code review (Standards + Spec) after implementation
- `/tdd` — test-driven development for critical business logic
- `/domain-modeling` — challenge terms, sharpen glossary, test edge cases
- `/codebase-design` — design deep modules, find clean seams
- `/implement` — execute implementation plan from spec
- Chrome DevTools MCP — visual verification, pixel-perfect comparison
- PostHog MCP — analytics integration, user behavior tracking (optional)

Machine-readable tool configs ship in `configs/` of the same repo (`prettier.config.mjs`, `.oxlintrc.json`, `eslint.config.mjs`).

## Language rules (all consumers)

- **Always talk in ASD-STE100 Simplified Technical English.** Use only approved STE100 vocabulary. One meaning per word, short sentences.
- **Always read `CONTEXT.md` files** and use their ubiquitous language.

## Terms

- **Rule module** — one file under `rules/` (`general.md`, `nestjs.md`, `frontend.md`, `i18n.md`, `linting.md`, `issues.md`), consumed as a unit by agents.
- **Consumer** — a repo that lists one of our rule files in its `opencode.json` `instructions` array.
- **Instruction** — a single URL entry in a consumer's `instructions` array.
- **Lint baseline** — the standard tool+rule configuration for the org, encoded in `rules/linting.md`. One accepted configuration; alternatives are not accommodated.
- **Tool config** — a machine-readable config file shipped in `configs/` (`prettier.config.mjs`, `.oxlintrc.json`, `eslint.config.mjs`) that a consumer copies into its own repo.
- **Config drift** — a config inside a consumer repo that contradicts the lint baseline (e.g. a stale app-level `.prettierrc`). Resolution is unification, not accommodation.
- **Library baseline** — the fixed library-per-concern table in `rules/libraries.md`, chosen by framework. A substitute library for a covered concern is a violation.
- **Inline multipart upload** — the upload model in `rules/upload.md`: files ride `multipart/form-data` on authenticated business endpoints; the `mediaUpload` interceptor validates and stores, injecting public URLs into `req.body` before DTO validation. Anti-pattern: a dedicated presign-then-PUT upload service.
- **Media lifecycle** — create/replace/delete of stored media in `rules/upload.md`; replaces persist new URLs first, then fire-and-forget `deleteDropped` (a failed GC never fails the update); orphaned objects from failed mid-update writes are accepted until a GC job exists.
- **`_`-prefix convention** — intentionally-unused bindings are named with a leading underscore and exempted from unused-variable rules via the three `^_` ignore patterns.
- **Suppressed binding** — a `_`-prefixed binding that swallowed real input (a DTO, a param, a state setter): real input silently discarded, a bug in hiding. The `_` is valid only for signature-required placeholders (guard params, validator args, react-query callbacks, test stubs) — otherwise wire it or remove it (`rules/linting.md`).
- **Slop** — an AI-generation artifact flagged by `rules/audit.md`: narrating comments, defensive checks on trusted paths, type-bypass casts, single-use abstractions, deep nesting, style inconsistent with the surrounding file, suppression directives, and value-free tests (no assertions, tautologies, mock-echoes).
- **Verdict** — a file's audit outcome: `clean` or one or more findings. A slice audit completes when every file in the slice carries a verdict.
- **Slice** — the unit of partitioning in `workflows/codebase-audit.md`: a group of paths small enough for one subagent's context; every source path sits in exactly one slice.
- **Reusable workflow** — a workflow file (prefixed with `_` or in `.github/workflows/`) that other workflows call via `uses: ./.github/workflows/<name>.yml` with `workflow_call` trigger. DRY for build/test logic shared across CI, release, and deploy.
- **Changeset** — a markdown file describing a package version bump and changelog entry, consumed by `changesets/action` to automate library releases.
- **Ecosystem CI** — downstream testing of dependent projects triggered by a comment command (e.g., `/ecosystem-ci`) on a PR, gated by permission checks.
- **Autofix command** — a comment-triggered workflow (e.g., `/autofix`) that runs lint fix and pushes the result to the PR branch, gated by permission checks.
