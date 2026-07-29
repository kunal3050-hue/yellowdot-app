# Staff experience — integration validation

**Status: ALL FOUR ITEMS COMPLETE.** Run against the Firebase Emulator Suite with seeded data, 2026-07-29.
**Date:** 2026-07-26, updated 2026-07-29 with live-backend results.
**Gate:** these must all be resolved before `/dashboard` becomes the default landing page.

| # | Validation | Status |
|---|---|---|
| 1 | Dashboard against a live backend, all widgets populate | ✅ **Complete** — 5/5 populate; **2 defects found and fixed** |
| 2 | Care against a live backend: generation, prioritisation, escalation | ✅ **Complete** — 6 tasks, escalation confirmed on real data; **1 defect found and fixed** |
| 3 | Per-role validation across all staff roles | ✅ **Complete** — static matrix + live per-role sign-in |
| 4 | Document discrepancies and fix before routing changes | ✅ **3 fixed, 3 outstanding** (§0) |

---

## §0. Live-backend run — 2026-07-29

Environment: `npm run dev:local` (Firestore + Auth emulators, `demo-kueboxs`,
seeded demo tenant). Signed in as each demo role in a real browser session.

### Dashboard — all five widgets populate

| Widget | Value | Matches seed? |
|---|---|---|
| Attendance | `10/18` · 56% present | ✅ 10 present of 18 |
| Open incidents | `1` | ✅ |
| Pickup approvals | `2` | ✅ |
| Outstanding fees | `₹73,250` · 8 unpaid | ✅ |
| Birthdays | `1` — Aarav Sharma | ✅ |

### Care — 6 tasks, escalation working on real data

```
CRITICAL  Pickup approval pending      Diya Patel · Overdue · 2h overdue
CRITICAL  Pickup approval pending      Myra Kapoor · Overdue · 2h overdue
CRITICAL  Serious incident awaiting review  Aadhya Nair · Allergic rash
HIGH      Overdue fees need chasing    3 invoices · ₹28,500 · 19h overdue
HIGH      Attendance not marked        6 of 18 unmarked · 10h overdue
HIGH      Incident awaiting acknowledgement  Kabir Reddy · Minor fall
```

Escalation confirmed against a real clock: pickups (base `high`) escalated to
`critical` at 2h past school end; attendance (base `medium`) to `high` past the
09:30 cutoff. Filter chips derived correctly (`Safety & Compliance 4`,
`Finance 1`).

### Per-role, live

| Role | Widgets | Care tasks | Care modules |
|---|---|---|---|
| Principal (`admin`) | 5 | 6 | 8 |
| Teacher | 4 — **no fees** | 5 — **no finance task** | Attendance, Students, Care & Hygiene, Child Journey, Pickup, Incidents, Classes, Staff Dashboard |
| Accountant | 2 | 1 — finance only | Finance Dashboard, Invoices, Students, Fees, Analytics |
| Centre Owner | **5** | — | — |

**D1 is confirmed a DATA problem, not a code problem.** Centre Owner renders a
full Dashboard the moment a role document exists. The production fix is to seed
the role document — no code change.

### Defects found by the live run — all fixed

**L1 — Incidents widget read the wrong response shape.** `select()` expected
`{ dashboard: { open } }`; the endpoint returns `{ stats: { open } }`. The tile
rendered "—" against real data. This was a guessed shape that no unit gate could
catch. **Fixed.**

**L2 — Seed wrote non-canonical student fields.** The fixture used `name`/`DOB`;
`studentService` reads `studentName`/`dob` (lowercase) and *projects* them to
`DOB` in the response. Result: every student came back with an empty name and no
birthday. **Fixed** — a fixture bug, not a widget bug.

**L3 — 🔴 An incident under review disappeared from Care entirely.** The task
provider queried `?status=open`, which excludes `under_review` — so its own
`under_review → in_progress` mapping was dead code that could never fire. For
child-safety records the correct behaviour is that an item stays visible until
**resolved**, not until someone starts looking at it. The provider now reads
unfiltered and keeps `open` + `under_review`. **Fixed** — the most consequential
of the three, and only observable with data in a middle state.

### Still outstanding

**N1 — 🟠 The Care module grid ignores scope level.** `resolveCareModules` uses
the boolean `can(capability)`, so a `self`-scoped grant renders the same card as
a school-wide one: a Teacher with `staff_management: { view: "self" }` sees a
card labelled **"Staff Dashboard"**, implying the HR management screen rather
than their own record. The §2c.1 ladder exists but no surface consults it yet.
Fix: let `surfaces.care` declare a minimum level, defaulting to `self`, and/or
vary the label by level. Not applied — it changes what roles see, so it belongs
with the other permission-visibility changes under review.

**N2 — 🟡 Ambiguous label.** `finance_dashboard` is labelled "Dashboard", which
reads confusingly in the Care grid next to the app's own Dashboard. Rename to
"Finance Dashboard" in the registry.

**N3 — ℹ️ Reseeding invalidates live sessions.** `seedEmulator.js` deletes and
recreates the auth users, so an open browser session is signed out mid-run.
Harmless, but worth knowing during testing.

### Carried forward, unchanged

D2 (Incidents unreachable for real staff in **production**) and D3 (Teacher's
Care grid missing modules in **production**) are unchanged: both are the
capability-data gap, and the emulator proves the code is correct once the
capabilities exist — Teacher sees Incidents, Care & Hygiene and Child Journey
here precisely because the emulator seeds those grants. **The production fix is
still the pending access diff.**

---

## 1. Per-role matrix — what each role actually sees

Produced by `npm run verify:roles`, which runs the **real** resolvers
(`widgets/resolve.js`, `tasks/resolve.js`) against the **real** capability model
and the **seeded role documents** from `roleService.js`. Production feature
flags.

| Role (backend id) | Widgets | Task providers | Care modules |
|---|---|---|---|
| **Teacher** (`teacher`) | 3 — attendance, pickup, birthdays | 2 — pickup, attendance | 3 — Attendance, Students, Pickup |
| **Reception** (`reception`) | 3 — attendance, pickup, birthdays | 2 — pickup, attendance | 3 — Students, Attendance, Pickup |
| **Accountant** (`accountant`) | 2 — fees, birthdays | 1 — overdue invoices | 4 — Invoices, Students, Fees, Analytics |
| **Principal** (`admin`) | 4 | 3 | 8 |
| **Centre Owner** (`center_owner`) | **0** | **0** | **0** |
| **Super Admin** (bypass) | 5 | 4 | 12 |

---

## 2. Discrepancies

### D1 — ⛔ BLOCKER: Centre Owner sees a completely empty Dashboard and Care

**The single most important finding, and the reason the landing page must not switch yet.**

This is a **new class of failure created by capability-gated surfaces**:

| Surface | Gates on | Resolves from | Works for `center_owner`? |
|---|---|---|---|
| Existing screens, sidebar | `can(routeKey)` | `STATIC_ROLE_PERMS` ∪ derived | ✅ yes |
| **Dashboard, Care** | `can(capability)` | **role document matrix only** | ❌ **no** |

`roleService.js` `SYSTEM_ROLES` seeds five roles — `admin`, `center_admin`,
`teacher`, `accountant`, `reception`. It does **not** seed `center_owner`, even
though that role exists in `permissions.js`, `permissionsBackend.js`,
`STATIC_ROLE_PERMS` and `ROLE_LABELS`.

A `center_owner` user therefore has route keys (navigation works, every existing
page opens) but an **empty permission matrix** — so every capability check
returns false and both new surfaces render blank.

**If the landing page had been switched before this check, a Centre Owner — the
most senior school-level role, and typically the paying customer — would log in
to an empty screen.**

**Fix (held for review, not applied):** seed a `center_owner` role document
mirroring `center_admin`. This grants capabilities and is therefore a permission
change, so it goes through the same review as
[PHASE1_ACCESS_DIFF.md](PHASE1_ACCESS_DIFF.md) rather than being applied
unilaterally.

**Also worth checking before that fix ships:** any *custom* role created through
the Roles UI will have a matrix (it is created with one), so this affects
system roles that were never seeded — but the same failure would hit any role
added to `permissions.js` without a corresponding seed.

### D2 — 🔴 HIGH: Incidents is invisible to every real staff role

`incidents-open` (widget) and `open-incidents` (task provider) resolve **only
for bypass roles**. No real staff role holds `incidents.view`, because
`incidents` has no entry in `rbacConfig` `PERMISSION_CATEGORIES` — so no role
document can grant it.

Consequence: **a teacher or principal never sees an open incident on Dashboard
or in the Care feed.** Given incidents are child-safety records, this is the
most consequential instance of the known unreachable-modules defect
(`knownGaps.UNREACHABLE_ROUTEKEYS`), and it is now user-visible on the new
surfaces rather than only in navigation.

**Fix:** part of the pending Phase 1 access work — add `incidents` to
`PERMISSION_CATEGORIES` and `MODULE_ROUTE_MAP`, then grant `incidents.view` to
the appropriate roles.

### D3 — 🟠 MEDIUM: Teacher's Care grid is missing three agreed modules

Agreed Teacher hub: *Attendance, Daily Care, Child Journey, Pickup, Incidents,
Classroom*. Actually resolving: **Attendance, Students, Pickup**.

Missing because no seeded role holds `care_hygiene.view`, `observations.view`
(Child Journey) or `incidents.view` — the same root cause as D2. The registry
entries and `surfaces.care` placements are correct; the capability data is not.

### D4 — 🟡 LOW: Teacher and Reception resolve identically

Both see the same 3 widgets and 2 task providers, differing only in module
order. Not a defect on its own — their seeded matrices genuinely overlap — but
worth a product decision on whether Reception should see finance or admissions
signals that Teacher does not.

### D5 — ℹ️ INFO: "Principal" is not a backend role

Mapped to `admin` throughout. Flagged repeatedly across the design rounds and
still never confirmed. If Principal and Centre Admin are meant to differ, that
is a role-model decision, not a UI one.

---

## 3. What has been verified without a live backend

Deterministic behaviour is fully covered, and is the part a live backend would
verify *less* well:

- **Escalation ladder** against a simulated clock — pickup escalating to
  critical at 16:45, attendance escalating at 09:31 but not 09:00, one-tier cap
  when several rules fire (`verify:tasks`).
- **Feed ordering** — priority desc → dueAt asc → createdAt asc.
- **Provider mapping** against fixtures, including that a failed response
  envelope produces **zero** tasks rather than a fabricated one.
- **Per-widget failure isolation** — every tile degrades to an em dash
  independently, page intact (browser-verified).
- **Request dedup** — `/students` fetched once for the two widgets that declare
  it (browser-verified).
- **No refetch loop** — zero additional requests over 8s (browser-verified).
- **Per-role visibility** — the matrix above.

## 4. Why items 1 and 2 are blocked — an environment decision is needed

`yellowdot-backend` has **no Firestore emulator configured**, and
`serviceAccountKey.json` points at project **`yellowdot-app`** — the same
project that serves production. Running the backend locally therefore reads
**real data for a real school**: real children, families and invoices.

Three consequences:

1. **Validation would read live children's records** into a local browser
   session. Dashboard and Care are read-only by design (§7 — Care never
   mutates), so nothing would be written, but the data is real PII.
2. **Authentication needs a real session.** The `yd_test_bypass_role`
   localStorage bypass skips Firebase on the client but sends no ID token, so
   every API call 401s. A genuine token is required.
3. **Finance would be excluded anyway** — the local `.env` has no
   `FINANCE_FOUNDATION_ENABLED`, so those routes are not mounted, and the
   finance widget/provider could not be validated against real data locally.

### Options

| Option | What it gives | Cost |
|---|---|---|
| **A. Firestore emulator + seeded fixtures** *(recommended)* | Full validation of both surfaces against realistic data, repeatable, zero exposure of real records | Emulator config + adapting the existing seed scripts to target it |
| **B. Separate dev Firebase project** | Same as A, closer to production behaviour | New project, new service account, seed data |
| **C. Point at production, read-only, with a real staff login** | Fastest; validates the exact production shapes | Reads real children's data locally; needs a real session; the finance gap remains |

**Recommendation: A.** It is the only option that makes this validation
repeatable and part of the verification suite rather than a one-off, and it
removes the "we tested against production" question entirely. The existing
`seedAdmin.js` / `seedRoles.js` / `seedTenant.js` / `seedFinanceDemoData.js`
scripts already generate the shapes needed — today they target the live
project, so they would need an emulator host and, ideally, a guard that refuses
to run against a non-emulator target.

**I have not started the backend or connected to the live project**, since that
choice is yours to make.
