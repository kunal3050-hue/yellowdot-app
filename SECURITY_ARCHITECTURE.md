# Security Architecture — KUE BOXS Care

**Status: canonical.** This document is the source of truth for authentication, authorization, tenant isolation, and ownership verification across the entire backend. It was written after Milestones 2–11 of the Production Hardening program closed all 8 Critical findings (C1–C8) from the 2026-07-13 security audit, each fix following the same pattern independently before this document unified them.

**All future modules must conform to the patterns below by reusing the existing middleware/helpers named here — not by inventing new authorization logic.** If a new requirement genuinely doesn't fit an existing pattern, extend this document in the same commit that introduces the new pattern, so it never drifts out of date.

---

## 1. Authentication flow

Every protected route starts with `authenticate` (`middleware/authMiddleware.js`):

1. Verify the Firebase ID token from the `Authorization: Bearer <token>` header via `auth.verifyIdToken(token)`. Reject (`401`) if missing or invalid.
2. Resolve identity from Firestore, in this order:
   - **Direct staff match**: `users/{uid}` doc exists → build `req.user` from it (`role`, `schoolId`, `centerId`, `centers`, `permissions`).
   - **Email fallback**: no direct match, but a `users` doc exists with the same `email` (handles the Google-OAuth-creates-a-new-UID case) → use that profile, auto-link the new UID to it for next time.
   - **Parent match**: no staff doc at all, but a `students` doc exists with `fatherEmail` or `motherEmail` equal to the caller's email → `req.user.role = "parent"`, `req.user.student = {studentId, studentName}`.
   - **Unknown**: none of the above → `req.user.role = "unknown"`, `req.user.profileMissing = true`.
3. `req.user` is built **entirely from server-verified data**. Nothing in `req.body`/`req.query`/`req.params` ever influences `role`, `schoolId`, `permissions`, or identity — this is the single most important invariant in the system (see Milestone 4 / Critical C1: `POST /api/auth/sync-user` used to violate this and let any signed-up user grant themselves `super_admin`).

**New-account provisioning**: staff accounts are created only through the admin-gated `POST /api/users`. Parent accounts are never explicitly "created" — they're resolved automatically by the email match above. There is no self-service path that lets an account choose its own role.

---

## 2. Authorization model

Composable Express middleware, all in `middleware/authMiddleware.js` unless noted:

| Middleware | Behavior |
|---|---|
| `authenticate` | Verifies the token, populates `req.user`. Always first. |
| `blockUnknown` | Rejects `role === "unknown"` (`403`). Use on any route real users depend on. |
| `staffOnly` | Rejects `"unknown"` and `"parent"` (`403`); bypass roles always pass. Use on every staff-only router. |
| `authorize(...roles)` | Allow-list of specific roles; bypass roles always pass. Use when only *some* staff roles should act (e.g. camera configuration is admin-tier only). |
| `authorizeRoute(routeKey)` | Permission-array check against `req.user.permissions` (`*` or the specific key). Use for frontend-module-shaped permission gates. |
| `requireOwnChild` | Parent-only; if `studentId` appears in `params`/`query`/`body`, it must match the linked child; sets `req.ownChildId`. **Only recognizes the field name `studentId`** — a route using a different param name (e.g. `childId`) must not rely on this validation alone (see §4). |

**Bypass roles**: `developer`, `super_admin` (`config/permissionsBackend.js`'s `isBypassRole`/`BYPASS_ROLES`). These bypass **role-tier** restrictions (e.g. center-scoping) within their own school. **They do not bypass the tenant boundary** — see §3. This is distinct from the platform-level Super Admin (tenant management, impersonation — a separate `tenants`-collection mechanism, out of scope for this document).

**Staff role set** used by tenant-check helpers (`middleware/studentAccess.js`, `middleware/studentRecordAccess.js`): `developer, super_admin, admin, center_admin, teacher, accountant, reception`.

---

## 3. Tenant isolation model

Every tenant-scoped Firestore collection carries a `schoolId` field. The rule, with no exceptions:

> **`schoolId` is always derived from `req.user.schoolId` (server-verified), never from client input.** Every by-ID read/update/delete must verify the fetched record's `schoolId` matches the caller's before proceeding.

**List/query endpoints**: filter by `schoolId` directly in the Firestore query (`.where("schoolId", "==", schoolId)`) — this is naturally tenant-safe as long as `schoolId` itself is server-resolved (see `resolveContext`/`resolveCtx` helpers repeated per-controller: `server.js`, `incidentRoutes.js`, `journeyRoutes.js`, `pickupAuthorizationController.js`, `cctvController.js`).

**By-ID endpoints** (`GET/PUT/DELETE .../:id`): fetch the record first, then check tenant membership, **before** calling the mutating service function:

```js
const existing = await someService.getOne(id);
if (!checkTenantAccess(req, existing).allowed) {
  return res.status(404).json({ error: "Not found." }); // hide cross-tenant existence
}
// ...proceed with the real operation
```

**Reuse `middleware/tenantRecordAccess.js`'s `checkTenantAccess(req, record)`** for this — it's deliberately generic (works for any `{schoolId}`-shaped record: events, PTMs, pickup-authorization entries, cameras) and already tested. Don't write a new tenant-check function unless the record's shape genuinely needs bespoke logic (e.g. `middleware/incidentAccess.js`, `middleware/studentAccess.js`, `middleware/studentRecordAccess.js` exist because those modules needed an additional parent-ownership branch alongside the tenant check — see §4).

**Cross-tenant denial is always `404`, never `403`.** A `403` confirms the record exists in another tenant; `404` doesn't. Every milestone in this program follows this convention.

**Bypass roles are tenant-scoped too.** `cctvAccessResolver.js`'s `canViewCamera()` used to grant `developer`/`super_admin` visibility across *every* school — a real, closed vulnerability (Critical C7 / Milestone 10). The fix: the `schoolId` check runs **before** any role branch, including the bypass-role branch. Any new resolver-style function must do the same — check tenant first, unconditionally, then apply role logic only after confirming same-school.

**Known, accepted architectural debt**: student IDs (`YD001`, `YD002`, …) are assigned from a single counter shared across every tenant on the platform, not namespaced per school (see Milestone 6 / Critical C3). This was deliberately **not** changed — the tenant check above makes ID-guessing irrelevant to authorization (a correctly-guessed foreign-tenant ID still 404s), and renamespacing would require migrating every other collection that stores a bare `studentId` as a foreign key (invoices, payments, `pickupRequests`, attendance, `medical`/`notes` subcollections, memories, `careLogs`). Do not "fix" this incidentally inside an unrelated module's milestone — it needs its own dedicated, cross-cutting migration if ever undertaken.

---

## 4. Ownership verification model

Distinct from tenant isolation: **ownership** answers "does this specific record belong to *this* parent's child?" — relevant only for parent-facing routes.

- The caller's linked child is `req.user.student.studentId` (set by `authenticate`, resolved from the `students` collection's `fatherEmail`/`motherEmail` match — see §1). **Never trust a client-supplied student/child ID for a parent.**
- Two valid patterns, pick based on what the route needs:
  1. **Force, don't validate** — ignore whatever ID the client sent; always query using the server-resolved linked child. Used by `scopeFinanceQuery()` (Milestone 3) and `journeyRoutes.js`'s parent route (Milestone 9, which explicitly discards `req.query.childId` in favor of `req.ownChildId`). Preferred when the endpoint has no legitimate reason to ever return another child's data.
  2. **Validate, then use the server value** — `requireOwnChild` middleware: if a `studentId` param is present, it must match; either way `req.ownChildId` becomes the value handlers use. Preferred when reusing existing middleware is cleaner than restructuring a handler.
- **`requireOwnChild` only recognizes the literal field name `studentId`** in `params`/`query`/`body`. A route using a differently-named parameter (e.g. `childId`) will silently skip the match check if you rely on it naively — either rename the param, or use pattern (1) above and ignore the mismatched field entirely (this is exactly what Milestone 9 did rather than widen the shared middleware's blast radius).
- **Ownership violation within the same tenant → `403`** ("you can only access your own child's records"). **Cross-tenant → `404`** (§3's rule still applies — check tenant before ownership, always in that order, since a cross-tenant record shouldn't even reveal that a "wrong child" scenario is happening).
- Parents are single-child in this resolution path (one `fatherEmail`/`motherEmail` match). Multi-child/family scenarios are handled by a separate, newer `parents/{uid}` document model (see the Family & Sibling Management module) — don't assume every parent-facing route needs to handle multiple linked children unless it explicitly uses that newer model.

---

## 5. Parent access model

Parents may access:
- Their own child's data, exclusively through dedicated `/api/parent/*` routes (`parentRoutes.js`, `journeyRoutes.js`'s `/api/parent/journey`, `incidentRoutes.js`'s `/api/parent/incidents*`, `cctvController.js`'s `parentCameras`/`parentLiveToken`).
- Never the staff-side equivalent of any of the above — `staffOnly` (or an explicit `role !== "parent"` check) must gate every staff route, with no exceptions carved out for "just reading."

Parents may **never** access:
- Student notes (`students/{id}/notes` — private staff observations, zero parent visibility by design, confirmed against `firestore.rules`' own intent).
- The unfiltered staff view of Journey entries (`GET /api/journey`) — this bypasses the `visibility !== "staff_only"` filter the parent-safe view applies.
- Any CCTV configuration route, PTM/Events staff mutation route, or pickup-authorization mutation route.

**A parent-facing exception is a product decision, not a security shortcut.** If parents need access to something currently staff-only, build a dedicated, separately-scoped `/api/parent/*` route with its own ownership check (per §4) — never relax the staff-side route's gate to "let parents through too."

---

## 6. Staff access model

Staff roles (`teacher, accountant, reception, center_admin, admin, super_admin, developer`) get full access to any record **within their own school** (`schoolId` match — §3), further scoped by role where the module requires it:

- **Broad, any-staff-role access**: incidents, events, PTM, journey (any staff member may view/manage any student's records in their own school — matches how a preschool actually operates, front-desk staff included).
- **Role-tiered access**: CCTV camera configuration (`CONFIGURE_ROLES = [super_admin, developer, admin]` for add/edit/delete; `ASSIGN_ROLES` adds `center_admin`/`center_owner` for classroom-assignment and connection-testing). HR/payroll routes similarly restrict by role via `authorizeRoute`/`authorize`.

**A staff role — even a bypass role — never crosses the school boundary.** See §3.

---

## 7. Admin access model

"Admin" in this system means two genuinely different things — do not conflate them:

1. **School-level admin/bypass roles** (`admin`, `center_admin`, `super_admin`, `developer` as a **staff role** stored on a `users/{uid}` doc with a specific `schoolId`). These see everything **within their own school**, bypassing center-level restrictions for `developer`/`super_admin` specifically. This is what §2/§3/§6 describe.
2. **Platform Super Admin** (a separate mechanism: the `tenants` collection, `tenantMiddleware.js`, and the impersonation flow described in the Multi-Tenant SaaS Layer). This is the only legitimate way to act across every tenant on the platform. It is not a role value on a regular `users/{uid}` doc, and no regular authorization check in this document should ever grant cross-tenant access as a side effect of a "bypass" role — if that ever happens, it's a bug (see the CCTV resolver fix in §3).

---

## 8. CCTV security model

- **Visibility**: `services/cctvAccessResolver.js`'s `canViewCamera(user, camera)` (staff) and `canParentViewCamera(child, presence, camera, opts)` (parent) are the single source of truth for "can this caller see/stream this camera?" Every route that touches a specific camera by ID must call one of these (or the generic `checkTenantAccess` for non-viewing operations like update/delete/test/verify) — never re-derive visibility logic inline.
- **Credentials at rest**: `services/cryptoService.js` (AES-256-GCM) encrypts the `password` field; `CCTV_ENCRYPTION_KEY` + `CCTV_REQUIRE_ENCRYPTION=true` must both be set in production (they are, as of Milestone 11 — see `docs/production-ops/22_MILESTONE_11_CCTV_CREDENTIAL_PROTECTION.md` for the key's location and the migration that encrypted the one previously-plaintext password).
- **Credentials never in `streamUrl`**: a custom RTSP URL supplied with embedded `user:pass@` is parsed server-side by `cctvService.js`'s `extractUrlCredentials()` at create/update time — the stored `streamUrl` is always credential-free; the parsed username/password populate the dedicated fields instead (which the two protections above already cover).
- **Client-facing responses are always masked**: `cctvController.js`'s `mask()` scrubs `password` and any embedded credentials in `streamUrl`, `mainStreamUrl`, `liveStreamUrl`, and the snake_case `stream_url` alias `docToCamera` also emits. **Any new field derived from a camera's stream URL must be added to `mask()` too** — this was missed once already (a same-day bug caught by Milestone 11's own live verification) precisely because a new alias field was added without updating the masking function.
- **`getOneWithSecret()`** (decrypted password) is server-side only. Any route that needs it must run the tenant check against the plain `getOne()` result **first**, and only call `getOneWithSecret()` once access is confirmed (see `verifyCamera` in `cctvController.js`).

---

## 9. Journey security model

- **Staff side** (`POST/GET/PUT/DELETE /api/journey`, `POST /api/milestones`, `POST /api/milestones/check`): `staffOnly`-gated, full school-wide access, no per-child ownership check needed (any staff member may manage any child's journey in their own school).
- **Parent side** (`GET /api/parent/journey`): `requireOwnChild`-gated; the route ignores any client-supplied `childId` query param entirely in favor of the server-resolved `req.ownChildId` (see §4's "force, don't validate" pattern).
- **Visibility filtering** happens at the service layer, not the route layer: `journeyService.getForStudent()` (parent view) filters out `visibility === "staff_only"` entries; `getForStaff()` (staff view) does not filter at all. Never let a parent reach `getForStaff()`'s output — that's exactly the C6 vulnerability Milestone 9 closed.
- **Tenant isolation** for update/delete is already enforced inside `journeyService.js` itself (`updateEntry`/`deleteEntry` throw `"Forbidden."` on `schoolId` mismatch) — a rare case where the service layer, not the route layer, owns the check. Confirm this is still true before assuming a new journey-adjacent route needs its own route-level tenant check.

---

## 10. Billing security model

- **Parents**: `middleware/requestScope.js`'s `scopeFinanceQuery(req, requestedStudentId)` **always overrides** a parent's requested `studentId` with their own linked child — the client-supplied value is read but never trusted for that role. Same file's `checkInvoiceOwnership(req, invoice)` handles the single-invoice-by-number case (parent viewing another family's invoice → `404`, not `403`, since invoice numbers can be somewhat guessable).
- **Staff**: full access within their own school; `resolveContext(req).schoolId` is always server-resolved, so list queries are tenant-safe by construction.
- **Fee templates**: staff-only for both read and write (`staffOnly` + `blockUnknown`) — no legitimate parent-facing use case exists in the current product; matches `firestore.rules`' own documented intent for this collection.
- **Reuse `scopeFinanceQuery`/`checkInvoiceOwnership`** for any new finance-adjacent endpoint rather than writing a new parent-scoping check — they're already the canonical pattern other modules (student CRUD, incidents) borrowed the "force the server value" idea from.

---

## How to secure a new module (checklist)

1. **Router-level role gate first.** `router.use(path, authenticate, blockUnknown, staffOnly)` for staff-only routers (see `incidentRoutes.js`, `eventRoutes.js`, `ptmRoutes.js`), or `authenticate` + `requireOwnChild`/an explicit `role === "parent"` check for parent-only ones.
2. **Every by-ID route**: fetch the record, call `checkTenantAccess(req, record)` (import from `middleware/tenantRecordAccess.js`) before doing anything else. If the module also needs parent-ownership logic, write a small dedicated wrapper the way `middleware/studentAccess.js`/`middleware/incidentAccess.js` do — don't duplicate the tenant-check logic itself.
3. **Never build `schoolId` from client input.** Use the existing `resolveContext`/`resolveCtx` pattern (derive from `req.user.schoolId`) already present in every controller.
4. **Cross-tenant → `404`. Same-tenant ownership violation → `403`.** Check tenant first, always.
5. **List endpoints**: filter the Firestore query by `schoolId` directly; this alone is tenant-safe as long as `schoolId` came from step 3.
6. **Write automated tests** covering: same-tenant staff access (allowed), cross-tenant staff access (blocked, `404`), parent-own-record (allowed, where applicable), parent-other-record (blocked, `403`), unauthenticated (`401`), and — for any by-ID mutation — an end-to-end test proving the underlying service function is **never called** for a blocked cross-tenant target (mock the service, assert the mock wasn't invoked).
7. **Verify live in production** with temporary Firebase accounts across at least two tenants before considering the module done, then delete all test data and independently re-verify the deletion.

---

## Reusable helpers reference

| File | Exports | Use for |
|---|---|---|
| `middleware/authMiddleware.js` | `authenticate, authorize, authorizeRoute, blockUnknown, staffOnly, requireOwnChild` | Role gating, own-child validation |
| `middleware/tenantRecordAccess.js` | `checkTenantAccess(req, record)` | Generic `{schoolId}` tenant check — reuse before writing a new one |
| `middleware/requestScope.js` | `resolveContext, scopeFinanceQuery, checkInvoiceOwnership` | Finance/billing scoping |
| `middleware/studentAccess.js` | `checkStudentAccess(req, student)` | Student CRUD (parent-own-child + staff-same-school) |
| `middleware/studentRecordAccess.js` | `checkMedicalAccess, checkNotesAccess` | Medical (parent+staff) vs. notes (staff-only) |
| `middleware/incidentAccess.js` | `checkIncidentAccess(req, incident)` | Incident reports tenant check |
| `services/cctvAccessResolver.js` | `canViewCamera, canParentViewCamera, filterViewableCameras` | CCTV visibility (staff + parent) |
| `config/permissionsBackend.js` | `isBypassRole, BYPASS_ROLES, ROLE_PERMISSIONS, ROLE_HOME` | Role classification |

*Document owner: update this file in the same commit whenever a new authorization pattern is introduced, or an existing one changes. Last updated 2026-07-13 (Milestones 2–11).*
