# CCTV Architecture — Yellow Dot CRM

Status legend: **[Implemented]** shipped today · **[Planned]** not yet built.

CCTV is a standalone **Surveillance** module (`/cctv`). Phase 1 is camera
management + verification only — no video streaming. Live video is deferred to
Phase 2/3.

---

## 1. Phase 1 — Camera Management & Verification **[Implemented]**

Internal, staff-only camera registry. No live video.

**Capabilities**
- Camera CRUD (add / edit / soft-delete / list), Firestore-backed.
- Classroom mapping (reuses the shared `CLASSES` list; stored as `classroom`
  string + forward-compatible `classrooms[]` array).
- Camera Code, unique per center.
- Guided setup: operator enters Brand + Static IP + Port + Camera Number
  (+ Username/Password); the RTSP URL is auto-generated (see §5).
- **Camera Verification** (§6): reachable → credentials → channel.

**Data model — Firestore `cameras/{cameraId}`**
```
cameraId, cameraCode, cameraName,
classroom, classrooms[],
brand, ip, port, channel, streamType,
username, password,          // password stored separately (see §7)
streamUrl,                   // credential-free, auto-generated
status, deleted, deletedAt,
schoolId, centerId, center,
createdAt, updatedAt, createdBy, updatedBy
```

**API (all `staffOnly`; writes require admin-tier — CCTV_MANAGE)**
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/cctv/cameras` | list (soft-deleted excluded) |
| GET | `/api/cctv/cameras/:id` | single |
| POST | `/api/cctv/cameras` | create |
| PUT | `/api/cctv/cameras/:id` | update |
| DELETE | `/api/cctv/cameras/:id` | soft delete |
| POST | `/api/cctv/cameras/verify` | RTSP verification (default "Test Camera") |
| POST | `/api/cctv/cameras/test` | TCP-only reachability (hidden dev diagnostic) |

Delete is **soft** (`deleted:true` + `deletedAt`); records are retained.

---

## 2. Phase 2 — Staff Live View **[Planned]**

Authenticated staff watch live camera feeds in-app.

- Requires a **Stream Engine** (FFmpeg/RTSP → HLS or WebRTC) running on a
  **persistent host** — NOT Firebase Functions (ephemeral FS, no long-lived
  process). The current backend (Railway) is a persistent host and is the
  intended home.
- Server composes the authenticated RTSP URL from stored IP/port/channel +
  **decrypted** credentials; the browser never receives credentials or the raw
  RTSP URL.
- New permission usage: **CCTV_VIEW** (already defined, §7) gates live viewing.
- Re-introduces FFmpeg, deliberately deferred from Phase 1 (see ADR note §6).

---

## 3. Phase 3 — Parent Access **[Planned]**

Parents view a restricted live feed of their child's classroom.

- Gated by child presence (parent sees a feed only while their child is checked
  in — reuses the existing parent-attendance/presence logic).
- Strict scoping: a parent may only access cameras mapped to their child's
  classroom/center.
- Credential encryption (CCTV-V2-TD-001) is a **hard prerequisite** before this
  phase ships (see §7).
- Likely a separate, more constrained stream path than staff Live View.

---

## 4. Supported camera brands **[Implemented: 3 templated]**

| Brand | Auto-template | Notes |
|---|---|---|
| **Hikvision** | yes | `/Streaming/Channels/<n>01` |
| **Dahua** | yes | `/cam/realmonitor?channel=<n>&subtype=0` |
| **CP Plus** | yes | Dahua-OEM; same path as Dahua |
| TP-Link / Other | no template | requires **Use Custom RTSP URL** toggle |

---

## 5. RTSP URL generation rules **[Implemented]**

Inputs: **Brand, Static IP, Port (default 554), Camera Number** (`channel`).
Generated URL is **credential-free** and stored in `streamUrl`.

```
Hikvision : rtsp://<ip>:<port>/Streaming/Channels/<channel>01
Dahua     : rtsp://<ip>:<port>/cam/realmonitor?channel=<channel>&subtype=0
CP Plus   : rtsp://<ip>:<port>/cam/realmonitor?channel=<channel>&subtype=0
```

- "Camera Number" is the UI label; the value is stored internally as `channel`.
- Hikvision: Camera Number `7` → path `…/Channels/701` (`<n>` + `01`).
- **Custom override:** "Use Custom RTSP URL" lets advanced users / unsupported
  brands enter the full path manually.
- **Preview:** read-only, regenerates live. Shows username, **masks password**
  as `*****` (e.g. `rtsp://admin:*****@<ip>:<port>/…`). The persisted
  `streamUrl` never contains credentials — they are injected server-side only
  when needed (verification / future streaming).

---

## 6. Verification flow **[Implemented]**

`POST /api/cctv/cameras/verify` — pure-Node RTSP, **no FFmpeg, no streaming**.
Uses built-in `net` (TCP) + `crypto` (MD5 Digest).

```
1. TCP connect host:port                         → ✓ Reachable
2. RTSP OPTIONS (best-effort)
3. RTSP DESCRIBE (no auth)        → 401 + WWW-Authenticate: Digest …
4. RTSP DESCRIBE + Digest/Basic   → 200 + SDP     → ✓ Credentials valid
                                  → 200 + SDP body → ✓ Channel valid
   failure mapping:
     401 after auth → credentials invalid
     404            → channel not found (auth OK)
     other / no SDP → channel/stream unverified
```

A `200 OK` + SDP from DESCRIBE confirms all three Phase 1 requirements without
decoding video. **Frame-decode verification is intentionally out of Phase 1**
and belongs to Phase 2 (the Stream Engine decodes anyway).

> **ADR note:** Phase 1 verification was briefly prototyped with FFmpeg, then
> replaced with the pure-Node DESCRIBE probe — zero dependency, lower deploy
> risk, sufficient for reachable/credentials/channel. FFmpeg returns in Phase 2.

**Vantage point:** verification runs on the backend host (Railway), so a camera
must be reachable **from that host's network**. Public-IP cameras work;
LAN-only cameras will fail a server-side check regardless of correctness — a
constraint to resolve in Phase 2 (on-prem agent or browser-side path).

`/api/cctv/cameras/test` remains as a **TCP-only** developer diagnostic
(reachability, no auth/channel), hidden behind a toggle in the UI.

---

## 7. Security model

**RBAC (existing roles only — no `cctv_viewer` role)**
- **CCTV_VIEW** — see cameras / (future) live view.
- **CCTV_MANAGE** — create/edit/delete/verify cameras.
- Phase 1 grants both to admin-tier only: `super_admin`, `developer`, `admin`,
  `center_admin`, `center_owner`. Staff (teacher/accountant/reception) and
  parents get neither. **[Implemented]**
- Enforced at three layers: route `authorize(...)` (API), `ROUTES.CCTV` route
  key (frontend nav/page), and `firestore.rules` `/cameras` (staff read,
  admin-tier write). **[Implemented]**

**Credentials**
- Camera username stored plaintext; **password** handled by `cryptoService`
  (AES-256-GCM) when `CCTV_ENCRYPTION_KEY` is set. **[Implemented, inactive]**
- **Current state:** key not set in production → passwords stored **plaintext**
  with a warning; never blocks save. Tracked as **CCTV-V2-TD-001**
  (`docs/TECH_DEBT.md`).
- **Hard requirement before Phase 2/3:** set `CCTV_ENCRYPTION_KEY` in
  production, migrate existing passwords, make a missing key fatal for
  streaming/parent paths.
- Passwords are **never** returned to clients (API masks as `••••••••`) and
  never embedded in the stored `streamUrl`. Decryption is server-side only.

**Network**
- Verification/streaming originate from the backend host, not the browser.
- Camera credentials are composed into the RTSP URL only in-memory on the
  server, never logged in full (logs redact `user:***`).
