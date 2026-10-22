# skills — opencode remote rules & workflows for The Resonance Team

Public, cross-project engineering rules, workflows, and tool baselines for OpenCode and AI coding agents, consumed via remote `instructions` URLs.

## Usage

Add **one instruction** — `CONTEXT.md` — to `opencode.jsonc` (per project) or `~/.config/opencode/opencode.jsonc` (global). It is the router: agents fetch only the rule modules and workflows their project needs by URL.

```jsonc
// ~/.config/opencode/opencode.jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": [
    "https://raw.githubusercontent.com/The-Resonance-Team/skills/main/CONTEXT.md"
  ],
  "references": {
    "skills": {
      "repository": "The-Resonance-Team/skills",
      "description": "Use for rule modules, workflows, and baseline configs"
    }
  }
}
```

Remote instructions are fetched with a 5-second timeout; the repo must stay public for anonymous fetch to work.

### Mixing instructions, references, and workflows

- **Instructions** (`AGENTS.md` + `CONTEXT.md` + active `rules/*.md` URLs): small, standing rules and conventions relevant on every request.
- **Workflows** (`workflows/*.md`): step-by-step procedures (`codebase-audit`, `themed-codebase-audit`, `lint-burndown`, `claude-design-to-nextjs`) fetched on demand when their trigger condition fires.
- **References** (`references` in `opencode.jsonc`): large external trees attached via `@alias` only when needed (zero standing context cost).

## Module index & tool configs

The single source of truth for all rule modules, workflows, and ubiquitous language lives in [`CONTEXT.md`](./CONTEXT.md). Do not duplicate the module table here.

Machine-readable baseline configs ship in [`configs/`](./configs/) (`.oxfmtrc.json`, `.oxlintrc.json`, `eslint.config.mjs`, `dependabot.yml`) and are copied into consumer repos per [`rules/linting.md`](./rules/linting.md) and [`rules/dependabot.md`](./rules/dependabot.md). CI automation packs live in [`skills/pr-analysis/`](./skills/pr-analysis/SKILL.md).

## Known gaps

- **Dart/Flutter** — no rule module yet. Create `rules/dart.md` when a repo carries Dart application code, not before.

## Contributing

See [`AGENTS.md`](./AGENTS.md) for the rule-file format contract and lifecycle rules. Commits go directly to `main` (trunk-based).
