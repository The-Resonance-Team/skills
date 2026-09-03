# AGENTS.md — skills repo guide

Guide for AI agents contributing to this repo. This file is read locally (by agents cloning the repo) — it may use lazy `@`-references. The `rules/*.md` files are consumed remotely and must stay self-contained.

## Rule file format

1. **Self-contained** — Each `rules/*.md` file is fetched by URL into a consumer's context with no surrounding repo. It must read standalone: its own scope statement, its own rules, no `@`-references to sibling files.
2. **Structure** — Start with a `#` title, a short scope paragraph (which projects include this file), then numbered rules grouped by `##` headings.
3. **Mandatory rules only** — These files encode standards an agent must follow, not advice. If something is optional, leave it out (YAGNI).
4. **Concrete, not abstract** — Each rule states the pattern and the anti-pattern, with a code example where the rule is about code. Rules proven by real incidents (like the `data?.data as Type` unwrap bug) get worked examples.
5. **No frontmatter** — Rule files are plain markdown; remote `instructions` fetch treats them as raw text. (Frontmatter is a skills mechanism, not a rules mechanism.)
6. **Keep it short** — A rule file that passes ~100 lines should be split: either trim, or create a new module (`rules/<domain>.md`) for a distinct surface.

## Editing workflow

1. Edit `rules/*.md` directly, commit directly to `main` (trunk-based, no PR workflow for this repo).
2. `CONTEXT.md` is the single source of truth for the module index — update its table in the same commit when you add or rename a rule file. Never duplicate the table elsewhere (README points to it).
3. Keep commit messages in the repo's existing conventional style (`feat:`, `fix:`, `chore:`).

## Vocabulary

- **Rule module** — one file under `rules/` (`general.md`, `nestjs.md`, `frontend.md`), consumed as a unit.
- **Consumer** — a repo that lists one of our rule files in its `opencode.json` `instructions` array.
- **Instruction** — a single URL entry in a consumer's `instructions` array.

## Rule lifecycle

1. **Extend before you add** — a lesson for an existing audience and surface extends its module. A new `rules/<domain>.md` needs a distinct audience that fetches it without the others; every module is a separate fetch for consumers.
2. **Deprecate, don't silently delete** — a superseded rule keeps a one-line pointer to its replacement. Delete only content that is factually wrong (wrong fails loudly at consumers, e.g. an invalid config value). Name the dead rule in a `fix:` commit message.
3. **Renames break consumers** — module URLs sit in consumers' `instructions`. A rename ships three parts same-day: the new files, a stub at the old URL mapping old sections to new ones, and updates to every known consumer. The stub carries a review date; on that date, check whether anything still fetches it.
4. **Configs move with their rule** — a baseline in `configs/` changes in the same commit as the rule text that documents it, proven by an incident or validator output, not by intent.
