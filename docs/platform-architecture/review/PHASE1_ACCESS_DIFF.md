# Phase 1 — access restoration diff, for review

**Status: NOT APPLIED. NOT MERGED.** Nothing in this document has been committed to the permission plumbing. The accompanying patch is a proposal.

**Patch:** [`phase1-safe-access.patch`](phase1-safe-access.patch) — one file, `yellowdot-backend/services/roleService.js`.

---

## 1. What is broken

19 routeKeys gating 46 shipped screens cannot be granted to **any** non-bypass role. This is not a configuration problem and no Firestore edit can fix it:

```
effective(role) = deriveRouteKeys(roleDoc.permissions) ∪ STATIC_ROLE_PERMS[role]
```

`deriveRouteKeys()` can only ever emit keys that appear as **values** in `roleService.js`'s `MODULE_ROUTE_MAP`. The affected keys appear in neither that map nor in `STATIC_ROLE_PERMS`, so **both terms of the union exclude them, for every role, under every possible role document.**

`ProtectedRoute` then sends `can(routeKey) === false` straight to `/unauthorized`, and the sidebar hides the item.

`developer` and `super_admin` are unaffected — `isBypassRole()` short-circuits every check before it. That is almost certainly why this survived: the modules work perfectly when tested as a developer and fail only for real staff.

## 2. Why it happened — three role maps, and the authoritative one is the stale one

| Map | Governs? | Reached by |
|---|---|---|
| `yellowdot-backend/services/roleService.js` `STATIC_ROLE_PERMS` | ✅ **authoritative** | `getPermissionsForRole` → `/api/auth/me` → `can()` and `authorizeRoute()` |
| `yellowdot-backend/config/permissionsBackend.js` `ROLE_PERMISSIONS` | ❌ dead | only `getPermissions()`, which has **no callers** |
| `yellowdot-frontend/src/config/permissions.js` `ROLE_PERMISSIONS` | ❌ not for real users | developer role-switcher only |

The two non-governing maps were kept up to date as modules shipped. The one that actually resolves permissions was not.

**Evidence quality differs by key, and the patch is built on it:**

| Keys | In backend mirror | In frontend map | Confidence |
|---|---|---|---|
| `care-hygiene`, `child-journey`, `cctv`, `qr-management`, `staff-checkout`, `academics-student-allocation`, `families` | ✅ | ✅ | **High** — two independent maps agree |
| `events`, `incidents`, `ptm` | ❌ | ✅ | **Medium** — frontend only. Included because all three are shipped modules with sidebar entries that currently dead-end, but flag if any was meant to stay restricted. |

## 3. What the patch does — safe subset only

Adds the missing keys to `STATIC_ROLE_PERMS`. **Purely additive: no role loses anything.**

| Role | Keys gained |
|---|---|
| `admin` | academics-student-allocation, care-hygiene, cctv, child-journey, events, families, incidents, ptm, qr-management, staff-checkout |
| `center_owner` | *same 10 as admin* |
| `center_admin` | academics-student-allocation, care-hygiene, child-journey, events, incidents, ptm, qr-management, staff-checkout *(8 — no cctv/families, matching the existing mirror)* |
| `teacher` | academics-student-allocation, care-hygiene, cctv, child-journey, events, incidents, ptm, staff-checkout *(8)* |
| `reception` | staff-checkout *(1)* |
| `accountant`, `parent` | *none — no divergence* |

**One caveat on `families`:** granting it is correct but inert until the Families module is routed at all — it is one of the two orphans from Phase 0 (`knownGaps.js`). The key and the route should land together.

## 4. What the patch deliberately does NOT do

**Every HR, Payroll and Performance key is excluded**, pending the `self` / `team` / `all` scope model (architecture §2c.1, added in rev 1.1):

```
departments, designations, staff-dashboard, staff-management,
staff-attendance, staff-attendance-manage, staff-shifts,
staff-leave, staff-leave-approve, staff-leave-types,
staff-payroll, staff-payroll-process,
staff-performance, staff-performance-manage
```

The reason is concrete. Both existing maps grant `teacher` the keys `staff-payroll` and `staff-performance` — evidently intending "a teacher can see their own payslip and their own review." But those keys are all-or-nothing: applying them as written would give **every teacher the payroll and performance modules for the entire school.**

That is the gap the scope model closes:

| Role | `staff_payroll.view` | `staff_leave.view` | `staff_leave.approve` | `staff_performance.view` |
|---|---|---|---|---|
| Teacher | `self` | `self` | `none` | `self` |
| Principal / Center Admin | `team` | `team` | `team` | `team` |
| Center Owner | `all` | `all` | `all` | `all` |
| Accountant | `none` | `none` | `none` | `none` |

`team` resolves through `staff.reportingManagerId`, which already exists.

**This requires backend work before it is safe**: every HR endpoint that today returns "all rows for the school" needs a scope-aware filter, resolved server-side from the authenticated user — never from a client-supplied parameter. Frontend gating alone would hide the button while leaving the endpoint open.

## 5. Applying and verifying

```bash
git apply docs/platform-architecture/review/phase1-safe-access.patch
```

Then, from `yellowdot-frontend/`:

```bash
npm run verify:permissions
```

The harness will report the exact per-role delta against the committed baseline and **fail** on anything lost. Expected result: gains only, matching the table in §3 — after which `permissions-baseline.json` is regenerated with `-- --update-baseline` in the same commit, so the new state becomes the guarded baseline.

## 6. Open questions for the reviewer

1. **`events`, `incidents`, `ptm`** rest on frontend-only evidence. Confirm all three were meant to be staff-accessible.
2. **`cctv` for `teacher`** — present in both maps, and `permissions.js` annotates it "Live View — classroom-scoped in resolver". Worth confirming the resolver actually scopes it, since the key itself does not.
3. **`center_admin` gets neither `cctv` nor `families`** while `admin` and `center_owner` get both. Preserved from the existing mirror rather than normalised — confirm it is intentional and not itself a drift artifact.
4. **Is this a hotfix?** If real staff are hitting `/unauthorized` on these modules in production today, the safe subset is independent of the refactor and need not wait for Phase 7.
