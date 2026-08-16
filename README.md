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

## Mixing instructions, references, skills

These compose — pick per source by size and relevance:

- **Instructions** (`AGENTS.md` + this repo's URLs) for what's always relevant: rules, conventions, build/test commands. Small, standing context shown every request.
- **References** (`references` in `opencode.json`) for large external trees needed only sometimes: product docs, shared libraries, another repo. Attach via `@alias` when needed; without a `description` they are not advertised to the agent. Zero context cost until pulled. References grant no extra permissions — outside-`Location` access still needs the `external_directory` / edit permissions.
- **Skills** for complex procedures worth progressive disclosure.

Rule of thumb: small + always-needed → instructions; big + sometimes-needed → references. Don't put large content in instructions; it burns tokens on every request.

Install a reference in the same `opencode.json` as the instruction:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": [
    "https://raw.githubusercontent.com/The-Resonance-Team/skills/main/CONTEXT.md"
  ],
  "references": {
    "docs": {
      "path": "../product-docs",
      "description": "Use for product behavior and terminology"
    }
  }
}
```

## Known gaps

- **Dart/Flutter** — no rule module. TaxEasy-Platform runs a `dart-mcp-server`; create `rules/dart.md` when a repo carries Dart application code, not before.

## Contributing

See [AGENTS.md](./AGENTS.md) for the rule-file format contract. Commits go directly to `main` (trunk-based).
