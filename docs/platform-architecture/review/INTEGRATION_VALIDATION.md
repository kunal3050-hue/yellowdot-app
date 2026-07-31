# Staff experience — integration validation

**Status: ALL FOUR ITEMS COMPLETE. Every discrepancy raised in this document — D1–D3 and N1–N3 — is now fixed and re-verified live.**
**Date:** 2026-07-26, updated 2026-07-29 (live-backend results), updated again 2026-07-29 (access diff + N1), updated again 2026-07-29 (N2 + N3, plus one new defect N2 surfaced).
**Gate:** these must all be resolved before `/dashboard` becomes the default landing page.

| # | Validation | Status |
|---|---|---|
| 1 | Dashboard against a live backend, all widgets populate | ✅ **Complete** — 5/5 populate; 2 defects found and fixed |
| 2 | Care against a live backend: generation, prioritisation, escalation | ✅ **Complete** — 6 tasks, escalation confirmed on real data; 1 defect found and fixed |
| 3 | Per-role validation across all staff roles | ✅ **Complete** — static matrix + live per-role sign-in |
| 4 | Document discrepancies and fix before routing changes | ✅ **All six (D1–D3, N1–N3) fixed** (§0.1, §0.2) |

---

## §0.1 Access diff and N1 — fixed 2026-07-29

### What was applied

1. **rbacConfig.js (frontend) + roleService.js (backend) `MODULE_ROUTE_MAP`** — added `incidents` and `care_hygiene` as first-class permission modules (new "Safety & Compliance" category on the frontend), and fixed `observations` (Child Journey) being present in the frontend map but **entirely absent from the backend copy** — a divergence nobody had caught.
2. **`docs/platform-architecture/review/phase1-safe-access.patch` applied as-is** — the routeKey-level fix prepared and reviewed earlier. Purely additive; `verify:permissions` confirms zero role lost anything.
3. **`SYSTEM_ROLES` (roleService.js) granted the matching granular capabilities** — `incidents`/`care_hygiene`/`observations` added to `admin`, `center_admin`, and `teacher`'s seeded matrices (the same role set the routeKey patch already used, kept consistent on purpose).
4. **A new `center_owner` entry added to `SYSTEM_ROLES`**, mirroring `admin` exactly — this is the actual D1 fix. `getRoleMatrix()` reads only the Firestore role document, never `STATIC_ROLE_PERMS`, so no amount of routeKey-level patching could have fixed D1 — only a role document does.
5. **N1 fix** — `resolveCareModules` now accepts a `level` function and a per-module `surfaces.care.minLevel` (default `"self"`, so nothing changes for the common boolean case). `staff_dashboard`'s registry entry declares `minLevel: "team"`, since it's a manager-facing screen with no separate self-service destination yet.

### What this does NOT fix, and why that's correct

**HR/Payroll/Performance capabilities remain ungranted to `teacher` in `SYSTEM_ROLES`.** This is deliberate, not a leftover: those endpoints are not yet scope-aware server-side (§2c.1), so granting even `self`-level would let the frontend hide a button while the endpoint stayed wide open. That work is still pending and is exactly what made N1 worth catching — a `self` grant with no scope-aware backend is misleading at best.

### Re-verified — all six gates green, then live in the emulator

`npm run verify:all` — registry / permissions / features / services / tasks / roles, all passing. `verify:permissions` confirms the widened access is exactly the reviewed set (gains only, matching PHASE1_ACCESS_DIFF.md §3) and that the divergence-freeze guard's new state was a deliberate re-baseline, not silent drift — `events`/`incidents`/`ptm` were already flagged "frontend-only evidence" in the original review, so `permissionsBackend.js` never had them to begin with; there was nothing to keep in sync.

`verify:roles`' N1 assertion is a **synthetic fixture**, not the real seeded teacher — production's `teacher` grants no `staff_management` capability at all today (level `"none"`, by design per the paragraph above), so asserting against the real seed would have passed for the wrong reason. The synthetic check proves the filter actually **discriminates**: a `self`-level grant excludes the Staff Dashboard card, a `team`-level grant includes it.

**Reseeded the emulator and signed in as each role again:**

| Role | Before this fix | After |
|---|---|---|
| Teacher — Care modules | Attendance, Students, Pickup Authorization *(3)* | **Attendance, Students, Care & Hygiene, Child Journey, Pickup Authorization, Incident Reports, Classes** *(7)* — **no Staff Dashboard card** |
| Teacher — widgets | 3 (no incidents) | **4** — Open Incidents now included |
| Teacher — tasks | 2 | **3** — `open-incidents` now included |
| Principal (admin) — Care modules | 8 | **9**, still correctly showing **Staff Dashboard** (level `all` ≥ `team`) |
| Centre Owner — Dashboard | 5/5 (already fixed by seed) | 5/5, unchanged — confirms no regression |

D2 and D3 from earlier in this document are **closed**: Incidents is now reachable for real staff, and Teacher's Care grid matches the agreed hub (Attendance, Daily Care, Child Journey, Pickup, Incidents, Classroom — Classes stands in for "Classroom").

**One thing this does not close:** these fixes are in `SYSTEM_ROLES`, the seed template for *new* schools. The real production school (`ydseawoods`) has its own Firestore role documents already, seeded before these capabilities existed, and `seedDefaultRoles()` only creates documents that don't already exist — it will not retroactively add `incidents`/`care_hygiene`/`observations` to an existing `teacher` document, or backfill a missing `center_owner` document unless one is truly absent. Applying this in production is a data operation (calling the already-idempotent `POST /api/roles/seed`, or an equivalent one-time backfill for existing docs), not a code deploy, and is **not something this session has done** — it needs a deliberate action against the real project, which stays outside what an agent should do unprompted.

---

## §0.2 N2 and N3 — fixed 2026-07-29

### N2 — ambiguous "Dashboard" label in the Care grid

`financeDashboardModule` is built directly with `defineModule` now, rather than via the shared `financePlatformScreen` helper (the same way `financeRefundsModule` already was an exception) — the module's own `label` is **"Finance Dashboard"**, while an explicit `nav.label: "Dashboard"` override keeps the **sidebar wording completely unchanged**: "Dashboard" under the "FINANCE" group heading already disambiguated it there, so nothing about the sidebar needed to move. This is the same per-placement `nav.label` override the `analytics` module already uses for its two different sidebar homes — not a new registry concept.

**A second, more consequential defect surfaced while verifying this one:** the card did not render for *any* role, before or after the label change. Its `capability` field was `"finance.view"` — a permission module id that has **never existed** in `PERMISSION_CATEGORIES` (only a `finance` *category*, grouping fees/invoices/payments/receipts/analytics, exists — no module inside it is named `finance`). No role document, seeded or custom, could ever hold it. Same defect class as D2/D3, just undiscovered until the card's *visibility* was checked rather than only its label.

Fixed by pointing the capability at `invoices.view` instead of inventing a new permission module: the underlying `/finance/dashboard` page is already gated by the `finance-dashboard` routeKey, granted via `FINANCE_UI_ROUTE_KEYS` to exactly `admin`/`center_owner`/`center_admin`/`accountant` — the same four roles that already hold `invoices.view` in `SYSTEM_ROLES`. So this reuses an existing, correctly-granted capability rather than widening anything: the card becomes visible to precisely the audience that could already reach the page it links to.

**Verified live** (Centre Owner, after the fix): the Care grid shows **"Finance Dashboard"** with no bare "Dashboard" card, and the sidebar under **FINANCE** still reads **`Dashboard → Student Ledger → Billing Plans → …`**, byte-for-byte unchanged.

### N3 — reseeding invalidated live browser sessions

`seedAuthUsers()` used to `deleteUser()` then `createUser()` on every reseed. Deleting a Firebase Auth user immediately invalidates every ID/refresh token tied to that UID, so any browser signed in as a demo account was silently logged out mid-reseed.

Fixed by checking existence first (`auth.getUser(uid)`) and calling `updateUser()` in place when the account already exists — the Auth emulator only revokes live sessions on `deleteUser()` or an explicit `revokeRefreshTokens()` call, neither of which this path exercises anymore. The password is deliberately **not** reset on the update path: it is a fixed constant that never legitimately drifts, so resetting it on every run would be a further unnecessary write for no benefit — only newly created accounts receive an explicit password.

**Verified empirically, not just by reading the SDK docs:** signed in as Reception, ran a full reseed, then — *without re-authenticating* — called `getIdToken()` and hit an authenticated API endpoint: `200`, no re-login required. Confirmed again through the actual app: navigated to `/dashboard` post-reseed and stayed there (no redirect to `/login`).

**Aside, not fixed, out of scope for this pass:** Reception's *emulator-only* fixture already granted `incidents.view` from the original seed script (predating the access-diff review, which did not include Reception in that grant for production). Harmless — it only affects local test data — but noted here rather than silently left unexplained, since it produces one more Dashboard tile for Reception in the emulator than the static per-role harness expects.

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
