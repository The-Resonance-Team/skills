---
name: qa
description: Full UI/UX QA pass over a web product's frontends — bring up the stack with seeded data, screenshot every route at 3 device widths, vision-audit the PNGs with parallel review agents, fix presentational findings, and report a triaged list. Use when asked to QA the UI, run a screenshot sweep, audit responsive/UX issues across apps, or re-verify UI fixes with screenshots.
---

# QA Sweep Workflow

Screenshot every route of every frontend at desktop/tablet/mobile, vision-audit the captures with parallel review agents, fix presentational findings under the standards in `rules/qa.md`:

```
https://raw.githubusercontent.com/The-Resonance-Team/skills/main/rules/qa.md
```

Then report a triaged remaining-issues list. The reference run (VibeHost, 2026-10-25: 375 shots, ~35 findings, 2 fix rounds) shapes every step below.

## Process

### 1. Recon → target list

Read the newest prior QA report (per-project QA notes or report doc) and `git log --oneline --since=<last QA date>` — every touched app or route gets extra audit attention. Read the sweep harness's `--help` before running it; the harness owns route lists, device profiles, seeded identities, and auth. **Completion criterion:** a written target list of apps, their ports, and the changed-since-last-pass routes.

### 2. Stack up with seeded data

Bring up the persistence layer, apply migrations, run the seed, start the dev servers **tee'd to a log file** — runtime errors are invisible in page status codes (a Next.js error boundary answers 200), and the log is how a server-side 500 hiding behind a rendered error page was found. **Completion criterion:** every app answers on its health endpoint.

Gotchas proven by incidents:

- Run the seed with the app's own env exported — a bare `bun run` may fall back to a different database port and seed nothing (or the wrong DB).
- A dev-server watch that recompiles can fail to rebind its port while the stale process keeps serving the OLD build — kill the listener before investigating 404s from new endpoints.
- Bundler persistent-cache panics (stale-task or chunk-group errors) are cured by deleting that app's build cache and restarting, not by code changes.
- Admin-style auth guards: if every privileged endpoint 403s for the seeded super-admin, the seed lost its identity-link rows — re-run the seed; never paper over with hand-minted tokens.

### 3. Sweep (3 devices × every route)

Archive the previous screenshot trees (before/after is half the audit's value), then run the harness **per app in parallel** — a serial sweep of ~400 routes takes ~40 min, parallel takes ~15. **Completion criterion:** manifests show every route shot with only expected status codes and zero failures.

**Manifest triage before any PNG is read**: statuses (5xx = infra), console errors per shot (a broken seed surfaces as 403s on every privileged call; empty-`src` images log per-row warnings; handled conflicts are noise), and final URLs (unexpected redirects mean the route list went stale). Fix infra before auditing — a sweep over a half-broken stack wastes the whole pass.

### 4. Vision audit (parallel review agents)

Fan out read-only review agents over app sections — **at most 2 concurrently** (the environment's concurrency limit; a third bounces), each reading ≤ ~90 PNGs plus its manifest slice. The dispatch prompt carries: the design-system context, audit criteria (overflow/clipping at mobile, tab/scroll affordance, empty/error states, spacing/contrast, locale bugs), the expected states NOT to flag (404 variants, banned-identity errors, seeded placeholder data), and the **downscale rule**: full-page PNGs are downscaled during review — a copy claim from unreadable pixels is filed as low-confidence, never asserted. Name the previously retracted misreads so agents do not rediscover them. **Completion criterion:** every route reviewed; every finding cites the PNG and either names a source location or is marked low-confidence.

### 5. Verify → classify

Re-verify each agent finding in the DOM or source before fixing (three of one run's findings were pixel misreads; ground truth is the DOM). Classify: **small** = presentational (fix under `rules/qa.md` without asking); **big** = layout restructure, new components, nav/IA, API behavior (present to the owner with evidence — never fixed silently). **Completion criterion:** a tagged findings list.

### 6. Fix loop

Fix smalls; keep both lint and typecheck green (new user-facing copy needs every locale's catalog or the i18n key check fails); reshoot the affected routes and read the PNG — a fix is done when the screenshot shows it. **Completion criterion:** gates green + reshoots confirm each fix.

### 7. Report

Update the project's QA report: fixed items, verified-not-bugs (retracted misreads, so they are not rediscovered), and a triaged remaining list — backend slices / polish batch / needs-DOM-check / environment. Big items go to the owner as a decision list; hand off the remainder if the session ends mid-list. **Completion criterion:** the report names every open item with its triage bucket.

## Suggested skills

Invoke these through the Skill tool at the phase named; availability varies by consumer, so treat a missing skill as a pointer to the technique, not a blocker.

| Phase | Skill | Why |
| ----- | ----- | ----- |
| 2 (stack up) | `diagnosing-bugs` | The rebind/cache/403 traps are misdiagnosis magnets — structured root-cause before touching anything. |
| 2–3 (sweep) | `webapp-testing` | Playwright harness patterns: server lifecycle, networkidle waits, element discovery when a route needs DOM inspection. |
| 5 (verify → classify) | `diagnosing-bugs` | The DOM checks behind low-confidence findings are runtime inspections, not pixel reads. |
| 6 (fix loop) | `building-components` | Component standards for the fixes: accessibility, composition, state, styling under the project's design system. |
| 7 (report) | `triage` | File backend-slice findings as issues with the repo's label workflow instead of leaving them in the report. |
| 7 (report) | `handoff` | Hand the remaining list to a fresh session with environment state when the pass ends mid-list. |
| after | `retro` | Fold new incidents back into this workflow and `rules/qa.md` so the next pass starts smarter. |
