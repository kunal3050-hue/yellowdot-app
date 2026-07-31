# Care Experience Review — Teacher Productivity

**Date:** 2026-07-31
**Scope:** First review under the new architecture baseline ([[feedback_architecture_baseline]]) — Staff-only, no platform abstractions proposed, every finding tied to a concrete Teacher-facing gap. Focuses on `/care` (the Task Engine's "what needs doing right now" screen) as it serves the Teacher role, since that's the stated priority.
**Method:** Code review of the Task Engine (`platform/tasks/`) and Module Registry `surfaces.care` declarations, cross-checked against a live walkthrough signed in as `teacher@demo.local` against the seeded emulator. Every finding below is confirmed both in source and on screen.

---

## What Care is supposed to do

Per its own docblock, Care has one job: show what work needs doing (a priority-sorted task feed) and where to go do it (a capability-driven destination grid), reading from the same providers as the Dashboard, mutating nothing. That's a good, narrow design. The findings below are about where the current provider/module coverage doesn't yet deliver on that promise for a Teacher specifically — not about the architecture itself, which the baseline says is finished.

## Live state observed (Teacher, seeded data)

"Needs attention" showed **5 items**: 1 critical incident, "Attendance not marked," 2 pickup approvals, 1 incident acknowledgement. The Modules grid showed: Attendance, Students, Care & Hygiene, Child Journey, Pickup Authorization, Incident Reports, Classes.

---

## C1 — 🔴 ~~Four of five items in a Teacher's "Needs attention" list aren't theirs to act on~~ FIXED

**Status: fixed and verified live (2026-07-31).** Added `splitTasksByOwnership(tasks, role)` as a pure function in `resolve.js` (same file, same testable pattern as `resolveProviders`/`resolveCareModules` — no new abstraction), matching each task's `owner.id` against the signed-in user's role. Bypass roles (`developer`, `super_admin`) keep the unsplit view, since they hold every capability by construction and splitting would leave their "mine" empty. `Care.jsx` now renders `mine` as "Needs attention" (count badge, filter chips, and empty-state all now reflect what's actually the viewer's) and `team` as a new, visually secondary "Team activity" section below it — same `TaskRow`, still showing the owner caption, just no longer mixed into the primary count. Verified live as both Teacher (1 item: Attendance not marked; 4 moved to Team activity) and Principal (2 items: both incidents; attendance/pickup/invoices moved to Team activity), confirming the split generalizes correctly rather than just emptying the list. All 6 verify:* gates, lint, and prod build green.

`resolveProviders()` (`platform/tasks/resolve.js`) gates each task provider on `can(p.capability)` — a coarse *view* check — and nothing gates the resulting tasks by who they actually belong to. Every task carries an `owner` field (`providers.js`: `{ type: "role", id: "reception", label: "Reception" }` etc.), but it's only ever used as a display caption (`Care.jsx`'s `TaskRow`) — grepping the whole Task Engine confirms `owner` is never read for filtering anywhere in `index.js` or `resolve.js`.

The practical effect, confirmed live: a Teacher who holds `incidents.view` and `pickup_auth.view` (both reasonable — a teacher should be able to *see* an incident or a pickup request) gets every open incident and every pending pickup dropped into their own personal "what needs doing right now" queue, labelled "Principal" or "Reception" in small grey text easy to miss at a glance. Of the 5 items shown, only 1 — "Attendance not marked" — was something the signed-in Teacher could actually resolve. The other 4 are visible-but-inert noise on every visit.

This directly works against the new baseline's mandate to reduce clicks and training time: a new Teacher has no way to learn "ignore these four, that one's mine" except by trial and error, and the list's count badge ("5 items") overstates their actual workload every single day.

**Recommendation:** Filter the feed to tasks whose `owner.id` matches the signed-in user's role (or is unset/shared), and move anything else into a clearly separate, secondary "Team activity" section — visible for context, but not counted in the headline number or mixed into the primary list.

## C2 — 🟠 ~~Care has no entry point in normal navigation, for any role~~ FIXED

**Status: fixed and verified live (2026-07-31).** Added a Care entry to `sidebarConfig.js`'s Overview section (alongside Live Dashboard / Control Center) and the matching `nav` declaration on the registry's `/care` route (`core.js`'s `dashboardModule` — its route comment previously said "not in nav yet: it ships alongside the existing surfaces so the full Staff experience can be reviewed before either replaces anything," which is exactly the state this closes out). Verified live as Teacher: Care now appears in the sidebar and navigates correctly.

`/care` is fully wired (route, `MainLayout`, `ProtectedRoute`) but has zero presence in `sidebarConfig.js` — confirmed by grep, the only "Care" match anywhere in the sidebar is the unrelated "Care & Hygiene" (diaper/hygiene logging) item. `RootRedirect` sends every Staff role to `/quick-navigation` (Control Center) on login, and the sidebar's "Live Dashboard" link points to the legacy `/live-dashboard`, not the new `/dashboard`. So the one screen built specifically to answer "what needs doing right now" is reachable only by typing the URL directly or via ⌘K search — the same class of problem the original Staff UX review found and fixed for Attendance and Pickup Authorization (C4/C5, 2026-07-30), still unresolved here.

**Recommendation:** Add a sidebar entry for Care (Overview section, alongside Live Dashboard / Control Center), so it's actually reachable the way it was designed to be used.

## C3 — 🟠 ~~The daily-care routine itself is invisible to the task feed~~ PARTIALLY FIXED (Care & Hygiene)

None of Nap Tracker, Food Menu, Food Consumption, or Care & Hygiene has a task provider. `platform/tasks/providers.js` has exactly four providers — pickup approvals, open incidents, attendance-not-marked, overdue invoices — and none of them touch daily-care data. This means Care's "what needs doing right now" can never surface "3 children still haven't napped past their usual time" or "lunch hasn't been logged for 5 children" — precisely the recurring, effort-consuming Teacher duties the workflow-optimization review walked through just one phase ago ([[project_workflow_optimization_review]]). A Teacher relying on Care to tell them what's outstanding today would see nothing about roughly half of their actual daily routine, not because it's done, but because nothing is watching it.

**Status: Care & Hygiene fixed and verified live (2026-07-31); Nap Tracker and Food Consumption deliberately left open.** Added `careHygienePending` to `providers.js`, same shape as `attendancePending` (total roster vs. `GET /api/care/summary`'s already-existing `students` array of who has ≥1 event logged today), registered a matching `care_hygiene` entry in the Service Registry. Verified live as Teacher: "Care & hygiene not logged · 8 of 18 children with no event logged today" now appears in Needs attention, correctly counted as the Teacher's own (C1's split still holds).

Nap Tracker and Food Consumption were **not** given providers, on purpose: Nap doesn't apply to every child the way attendance/hygiene do (not everyone naps), so "unmarked" has no honest universal meaning there without inventing a per-child schedule model that doesn't exist yet; Food Consumption is additionally gated behind a same-day Food Menu existing at all (see W2), so a task nagging about unlogged consumption could fire on a day nobody could have logged anything. Shipping either now would mean guessing at business rules the review didn't actually validate — which the new baseline's "does this solve a real problem" bar argues against doing speculatively. Left as future work once those rules are actually defined.

**Incidental fix required to ship this:** `verify-roles.mjs`'s "provider visible to no role" check runs against simulated PRODUCTION feature flags, where `DAILY_CARE` (and therefore the entire Nap/Food/Hygiene feature area, including the pre-existing Care & Hygiene module itself) is off — `featureFlags.js` labels it explicitly "Yellow Dot only... flip to true when approved for production rollout." The gate didn't previously distinguish "nobody holds this capability" (a real bug) from "correctly gated behind a flag not yet approved for production" (expected), because no staging-only-gated task provider had existed before this one. Fixed the gate itself to check `FLAG_GROUPS.staging` and downgrade that specific case to a warning — it still reports (`⚠️ task provider "care-hygiene-pending" is visible to NO role in production → gated behind "DAILY_CARE"...`), just doesn't block the build for a state that's true by design, not by accident.

## C4 — 🟡 The Modules destination grid isn't curated for the role viewing it

`resolveCareModules()` includes any module with a `surfaces.care` entry that the viewer has view-capability on — the per-role `roles: {...}` map only affects sort *order*, not visibility (confirmed in `resolve.js`'s own comment: "granting a Teacher Finance access makes Finance appear in their grid without any change here"). Live, this meant a Teacher's grid mixed "Students" and "Classes" — reference/browse screens, not action destinations — in with the five genuinely actionable modules (Attendance, Care & Hygiene, Child Journey, Pickup Authorization, Incident Reports), while Nap Tracker and Food Consumption were entirely absent (same root cause as C3 — no `surfaces.care` entry at all, not even an unranked one).

**Status: coverage half fixed and verified live (2026-07-31).** Added `surfaces.care` to `napTrackerModule` (order 15) and `foodConsumptionModule` (order 25) — same pattern as the existing `attendanceModule`/`careHygieneModule` entries. `foodMenuModule` deliberately did **not** get one: Teacher holds `food_menu.view` but not `.create` (W2), so it's a browse-only screen for them, and adding it would reproduce the exact clutter this finding is about. Verified live as Teacher: Nap Tracker and Consumption Log now appear in the grid; Food Menu correctly does not.

**Still open:** whether "Students" and "Classes" belong in a *do-the-work* grid at all for Teacher, versus staying reachable only via the sidebar as they are today. Left open deliberately — `surfaces.care` is global (the `roles:{}` map only reorders, per-role removal isn't currently expressible), so removing them here would also remove them from every other role's Care grid, including Reception, where "Students" plausibly earns its place differently than it does for Teacher. That's a product call, not a mechanical fix, and needs a decision before touching it.

---

## Summary table

| # | Finding | Severity | Fix scope |
|---|---|---|---|
| C1 | Task feed shows every viewable task, not just the signed-in user's own | 🔴 | ✅ FIXED 2026-07-31 — `splitTasksByOwnership`, primary/secondary sections |
| C2 | `/care` has no sidebar entry, unreachable except by URL/search | 🟠 | ✅ FIXED 2026-07-31 — sidebar + registry `nav` entry |
| C3 | No task provider for Nap Tracker/Food Menu/Food Consumption/Care & Hygiene | 🟠 | ✅ Care & Hygiene FIXED 2026-07-31; Nap/Food deliberately deferred, see above |
| C4 | Modules grid isn't curated — includes browse-only screens, missing daily-care destinations | 🟡 | ✅ Coverage half FIXED 2026-07-31 (Nap Tracker/Consumption Log added); Students/Classes inclusion still an open product question |

**Remaining:** whether "Students" and "Classes" belong in Teacher's Care grid — needs a decision, not a mechanical fix, since removing them would affect every role's grid, not just Teacher's.
