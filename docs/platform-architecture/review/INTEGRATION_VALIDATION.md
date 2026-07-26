# Staff experience — integration validation

**Status: items 1–2 BLOCKED (see §4). Item 3 COMPLETE. Item 4 below.**
**Date:** 2026-07-26
**Gate:** these must all be resolved before `/dashboard` becomes the default landing page.

| # | Validation | Status |
|---|---|---|
| 1 | Dashboard against a live backend, all widgets populate | ⛔ **Blocked** — needs an environment decision (§4) |
| 2 | Care against a live backend: generation, prioritisation, escalation, completion | 🟡 **Partial** — rules verified deterministically; data path blocked |
| 3 | Per-role validation across all staff roles | ✅ **Complete** — `npm run verify:roles` |
| 4 | Document discrepancies and fix before routing changes | ✅ **Documented below**, fixes held for review |

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
