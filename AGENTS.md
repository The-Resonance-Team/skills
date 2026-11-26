# AGENTS.md — skills repo guide

Guide for AI agents contributing to this repo. This file is read locally (by agents cloning the repo) — it may use lazy `@`-references. The `rules/*.md` files are consumed remotely and must stay self-contained.

## Rule file format

1. **Self-contained** — Each `rules/*.md` file stands alone: its own scope statement, rules, and no `@`-references to sibling files. Individual raw URLs remain available.
2. **Structure** — Start with YAML catalog metadata and a `#` title. Put shared scope and context in indexed numbered rules, followed by the other numbered rules grouped by `##` headings. Give each rule a stable `<!-- rule: slug -->` anchor immediately before its numbered heading.
3. **Mandatory rules only** — These files encode standards an agent must follow, not advice. If something is optional, leave it out (YAGNI).
4. **Concrete, not abstract** — Each rule states the pattern and the anti-pattern, with a code example where the rule is about code. Rules proven by real incidents (like the `data?.data as Type` unwrap bug) get worked examples.
5. **Catalog metadata** — Require `id`, `name`, `kind`, `description`, `scope`, and `priority`. Stable IDs must not change when a rule is reordered. Record removed or replaced IDs in `agent-rules-mcp/id-migrations.json`. Each rule is limited to 1,000 `o200k_base` tokens; each workflow to 10,000.
6. **Keep it short** — A rule file that passes ~100 lines should be split: either trim, or create a new module (`rules/<domain>.md`) for a distinct surface.

## Editing workflow

1. Edit `rules/*.md` directly. For a human edit from a local clone, ask whether to push
   directly to `main` or open a PR. A patch proposed by the rules MCP always opens a
   draft PR; it never pushes to `main`.
2. Rule and workflow source metadata owns the catalog index. Rebuild and commit the catalog and embedding cache with source changes.
3. Keep commit messages in the repo's existing conventional style (`feat:`, `fix:`, `chore:`).

## Reference notes

1. [free-resources/INDEX.md](./free-resources/INDEX.md) is the only shallow entry for optional reference notes. Open a provider file only when the task needs it.
2. Reference notes are not standing rules and are not catalog entries.

## Vocabulary

Use [`GLOSSARY.md`](./GLOSSARY.md) for team-rule terms and [`agent-rules-mcp/GLOSSARY.md`](./agent-rules-mcp/GLOSSARY.md) for MCP terms.

## Rule lifecycle

1. **Extend before you add** — a lesson for an existing audience and surface extends its module. A new `rules/<domain>.md` needs a distinct audience that fetches it without the others; every module is a separate fetch for consumers.
2. **Hard-delete dead rules** — a module is dead when it has no named consumer, no inbound rule or workflow reference, and no live scope. Delete the file, fix every inbound reference, rebuild the catalog, and update every known consumer in the same commit. Name the deleted module in a `fix:` commit message. Wrong content fails loudly at consumers: delete it in the same fix.
3. **Merge duplicates into one owner** — when two rules state the same requirement, keep one copy in the module that owns the surface and delete the other. Update cross-references in the same commit. Never leave a stub at the old path.
4. **Configs move with their rule** — a baseline in `configs/` changes in the same commit as the rule text that documents it, proven by an incident or validator output, not by intent.
