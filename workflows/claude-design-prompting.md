---
name: claude-design-prompting
description: >-
  Interview the user to discover UI/UX design demand, generate multi-surface
  Claude Design prompts that balance creative freedom with production copy,
  responsive, and CRUD guardrails, audit .dc.html exports, and generate in-place
  patch prompts. Use when writing prompts for Claude Design or AI UI generators,
  grilling the user on app/portal features before design, or auditing a .dc.html
  archive for production readiness.
---

# Claude Design Prompting & Production Audit Workflow

Turn product and domain requirements into a multi-surface prompt suite for Claude Design (`.dc.html`), give Claude Design maximum creative room to propose strong UX and visual patterns while locking down production copy, responsive reachability, and CRUD/state completeness, and audit `.dc.html` exports before handing off to `workflows/claude-design-to-nextjs.md`.

## Process

### 1. Recon domain & codebase

Inspect the repository before asking the user any questions:
- Read `DESIGN.md`, `GLOSSARY-MAP.md`, tier `GLOSSARY.md` files (`rules/frontend.md` #21, `rules/i18n.md` #8), `schema.prisma`, `docs/research/*`, and existing route/theme files (`globals.css`).
- Note every conflict between the user's request, `DESIGN.md`, the glossaries, and the schema (e.g. overloaded role names, `Dashboard` vs `Role Portal`, deprecated fee/status enums in `schema.prisma` vs settled domain rules in `GLOSSARY.md`).
- **Completion criterion**: every surface, role, status enum, and glossary-vs-schema conflict is inventoried; zero look-up-able questions remain.

### 2. Grill the design tree in rounds

Interview the user along the frontier (`❓ **Q1** - **<Title>**: ... ➡️ **Recommendation**: ...`), updating `GLOSSARY.md` (pure domain glossary) and `DESIGN.md` (aesthetic tokens, responsive rules, component naming, and the User-Facing Copy **Term table**) inline as decisions settle:

1. **Round 1 — Surface topology & ubiquitous language**:
   - Align surface and role names with `GLOSSARY.md` (e.g. `Public Landing Page`, `Auth Surface`, and one surface per role). Prefer natural consumer labels (`Trang Phụ huynh`, `Góc Học tập`, `Trang Gia sư`) over architectural nouns (`Cổng / Portal`, `Dashboard`).
   - Settle multi-actor account relationships (e.g. how a paying `Client` Parent links to or provisions a `Student` Learner login).
   - Settle external UX reference benchmarks (e.g. Duolingo, Airbnb, Wise, Stripe, or `frappe/lms` as UX/curriculum benchmarks rather than runtime dependencies).
   - Confirm prompt partitioning: **1 dedicated prompt per surface**, where Prompt 1 establishes `design/tokens.css` in the `design/` folder and Prompts 2..N inherit `design/tokens.css`.
   - Confirm stripping backend-only mechanics (webhooks, HMAC, cron internals, payment gateway brand names, internal SLA timers) from user-facing UI.
2. **Round 2 — Authority boundaries, commercial visibility & mutability (`U/D`)**:
   - Define cross-portal creation vs editing boundaries (e.g. Admin schedules `LMS Batch` cohorts; assigned Tutors co-author `LMS Course` chapters, lessons, and quizzes).
   - Define role-specific pricing visibility (e.g. `0₫` service fee on the Client invoice vs Gross Tuition − Platform Fee = Net Payout on the Tutor side).
   - Ask the **Mutability & Cancellation question**: which records can users **Update (`U`)** or **Cancel / Withdraw / Delete (`D`)** self-service vs after verification/approval (e.g. editing a `VERIFIED` Tutor profile, requesting a rank upgrade, editing or cancelling a `PENDING_REVIEW`/`PUBLISHED` class request, withdrawing a `PENDING` application, replacing a submitted homework file before grading).
3. **Round 3 — Copy tone, responsive targets, token freedom & delivery**:
   - Confirm whether Prompt 1 has full creative freedom to invent the visual identity (`design/tokens.css`) or must use existing CSS variables.
   - Confirm target UI copy language (`Tiếng Việt` consumer-grade copy, zero operator jargon, zero unverified marketing claims like `98% match`) and keep all statutory/legal disclaimers out of UI chrome (dedicated `/terms` and `/privacy` routes own legal copy per `rules/i18n.md` #11).
   - Confirm saving the prompt suite to `docs/drafts/claude-design-prompts.md` in addition to the chat response.
- **Completion criterion**: the design tree frontier is empty, the user confirms shared understanding, and `GLOSSARY.md` reflects every settled term.

### 3. Generate multi-surface prompts (Creative Freedom + Production Guardrails)

Write one self-contained markdown prompt per surface in `docs/drafts/claude-design-prompts.md`. Balance **creative latitude** (letting Claude Design's design priors shine) with **non-negotiable production guardrails**:

- **Prompt 1 (`Public Landing Page` & Discovery)**: grant Claude Design full creative freedom to propose the information architecture, visual aesthetic, typography, color palette, and `design/tokens.css` in the workspace `design` folder.
- **Prompts 2..N (`Auth Surface` & `Role Surfaces`)**: instruct Claude Design at the top of each prompt to inspect `design/tokens.css` and existing `.dc.html` files in the workspace first and reuse the exact tokens, breakpoint scale, and component language.
- **Outcome framing, zero layout micro-management**:
  - State **User Goal + Displayed/Input Data + State Transitions + Business/Privacy Rules + High-Friction UX Moments**.
  - Leave geometry, spatial composition, and component structure open to Claude Design (invite Claude Design to propose the best layout, progressive disclosure, and conversion patterns for flows like keeping live tuition estimates visible on mobile during a multi-step class request, saving/scanning a bank QR code on the same phone, introducing quiz rules in a pre-start lobby before the timer ticks, or surfacing 1-tap Call/Zalo actions on urgent 2-hour contact cards) rather than prescribing fixed column counts or sidebar widths.
- **Embed the 4 Production Guardrails in every prompt**:
  1. **Consumer-Grade Copy & Zero-Jargon Guardrail (`rules/i18n.md` #7–#11)**:
     - Write outcome-first copy in the end user's everyday language (`Trang Phụ huynh`, `Góc Học tập`, `Chuyển thu nhập`, `Đã nhận`, `Gợi ý phù hợp`, `Phản hồi trong 2 giờ`, `Tổng quan`, `Xác thực`, `Hồ sơ`, `Chuỗi ngày học`).
     - Strip internal operator codes (`SLA 2h`, `24h dispute window`, `SOP`), payment provider mechanics (`qua SePay VietQR`, `webhook`), B2B accounting jargon on personal earnings (`Giải ngân`, `Đối soát`), architectural nouns (`Cổng / Portal`), unsubstantiated percentages (`98% phù hợp`), and raw English UI loanwords (`Dashboard`, `Verify`, `Profile`, `Streak`, `Badge`).
  2. **Prototype Control Isolation Guardrail (100% Clean Product Surface)**:
     - House all prototype state, persona, time-travel, and error-simulation switchers inside a single floating, collapsible **Prototype Toolbar** (`data-prototype-toolbar` at bottom-right) or `data-props` controls so the product canvas renders 100% production-authentic UI (keep demo quick-fill bars, OTP hint banners, `"Simulate >5m late"` switches, and `"Test >20MB file"` buttons out of product headers, cards, forms, and modals).
  3. **Multi-Viewport & Responsive Reachability Guardrail (`375px` · `768px` · `1280px+`)**:
     - Define one shared breakpoint scale in `design/tokens.css` (`640px`, `768px`, `1024px`, `1280px`) inherited by every surface.
     - Guarantee **100% navigation reachability at `375px` (Mobile) and `768px` (Tablet)**: when desktop navigation collapses below `1024px`, keep every primary and secondary route reachable (letting Claude Design choose the best mobile pattern: bottom tab bar + `"More"` sheet, slide-over drawer, or compact rail).
     - Require **responsive adaptation for dense views**: ask Claude Design to design clean `375px–768px` adaptations for multi-column master-detail workspaces, `7×3` weekly availability grids, multi-item comparison tables, and pricing tables (such as list-to-drawer drilldowns, sticky-first-column horizontal scroll with `>= 44×44px` touch targets, or stacked cards) with zero horizontal page overflow, and mobile modals/forms that keep primary CTAs visible above the virtual keyboard (such as bottom sheets with sticky footers).
  4. **Scannability & Typography Floor Guardrail**:
     - Keep summary/catalog cards scannable (**≤ 4 high-signal data points** in the default card view, with secondary tags and credentials disclosed in the detail view/drawer).
     - Set a **minimum `12px–14px` font size** for instructional, policy, and helper copy (reserving `10px–11px` strictly for compact uppercase eyebrow labels or badge counters).
- **Embed the 6-Point Production CRUD & State Completeness Contract**:
  1. **Full Entity CRUD (`C / R / U / D`)**: every user-created entity (child profile, class request, seat reservation, tutor application, homework file/text submission, discussion post/reply, LMS course/chapter/lesson/quiz option text, class announcement, bank account, withdrawal request) must include **Update (`U`)** and **Delete / Cancel / Withdraw / Archive (`D`)** flows.
  2. **Post-Approval Editability**: verified or submitted states must not lock users into dead-end read-only views—include an edit mode for `VERIFIED` profiles (plus credential/rank upgrade requests) and file replacement for `submitted` assignments before grading.
  3. **Complete Lifecycle Enum Coverage**: include interactive states/tabs for every lifecycle enum value (`DRAFT`, `PENDING_REVIEW`, `PUBLISHED`, `ASSIGNED`, `ACTIVE`, `FAILED_MATCH`, `COMPLETED`, `CANCELLED`; `PENDING`, `PAID`, `EXPIRED`, `CANCELLED`, `REFUNDED`). In Admin, include `ACTIVE` and `CLOSED/CANCELLED` tabs, a `Reject / Cancel` action on pending requests, and a `+ Create` flow for phone/offline leads.
  4. **Authenticated vs Guest States on Public Surfaces**: shared headers (`SiteHeader.dc.html`) and public booking/apply modals must include a state toggle (in the Prototype Toolbar) for `guest` vs signed-in roles (`client`, `student`, `tutor`, `admin`) and Tutor verification states (`UNVERIFIED`, `PENDING`, `REJECTED`, `VERIFIED`).
  5. **Auth Negative & Multi-Profile States**: include invalid password/PIN error states, Parent-locked child account screens, expired OTP states, and an active-session profile switcher for shared family devices.
  6. **Self-Service Account Settings & Admin User Directory**: include an Account & Profile Settings view (personal info, password/PIN, saved addresses, notification preferences) in every portal, and a unified `Users` directory (search, link/unlink Parent–Student, suspend/unlock) in the Admin Portal.
- **Completion criterion**: all surface prompts are written to `docs/drafts/claude-design-prompts.md` and presented to the user, satisfying all 4 Production Guardrails and all 6 CRUD Completeness points while preserving layout freedom for Claude Design.

### 4. Audit `.dc.html` archive & generate in-place patch prompts

When inspecting a `.zip` export from Claude Design (or generating follow-up patch prompts for an existing archive/codebase):
1. **Extract once into sandbox**: if the `.zip` path sits outside the workspace (e.g. `~/Downloads/*.zip`), copy it to `/tmp/` or `<appDataDir>/brain/<id>/scratch/design/` in one step and `unzip -o` inside the sandbox.
2. **One-command `x-dc` structure scan first**: Claude Design `.dc.html` files store markup in `<x-dc>`, screen/modal names in `data-screen-label`, component props in `<script type="text/x-dc" data-dc-script data-props="...">`, shared imports in `<dc-import>`, and conditionals in `<sc-if>` / `<sc-for>`. Never read multi-thousand-line `.dc.html` files chunk-by-chunk first. Run one index command across the extracted folder:
   ```bash
   rg -n 'data-screen-label=|data-props=|<dc-import|state\s*=|const\s+(NAV|TABS|ST|SEED|RANK)' *.dc.html data.js
   ```
3. **Audit across 3 Production Axes**:
   - **Axis A — Master CRUD & Lifecycle Matrix**: verify `Create (C)`, `Read (R)`, `Update (U)`, and `Delete / Cancel / Archive (D)` plus the 6-Point Completeness Contract across every domain entity.
   - **Axis B — Copy, Prototype Isolation & UX Flow Quality**: scan for leaked internal jargon (`SLA`, `Portal/Cổng`, gateway brand mechanics, `Giải ngân/Đối soát`, unverified `%` claims, English UI loanwords), inline prototype controls mixed into product chrome, badge-overloaded cards (`> 4` badges), sub-`12px` instructional text, and high-friction task gaps.
   - **Axis C — Responsive & Breakpoint Parity (`375px` · `768px` · `1280px`)**: inspect `@media` rules and grid templates (`grid-template-columns`) across all surfaces to catch breakpoint drift, missing mobile/tablet navigation bars, truncated mobile nav items, uncollapsed multi-column split panes, and unscrollable `7×3` schedule or comparison grids.
4. **Write archive-grounded patch prompts**: group fixes into clear, copy-pasteable prompts (e.g. Copy Changelog Prompt, UI/UX & Flow Refinement Prompt, Responsive & Mobile/Tablet Breakpoint Prompt, or per-`.dc.html` CRUD Patch Prompts) in `docs/drafts/claude-design-patch-prompts.md`. Every prompt must explicitly cite:
   - Target `.dc.html` filenames (or app component names) and shared `<dc-import>` components (`SiteHeader.dc.html`, `SiteFooter.dc.html`, `TutorCard.dc.html`).
   - Exact `data-screen-label` section names, `data-props` enum values (`startView`, `demoState`, `verif`, `rank`, `moment`), and modal/drawer state keys (`m.*`, `has*`).
   - Existing `design/tokens.css` variables (`--am-*`), `data.js` seed ID prefixes (`MS-XXXX` vs `YC-XXXX`), rank keys (`sv`/`gv`), and validation regexes so Claude Design edits in place without inventing conflicting state or tokens.
- **Completion criterion**: `rg` structural index completed before reading `.dc.html` bodies, 3-axis audit (CRUD, Copy/UX, Responsive) delivered, and archive-grounded patch prompts written with exact `.dc.html`, `data-screen-label`, `data-props`, and `design/tokens.css` references.
