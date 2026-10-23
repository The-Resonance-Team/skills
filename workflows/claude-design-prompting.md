---
name: claude-design-prompting
description: >-
  Interview the user to discover UI/UX design demand, generate multi-surface
  Claude Design prompts without layout prescription, audit .dc.html exports for
  production CRUD and state completeness, and generate in-place patch prompts.
  Use when writing prompts for Claude Design or AI UI generators, grilling the
  user on app/portal features before design, or auditing a .dc.html archive for
  production readiness.
---

# Claude Design Prompting & Production CRUD Audit Workflow

Turn product and domain requirements into a multi-surface prompt suite for Claude Design (`.dc.html`), audit the resulting design archive for production completeness, and close any CRUD or state gaps before handing off to `workflows/claude-design-to-nextjs.md`.

## Process

### 1. Recon domain & codebase

Inspect the repository before asking the user any questions:
- Read `GLOSSARY-MAP.md`, tier `GLOSSARY.md` files (`rules/i18n.md` #8), `schema.prisma`, `docs/research/*`, and existing route/theme files (`globals.css`).
- Note every conflict between the user's request, the glossaries, and the schema (e.g. overloaded role names, `Dashboard` vs `Role Portal`, deprecated fee/status enums in `schema.prisma` vs settled domain rules in `GLOSSARY.md`).
- **Completion criterion**: every surface, role, status enum, and glossary-vs-schema conflict is inventoried; zero look-up-able questions remain.

### 2. Grill the design tree in rounds

Interview the user along the frontier (`❓ **Q1** - **<Title>**: ... ➡️ **Recommendation**: ...`), updating `GLOSSARY.md` and its **Term table** (internal term → VI → EN) inline as decisions settle:

1. **Round 1 — Surface topology & ubiquitous language**:
   - Align surface and role names with `GLOSSARY.md` (e.g. `Public Landing Page`, `Auth Surface`, and one `Role Portal` per role).
   - Settle multi-actor account relationships (e.g. how a paying `Client` Parent links to or provisions a `Student` Learner login).
   - Settle external UX reference benchmarks (e.g. `frappe/lms` as a curriculum/cohort feature reference rather than a runtime service).
   - Confirm prompt partitioning: **1 dedicated prompt per surface**, where Prompt 1 establishes `design/tokens.css` in the `design/` folder and Prompts 2..N inherit `design/tokens.css`.
   - Confirm stripping backend-only mechanics (webhooks, HMAC, cron internals) that do not appear on the UI.
2. **Round 2 — Authority boundaries, commercial visibility & mutability (`U/D`)**:
   - Define cross-portal creation vs editing boundaries (e.g. Admin schedules `LMS Batch` cohorts; assigned Tutors co-author `LMS Course` chapters, lessons, and quizzes).
   - Define role-specific pricing visibility (e.g. `0₫` service fee on the Client invoice vs Gross Tuition − Platform Fee = Net Payout on the Tutor side).
   - Ask the **Mutability & Cancellation question**: which records can users **Update (`U`)** or **Cancel / Withdraw / Delete (`D`)** self-service vs after verification/approval (e.g. editing a `VERIFIED` Tutor profile, requesting a rank upgrade, editing or cancelling a `PENDING_REVIEW`/`PUBLISHED` class request, withdrawing a `PENDING` application, replacing a submitted homework file before grading).
3. **Round 3 — Copy, token freedom & delivery**:
   - Confirm whether Prompt 1 has full creative freedom to invent the visual identity (`design/tokens.css`) or must use existing CSS variables.
   - Confirm target UI copy language (`Tiếng Việt` marketing and product copy) and keep all statutory/legal disclaimers out of UI chrome (dedicated `/terms` and `/privacy` routes own legal copy per `rules/i18n.md` #11).
   - Confirm saving the prompt suite to `docs/drafts/claude-design-prompts.md` in addition to the chat response.
- **Completion criterion**: the design tree frontier is empty, the user confirms shared understanding, and `GLOSSARY.md` reflects every settled term.

### 3. Generate multi-surface prompts (Goal + Data + State + CRUD contract)

Write one self-contained markdown prompt per surface in `docs/drafts/claude-design-prompts.md`:
- **Prompt 1 (`Public Landing Page` & Discovery)**: grant Claude Design full creative freedom to propose the information architecture, visual aesthetic, typography, color palette, and `design/tokens.css` in the workspace `design` folder.
- **Prompts 2..N (`Auth Surface` & `Role Portals`)**: instruct Claude Design at the top of each prompt to inspect `design/tokens.css` and existing `.dc.html` files in the workspace first and reuse the exact tokens and component language.
- **Outcome framing, zero layout prescription**: specify **User Goal + Displayed/Input Data + State Transitions + Privacy/Business Rules**. State what the user accomplishes and sees; let Claude Design invent the layout, navigation, and component patterns (avoid prescribing "3-column grid", "left sidebar", or "4-step modal").
- **Embed the 6-Point Production CRUD & State Completeness Contract** in the prompts so the first pass does not stop at happy-path `Create` + `Read` prototypes:
  1. **Full Entity CRUD (`C / R / U / D`)**: every user-created entity (child profile, class request, seat reservation, tutor application, homework file/text submission, discussion post/reply, LMS course/chapter/lesson/quiz option text, class announcement, bank account, withdrawal request) must include **Update (`U`)** and **Delete / Cancel / Withdraw / Archive (`D`)** flows.
  2. **Post-Approval Editability**: verified or submitted states must not lock users into dead-end read-only views—include an edit mode for `VERIFIED` profiles (plus credential/rank upgrade requests) and file replacement for `submitted` assignments before grading.
  3. **Complete Lifecycle Enum Coverage**: include interactive states/tabs for every lifecycle enum value (`DRAFT`, `PENDING_REVIEW`, `PUBLISHED`, `ASSIGNED`, `ACTIVE`, `FAILED_MATCH`, `COMPLETED`, `CANCELLED`; `PENDING`, `PAID`, `EXPIRED`, `CANCELLED`, `REFUNDED`). In Admin, include `ACTIVE` and `CLOSED/CANCELLED` tabs, a `Reject / Cancel` action on pending requests, and a `+ Create` flow for phone/offline leads.
  4. **Authenticated vs Guest States on Public Surfaces**: shared headers (`SiteHeader.dc.html`) and public booking/apply modals must include a state toggle for `guest` vs signed-in roles (`client`, `student`, `tutor`, `admin`) and Tutor verification states (`UNVERIFIED`, `PENDING`, `REJECTED`, `VERIFIED`).
  5. **Auth Negative & Multi-Profile States**: include invalid password/PIN error states, Parent-locked child account screens, expired OTP states, and an active-session profile switcher for shared family devices.
  6. **Self-Service Account Settings & Admin User Directory**: include an Account & Profile Settings view (personal info, password/PIN, saved addresses, notification preferences) in every portal, and a unified `Users` directory (search, link/unlink Parent–Student, suspend/unlock) in the Admin Portal.
- **Completion criterion**: all surface prompts are written to `docs/drafts/claude-design-prompts.md` and presented to the user, satisfying all 6 completeness points with zero layout prescription and zero legal boilerplate.

### 4. Audit `.dc.html` archive & generate in-place patch prompts

When inspecting a `.zip` export from Claude Design:
1. **Extract once**: unzip the archive directly into `<appDataDir>/brain/<id>/scratch/design/` (or workspace `.tmp-design/`).
2. **Scripted structure scan first**: before reading multi-thousand-line `.dc.html` files in chunks, run a single `rg` / script pass across `*.dc.html` and `*.js` to list `<template` prop definitions, view IDs (`v*`), modal/drawer flags (`has*`, `m*`), and status arrays.
3. **Build the Master CRUD Matrix**: audit every domain entity across `Create (C)`, `Read (R)`, `Update (U)`, and `Delete / Cancel / Archive (D)` plus the 6-Point Completeness Contract above.
4. **Write page-by-page patch prompts**: if any `U`/`D` flow or lifecycle state is missing, write one self-contained prompt per `.dc.html` file in `docs/drafts/claude-design-patch-prompts.md`. Reference the exact existing `.dc.html` filename, view keys (`vOverview`, `vClasses`, `vProf`), prop names, and `design/tokens.css` so Claude Design completes each page in place without regressing existing views.
- **Completion criterion**: full CRUD audit table delivered, page-by-page patch prompts written to `docs/drafts/claude-design-patch-prompts.md` (when gaps exist), and verified ready for `workflows/claude-design-to-nextjs.md`.
