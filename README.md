# skills — opencode remote rules for The Resonance Team

Public, cross-project rules for opencode, consumed via remote `instructions` URLs. Sibling of the `skills/` directory pattern in `business-skills`, but **rules-only**: plain markdown fetched into context, no skill packs.

## Usage

Add **one instruction** — `CONTEXT.md` — to `opencode.json` (per project) or `~/.config/opencode/opencode.json` (global). It is the router: agents fetch only the rule modules their project needs, by URL.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": [
    "https://raw.githubusercontent.com/The-Resonance-Team/skills/main/CONTEXT.md"
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
| `rules/linting.md`  | All TS/JS projects | Lint & format — Prettier, Oxlint, ESLint (Next.js only)          |
| `rules/libraries.md` | All TS/JS projects | One library per concern — axios, zod, RHF, TanStack Query, class-validator, date-fns |
| `rules/upload.md`    | APIs with uploads  | Inline multipart + S3 — mediaUpload interceptor, StorageService, URL-shaped DTOs |

Machine-readable tool configs (Prettier, Oxlint, ESLint-for-Next.js) ship in [`configs/`](./configs/) and are copied into consumer repos per `rules/linting.md`.

## Known gaps

- **Dart/Flutter** — no rule module. TaxEasy-Platform runs a `dart-mcp-server`; create `rules/dart.md` when a repo carries Dart application code, not before.

## Contributing

See [AGENTS.md](./AGENTS.md) for the rule-file format contract. Commits go directly to `main` (trunk-based).
