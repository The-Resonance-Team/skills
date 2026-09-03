# Retro: Self-Improving Rules Research

## What I did

Read the rule-set repo (`/Users/xirothedev/workspace/skills`), the consumer repo
(`/Users/xirothedev/workspace/Ecopick-Platform`), two agent skills, and the OpenCode
docs, all as primary sources. Checked every cited path and line by reading the file.
Evaluated four candidate meanings of "self-improving" for the shared agent-rule set
(remote rule modules fetched by URL into opencode `instructions`, trunk-based,
consumed by Ecopick-Platform via local clone + `AGENTS.md`).

## Baseline: how rules flow today

| Fact | Source |
| ---- | ------ |
| Each `rules/*.md` is fetched by URL into a consumer's context with no surrounding repo; must read standalone, no `@`-references | `skills/AGENTS.md:7` |
| Rules encode mandatory standards only, concrete pattern + anti-pattern, keep short (~100 lines then split) | `skills/AGENTS.md:9-12` |
| Trunk-based: edit `rules/*.md` directly, commit directly to `main`, no PR workflow | `skills/AGENTS.md:16` |
| `CONTEXT.md` is the single source of truth for the module index, updated in the same commit on add/rename | `skills/AGENTS.md:17` |
| Lifecycle: extend before adding; deprecate with a pointer, never silently delete; wrong content fails loudly at consumers | `skills/AGENTS.md:28-29` |
| Renames break consumers: ship new files + stub at old URL + update every known consumer, same day, stub carries a review date | `skills/AGENTS.md:30` |
| Config baselines in `configs/` change in the same commit as the rule text, proven by an incident or validator output | `skills/AGENTS.md:31` |
| Ecopick wires the modules by local clone: `AGENTS.md` names the `CONTEXT.md` + 7 rule modules to read and the 5 configs to copy | `Ecopick-Platform/AGENTS.md:7` |
| No `opencode.json` and no `.opencode/` directory exist in Ecopick-Platform (searched to depth 3): consumption is manual, not a remote `instructions` fetch | verified by `find`, 2026-09-04 |
| The manual incident-to-rule step is already encoded: `general.md` rule 10 tells the agent to say a rule is wrong/missing, ask the user, then edit `rules/*.md` and push to `main`; never silently deviate | `skills/rules/general.md:78-80` |
| OpenCode supports remote rule URLs in `instructions`, fetched with a 5-second timeout; all instruction files combine with `AGENTS.md` | `https://opencode.ai/docs/rules/` ("Custom Instructions", "Referencing External Files") |
| OpenCode rule precedence: local `AGENTS.md` walk-up, then global, then Claude-Code fallback; first match per category wins | `https://opencode.ai/docs/rules/` ("Precedence") |

## (a) Incident-to-rule pipeline with a human gate — VIABLE, adopt first

This already happens manually. The git history is the proof:

| Incident | Rule it produced |
| -------- | ---------------- |
| `package-manager-versions` shipped in the baseline, Dependabot validator failed a consumer PR | `fix:` commit `41f2544`; rule text records it at `skills/rules/dependabot.md:21`; machine check added in `skills/.github/workflows/hygiene.yml:22-30` |
| Enabling `minimumReleaseAge` failed CI on four under-age lockfile entries on first run | `skills/rules/dependabot.md:72` ("Worked incident (2026-09)") |
| First CodeQL run on a private repo failed on GHAS entitlement | `skills/rules/github-supply-chain.md:36` |
| Secret scanner on mutable ref; pinned to SHA | `skills/rules/github-supply-chain.md:50` |
| Parallel self-hosted jobs raced `pnpm/action-setup` (`ENOENT chmod pnpm`) | `skills/rules/github-supply-chain.md:56`; consumer-side fix in Ecopick `cb2fe671` |
| `curl` from GitHub API inside SSH fails intermittently; `localhost` resolves to IPv6; `continue-on-error` hides failures | `skills/rules/github-vps-deploy.md:10-12`, `:35`, `:124-136` |
| PR merged without closing its issue (keyword not adjacent to reference) | `skills/rules/issues.md:45` (restosuite #35), rule at `:43-48` |
| Full-repo QA pass distilled into 5 rule modules | commits `b153364`, `d3250cb` |
| Consumer mirror: invalid ecosystem dropped, pnpm derived, trufflehog pinned | Ecopick `b4ed0cbd`, `3e5ad06d`, `cb2fe671` |

The emergent record format is the one-line incident stamp (`Worked incident (2026-09): ...`,
`Incident 2026-09: ...`), used in `dependabot.md:21,72`, `github-supply-chain.md:36,50,56,79`,
`hygiene.yml:22`. Systematizing (a) means formalizing this stamp plus the gate, not new machinery:

- The gate already exists in two places: `general.md:80` (ask the user before updating rules)
  and the audit report gate (`workflows/codebase-audit.md:42`, fix only after human approves).
- The consumer-side pattern done right: ADR notes the upstream rule follow-up at decision time,
  e.g. "Library baseline `libraries.md` chưa có row i18n — thêm row `i18n → next-intl` khi merge"
  (`Ecopick-Platform/docs/adr/0033-i18n-next-intl-shared-catalog-hybrid-routing.md:7`).
- Correction to the task brief: none of the three `docs/adr/0033*` files is a rule-change
  follow-up document. `0033-opencode-incident-agent.md` is a removed production-agent proposal;
  `0033-referral-fee-accrual.md:1-12` is a domain fee decision. The i18n ADR's line 7 is the
  closest thing to a rule-change follow-up done right, and it is one line, not a document.

Verdict: viable. Cheapest mechanism, proven by history, fits trunk-based flow.

## (b) Automated violation mining — VIABLE, adopt second

The sensors already exist and already emit rule-typed findings:

| Sensor | What it emits | Source |
| ------ | ------------- | ------ |
| Codebase audit, team-rule checklist | Findings under category `rule`: "a rule violated anywhere in the slice" | `skills/rules/audit.md:47-50`; merge table `workflows/codebase-audit.md:33-38`; every finding cites `file:line` (`:29`) |
| Code-review skill, Standards axis | Per-hunk violations citing the standard (file + rule); deliberately not merged with Spec findings | `~/.agents/skills/code-review/SKILL.md:60-64`, `:76`, `:82-86` |
| CI checks (consumer) | lint / typecheck / prisma / test / build gates; secret scan with pinned TruffleHog behind GHCR login | `Ecopick-Platform/.github/workflows/ci.yml:40-47`, `:76-99`, `:148-162` |
| CI checks (rules repo) | Config-baseline validator; router-URL reachability check | `skills/.github/workflows/hygiene.yml:1-11`, `:24-30`; `skills/.github/workflows/check-router-links.yml:17-23` |
| Triage skill | Verify-the-claim step (reproduce before acting) + redundancy/prior-rejection search — the right shape for a rule-proposal intake | `~/.agents/skills/triage/SKILL.md:70-76` |

What mining can and cannot do here:

- CAN: aggregate repeated `rule`-category audit findings and Standards-axis review findings into
  skills-repo issues (grouped per `rules/issues.md:15` — one issue per effort, not per finding;
  search-before-create at `:7-11`), then promote to rule edits through the (a) gate.
- CAN: turn a whole class of prose rules into machine checks, following the hygiene.yml precedent
  (the `package-manager-versions` incident became an allowlist validator, `hygiene.yml:23-30`).
  Candidates: `ponytail:` ledger harvest (`general.md:66` ships the grep), suppression-directive
  grep (`audit.md:24`, `linting.md:38-39`), identifier-length scan (`general.md:94` ships the grep).
- CANNOT: detect breaches of judgment rules (ladder, naming, STE100) without a human verdict —
  the audit workflow knows this, which is why fixes wait for report approval
  (`workflows/codebase-audit.md:42`) and the review skill marks smells as judgement calls
  (`code-review/SKILL.md:40-41`).
- The audit rhythm already prescribes the mining cadence: quarterly full audits, weekly
  changed-paths runs, one scorecard line per run in `AUDIT.md`
  (`workflows/codebase-audit.md:50-55`). The scorecard trend IS the violation time series —
  no new infrastructure needed to start mining.

Verdict: viable as a human-gated loop. The sensors exist; the missing piece is only the
promotion step (repeated finding → rule edit), which routes through (a).

## (c) Usage/staleness metrics — LIMITED, supporting role only

Honest accounting of what signal exists:

- AGAINST: OpenCode has no rule-usage telemetry. Skills load on demand through the `skill`
  tool (`https://opencode.ai/docs/skills/`), but that reports skill loads, not which rule line
  was followed, cited, or ignored. Plugin events (`session.idle`, `session.error`,
  `file.edited`, `tool.execute.before/after` at `https://opencode.ai/docs/plugins/`) observe
  tool calls and session lifecycle — none of them observes "rule R applied to decision D".
  Any citation-counting scheme would measure mention frequency, not compliance, and would need
  custom instrumentation with no first-party sink.
- FOR (proxies, all primary-sourced):
  - `AUDIT.md` scorecard trend per category (`workflows/codebase-audit.md:52-55`): a rule whose
    violations never appear in audits is either internalized or dead — the trend cannot tell
    which, but it can nominate staleness candidates for human review.
  - `ponytail:` ledger harvest (`general.md:66-68`): `no-trigger` markers are dated debt with
    upgrade conditions — countable, greppable, already prescribed pre-ship.
  - Router link checks (`check-router-links.yml:17-23`): dead modules surface mechanically.
  - Pruning is already governed: deprecate-with-pointer, delete only factually-wrong content
    (`AGENTS.md:29`), renames carry review dates (`AGENTS.md:30`).

Verdict: partially viable. Adopt the cheap proxies (scorecard trend + scheduled staleness review),
reject automated follow/cite/ignore scoring — the signal does not exist in any primary source,
and building it means instrumenting agents to self-report compliance, which is both gameable
and more machinery than the rule set's scale justifies.

## (d) Fully autonomous rule rewriting — NOT VIABLE, forbid for shared standards

Four independent grounds, each primary-sourced:

1. Blast radius with no review gate. The repo commits straight to `main` (`AGENTS.md:16`) and
   consumers fetch by URL with a 5-second timeout (OpenCode rules docs). A bad autonomous edit
   propagates to every consumer on next fetch; factually-wrong content "fails loudly at
   consumers" (`AGENTS.md:29`). There is no PR workflow to catch it — autonomy plus trunk-based
   equals unreviewed blast radius.
2. Rename/stability economics. Module URLs sit in consumers' `instructions`; a rename already
   ships three parts same-day plus consumer updates (`AGENTS.md:30`). An autonomous rewriter
   optimizing for clarity would rename freely and bill humans for the migration each time.
3. The rules' own gate forbids it. `general.md:80` requires asking the user before updating
   rules; the audit workflow requires report approval before any fix (`codebase-audit.md:42`).
   Autonomy would violate the standards it rewrites — a self-contradicting mechanism.
4. Production precedent in-repo: detection and analysis may automate, remediation stays human.
   The incident-agent ADR keeps the agent as analysis-only after the alert, rejects proactive
   inspection as duplicate detection, and rejects remediation for attack-surface reasons
   (`0033-opencode-incident-agent.md:8,28-29`). Rule edits are remediation of the standards
   themselves — same logic applies one level up.

OpenCode's plugin system could technically implement it (`file.edited`, `session.compacted`,
`experimental.session.compacting` hooks at `https://opencode.ai/docs/plugins/`, plus agent
`permission` scoping at `https://opencode.ai/docs/agents/`), which is exactly why the
prohibition should be explicit rather than assumed: capability exists, license must not.

Verdict: not viable for the shared set. A single-repo experiment (draft-only, human commits)
is the most autonomy that should ever touch rule text.

## Recommendation

Adopt (a) first, (b) second, (c) as cheap proxies, forbid (d). Ordered, minimal changes:

### 1. Formalize the incident stamp + gate — `skills` repo (do first)

- `AGENTS.md`, "Rule lifecycle" section: add the incident-to-rule checklist —
  (i) every new/changed rule carries a one-line `Worked incident (YYYY-MM): <symptom> → <fix>`
  stamp (the format already used at `rules/dependabot.md:21,72`,
  `rules/github-supply-chain.md:36,50,56,79`); (ii) config changes ride the same commit
  (already required at `AGENTS.md:31`); (iii) human approves before commit (already required
  by `rules/general.md:80`, restated for the repo owner's own sessions).
- `Ecopick-Platform/AGENTS.md:9-13` deltas: add one line — session incidents that reveal a
  missing/wrong team rule get recorded as an ADR one-liner naming the upstream follow-up,
  following `docs/adr/0033-i18n-next-intl-shared-catalog-hybrid-routing.md:7`.

### 2. Close the mining loop — both repos (do second)

- `skills/workflows/codebase-audit.md`, after §4 (report gate at `:42`): add the promotion
  step — repeated category-`rule` findings across runs (read off the `AUDIT.md` scorecard trend,
  `:52-55`) become one grouped skills-repo issue (`rules/issues.md:15`), and the issue's
  resolution is a rule edit through mechanism 1.
- Convert the greppable rules into checks following the `hygiene.yml:23-30` pattern before any
  new sensor is built: `ponytail:` no-trigger harvest (`general.md:66-68`), suppression grep
  (`rules/audit.md:24`), identifier scan (`general.md:94`).
- Opt-in experiment only: `.opencode/plugins/rule-capture.ts` (new file; no `.opencode/`
  exists in either repo) on `session.idle`/`session.error` (events at
  `https://opencode.ai/docs/plugins/`) drafting an incident note for human review — draft only,
  never commit; Ecopick side first, skills repo never auto-touched.

### 3. Staleness review without fake metrics (cheap part of (c))

- New `skills/.github/workflows/rule-review.yml`: quarterly scheduled run (mirror the Monday
  cron style of `hygiene.yml:10` / `check-router-links.yml:10`) that opens a review issue listing
  modules untouched for N months plus the `AUDIT.md` trend — human decides prune/rewrite/keep.
  Advisory only; lifecycle rules (`AGENTS.md:28-30`) still govern the outcome.

### Explicit limits (what must stay human)

- No autonomous pushes to the skills repo `main` — ever. Rule edits are human-committed
  (consistent with `AGENTS.md:16` trunk-based + `general.md:80` ask-first).
- No autonomous renames, splits, or deletions of modules (consumer-migration cost,
  `AGENTS.md:28-30`).
- No compliance scoring from mention frequency (no supporting signal in any primary source).
- Agents may draft rule text and incident stamps; the human gate in (a) is the only path to `main`.

## Sources consulted

- `skills/AGENTS.md` (31 lines), `skills/CONTEXT.md` (76 lines)
- `skills/rules/dependabot.md` (72), `skills/rules/github-supply-chain.md` (79),
  `skills/rules/github-vps-deploy.md` (161), `skills/rules/general.md` (122, rule 10 + ladder/ledger),
  `skills/rules/linting.md` (53), `skills/rules/audit.md` (59), `skills/rules/issues.md` (168),
  `skills/rules/github-pr-automation.md` (1-60)
- `skills/workflows/codebase-audit.md` (55), `skills/.github/workflows/hygiene.yml` (31),
  `skills/.github/workflows/check-router-links.yml` (24)
- `skills` git log (incident→rule commits `41f2544`, `6b63431`, `3058ecc`, `75c4deb`, `3ac4b98`, `b153364`, `d3250cb`)
- `Ecopick-Platform/AGENTS.md` (13), `Ecopick-Platform/.github/workflows/ci.yml` (238),
  `Ecopick-Platform/docs/adr/0033-opencode-incident-agent.md` (44),
  `0033-i18n-next-intl-shared-catalog-hybrid-routing.md` (1-15),
  `0033-referral-fee-accrual.md` (1-15); Ecopick git log (`b4ed0cbd`, `3e5ad06d`, `cb2fe671`)
- `~/.agents/skills/code-review/SKILL.md` (87), `~/.agents/skills/triage/SKILL.md` (112)
- OpenCode docs (WebFetch 2026-09-04, `https://opencode.ai/docs/rules/`,
  `/agents/`, `/skills/`, `/plugins/`, `/config/`; note `https://opencode.ai/docs/hooks/`
  returns 404 — hooks live under `/plugins/` events, and agent scoping under `/agents/` permissions)
- Convention model: `skills/docs/retro-github-workflows-research.md` (127 lines)
- Deliberately not cited: GitHub REST API (no endpoint-level claim is made; mining is framed on
  the in-repo `gh` CLI at `rules/issues.md:7-11,21-25,36-38` and `github-script` at
  `rules/issues.md:56-83`, `rules/github-pr-automation.md:18-44`)
