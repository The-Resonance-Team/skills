# Issue Rules — grouping and umbrella issues

Applies to every repo that uses GitHub issues as the issue tracker. Include this file in `opencode.json` `instructions` for any such repo.

## Grouping

1. **Search before you create** — Before creating an issue, list open issues and check for one that already covers the work:

   ```sh
   gh issue list --state open --json number,title
   ```

   If an open issue or umbrella covers it, extend that issue. Never create a duplicate.

2. **One issue per effort, not one per finding** — An audit that produces many related findings is ONE issue with a checklist of acceptance criteria, grouped per surface (e.g. api / web / portal / miniapp) — not one issue per finding. Related items share a domain feature, a backend dependency, or a screen/flow. When in doubt, group. Example: a mock/stub cleanup with 25 findings becomes 1 umbrella issue with per-surface criteria, not 25 issues.

3. **Split only for independent delivery** — Split work into separate issues only when each part is independently grabbable AND demoable alone AND has no shared boundary with the rest (different feature, different tracker milestone, or different owner). The default is one issue.

## Umbrella mechanics

4. **Prefer native sub-issues over closing** — When the umbrella duplicates existing open issues, do NOT close them. Keep them open and link them as sub-issues:

   ```sh
   gh issue edit <parent> --add-sub-issue <n>
   ```

   Sub-issues keep their own labels, priority, and blockers. Annotate the overlapping criterion in the umbrella body with `covered by #n`.

5. **Close only what the umbrella truly supersedes** — Issues fully replaced by the umbrella close as duplicates with a pointer to the umbrella:

   ```sh
   gh issue close <n> --reason duplicate --comment "Superseded by #<umbrella>"
   ```

6. **Record dependencies natively, not in prose** — Use GitHub's blocked-by edges, not only body text:

   ```sh
   gh issue edit <n> --add-blocked-by <m>
   ```

7. **Label the umbrella for every surface it touches** — one `sub-product:*` label per affected app, plus `type:feature` / `type:chore`, `priority`, and `ready-for-agent` when the body is self-contained.

## PR close link

8. **Wire the close keyword on every PR** — A PR whose merge completes an issue states it with a closing keyword adjacent to the reference: `Closes #N` (or `Fixes`/`Resolves`). GitHub closes the issue on merge. Text between keyword and reference does NOT close — `Resolves the buildable slice of #5` leaves the issue open (real incident: restosuite #35 stayed open after its PR merged). When the issue is a parent whose remaining scope moved to sub-issues, close it manually instead: `gh issue close N --reason completed --comment "<PR + sub-issue pointers>"`.

9. **Never close a parent by keyword** — A PR that implements part of a parent issue uses `Part of #N` (never closes). The parent closes only when every sub-issue is done.
