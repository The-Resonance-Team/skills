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

## Reference notes

1. [free-resources/INDEX.md](./free-resources/INDEX.md) is the only shallow entry for optional reference notes. Open a provider file only when the task needs it.
2. Do not add reference notes to the standing rule index in `CONTEXT.md`, except for the single link to `free-resources/INDEX.md`.

## Vocabulary

All canonical terms (`Router`, `Rule module`, `Consumer`, `Instruction`) are defined in [`CONTEXT.md#Terms`](./CONTEXT.md#terms) — do not duplicate them here.

## Rule lifecycle

1. **Extend before you add** — a lesson for an existing audience and surface extends its module. A new `rules/<domain>.md` needs a distinct audience that fetches it without the others; every module is a separate fetch for consumers.
2. **Hard-delete dead rules** — a module is dead when it has no named consumer, no inbound rule or workflow reference, and no live scope. A row in `CONTEXT.md` is an index entry, not a reference. Delete the file, remove its router row, fix every inbound reference, and update every known consumer in the same commit. Name the deleted module in a `fix:` commit message. Wrong content fails loudly at consumers: delete it in the same fix.
3. **Merge duplicates into one owner** — when two rules state the same requirement, keep one copy in the module that owns the surface and delete the other. Update cross-references in the same commit. Never leave a stub at the old path.
4. **Configs move with their rule** — a baseline in `configs/` changes in the same commit as the rule text that documents it, proven by an incident or validator output, not by intent.
