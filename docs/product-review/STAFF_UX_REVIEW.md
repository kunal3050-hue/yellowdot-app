# KUE BOXS Care — Staff Experience Product Review

**Date:** 2026-07-30
**Method:** Live walkthrough in a real browser session, signed in as each role in turn, against the seeded emulator (18 students, realistic attendance/pickup/incident/invoice data, all six staff roles). Not a code read — every finding below was observed on screen or confirmed by clicking through, and where a finding could have two explanations (real bug vs. seed-data gap), that was checked before it's stated as fact.
**Scope:** Usability and operational efficiency only, per the brief. Nothing here proposes an architecture change — every recommendation is achievable by editing content, wiring, or copy in the existing system.
**Roles reviewed:** Teacher, Reception, Accountant, Principal (`admin`), Centre Owner, Super Admin.

---

## How to read this document

Findings are numbered **X1, X2, …** within each section so they can be referenced individually (e.g. in a ticket). Severity is plain language:
- 🔴 **Breaks or misleads** — a user cannot complete a task, or the app tells them something false
- 🟠 **Costs real time or trust, every day** — works, but wastes taps or creates doubt
- 🟡 **Polish** — noticeable, worth fixing, not urgent

---

## Executive summary — the five findings that matter most

1. **🔴 Two invoice systems, same label, contradictory numbers, both live.** The sidebar's "Finance → Invoices" (Finance Platform) shows **0 invoices**. The Control Center grid's "Invoices" card, one click away on the same landing page, shows **14 invoices, ₹73,250 outstanding** — the real, correct number, matching Dashboard and Care. An accountant using the nav item the product actually promotes (the sidebar) sees an empty, seemingly broken Finance module, while their real financial data sits in a screen the sidebar no longer even links to. See **F1**.
2. **🔴 The Control Center — the page every single role lands on after login — shows fabricated numbers as if they were real.** "Staff Present — sample · not tracked yet" and "Admissions — 3 · sample · this week" sit in the same KPI row as real numbers, with no visual distinction. See **C1**.
3. **🔴 The same KPI row shows financial data to roles with no financial capability.** Teacher and Reception — neither can see a single invoice anywhere else in the app — see "Outstanding Fees ₹73,250" on their landing page. See **C2**.
4. **🟠 A Teacher's single most frequent task — marking attendance — has no sidebar entry, and the page it does live on drops the entire app shell**, replacing "KUE BOXS Care" branding with "Yellow Dot" and removing all navigation except a single home icon. See **T1, C4**.
5. **🟠 Centre Owner and Principal are the same role wearing different name tags.** Identical sidebar, identical Dashboard, identical Care. A business owner and an academic principal have different jobs; nothing here reflects that. See **P1**.

---

## Cross-cutting findings — apply to every role

These were each confirmed on at least two roles; several were confirmed on all six. They're listed once here rather than repeated in every role section.

### C1 — 🔴 Fabricated data shown as real, on the first screen everyone sees

The Control Center's "Today's Overview" row (`/quick-navigation`, the page `RootRedirect` sends every non-parent role to) shows six KPIs. Two are placeholders wearing the same visual weight as the real four:

```
STAFF PRESENT          —        sample · not tracked yet
ADMISSIONS              3       sample · this week
```

The word "sample" is the only signal these aren't real, and it's printed in the same small grey caption style as legitimate context text ("checked in today", "awaiting collection") on the real KPIs next to them. A principal glancing at this each morning has no reason to notice the difference. **Either wire these to real data or remove them** — a KPI that admits it isn't tracked yet is actively worse than no KPI, because it looks like the app is lying, and every other number on the same row loses a little credibility by association.

### C2 — 🔴 Financial data shown to roles with no financial capability

The same KPI row shows `OUTSTANDING FEES ₹73,250` to **every** role that lands on this page — confirmed directly for Teacher, Reception, and Accountant. Teacher and Reception hold no `fees`/`invoices` capability anywhere else in the app; this is the only screen where they see money figures. This isn't just an efficiency nit — a school might reasonably not want every staff member seeing the school's total outstanding balance every morning. **Recommendation: gate this row's individual KPIs by capability**, the same way the new Dashboard already does correctly (see C7).

### C3 — 🟠 "Add Student" offered to roles that cannot add a student

The top quick-action bar shows "Add Student" to Teacher, Reception, and Accountant. None of the three hold `students.create`. Clicking through as Teacher, **the full 5-step admission wizard opens anyway** — Student Info, Parent Details, Medical, Pickup Auth, Fees — with no visible block. Whether the final submit is rejected server-side wasn't tested (out of scope for a UX pass), but from a pure usability standpoint this is a dead end dressed up as a live action: a teacher who taps "Add Student" because the app offered it will spend real time in a form before discovering — if they discover at all — that it was never going to work for them. **Recommendation: hide quick actions the current role cannot complete**, not just capability-gate the underlying page.

### C4 — 🟠 Two pages, `/attendance` and `/pickup-authorization`, silently drop the entire app shell

Reached via the Control Center grid (not the sidebar — see C5), both pages replace the standard sidebar, topbar, search, and "KUE BOXS Care" branding with a completely different, self-contained mini-app: a plain "Yellow Dot" wordmark and a tiny local nav (`Dashboard / QR Scanner / Student QRs / History` for Attendance; `Authorized Persons / Pickup History / Attendance` for Pickup Authorization). The only way back to the rest of the app is a small home icon — no Care, no Ctrl+K, no module tree.

This is a coherent pattern, not random breakage: **both orphaned pages (missing from the sidebar, C5) are also the ones still running the old shell.** They were evidently built before the current layout and design system and never migrated — which also explains why nobody using the sidebar day-to-day would have noticed. For the people who actually use these two screens constantly (Teacher and Reception, respectively, for their single most common task), this is the roughest edge in the whole app: a jarring context switch, twice a day, every day.

*One genuine positive to flag alongside this:* once you're on the Attendance page, marking a child present is a **single click** (a Present/Absent/Late button per row, no dialog, no confirmation). The interaction design of the page itself is efficient — it's the arrival and departure that are broken.

### C5 — 🟠 Two of the most-used screens in the app have no sidebar entry at all

`/attendance` (mark attendance) and `/pickup-authorization` (manage pickup approvals) are reachable only via the Control Center's 30+-card grid, direct URL, or Ctrl+K search. For a Teacher, marking attendance is arguably *the* daily task; it is not in their sidebar. Gate Register (`/child-presence`) is in the sidebar and is a related but different screen (check-in/pickup activity, not the attendance register itself) — a new teacher would have real reason to think Gate Register *is* the attendance screen, try it, and not find what they need.

### C6 — 🟠 Finance Platform's own sidebar is empty; the real data lives in a page it no longer links to

Confirmed directly (Accountant role): `/finance/invoices` — the "Invoices" item in the sidebar's Finance group — shows **0 invoices**. The legacy `/invoice` page, no longer in the sidebar for any role but still fully live and reachable from the Control Center grid, shows the real **14 invoices / ₹73,250 outstanding**, matching Dashboard and Care exactly. This is not a seed-data gap on the legacy side — the legacy figures match the platform's own Dashboard/Care widgets, which pull from the same source. It's that the newer Finance Platform (Student Ledger, Billing Plans, Invoices, Payments, Collections, Family Accounts, Refunds, Reports, Audit Log — eleven sidebar items) runs on a separate data model that this school's real operational data was never migrated into.

**This is the highest-impact finding in this review.** An accountant trusting the sidebar's Finance group — the one the product promotes — would reasonably conclude the school has no invoices, and every other screen in that eleven-item group is presumably in the same state, since they share the same underlying model. The Control Center grid's smaller, older Finance section (Fees / Invoices / Payments) is the one with real numbers, and it's the one no longer advertised anywhere except that grid.

### C7 — ✅ Positive finding, worth preserving deliberately

The **new Dashboard and Care pages get this right where the Control Center doesn't.** Every widget and task on both is correctly scoped to the signed-in role's actual capabilities — Teacher and Reception never see a fee figure on either surface; Accountant sees exactly the finance-relevant tiles and nothing else. This was confirmed on all six roles. Whatever else changes, the permission discipline already built into these two pages should be the model the Control Center's KPI row and quick actions are brought up to, not the other way around.

### C8 — 🟡 Same word, three unrelated meanings, no visual distinction

"Dashboard" labels four different things a user can click: **Live Dashboard** (sidebar, Overview), **Dashboard** (sidebar, under Staff Management — an HR team-overview screen), **Dashboard** (sidebar, under Finance — the empty Finance Platform screen from C6), and the app's own new **Dashboard** (not yet in any sidebar). A support conversation ("go to the Dashboard") has no way to resolve which one is meant. One of these was already fixed this cycle (Finance's card in the *Care* grid now reads "Finance Dashboard" instead of "Dashboard" — see the commit history) but the **sidebar itself still says bare "Dashboard" in both the Staff Management and Finance groups**, so the ambiguity survives everywhere a user is actually likely to click.

### C9 — 🟡 The 30-card Control Center grid has no sense of priority

Every role's Control Center shows every reachable module as an equal-weight card, grouped alphabetically-ish by category, with no distinction between "you'll use this five times today" (Attendance, Care & Hygiene for a Teacher) and "you'll use this once a term" (Classroom Allocation, Teacher Allocation). Principal and Centre Owner see roughly 30 cards this way. The new Care page already solves exactly this problem by sorting by actual urgency — but nobody lands there by default (see C11).

### C10 — 🟡 Repeated category subtitles create visual noise on the Care grid

Every module card in Care's "Modules" section repeats its category as a subtitle — e.g. three consecutive cards all reading "Safety & Compliance" underneath three different module names, and "Child Journey" appearing twice in a row (module name, then identical category name). A real section heading per category (the way the old grid at least visually clusters things) would read faster than a repeated caption on every card.

### C11 — 🟡 `ROLE_HOME` is dead configuration that misleads whoever reads it next

`permissions.js` defines a `ROLE_HOME` map suggesting Teacher lands on Gate Register, Accountant on Invoices, Super Admin on Tenants. Verified live: **every non-parent role lands on `/quick-navigation`** regardless of this map — `RootRedirect` never reads it, and nothing else in the codebase does either. This isn't user-facing, but it will actively mislead the next person (human or AI) who edits it expecting it to change behavior. Either wire it up or delete it.

### C12 — 🟡 Raw internal identifiers leak into a couple of user-facing screens

Profile's "Assigned Centers" field shows the literal slug `demo-centre-north` rather than "Demo Centre North" — the same page's header, two lines above, gets the formatting right. Similarly, Super Admin's tenant-plan filter offers "Trial / Starter / Professional / Enterprise" while the actual seeded tenant is stored with plan `"premium"` — a value that isn't even one of the filter's own options. Small, but the kind of thing that quietly erodes trust in the data underneath.

---

## Role-by-role walkthrough

### 👩‍🏫 Teacher — daily workflow: mark attendance, log care/hygiene, log meals/naps, note observations, handle pickups

**Landing:** Control Center (see C1–C3, C9). Sidebar is correctly scoped to eight groups — no Finance, no Staff Management admin screens, no Academics allocation — genuinely well-filtered for the role.

**Dashboard (new):** 4 correctly-scoped tiles (Attendance, Open Incidents, Pickup Approvals, Birthdays) — no finance leak. Good.

**Care (new):** 5 tasks, correctly prioritised, escalation visibly working (a pickup at 2 hours past school-end read CRITICAL; attendance past the 09:30 cutoff read HIGH). Module grid: Attendance, Students, Care & Hygiene, Child Journey, Pickup Authorization, Incident Reports, Classes — all relevant.

- **T1 🟠 — Tasks tagged with someone else's name sit on a Teacher's "what needs doing" list.** Two of the five Care tasks read `Pickup approval pending … Reception` and `Incident awaiting acknowledgement … Principal`. A Teacher reading their own action queue and seeing another role's name attached to an item will reasonably wonder why it's there — is it something they're supposed to chase, or just visible to them? The escalation and prioritisation logic is sound; what's missing is a visual or copy distinction between "yours to act on" and "visible to you because you can see this domain." Even a one-line framing change (e.g. a lighter treatment for items owned by another role) would remove the ambiguity.

**Attendance (`/attendance`):** see C4/C5. Once there, marking a child present is one click — genuinely efficient. Getting there and back is not.

**Care & Hygiene (`/care-hygiene`):** Full standard shell (unlike Attendance). One card per child, most recent event shown inline ("🩺 Handwash", "💧 Water Refilled", "No events today"), single "Log Care" button per child. This is the best-designed daily screen reviewed in this pass — worth using as the template for other daily-logging screens.

**Profile:** Clean, minor C12 issue (raw center slug).

---

### 🏫 Reception — daily workflow: check-in, pickup approvals, admissions support, front-desk queries

**Landing:** Control Center. Sidebar is the leanest of any role — People/Students plus Safety & Compliance only. Appropriately minimal.

- Same C1/C2/C3 issues confirmed identically (fabricated "sample" KPIs, fee data shown despite no finance access, dead "Add Student" quick action).

**Dashboard / Care:** Same 4 tiles / correctly-scoped feed as Teacher (Reception and Teacher hold near-identical capability sets in this build — see note in P1 about role differentiation more broadly).

**Pickup Authorization (`/pickup-authorization`):** This is Reception's single most load-bearing screen, and it has the C4/C5 problem worse than Attendance does — it's not just missing from the sidebar, it's the screen a Receptionist would open dozens of times a day, every time dropping into the shell-less "K" mini-app with no way back except a tiny home icon.

**Gate Register (`/child-presence`):** Correctly on the current shell, sidebar-linked, reasonable live-stats layout (Present / Not Arrived / Picked-up counts).

---

### 💰 Accountant — daily workflow: invoices, payments, fee follow-up, financial reporting

**Landing:** Control Center. Sidebar correctly scoped: Overview, Students, and the full 11-item Finance Platform group — no HR, no Academics, no Safety modules. Quick actions correctly swap to "Record Payment / Generate Invoice" instead of "Mark Attendance" — **the quick-action set does adapt per role**, which is worth crediting; only "Add Student" is wrong across every role (C3).

**Dashboard / Care:** Correctly scoped — 2 widgets (Fees, Birthdays), 1 task ("Overdue fees need chasing — 3 invoices · ₹28,500 · 9h overdue"). Clean and focused.

- **F1 🔴 — see C6.** This is where it was found and verified: `/finance/invoices` (sidebar) shows 0; `/invoice` (Control Center grid only) shows the real 14/₹73,250. For the one role whose entire job runs through this screen, this is not a rough edge — it's the difference between the tool working and not.
- **F2 🟡 — Two "Finance" experiences on the landing page's own module grid.** The Control Center's Workspace grid shows a 3-item "Finance" section (Fees, Invoices, Payments) — the legacy set — sitting alongside the sidebar's 11-item Finance Platform group. Same word, two different scopes, on two navigation surfaces open at the same time.

---

### 🧑‍💼 Principal (`admin`) — daily workflow: oversight across attendance, incidents, staff, academics, approvals

**Landing:** Control Center, full 34-card grid across 10 categories — the largest surface any role sees (C9 applies at maximum scale here). One inconsistency spotted only at this scale: the "Security" category shows "Show 1 more" (5 items, 4 shown by default) while every other category — including ones with 4 items — shows everything with no truncation. Minor, but an unexplained exception a Principal will notice since they see the whole grid daily.

**Dashboard / Care:** Full 5-widget / 6-task view. Care in particular is a strong upgrade over the Control Center grid for this role specifically — a Principal's real job is triage across every domain, and Care's single prioritised list (incident → overdue fee → pickup → pickup → incident → attendance, correctly ordered) does that job in one screen where the Control Center takes a 34-card scavenger hunt.

**Roles & Permissions, Staff Management:** Not deep-tested this pass (already extensively covered in the platform-architecture work); no new findings.

---

### 🏢 Centre Owner — daily workflow: (per the product's own stated intent) business oversight — revenue, occupancy, staff costs

- **P1 🟠 — Centre Owner and Principal are identical in every respect tested.** Same sidebar (byte-for-byte, confirmed side by side), same Dashboard tiles, same Care feed and module grid. If a Centre Owner's job really is meant to differ from a Principal's — and the role names strongly imply it should (business/ownership vs. academic/operational leadership) — nothing in the current build reflects that. This was flagged conceptually in the earlier integration report (D5) and is now directly confirmed on screen. **Recommendation:** even without touching permissions, Dashboard and Care already support per-role emphasis (widget `displayOrder`, Care grid `roles` ordering) — a Centre Owner's Dashboard could lead with revenue/occupancy-flavoured tiles and a Principal's with academic/staffing ones, using data both already have access to. That's a content change, not an architecture one.

---

### 🛠️ Super Admin — daily workflow: platform health across every tenant school, not day-to-day operations at one school

- **S1 🔴 — Super Admin's landing page is a single school's Control Center, not a platform view.** Signing in as Super Admin lands on the exact same "Everything you need to run your preschool, in one place" page as every operational role, for one arbitrarily-selected school (whichever `demo-school` context resolves to). Platform tools (Preschools, Platform Analytics, Audit Logs) are a three-item group near the bottom of an otherwise full single-tenant sidebar — a Super Admin has to scroll past thirteen groups of one school's HR, Payroll, Performance, Academics, and Finance screens to reach the tools that are actually their job.
- **S2 🟠 — Dashboard and Care don't yet reflect the platform-level scope they were designed for.** Super Admin's Dashboard shows the same single-school widgets as every other bypass role (Attendance, Incidents, Pickups, Fees, Birthdays) — no tenant count, no trials-expiring, no platform-wide signal anywhere. This is a known, already-documented gap (the architecture work explicitly called for a platform-scoped Care queue for this role) that simply hasn't been built yet, not a regression.
- **S3 🟡 — Plan taxonomy mismatch**, see C12: the Preschools screen's own filter doesn't include the value its own seeded data uses.

Positive: the Preschools list itself (search, status/plan filters, Suspend/Impersonate actions) is clean and does what it says.

---

## Recommendations, prioritised

Ranked by user impact, not effort — several of the 🔴 items are likely small fixes (data wiring, copy, hiding a button) rather than large ones.

| # | Fix | Severity | Why first |
|---|---|---|---|
| 1 | Reconnect `/finance/invoices` (and the rest of the Finance Platform) to real data, or point the sidebar back at the screens that have it | 🔴 | An accountant's core tool appears broken |
| 2 | Remove or clearly badge the two "sample" KPIs on the Control Center | 🔴 | Fabricated data on the first screen everyone sees, every day |
| 3 | Capability-gate the Control Center's KPI row and quick-action bar the way Dashboard/Care already correctly do | 🔴 | Financial data shown to roles that can't see it anywhere else; dead-end actions offered to roles that can't complete them |
| 4 | Give `/attendance` and `/pickup-authorization` the standard shell, and add both to the sidebar | 🟠 | The two highest-frequency daily screens in the app are the least discoverable and the most jarring to use |
| 5 | Differentiate Centre Owner from Principal — start with Dashboard/Care content ordering, no permission changes needed | 🟠 | Two named roles with no actual difference is a wasted opportunity and a confusing role model for the customer |
| 6 | Give Super Admin a platform-scoped landing view instead of a single school's Control Center | 🟠 | Their actual job is buried at the bottom of the wrong page |
| 7 | Rename the two remaining bare "Dashboard" sidebar entries (Staff Management, Finance) | 🟡 | Cheap, removes a standing ambiguity |
| 8 | Add section headings (or otherwise de-emphasise repeated captions) to the Care module grid | 🟡 | Readability |
| 9 | Reconcile the tenant plan vocabulary (Trial/Standard/Premium/Enterprise vs. Trial/Starter/Professional/Enterprise) | 🟡 | Data trust |
| 10 | Delete or wire up `ROLE_HOME` | 🟡 | Prevents a future mistake, not user-facing today |

---

## What this review did not cover

In the interest of finishing a useful pass rather than an exhaustive one: HR sub-screens (Payroll, Performance, Leave) were seen in the sidebar but not opened and interacted with — they're bypass-only in production today (per the ongoing access-diff work) so no real staff role can reach them yet, which made them lower priority for this pass. CCTV, Roles & Permissions, and Settings were confirmed reachable but not walked in detail, since they were already covered in depth during the platform-architecture work earlier this project. Whether the Finance Platform's *other* ten screens (Student Ledger, Billing Plans, Payments, Collections, Family Accounts, Refunds, Reports, Recurring Billing, Finance Settings, Audit Log) share the same disconnected-data problem as Invoices (C6/F1) was inferred from the shared data model, not individually verified — that would be the natural next check.
