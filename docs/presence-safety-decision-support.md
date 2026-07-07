# Presence & Safety — Decision-Support Document

**Purpose:** This document surfaces the structural tensions, open decisions, and constraints the team must resolve *before* redesigning the Presence & Safety area. It does not propose a redesign. It exists so that product, engineering, and operations can align on what they are building before any work begins.

**Basis:** Functional audit of all seven modules (June 2026). Every claim below is grounded in audited code, not assumptions.

---

## 1. Current Architecture — Snapshot

Seven modules. Four Firestore collections. Two overlapping check-in/out flows. One external infrastructure dependency.

### Collections that matter

| Collection | What it stores | Written by |
|-----------|---------------|-----------|
| `attendance` | Staff-initiated check-in/out (manual mark or QR scan) | Attendance module |
| `parentAttendance` | Parent-initiated gate entry/exit + Staff Checkout | Parent Entry, Staff Checkout |
| `pickupLogs` | Both authorized-person records (type=authorization) AND pickup event history (type=history) | Pickup Authorization, Parent Entry, Staff Checkout |
| `pickupRequests` | Unknown-person approval requests sent to parent | Staff Checkout |
| `cameras` | CCTV camera config (passwords AES-encrypted) | CCTV |
| `qrConfigs` | Center gate QR codes (base64 PNG + payload) | QR Management |

### How child status is currently determined

There is no `childPresence` document. "Is the child in school right now?" is answered by querying `parentAttendance`, finding the most recent record for that student today, and reading its `action` field:

- Latest action = `Check_In` → **PRESENT**
- Latest action = `Check_Out` → **CHECKED_OUT**
- No records today → **NOT_ARRIVED**

This query runs on every Staff Checkout screen load and on every CCTV parent-token request.

### Two separate check-in/out systems running in parallel

| Event | Who acts | Collection written | Notification fired |
|-------|---------|-------------------|-------------------|
| Staff marks student Present | Staff | `attendance` | ATTENDANCE_MARKED |
| Staff QR scans student | Staff | `attendance` | CHILD_CHECKED_IN / OUT |
| Parent scans gate QR + selfie | Parent | `parentAttendance` | CHILD_CHECKED_IN / OUT |
| Staff processes departure at desk | Staff | `parentAttendance` | CHILD_CHECKED_OUT |

Staff QR scan and parent gate scan produce different notification types but are stored in different collections. A student can appear Present in `attendance` and NOT_ARRIVED in `parentAttendance` simultaneously if staff marked them manually but the parent never scanned the gate.

---

## 2. Structural Tensions

These are not bugs. They are design choices made at different points in time that now pull against each other. Each one has implications for the redesign.

---

### Tension 1 — Two check-in systems, one reality

**What exists:** `attendance` tracks who is marked present by staff. `parentAttendance` tracks who physically passed through the gate. Both fire CHILD_CHECKED_IN/OUT notifications.

**The friction:** Child status (used by Staff Checkout and CCTV parent-view) reads only `parentAttendance`. If a child was marked Present by staff (QR scan → `attendance`) but the parent never scanned the gate, the CCTV parent-view will block because the child shows as NOT_ARRIVED.

**What the team needs to decide:** Are these two systems intentionally independent, or should there be one authoritative presence record that either flow can write to?

**If they are intentionally independent:** Accept that staff attendance and gate presence are separate concerns. Document it explicitly so support staff understand why a child can be "Present" in attendance but "Not Arrived" for parent CCTV access.

**If they should be unified:** Requires a data model decision (see Decision 2 below) and a migration of existing records.

---

### Tension 2 — Staff Checkout writes to the parent entry collection

**What exists:** When a staff member checks out a child from the front desk, it calls `POST /api/parent-attendance` — the same endpoint as a parent scanning the gate QR. The only distinction is `gate: ""` or `gate: "staff-checkout"` in the record.

**The friction:** Child status derivation, audit queries, and parent notifications treat these records identically. A parent receives a CHILD_CHECKED_OUT notification whether their child was checked out by the parent themselves or by a staff member — with no indication in the notification of who performed the action.

**What the team needs to decide:** Is staff checkout the same event as parent gate exit, or is it a distinct operation that should be tracked separately?

**If same:** The current design is correct. Consider adding an `actorType` field (parent / staff) for auditability without changing the data model.

**If distinct:** Staff checkout needs its own collection or at minimum a mandatory discriminator field. Notifications should be differentiated ("Staff checked out [child]" vs "You checked out [child]").

---

### Tension 3 — `pickupLogs` stores two fundamentally different data shapes

**What exists:** Pickup Authorization records (who is on the approved list) and Pickup History records (event log of who actually picked up) both live in a single `pickupLogs` collection, differentiated by `type: "authorization"` and `type: "history"`.

**The friction:**
- Authorization records are long-lived (months/years) and rarely change.
- History records accumulate daily and are append-only.
- Queries must always include a `type` filter or they return mixed results.
- The `pickupAuditLogs` collection tracks changes to authorization records but not history records — the naming is confusing.

**What the team needs to decide:** Is the co-location acceptable, or should authorization and history be separated at the data layer?

**If keeping co-located:** Enforce the `type` filter in all queries (already done; risk is developer error on new queries).

**If splitting:** `pickupAuthorization` and `pickupEvents` become separate collections. Requires a one-time data migration. Simplifies queries and eliminates the `type` discriminator pattern.

---

### Tension 4 — Child status is derived, not stored

**What exists:** There is no document that says "child X is currently in school." Status is computed at request time by querying `parentAttendance` and finding the most recent record.

**The friction:**
- Every call to `GET /api/child-status/:studentId` runs a query.
- CCTV parent token issuance runs this query.
- If the same child has many records in a day (multiple check-ins and check-outs), the query must sort and take the latest.
- There is no way to subscribe to "child just arrived" — a polling or snapshot approach is required.

**What the team needs to decide:** Is real-time presence state needed, or is "current status derived from today's log" sufficient?

**If derived is sufficient:** Current design is acceptable. Consider caching the derived status with a short TTL.

**If real-time presence state is needed:** A materialized `childPresence/{studentId}` document (updated on every check-in/out event) becomes the source of truth. This enables Firestore real-time listeners without querying the log. Requires all check-in/out paths to update this document atomically.

---

### Tension 5 — QR Management is infrastructure, not a feature

**What exists:** A dedicated page in the Presence & Safety sidebar for generating gate QR codes. Used once at setup; never touched again unless the QR is compromised.

**The friction:** It occupies a sidebar slot alongside daily-use screens. Staff unfamiliar with the system may open it looking for something else. The generate/regenerate action carries consequence (old QR stops working immediately) but there is no admin-confirmation gate beyond a modal.

**What the team needs to decide:** Does QR Management belong in the Presence & Safety nav, or should it live in Settings?

**If keeping in Presence & Safety:** Consider adding a visual indicator that distinguishes it as a one-time setup tool.

**If moving to Settings:** No functional change required — just a routing and nav change.

---

### Tension 6 — CCTV requires external infrastructure that may not always be running

**What exists:** Live view works through MediaMTX (an RTSP-to-HLS relay server). The app correctly displays an ENGINE_NOT_PROVISIONED error when MediaMTX is not available. Camera management (add/edit/delete/verify) works without MediaMTX.

**The friction:** The live-view feature, RTSP verification (ffmpeg), and parent live-view token issuance all depend on services outside Railway/Firestore. If MediaMTX is not deployed or goes down, these features silently fail or return errors.

**What the team needs to decide:** Is CCTV live view in scope for the redesign, or should camera management and live view be treated as separate stages?

**If live view is in scope:** Infrastructure availability must be part of the redesign plan. The parent live-view gating logic (school-hours + child-is-present + classroom-match) is already implemented.

**If live view is deferred:** The camera management tabs (add/edit/verify connection) and the classroom mapping view are self-contained and safe to include. Live-view can be gated behind a feature flag until infra is stable.

---

## 3. Decision Register

These are the decisions the team must make before implementation begins. Each one has downstream consequences.

| # | Decision | Options | Constraint if deferred |
|---|----------|---------|----------------------|
| D1 | Are staff attendance and gate presence the same event? | (A) Yes — unify into one record. (B) No — keep split. | Child-status derivation remains ambiguous |
| D2 | Should child presence be a stored document or derived from log? | (A) Materialized `childPresence` doc. (B) Keep derived from log. | CCTV parent-view and Staff Checkout cannot do real-time updates |
| D3 | Is staff checkout distinct from parent gate exit at the data layer? | (A) Same event, add `actorType` field. (B) Separate collection/endpoint. | Parent notifications are undifferentiated |
| D4 | Should `pickupLogs` be split into authorization + events collections? | (A) Split now. (B) Keep with type discriminator. | New developers will make query mistakes without the filter |
| D5 | Where does QR Management live in the nav? | (A) Presence & Safety sidebar. (B) Settings. | Sidebar remains cluttered with a non-daily tool |
| D6 | Is CCTV live view in scope for the redesign? | (A) Full live view in scope. (B) Camera management only. (C) Defer CCTV entirely. | Scope and infra requirements change significantly |
| D7 | What happens when a parent rejects a Staff Checkout pickup request? | (A) Child remains PRESENT, staff is alerted. (B) Incident is logged, escalation flow begins. | Pickup request flow is incomplete without a rejection path |

---

## 4. Dependency Constraints

These are hard constraints. Changing them requires migration work that cannot be done in the same sprint as the UI redesign.

**Cannot change without migration:**

1. **`attendance` document ID format** (`ATT-{date}-{studentId}`) — deterministic, used for upsert idempotency. If the format changes, existing records become inaccessible via the old key.

2. **`parentAttendance` as the source of truth for child status** — Staff Checkout and CCTV both derive status from this collection. Any change to this collection schema or query pattern requires updating both consumers simultaneously.

3. **`pickupLogs` shared collection** — All pickup authorization and history queries filter by `type`. Any split requires a one-time migration and coordinated deploy of both backend and frontend.

4. **`qrConfigs` keyed by `centerId`** — QR payload embeds `centerId`. All gate QRs printed and mounted physically encode this payload. Changing the payload format requires reprinting and redistributing physical QR codes.

5. **Father/Mother protection in `pickupAuthorization`** — `isProtected: true` is enforced at both the API level and the Firestore document. There is no UI to override this. Any change to protection logic must be deliberate and requires understanding the legal/safeguarding reason it was added.

**Can change with no migration:**

- Sidebar navigation structure (routing only)
- Toast notification positioning and timing
- Camera management UI layout (CCTV)
- Attendance filter defaults
- Any visual change to screens

---

## 5. Risk Register

| Risk | Likelihood | Impact | Trigger |
|------|-----------|--------|---------|
| Child shown as NOT_ARRIVED in CCTV despite staff marking Present in Attendance | High | Medium | Parent tries to access live view, gets blocked; calls school |
| base64 selfies approach Firestore 1MB document limit as school grows | Medium | High | >20 check-in/out events per student per day; each selfie ≤49KB |
| CCTV_ENCRYPTION_KEY lost or rotated without migrating existing camera passwords | Low | Critical | Camera passwords become unrecoverable; all cameras must be re-entered |
| Staff Checkout creates parent notification indistinguishable from parent self-checkout | High | Low | Parent confusion about who collected the child |
| `pickupLogs` type-discriminator missed in a new query | Medium | Medium | Pickup authorization records returned when only history was requested, or vice versa |
| MediaMTX downtime silently breaks CCTV live view | High | Medium | Staff attempt live monitoring during an incident |
| Unknown-person pickup request rejected by parent — no defined escalation path | High | High | Child remains with unverified person while system has no next step |
| Bulk pickup migration endpoint (200 students) run repeatedly — creates duplicate Father/Mother records | Low | Medium | Admin triggers migration twice; UI shows duplicate protected records |

---

## 6. Gaps — Functionality That Does Not Exist Yet

These are absent from the current codebase. They may or may not be in scope for the redesign, but they affect design decisions.

1. **Pickup request rejection handling** — `PUT /api/pickup-requests/:id/reject` exists. The parent can reject. There is no defined flow for what happens next: no incident record is created, no staff alert is sent, and no UI surface exists to see rejected requests.

2. **Real-time presence updates** — There is no Firestore listener in any module. All screens poll or load on mount. "Child just arrived" cannot surface instantly in the Staff Checkout or Attendance views without a page refresh.

3. **Multi-gate support** — QR Management generates one QR per center. If a school has Gate 1 and Gate 2, it requires one QR per gate (format supports it: `YD-BRANCH-GATE-2`), but the management UI treats the center as having a single QR. The backend `qrConfigs` document is keyed by `centerId` with no gate-level granularity.

4. **Attendance exception reporting** — The History view shows records but has no summary-level report: "Students with 3+ absences this month," "Students never marked," etc.

5. **Parent access to pickup requests** — The parent can approve/reject pickup requests, but there is no parent-facing screen shown in the audit for viewing past requests or the outcome of rejections.

---

## 7. Effort Calibration

Based on current codebase complexity. These are estimates for rebuild, not enhancement.

| Module | Frontend | Backend | Notes |
|--------|---------|---------|-------|
| Attendance | 8–10 days | 3–4 days | QR scan, batch operations, multi-filter dashboard |
| Parent Entry | 10–14 days | 3–4 days | Face detection, camera lifecycle, step flow |
| Pickup Authorization | 6–8 days | 2–3 days | Photo compression, protection logic, migration tool |
| Pickup History | 3–4 days | 2 days | Read-only filtered log + selfie modal |
| Staff Checkout | 6–8 days | 2–3 days | Step flow, camera, pickup request path |
| QR Management | 2–3 days | 1–2 days | Already simple; print + generate |
| CCTV (mgmt only) | 4–5 days | 3–4 days | Without live view |
| CCTV (full, with live view) | 8–10 days | 6–8 days | Requires MediaMTX infra decision |
| Data model migration (if D1–D4 chosen) | — | 3–5 days | One-time migration scripts + coordinated deploy |

**Total range:**
- Minimal (no data model changes, CCTV mgmt only): ~44–56 days
- Full (data model unification, full CCTV): ~65–85 days

---

## 8. Recommended Pre-Work Before Redesign Begins

These are not design decisions — they are information-gathering steps that will make the decisions above easier to make correctly.

1. **Confirm whether the school has more than one physical gate.** This affects D5 (QR Management scope) and whether multi-gate support is a day-one requirement.

2. **Check what the operations team actually uses day-to-day.** Staff Checkout and Parent Entry overlap significantly. A 30-minute observation of morning arrival and afternoon pickup would clarify which flow staff actually follow.

3. **Confirm CCTV infrastructure status.** Is MediaMTX deployed? Is it on Railway? Is it on a separate VPS? This determines whether live view is a day-one feature or a phase-two addition.

4. **Define the rejection escalation for pickup requests.** What should happen when a parent rejects a Staff Checkout request? This is a safeguarding question, not a technical one. The answer determines whether an incident flow needs to be built.

5. **Decide whether base64 selfie storage in Firestore is acceptable long-term.** Current cap is 49KB per document. At 100 check-ins/day × 365 days, the school accumulates ~35,000 documents, each up to 49KB. Firebase Storage + a URL reference is the standard pattern for binary data at scale.
