# AGENTS.md — skills repo guide

Guide for AI agents contributing to this repo. This file is read locally (by agents cloning the repo) — it may use lazy `@`-references. The `rules/*.md` files are consumed remotely and must stay self-contained. The repo is also the **resonance plugin package** (Agent Plugins 1.0.0): `plugin.json` + `skills/` + `mcp.json` at root.

- **Never edit installed skills** in client discovery dirs — `scripts/install.mjs` owns them and re-copies from upstream; `skills/` holds team-authored skills only.
- **Never commit secrets** — `mcp.json` holds `${VAR}` placeholders only.
- Run `node scripts/validate.mjs` before committing; the package must stay valid.

## Rule file format

1. **Self-contained** — Each `rules/*.md` file is fetched by URL into a consumer's context with no surrounding repo. It must read standalone: its own scope statement, its own rules, no `@`-references to sibling files.
2. **Structure** — Start with a `#` title, a short scope paragraph (which projects include this file), then numbered rules grouped by `##` headings.
3. **Mandatory rules only** — These files encode standards an agent must follow, not advice. If something is optional, leave it out (YAGNI).
4. **Concrete, not abstract** — Each rule states the pattern and the anti-pattern, with a code example where the rule is about code. Rules proven by real incidents (like the `data?.data as Type` unwrap bug) get worked examples.
5. **No frontmatter** — Rule files are plain markdown; remote `instructions` fetch treats them as raw text. (Frontmatter is a skills mechanism, not a rules mechanism.)
6. **Keep it short** — A rule file that passes ~100 lines should be split: either trim, or create a new module (`rules/<domain>.md`) for a distinct surface.

## Editing workflow

1. Edit `rules/*.md` directly, commit directly to `main` (trunk-based, no PR workflow for this repo).
2. When you add or rename a rule file, update the index table in `README.md` in the same commit.
3. Keep commit messages in the repo's existing conventional style (`feat:`, `fix:`, `chore:`).

## Vocabulary

- **Rule module** — one file under `rules/` (`general.md`, `nestjs.md`, `frontend.md`), consumed as a unit.
- **Consumer** — a repo that lists one of our rule files in its `opencode.json` `instructions` array.
- **Instruction** — a single URL entry in a consumer's `instructions` array.
