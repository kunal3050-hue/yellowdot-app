# Changelog

All notable changes to the KUE BOXS Care / Yellow Dot backend and platform are recorded here. This file starts retroactively at the Production Hardening security program (Milestone 2) — earlier history is available via `git log` and `docs/production-ops/00`–`08`, but wasn't reconstructed into changelog form to avoid inventing detail that wasn't contemporaneously recorded.

Format is loosely [Keep a Changelog](https://keepachangelog.com/); dates are `YYYY-MM-DD`.

## [Unreleased]

### Security
- Security Hardening Phase Completion Report produced after M16: all 10 Critical findings and all 5 tenant-isolation-shaped High findings across the whole program (M2–M16) are now closed. 9 infrastructure/hardening-shaped Highs from the original 2026-07-13 audit remain open and out of this program's scope. See `docs/production-ops/31_SECURITY_HARDENING_PHASE_COMPLETION_REPORT.md`, `29_SECURITY_COVERAGE_MATRIX.md`, `30_PRODUCTION_READINESS_REPORT_V2.md`.

## [M16] — 2026-07-14

### Security
- **Fixed**: `communicationRoutes.js` — holidays/notices/announcements update/delete had no `schoolId` check (any staff with write/delete permission could edit or delete another school's public content). Added `getHoliday`/`getNotice`/`getAnnouncement` getters and wired `checkTenantAccess` into all six mutation routes.
- **Fixed**: `updateHoliday`/`updateNotice`/`updateAnnouncement` spread the raw request body directly into the Firestore update, including any client-supplied `schoolId` — a legitimate same-school writer could reassign a record into a different tenant's namespace. Added `_stripImmutable()` to drop `schoolId`/`id` from every update body.
- Commit: `b5220ef`. Full report: `docs/production-ops/28_MILESTONE_16_COMMUNICATION_MODULE_HARDENING.md`.

## [M15] — 2026-07-14

### Security
- **Fixed**: `attendanceRoutes.js`'s `checkOut()` (falsifiable check-out time for a foreign school's student) and `generateStudentQR()` (valid check-in QR generated for any studentId, no tenant check).
- **Fixed**: `staffAttendanceRoutes.js` — `staffMonth`, attendance record update/remove, and shift update/remove all lacked tenant checks.
- **Fixed**: `qrRoutes.js` — center-QR read/regenerate had no tenant check; `qrConfigs` carries no `schoolId` of its own, so added a bespoke `qrService.centerBelongsToSchool()` check instead of the generic helper.
- Commit: `88ba04e`. Full report: `docs/production-ops/27_MILESTONE_15_ATTENDANCE_PLATFORM_HARDENING.md`.

## [M14] — 2026-07-14

### Security
- **Fixed**: `ptmService.rescheduleBooking()`/`cancelBooking()` accepted a `parentId` argument and never checked it — any authenticated parent, any school, could reschedule or cancel any other parent's PTM booking by ID. Lowest attacker-privilege-bar finding across the whole program (parent role, not staff/admin).
- **Fixed**: `POST /api/parent/ptm/:id/book` now tenant-checks the target PTM; `GET /api/parent/ptm` no longer trusts a client-supplied `studentId` and uses the parent's real `schoolId` instead of a hardcoded fallback.
- **Fixed (follow-up, same day)**: `req.parent.parentId` doesn't exist — the parent-profile object only carries `.uid`. Every PTM call site had silently been passing `undefined` as the ownership key, defeating the fix above until caught by this milestone's own live verification. Switched to `parent.uid` everywhere.
- **Fixed**: missing `ptmBookings` (ptmId+studentId+status) composite index, found blocking `GET /api/parent/ptm` for every parent in production — pre-existing, unrelated to the ownership fix, same class of gap as the M8 PTM index issue.
- Commits: `e626c83`, `ab0f588`, `7821dd0`. Full report: `docs/production-ops/26_MILESTONE_14_PTM_BOOKING_OWNERSHIP.md`.

## [M13] — 2026-07-14

### Security
- **Fixed**: `staffRoutes.js` — every by-ID endpoint (`GET/PUT/DELETE/:staffId`, `restore`, `invite`, `link-user`, `unlink-user`, `disable-user`) lacked a tenant check, exposing cross-tenant staff PII and allowing role escalation via the mutable `role` field and Auth-account lockout via `disable-user`.
- **Fixed**: `staffController.invite()`'s `_ensureAuthUser()` writes a real `users/{uid}` Firestore document directly — a second, parallel account-creation path entirely separate from `userService.js`, which used `staff.role` with no validation at all. Now routes through `userService`'s `_resolveAssignableRole()`, closing the same class of bypass-role escalation M12 closed for `userRoutes.js`.
- Commit: `f75a26c`. Full report: `docs/production-ops/25_MILESTONE_13_STAFF_MANAGEMENT_TENANT_ISOLATION.md`.

## [M12] — 2026-07-14

### Security
- **Fixed**: systemic cross-tenant IDOR (H1) across `payrollController.js`, `leaveController.js`, `performanceController.js`, `familyRoutes.js`, `departmentController.js`, `designationController.js`, `roleRoutes.js`, `userRoutes.js` — every by-ID fetch/update/delete now verifies the record's `schoolId` matches the caller's before proceeding, reusing `checkTenantAccess` from Milestone 8.
- **Fixed**: role-escalation path in `userService.js` — a client-supplied `role` of `developer`/`super_admin` could previously be granted to any user, any tenant, through the ordinary user-management API. Now capped via `ASSIGNABLE_ROLES`/`_resolveAssignableRole()`.
- **Fixed (stopgap)**: cross-tenant mutation of shared `roles/{admin|teacher|...}` system-role documents via `roleRoutes.js`. The underlying shared-document data model (fixed slug, first-writer-wins seeding) is unchanged — tracked as accepted debt pending a dedicated migration.
- **Added**: `permissionAuditLogs` composite Firestore index (`roleId`+`schoolId`+`timestamp`) so audit-log reads are scoped server-side, not just pre-checked.
- **Added**: `SECURITY_ARCHITECTURE.md` as the canonical authorization/tenant-isolation reference (introduced just before M12, extended by it).
- Commit: `d958c93`. Full report: `docs/production-ops/23_MILESTONE_12_HR_FINANCE_ADMIN_TENANT_ISOLATION.md`.

## [M11] — CCTV credential protection (Critical C8)
- **Fixed**: `mask()` now scrubs `password` and every embedded-credential URL field (`streamUrl`, `mainStreamUrl`, `liveStreamUrl`, and the snake_case `stream_url` alias — the last one missed in the first pass and caught by the milestone's own production verification).
- **Added**: `extractUrlCredentials()` — a custom RTSP `streamUrl` with embedded `user:pass@` is parsed server-side at create/update time so the stored URL is always credential-free.
- Commits: `cc11fb3`, `3d6738a`.

## [M10] — Pickup authorization & CCTV configuration tenant isolation (Critical C7)
- **Fixed**: `pickupAuthorizationController.js` update/delete and `cctvController.js` update/delete/test/verify now tenant-check before mutating.
- **Fixed**: `cctvAccessResolver.js`'s `canViewCamera`/`canParentViewCamera` — bypass roles (`developer`/`super_admin`) previously had no tenant restriction at all; the school check now runs before any role branch.
- Commit: `cc3285f`.

## [M9] — Child Journey authorization & ownership (Critical C6)
- **Fixed**: `journeyRoutes.js` staff routes gated `staffOnly`; parent route (`GET /api/parent/journey`) now ignores any client-supplied `childId` in favor of the server-resolved linked child.
- Commit: `aa2e5f0`.

## [M8] — Events & PTM authorization and tenant isolation (Critical C5)
- **Fixed**: `eventRoutes.js`/`ptmRoutes.js` — added missing `staffOnly`/`blockUnknown` gates and wired `checkTenantAccess` (new, reusable) into by-ID mutation routes.
- **Added**: `middleware/tenantRecordAccess.js` — the generic `checkTenantAccess(req, record)` helper reused by every milestone since.
- Commit: `42a7551`.

## [M7] — Incident reports authorization and tenant isolation
- **Fixed**: `incidentRoutes.js` — staff-only gating plus tenant isolation on by-ID routes.
- Commit: `ffcfd75`.

## [M6] — Student CRUD tenant isolation (Critical C3)
- **Fixed**: student `GET`/`PUT`/`DELETE` (inline in `server.js`) now tenant-check before returning/mutating.
- **Accepted debt**: student IDs remain globally sequential, not namespaced per school — tenant checks make ID-guessing irrelevant to authorization, so this was deliberately not changed.
- Commit: `0de95e2`.

## [M5] — Student medical records & private notes access control
- **Fixed**: `students/{id}/medical` and `students/{id}/notes` subcollection routes — ownership (parent-own-child) + tenant checks; notes remain staff-only, zero parent visibility by design.
- Commit: `1bbea9d`.

## [M4] — `sync-user` role self-assignment (Critical C1)
- **Fixed**: `POST /api/auth/sync-user` could previously let any signed-up user grant themselves an arbitrary role (including `super_admin`) via the request body. `req.user` is now built entirely from server-verified data; the route never reads `role`/`permissions`/`schoolId`/`tenantId`/`center` from the request body.
- Commit: `6a7cb29`.

## [M3] — Billing / invoice data leak
- **Fixed**: `scopeFinanceQuery`/`checkInvoiceOwnership` (new, `middleware/requestScope.js`) — parents can no longer request another family's invoice by supplying a different `studentId`/invoice number; the server always overrides with the caller's own linked child.
- Commit: `0ccd606`.

## [M2] — Pickup-authorization IDOR
- **Fixed**: pickup-approve/reject routes now check ownership/tenant before acting.
- Commit: `b2378ab`.

---

*Retroactive entries above were reconstructed from `git log` and the corresponding dated reports in `docs/production-ops/`; treat commit hashes as authoritative over any prose summary here if they ever disagree.*
