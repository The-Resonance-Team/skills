---
id: "issues"
name: "Issue Rules — grouping, umbrella mechanics & PR closing"
kind: "rule"
description: "Applies to every repo that uses GitHub Issues as its tracker."
scope: "Repos with a GitHub issue tracker"
priority: "mandatory"
---
# Issue Rules — grouping, umbrella mechanics & PR closing

<!-- rule: module-context -->
0. **Module context** — Apply this context when the module applies.

Applies to every repo that uses GitHub Issues as its tracker.

## Grouping

<!-- rule: search-before-creating -->
1. **Search before creating** — List open issues first (`gh issue list --state open --json number,title`). If an open issue or umbrella already covers the scope, extend it instead of creating a duplicate.
<!-- rule: one-umbrella-issue-per-effor -->
2. **One umbrella issue per effort, never one per finding** — An audit or cleanup producing 25 related findings becomes **one** umbrella issue with acceptance criteria grouped per surface (`api`, `web`, `portal`, `miniapp`), not 25 issues.
<!-- rule: split-only-for-independent-d -->
3. **Split only for independent delivery** — Create separate issues only when each slice is independently grabbable, demoable alone, and shares no boundary, milestone, or owner with the rest.

## Umbrella mechanics

<!-- rule: link-existing-issues-as-nati -->
4. **Link existing issues as native sub-issues instead of closing them** — Keep overlapping open issues open with their own labels/blockers, link them natively, and annotate the umbrella checklist item with `covered by #n`:

   ```sh
   gh issue edit <parent> --add-sub-issue <n>
   ```

<!-- rule: close-only-truly-superseded -->
5. **Close only truly superseded issues** — When an umbrella completely replaces an older issue, close the old one as a duplicate pointing to the umbrella:

   ```sh
   gh issue close <n> --reason duplicate --comment "Superseded by #<umbrella>"
   ```

<!-- rule: record-dependencies-via-nati -->
6. **Record dependencies via native `blocked-by` edges** — Wire blocking relationships in the graph, not just in prose:

   ```sh
   gh issue edit <n> --add-blocked-by <m>
   ```

<!-- rule: label-every-touched-surface -->
7. **Label every touched surface** — Attach one `sub-product:*` label per affected app plus `type:feature` / `type:chore`, `priority`, and `ready-for-agent` when the body is self-contained.

## PR close link

<!-- rule: keep-the-closing-keyword-imm -->
8. **Keep the closing keyword immediately adjacent to `#N`** — Write `Closes #N` (or `Fixes #N` / `Resolves #N`) in the PR body. Intervening words (`Resolves the buildable slice of #5`) break GitHub's auto-close parser and leave the issue open after merge (Precedent: RestoSuite #35). When a parent issue's remaining scope moved to sub-issues, close the parent manually with pointers (`gh issue close N --reason completed --comment "..."`).
<!-- rule: never-auto-close-a-parent-is -->
9. **Never auto-close a parent issue from a partial PR** — A PR delivering one slice of an umbrella writes `Part of #N`; the parent closes only when all sub-issues are complete.
