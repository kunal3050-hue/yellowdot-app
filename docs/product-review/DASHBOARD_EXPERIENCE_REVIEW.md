# Dashboard Experience Review

**Date:** 2026-07-31
**Scope:** Next item in the priority order after Care ([[project_care_experience_review]]) — Staff-only, no platform abstractions proposed. Focuses on `/dashboard` (the Widget Engine's "what is happening" screen), which Care already showed shares its architecture and data sources.
**Method:** Code review of the Widget Engine (`platform/widgets/`) and the backend endpoints its widgets read, cross-checked against a live walkthrough signed in as `teacher@demo.local` against the seeded emulator.

---

## What Dashboard is supposed to do

Per its own docblock: insights only, no mutations, every tile deep-links into the module that owns the data — "Dashboard = see, Care = do." Five widgets exist today (Attendance, Open incidents, Awaiting Parent, Outstanding fees, Birthdays), each gated by capability and feature flag, each degrading independently on failure. The engine itself is solid — per-widget error isolation, shared reads via the Service Registry, focus-refetch. The findings below are about coverage and cross-surface consistency, the same class of issue the Care review found, not the architecture.

## Live state observed (Teacher, seeded data)

`/dashboard` showed 4 widgets: Attendance (10/18, 56%), Open incidents (**1**), Awaiting Parent (2), Birthdays (1).

---

## D1 — 🟠 ~~`/dashboard` has no sidebar entry, for any role~~ FIXED

Grepped `sidebarConfig.js` — zero matches for `/dashboard`. The registry route itself says why: `core.js`'s `dashboardModule` comment reads "Deliberately NOT in `nav` yet: it ships alongside `/live-dashboard` so it can be verified against real data before it replaces anything." That verification is exactly what's been happening across this whole review series — Dashboard has been live-tested against real data repeatedly, including in this review. This is the identical gap Care had before C2 (fixed 2026-07-31): a fully built, routed, capability-gated page reachable only by direct URL or ⌘K.

**Status: fixed and verified live (2026-07-31).** Added a sidebar entry (Overview section) and the matching registry `nav` declaration, same pattern as C2. Labelled **"Insights"** rather than reusing "Dashboard" — that word already names three other things in this sidebar (Live Dashboard, Staff Management › Dashboard, Finance › Dashboard), the exact ambiguity the original staff UX review flagged as C8; this page's own docblock already calls itself "insights only," so that's what the sidebar calls it too. Verified live as Teacher: sidebar now reads "Live Dashboard, Control Center, Insights, Care," and clicking Insights navigates correctly.

## D2 — 🟠 ~~"Open incidents" undercounts against Care's own incident count, for the same underlying reason as W3~~ FIXED

Live in the same session: Dashboard's "Open incidents" widget showed **1**; Care's task feed showed **2** incident items (one "Serious incident awaiting review" — status `under_review`, shown as "In progress" — and one "Incident awaiting acknowledgement" — status `open`).

Confirmed in code: the widget reads `GET /api/incidents/dashboard`, whose backend (`incidentService.js:183`) computed `open = all.filter(i => i.status === "open").length` — strictly `open`, nothing else. Care's `openIncidents` task provider deliberately does NOT do this — its own inline comment (`providers.js`) explains that filtering to `status=open` was found to exclude `under_review` entirely during the original integration validation pass, and that for child-safety records "the item stays visible until it is RESOLVED, not until someone starts looking at it." That fix was applied to the task feed but never to the dashboard stats endpoint it's named almost identically to — so the two surfaces disagreed about what "open incidents" means, the same class of problem W3 fixed between Control Center and Gate Register's pickup counts.

**Status: fixed and verified live (2026-07-31).** Fixed the data at the source: `getDashboardStats` now computes `open = status === "open" || status === "under_review"`, matching Care's own reasoning rather than maintaining two definitions. Checked all consumers first — `pages/Incidents.jsx` reads the exact same `stats.open` for its own "Open Incidents" stat card, so this fix corrects a **third** surface too, not just Dashboard vs. Care: verified live, that page's stat card now reads 2, matching its own status-filtered list (1 Open + 1 Under Review), which it didn't before. Verified live on Dashboard as well: "Open incidents" now reads 2, matching Care exactly.

## D3 — 🟡 Care & Hygiene has a task provider but no matching widget

C3 (Care review, fixed 2026-07-31) added `careHygienePending`, a task provider for same-day coverage. Attendance has both a widget (`attendanceToday`) and a task (`attendancePending`) — the two surfaces are meant to be symmetric, reading the same data for two different purposes ("what's the state" vs "what needs doing"). Care & Hygiene now has the task half but not the widget half, so Dashboard's "what is happening" view has no visibility into an area Care's "what needs doing" view already covers.

**Recommendation:** Add a `careHygieneToday`-style widget mirroring `attendanceToday`'s shape (logged/total, tone by percentage), reusing the same `care_hygiene.summary` service read `careHygienePending` already established — no new backend surface needed.

---

## Summary table

| # | Finding | Severity | Fix scope |
|---|---|---|---|
| D1 | `/dashboard` has no sidebar entry | 🟠 | ✅ FIXED 2026-07-31 — added as "Insights" (avoids the C8 "Dashboard" collision) |
| D2 | "Open incidents" widget and Care's incident task disagree on what counts as open | 🟠 | ✅ FIXED 2026-07-31 — fixed at the source, also corrected a third surface (Incidents page's own stat card) |
| D3 | No Care & Hygiene widget despite the matching task existing | 🟡 | Still open |

**Recommended order:** D1 and D2 are independent and both worth doing regardless of order. D3 is smaller and can follow either, or be skipped if the daily-care widget area isn't wanted on Dashboard specifically.
