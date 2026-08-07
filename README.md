# skills — opencode remote rules for The Resonance Team

Public, cross-project rules for opencode, consumed via remote `instructions` URLs. Sibling of the `skills/` directory pattern in `business-skills`, but **rules-only**: plain markdown fetched into context, no skill packs.

## Usage

Add the modules you need to `opencode.json` (per project) or `~/.config/opencode/opencode.json` (global). Each file is **self-contained** — include only the modules your project needs.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": [
    "https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/general.md",
    "https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/nestjs.md",
    "https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/frontend.md"
  ]
}
```

Remote instructions are fetched with a 5-second timeout; the repo must stay public for anonymous fetch to work.

## Rule modules

| File                | Scope              | Include when                                                     |
| ------------------- | ------------------ | ---------------------------------------------------------------- |
| `rules/general.md`  | All projects       | Always — language, axios generics, Tailwind v4, trust boundaries |
| `rules/nestjs.md`   | NestJS API         | Working in a NestJS backend (`apps/api`)                         |
| `rules/frontend.md` | Web/portal/miniapp | Working in a browser client                                      |

## Contributing

See [AGENTS.md](./AGENTS.md) for the rule-file format contract. Commits go directly to `main` (trunk-based).
