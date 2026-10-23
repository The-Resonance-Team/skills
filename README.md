# skills — remote engineering rules & workflows for The Resonance Team

Public, cross-project engineering rules, workflows, and tool baselines for AI coding agents. This repository is **100% remote rules** updated continuously on `main` and consumed live via the [`CONTEXT.md`](./CONTEXT.md) router—never installed as static local skills (`npx skills add`), which go stale between commits.

## Setup by Agent

### 1. Universal `AGENTS.md` Pointer (OpenCode v2, Codex, Antigravity, Hermes, Cursor)

Add this canonical router block to `<repo>/AGENTS.md` (per project) or to your agent's global standing instruction file:

```markdown
## Engineering Rules & Workflows (The Resonance Team)

Always read the router at `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/CONTEXT.md` (or `@skills/CONTEXT.md` when mounted via OpenCode `references`).
Fetch and follow every `rules/*.md` module and `workflows/*.md` procedure from its tables whose scope matches this repository and current task.
```

| `AGENTS.md`-Native Agent | Global Standing File | Project File & Runtime Notes |
| :--- | :--- | :--- |
| **OpenCode v2** | `~/.config/opencode/AGENTS.md` | `<repo>/AGENTS.md` (pair with `references.skills` in `opencode.jsonc` below). |
| **OpenAI Codex** | `~/.codex/AGENTS.md` | `<repo>/AGENTS.md` (32 KiB default `project_doc_max_bytes` in `~/.codex/config.toml`). For network-disabled sandboxes, clone this repo to `~/.agents/resonance-skills` and reference `~/.agents/resonance-skills/CONTEXT.md`. |
| **Google Antigravity (AGY)** | `~/.gemini/GEMINI.md` | `<repo>/AGENTS.md`, `<repo>/GEMINI.md`, or `.agents/rules/resonance.md` (24 KB per-file cap; 20k-token rules budget). |
| **Nous Hermes Agent** | `~/.hermes/SOUL.md` (slot #1 prompt) | `<repo>/AGENTS.md` (walks down from Git root to CWD; personal overrides go in `AGENTS.override.md`). |
| **Cursor** | Cursor Settings → Rules | `<repo>/AGENTS.md` (or `.cursor/rules/resonance.mdc` with `alwaysApply: true` frontmatter). |

---

### 2. OpenCode v2 (`opencode.jsonc` + `AGENTS.md`)

> **OpenCode v2 remote rule note:** OpenCode v2 parses and retains `"instructions"` in `opencode.jsonc` for v1 compatibility, **but v2 does not resolve `"instructions"` entries (remote HTTP/HTTPS URLs or globs) into active model context yet**. Active standing rules in v2 load from `AGENTS.md` (`~/.config/opencode/AGENTS.md` or `<repo>/AGENTS.md`). Pair `AGENTS.md` with `"references"` in `opencode.jsonc`: OpenCode v2 clones `The-Resonance-Team/skills`, refreshes `main` asynchronously, and advertises `@skills` in the system prompt.

1. Configure `~/.config/opencode/opencode.jsonc` (global) or `opencode.jsonc` (per project):

```jsonc
// ~/.config/opencode/opencode.jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "references": {
    "skills": {
      "repository": "The-Resonance-Team/skills",
      "branch": "main",
      "description": "Team engineering router (CONTEXT.md), rule modules (rules/*.md), workflows (workflows/*.md), and tool baseline configs (configs/*)"
    }
  },
  // Retained for OpenCode v1 compatibility (parsed but inactive in v2; 5s fetch timeout):
  "instructions": [
    "https://raw.githubusercontent.com/The-Resonance-Team/skills/main/CONTEXT.md"
  ]
}
```

2. Add the [Universal `AGENTS.md` Pointer](#1-universal-agentsmd-pointer-opencode-v2-codex-antigravity-hermes-cursor) to `~/.config/opencode/AGENTS.md` (global) or `<repo>/AGENTS.md`.

---

### 3. Dedicated Entry Points (Agents That Do Not Resolve `AGENTS.md` as Main)

For agents that read a tool-specific instruction file instead of `AGENTS.md`, place the [Universal `AGENTS.md` Pointer](#1-universal-agentsmd-pointer-opencode-v2-codex-antigravity-hermes-cursor) in their native file or bridge them to `<repo>/AGENTS.md`:

| Agent | Global Entry Point | Project Entry Point / Bridge to `AGENTS.md` |
| :--- | :--- | :--- |
| **Claude Code** | `~/.claude/CLAUDE.md` | Add the router block to `CLAUDE.md` or `.claude/rules/resonance.md`, or bridge to `<repo>/AGENTS.md` with `@AGENTS.md` in `CLAUDE.md` (`ln -s AGENTS.md CLAUDE.md` also works). |
| **Windsurf** | `~/.codeium/windsurf/memories/global_rules.md` | Add the router block to `.windsurf/rules/resonance.md`. |
| **GitHub Copilot** | — | Add the router block to `.github/copilot-instructions.md` (or `.github/instructions/resonance.instructions.md` with `applyTo: "**"` frontmatter). |

### Mixing instructions, references, and workflows

- **Instructions** (`AGENTS.md` / `CLAUDE.md` / `GEMINI.md` + `CONTEXT.md` + active `rules/*.md` URLs): small, standing rules and conventions relevant on every request.
- **Workflows** (`workflows/*.md`): step-by-step procedures (`codebase-audit`, `themed-codebase-audit`, `lint-burndown`, `claude-design-prompting`, `claude-design-to-nextjs`) fetched on demand when their trigger condition fires.
- **References** (`references` in `opencode.jsonc`): cached Git repositories or external trees attached via `@alias` only when needed (zero standing context cost beyond the description line).

## Module index & tool configs

The single source of truth for all rule modules, workflows, and ubiquitous language lives in [`CONTEXT.md`](./CONTEXT.md). Do not duplicate the module table here.

Machine-readable baseline configs ship in [`configs/`](./configs/) (`.oxfmtrc.json`, `.oxlintrc.json`, `eslint.config.mjs`, `dependabot.yml`) and are copied into consumer repos per [`rules/linting.md`](./rules/linting.md) and [`rules/dependabot.md`](./rules/dependabot.md). CI automation packs live in [`skills/pr-analysis/`](./skills/pr-analysis/SKILL.md).

## Known gaps

- **Dart/Flutter** — no rule module yet. Create `rules/dart.md` when a repo carries Dart application code, not before.

## Contributing

See [`AGENTS.md`](./AGENTS.md) for the rule-file format contract and lifecycle rules. Commits go directly to `main` (trunk-based).
