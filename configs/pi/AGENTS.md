# Pi

This file overrides `~/AGENTS.md` for Pi only.

`extensions/team-rules.ts` loads `profiles/xirothedev.md` and `CONTEXT.md` into `<team_rules>`. When that section is present, do not fetch those two files again.

If `<team_rules>` is missing, fetch both now:

- `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/profiles/xirothedev.md`
- `https://raw.githubusercontent.com/The-Resonance-Team/skills/main/CONTEXT.md`

Offline: `~/workspace/skills/profiles/xirothedev.md` and `~/workspace/skills/CONTEXT.md`.
