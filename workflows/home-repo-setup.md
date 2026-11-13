# Home Repo setup

**Trigger:** Fetch this workflow when the user wants to set up a **Home Repo**: one git repo that holds shared skills, `AGENTS.md` (and/or other harness start files) and shared agent docs, and that **points at** their other repos so the agent can be run from it.

**Scope:** Applies to OpenCode/`AGENTS.md`-centric workflows by default; adapt file names/commands only to match the user’s actual harness and tooling.

## Safety invariants (always)

- **Read-only until apply is explicitly approved.** Until the user approves the Step 4 apply manifest and says to apply, do not create, move, copy, delete, rename, branch, commit, or push anything.
- **Secrets stay unread.** Leave `.env` and other secret/credential files unread. Do not print, copy, or infer secret values.
- **Facts are your job; decisions are the user’s.** Look up every fact yourself (filesystem, `git`, `gh`, config files) using tools/subagents for wide searches. Bring the user only decisions, evidence summaries, and conflicts that require a choice.
- **No push.** Pushing is always the user’s call unless they explicitly ask later.

## How to work (grilling / frontier)

Work as a **design tree** of decisions. The **frontier** is every decision whose prerequisites are settled.

- **Rounds:** In each round, ask the **whole current frontier**. Number each question, give your **recommended answer**, and word it so “yes” (or the recommended option) accepts it.
- **Dependencies:** A question that depends on an answer still open belongs to a **later round**. After each user response, recompute the frontier and ask the next round.
- **Fact-finding in parallel:** When a frontier question needs a fact, dispatch subagents/tools to find it. Do not block unrelated frontier questions on that lookup; only questions downstream of the unsettled fact wait.
- **Shared understanding gate:** Do not act on the plan until the frontier is empty (nothing silently assumed) and the user explicitly confirms shared understanding / approves the required gate for that step.

## Canonical terms (domain clarity)

Use these terms consistently; **surface and resolve conflicts** when the user or repo state uses a term differently. When terms are resolved or conflicting meanings are clarified, **lazily create/update `GLOSSARY.md` in the Home Repo** (only if/when the Home Repo exists or as part of the approved plan) to record the canonical definitions. Keep `GLOSSARY.md` free of implementation details.

| Term | Canonical meaning (default) |
| --- | --- |
| **Home Repo** | The single git repo that stores shared agent material and pointers to other repos; the primary place to run the agent from. |
| **Child repo / pointed-at repo** | A repo listed by the Home Repo as a target the agent may work in; not the Home Repo itself. |
| **Shared** | Material that is true across repos and belongs in one canonical copy in the Home Repo. |
| **Duplicate** | The “same” item present in multiple places; copies are diffed and one canonical version is chosen. |
| **Repo-specific** | Material about one repo’s code, commands, or domain; stays in that repo. |
| **Installed** | Material sourced from a published skills repo/marketplace or managed install; stays installed (not copied as a Home Repo-owned duplicate) unless the user decides otherwise. |
| **Harness start file** | The file(s) the user’s harness loads at session start (e.g. `AGENTS.md`, `CLAUDE.md`). |
| **Pointer** | An entry in the Home Repo that names a child repo, what it is, its local path, and clone source. |

**Conflict examples to resolve explicitly:** `AGENTS.md` vs `CLAUDE.md` as source of truth, divergent duplicate contents, an item that is both “installed” and locally modified, or unclear repo ownership.

## Step 1 — Inventory the repos (facts → decisions)

**Goal:** Know which repos exist, which belong in scope, and where/how the Home Repo will live.

### 1a. Gather facts (agent)

- Find every git repo under the user’s home directory, **skipping dependency/vendor folders** (e.g. `node_modules`, `.venv`, vendor caches) and obvious non-source clones as appropriate; report what was skipped.
- For each repo record: **path**, **remote(s)**, **visibility** (public/private/unknown), and **last commit date**.
- Detect signals relevant to the Home Repo choice (recent activity, existing `AGENTS.md`/`CLAUDE.md`, existing “home/meta” repos) and to the user’s harness.

### 1b. Round (decisions) — ask at least

Present facts succinctly, then ask (numbered, with recommendations):

1. **Which repos the Home Repo points at** (recommend those with recent commits; include/exclude rationale).
2. **Where the Home Repo lives, and whether it is new or existing** (recommend a new private repo beside the others unless a clear existing candidate fits).
3. **Personal or shared with a team** (affects naming, visibility, and what counts as “shared”).
4. **Which harness start file(s) load at session start**: `AGENTS.md`, `CLAUDE.md`, or both (recommend what the setup shows).

**Done when:** Every discovered repo is marked **in** or **out** (with reason if out), and questions 1–4 are answered.

## Step 2 — Inventory the shared material (facts → classification)

**Goal:** Classify candidate material so the plan has one destination per item.

### 2a. Gather facts (agent)

Across the **in-scope repos** and relevant **user-level skill folders** (e.g. `~/.claude/skills`, `~/.agents/skills`, and any harness-indicated locations), list:

- every **skill** (a folder containing `SKILL.md`),
- every **`AGENTS.md`** and **`CLAUDE.md`**,
- every **doc written for agents** (coding standards, glossaries, ADRs, runbooks for agents, etc.).

For each item capture: source path(s), type, owning repo/location, and last-modified/commit signals as available.

### 2b. Classify into exactly one bucket

Sort each item into:

- **shared** — true across repos.
- **duplicate** — same item in several places; **diff the copies and mark the newest** as the canonical candidate. **Tie-breaker:** if timestamps are equal/unreliable or the “newest” is unclear, **do not guess**—show a short diff/summary and ask the user to choose.
- **repo-specific** — about one repo’s code, commands, or domain.
- **installed** — from a published skills repo or marketplace.

Resolve ambiguous classifications and conflicts in rounds (frontier recomputed).

**Done when:** Every discovered item sits in **exactly one bucket**, with a noted canonical source for duplicates/shared items.

## Step 3 — Agree the plan (no mutations)

**Goal:** Reach an approved, explicit plan and Home Repo `AGENTS.md` design.

### 3a. Present the plan

Show:

1. A **table of every item**: current location(s), bucket, and **destination**:
   - **shared** and **duplicate** → move/consolidate to the Home Repo as **one copy** (canonical/newest chosen version).
   - **repo-specific** → stays in its repo.
   - **installed** → stays installed.
2. The proposed **Home Repo `AGENTS.md`**:
   - a short intro, then
   - an **“Other Repos”** section with one pointer per in-scope repo:

     `<name> (<what it is>): <local path>. Clone from <remote> if missing.`

   - add a **hint** where a repo needs one (e.g. “read its `AGENTS.md` first”).
   - if **more than ~20 repos**, group pointers into **one file per area** and point at those files from `AGENTS.md` instead of listing all inline.
3. Harness compatibility: if the chosen harness loads a different start file, plan that file as a **one-line pointer to `AGENTS.md`** (or the agreed canonical start file).
4. Any **`GLOSSARY.md`** entries to create/update (lazy, only for resolved/conflicting terms).

### 3b. Iterate in rounds

Settle open items in further rounds until nothing is assumed.

**Done when:** The user **approves the table and the proposed `AGENTS.md` (and related start-file/glossary plan)** and confirms shared understanding.

## Step 4 — Apply the plan (two-phase, gated)

**Goal:** Apply exactly the approved plan, safely and audibly.

### Phase 4a — Dry-run / apply manifest (no mutations)

Produce an exact **apply manifest** for user review, listing per action:

- Home Repo creation/init or reuse (path, visibility intent as applicable),
- files/dirs to create or update in the Home Repo (including `AGENTS.md`, pointer files, `GLOSSARY.md`, and harness pointer file if needed),
- for each **shared/duplicate** item: source → destination copy operation (keeping skill folders whole),
- for each **child repo**: new local **branch name**, items to remove/move out (copies that moved) vs **repo-specific material that stays**,
- commits to create (where), with proposed messages,
- explicit statement: **no push**.

Ask for explicit approval: **“apply now”** (accepting the manifest as-is or with named edits). A question/edits request returns to the frontier (no mutations).

### Phase 4b — Execute (only after “apply now”)

1. Create or prepare the Home Repo and write its `AGENTS.md` (and pointer/glossary/start-file pointer files) per the approved manifest.
2. Copy each shared item into the Home Repo, **keeping skill folders whole**.
3. In each child repo, on a **new local branch**, remove the copies that moved. **Repo-specific material stays.**
4. Create commits in the Home Repo (and child repos only if specified/approved in the manifest). **Do not push.**

**Done when:** Every row of the approved table is applied (or explicitly skipped).

## Report

Provide:

- **Per-row outcome** (applied / skipped / blocked) for every table row.
- **Branches created** in each repo (name + base).
- **Commits created** (repo, hash/message summary).
- **Anything skipped**, with the reason and what decision (if any) is needed next.
- Any **`GLOSSARY.md`** updates made (or deferred) and unresolved conflicts, if present.
