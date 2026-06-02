# CCTV — Handover Document

**Status: PHASE 2 COMPLETE (INFRASTRUCTURE PENDING)**

CCTV development is **paused** after the metadata/security foundation. No video
streaming exists. This document is the single source of truth for resuming.

Last relevant commits: `053419a` (Phase 2B prereqs B+C), `c3ba61d` (repo hygiene).

---

## 0. Scope at a glance

| Built & shipped | NOT built (intentionally paused) |
|---|---|
| Camera Management (CRUD, soft-delete) | MediaMTX / stream engine |
| Camera Verification (RTSP DESCRIBE) | Staff Live View (video) |
| Classroom Mapping | Parent CCTV access |
| Encryption foundation + enforcement switch | HLS / WebRTC playback |
| Classroom-scoped access resolver | Audit logging (designed, not coded) |

---

## 1. Current architecture

### Data model
**`cameras/{cameraId}`** (Firestore)
```
cameraId, cameraCode (unique per center), cameraName,
classroom (string), classrooms[] (forward-compat multi-map),
brand, ip, port, channel, streamType,
username, password (encrypted-at-rest capable; see §3),
streamUrl (credential-free, auto-generated),
status, deleted, deletedAt,
schoolId, centerId, center,
createdAt, updatedAt, createdBy, updatedBy
```
**`users/{uid}`** — added this phase: **`classrooms: string[]`** (staff classroom
assignment; drives teacher scoping). All other user fields pre-existing.

No standalone classroom entity — classrooms are the shared `CLASSES` string list
(`Daycare, Playgroup, Nursery, LKG, UKG, Class 1–5`), reused from Students.

### Backend services (`yellowdot-backend/services/`)
| File | Responsibility |
|---|---|
| `cctvService.js` | Camera CRUD; `getOne` (masked), `getOneWithSecret` (decrypted, server-only); soft delete; cameraCode uniqueness; `encPassword()` enforcement |
| `cameraVerifyService.js` | Pure-Node RTSP `OPTIONS`→`DESCRIBE`→Digest/Basic verification (no ffmpeg) |
| `cameraTestService.js` | TCP-only reachability (hidden dev diagnostic) |
| `cctvAccessResolver.js` | **Reusable** `canViewCamera` / `filterViewableCameras` / `describeScope` (serves Phase 2A staff + Phase 3 parent) |
| `cryptoService.js` | AES-256-GCM encrypt/decrypt; `isEnabled()`, `isRequired()`, `isEncrypted()` |

### API endpoints (`routes/cctvRoutes.js`) — all `authenticate + staffOnly`
| Method | Path | Guard | Purpose |
|---|---|---|---|
| GET | `/api/cctv/cameras` | staff | list (deleted excluded) |
| GET | `/api/cctv/cameras/:id` | staff | single |
| POST | `/api/cctv/cameras` | MANAGE | create |
| PUT | `/api/cctv/cameras/:id` | MANAGE | update |
| DELETE | `/api/cctv/cameras/:id` | MANAGE | soft delete |
| POST | `/api/cctv/cameras/verify` | MANAGE | RTSP verification (default "Test Camera") |
| POST | `/api/cctv/cameras/test` | MANAGE | TCP-only diagnostic |

`MANAGE_ROLES = [admin, center_admin, center_owner, super_admin, developer]`.

### Frontend modules (`yellowdot-frontend/src/`)
- `pages/CCTV.jsx` — module shell, tabs: **Camera Management · Classroom Mapping · Camera Verification**.
- `services/cctvService.js` — API client (`getCameras/getCamera/addCamera/updateCamera/deleteCamera/verifyCamera/testConnection`).
- Nav: top-level **Surveillance** group → CCTV, in both Sidebar (`sidebarConfig.js`) and Quick Navigation (`QuickNav.jsx`). Route `/cctv` in `App.jsx`, gated by `ROUTES.CCTV`.

### Camera verification flow
```
TCP connect host:port                         → ✓ Reachable
RTSP OPTIONS (best-effort)
RTSP DESCRIBE (no auth)        → 401 + WWW-Authenticate: Digest
RTSP DESCRIBE + Digest/Basic   → 200 + SDP     → ✓ Credentials valid + ✓ Channel valid
   401 → bad credentials | 404 → channel not found | other → unverified
```
Pure Node (`net` + `crypto`). No frame decode (deferred to Phase 2B/streaming).
Runs from the backend host → only verifies cameras reachable from that network.

---

## 2. Completed features
- **Camera Management** — CRUD, soft delete (`deleted`+`deletedAt`, records retained), `cameraCode` unique per center.
- **Guided setup / RTSP builder** — Brand + IP + Port + Camera Number → auto-generated credential-free `streamUrl`; "Use Custom RTSP URL" toggle; read-only preview showing `user:*****@` (password masked).
- **Camera Verification** — real RTSP auth + channel validation (above).
- **Classroom Mapping** — `classroom` + `classrooms[]`; Classroom Mapping tab groups cameras; reuses shared `CLASSES`.
- **Encryption foundation** — AES-256-GCM (`cryptoService`), `getOneWithSecret` server-side decrypt, fail-closed enforcement switch (§3), idempotent migration script.
- **Classroom-scoped permissions** — `cctvAccessResolver` (10/10 unit-checks passing), staff `classrooms[]`.
- **Brands** — Hikvision, Dahua, CP Plus (templated); TP-Link/Other via custom URL.

---

## 3. Security model
- **Credential storage:** username plaintext; **password** via `cryptoService` (AES-256-GCM), format `enc:v1:<iv>:<tag>:<ct>`. Never returned to clients (API masks `••••••••`); never embedded in stored `streamUrl`; decrypt only via `getOneWithSecret`, server-side.
- **Enforcement (CCTV-V2-TD-001):** `encPassword()` — if `CCTV_REQUIRE_ENCRYPTION=true` and key missing → **throws** (fail closed). Encrypts when key present. Dev-only plaintext-with-warning when neither set. **Production has NOT yet enabled this** (key + flag not set on Railway; migration not run).
- **CCTV permissions:** `CCTV_VIEW` / `CCTV_MANAGE` modules (no `cctv_viewer` role). Enforced at route `authorize()`, frontend `ROUTES.CCTV`, and `firestore.rules /cameras` (staff read, admin-tier write).
- **Audit logging:** **DESIGNED, NOT IMPLEMENTED.** `cctvAuditLogs` + `LIVE_VIEW_STARTED/STOPPED` are specified for the streaming phase but no code exists yet. Camera CRUD currently has no dedicated audit trail beyond `createdBy/updatedBy` stamps.
- **Known assumptions:** (a) verification/streaming run from the backend host's network; (b) "encrypted at rest" protects the DB, not against someone with backend env access (standard for server-used credentials); (c) prod passwords are currently **plaintext** until the migration runs.

---

## 4. Permission model

| Role | CCTV scope | Manage? |
|---|---|---|
| super_admin / developer | All cameras, all centers (bypass) | Yes |
| admin / center_admin / center_owner | All cameras in their center | Yes |
| coordinator* | All cameras in their center | No (view only, when granted) |
| teacher | Cameras whose `classrooms` ∩ teacher's `classrooms`, same center | No |
| accountant / reception | None | No |
| parent | **None (Phase 3, not built)** | No |

\* `coordinator` is wired in the resolver (`CENTER_WIDE_ROLES`); add the role to the
system if/when a dedicated coordinator is introduced.

**Classroom scoping** is implemented in `cctvAccessResolver.canViewCamera`. **Note:**
`CCTV_VIEW` is currently granted to **admin-tier only**; the teacher/coordinator
grant is intentionally deferred until Live View exists (no point exposing an empty
streaming UI). The resolver is ready; flipping the grant is a Phase 2B step.

---

## 5. Required infrastructure for MediaMTX (Phase 2B streaming)

Cameras are **H.265/HEVC** → browsers can't play directly → **transcoding is mandatory** (H.265→H.264). This dictates the infra.

- **Components:** (1) media server (MediaMTX recommended; alt: Janus) for RTSP ingest + transcode + HLS/WebRTC output; (2) FFmpeg (bundled or system) for transcode; (3) the existing API (token issuance/authz); (4) optional Redis (active-session registry/ref-counts) at scale; (5) optional CDN for HLS segments at scale.
- **Hosting options:** small scale — a **separate Railway service** (NOT the API process); larger scale — dedicated VM (Hetzner/AWS) or autoscaling worker pool. **Never run transcoding inside the `/api` process.**
- **Resource estimates:** ~0.5–1 vCPU per concurrent 1080p H.265→H.264 transcode (less if downscaled to 480–720p / fps-capped). Fan-out: one transcode serves many viewers of the same camera. Plan by **concurrent transcodes**, not camera count.
- **Network:** backend host must reach each camera's IP:554 (public IP, VPN, or on-prem agent). LAN-only cameras need an on-prem relay. Outbound RTSP/TCP 554 must be allowed from the host.
- **Cost:** dominated by transcode CPU + egress. 100 cameras / ~10–20 concurrent → 1–2 worker instances. 500 cameras → worker pool + CDN + Redis.
- **Deployment architecture:** Browser → API (token, on Railway) → Stream Engine (separate service, holds decrypted creds, transcodes, serves token-gated HLS) → hls.js. On-demand start/stop, ref-counted. Media plane is **identity-agnostic** (trusts signed stream token, not role).

---

## 6. Steps to resume Phase 2B (Staff Live View)

**Prerequisites (must be done first):**
1. **Activate encryption in prod:** set `CCTV_ENCRYPTION_KEY` (64 hex) on Railway; deploy; run `node scripts/encryptCameraPasswords.js` (dry-run → `--confirm`); then set `CCTV_REQUIRE_ENCRYPTION=true`.
2. **Populate staff `classrooms[]`** for teachers (script or user-management UI).
3. **Confirm Railway is serving the latest commit** (deploy status has been unverified from CLI all session).

**Infrastructure setup sequence:**
4. Provision the stream-engine service (MediaMTX), separate from the API.
5. Configure RTSP ingest + H.265→H.264 transcode + token-gated HLS output.

**Backend work remaining:**
6. `POST /api/cctv/cameras/:id/live-token` — authz via `cctvAccessResolver.canViewCamera` + sign short-lived stream token `{userId, cameraId, exp, sessionId}`.
7. `POST .../live-stop`; ref-counted session registry; on-demand engine start/stop.
8. **Audit logging** — `cctvAuditLogs` collection + `LIVE_VIEW_STARTED/STOPPED` events `{userId, role, cameraId, classroom, centerId, ts, ip}`.
9. Grant `CCTV_VIEW` to teacher + coordinator in `permissions.js`/`permissionsBackend.js`/`roleService.js`.

**Frontend work remaining:**
10. "Live View" tab in `CCTV.jsx`; visibility-scoped camera grid cards (Classroom / Camera / Status / "View Live"); hls.js viewer; token fetch + renew; starting/offline states.

**Testing:** teacher sees only assigned classrooms; coordinator/center-admin see center; unauthorized blocked; credentials never reach browser (inspect network); existing CRUD/verify still work; build + deploy succeed.

---

## 7. Steps to start Phase 3 (Parent CCTV)

- **Additional security:** stricter token scope; per-child camera allow-list; encryption (§6.1) is a hard prerequisite.
- **Parent permission model:** add a `parent` branch to `cctvAccessResolver.canViewCamera` (presence-gated, classroom-scoped). **No new role, no engine refactor** — the resolver + token issuer + identity-agnostic media plane were built for exactly this.
- **Presence-gating:** issue a stream token only while the parent's child is checked in (reuse existing parent-attendance / security/child-status logic).
- **Audit:** parent views must be logged (who/which camera/when) — compliance artifact.
- **Compliance:** childcare surveillance → consent, retention policy, access logs, data-protection review before exposing any feed to parents.

---

## 8. Open technical debt
- **CCTV-V2-TD-001** (see `docs/TECH_DEBT.md`): prod passwords plaintext until encryption activated + migration run.
- **Audit logging not implemented** — required before any live viewing ships.
- **Railway deploy unverified** — no CLI confirmation of running commit all session; add a public `/api/version` probe to close this.
- **Vantage-point limitation** — server-side verification/streaming only reaches cameras on the backend's network; LAN-only cameras need a relay.
- **Stale-camera fallback** — cameras created before `ip`/`port` persistence rely on `streamUrl` parsing; re-save backfills them.
- **`coordinator` role** referenced in resolver but not a registered system role yet.
- **HEVC assumption** — verified on one camera; confirm other cameras' codecs before sizing transcode infra.

---

## 9. Deployment status
- **Deployed (Firebase Hosting):** frontend CCTV module (management, mapping, verification UI) — current.
- **Requires Railway deployment:** all backend CCTV code (`cctvService`, `cameraVerifyService`, `cameraTestService`, `cctvAccessResolver`, `cryptoService`, routes, user `classrooms[]`). **Deploy status unconfirmed** — verify commit `c3ba61d` (or ≥ `053419a`) is live; the `/verify` and `/test` routes 404 if Railway is stale.
- **Environment variables (Railway — to set):**
  - `CCTV_ENCRYPTION_KEY` — 64-hex AES key (NOT set in prod).
  - `CCTV_REQUIRE_ENCRYPTION=true` — fail-closed switch (NOT set; enable after migration).
  - (existing) `FIREBASE_SERVICE_ACCOUNT`, `SCHOOL_ID`, `CORS_ORIGIN`.
- **Migration status:** `scripts/encryptCameraPasswords.js` exists, **NOT run** in prod (passwords plaintext). `scripts/fixCam7Record.js` already applied. `scripts/alignCctvRbac.js` already applied (role docs aligned).

---

## 10. Resume checklist (TL;DR)
1. Set `CCTV_ENCRYPTION_KEY` on Railway → deploy → run encryption migration → set `CCTV_REQUIRE_ENCRYPTION=true`.
2. Populate teacher `classrooms[]`.
3. Confirm Railway is live (commit + `/api/version` or dashboard).
4. Provision MediaMTX (separate service).
5. Build: live-token endpoint + audit logging + Live View UI; grant `CCTV_VIEW` to teacher/coordinator.
6. Test the visibility matrix end-to-end.

**CCTV is paused. No further CCTV features or architecture changes until instructed.**
