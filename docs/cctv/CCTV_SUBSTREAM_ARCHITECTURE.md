# CCTV Production Architecture — H.264 Substream (Phase 2B & 3)

**Decision:** stream the camera's **H.264 substream** directly — **no FFmpeg
transcoding**. Verified live: Hikvision ch `xx01` = H.265 (main), `xx02` = H.264
(substream). MediaMTX remuxes the substream to WebRTC/HLS.

```
Camera ──RTSP H.264 (xx02)──▶ MediaMTX (remux, no transcode) ──WebRTC/HLS──▶ Yellow Dot CRM
```

Transcoding (FFmpeg) is a **fallback only** for a camera that lacks an H.264
substream — not the default path.

---

## 1. Channel convention

| Stream | Path | Use |
|---|---|---|
| **Main** | `/Streaming/Channels/<ch>01` | Verification, snapshots, diagnostics (existing) |
| **Sub** | `/Streaming/Channels/<ch>02` | **Live viewing** (H.264, browser-native) |

- `cameraVerifyService` keeps using **main** (`xx01`).
- Live View uses **sub** (`xx02`), derived from the same `ip/port/channel`.
- Audio (PCMU) is **dropped** for live viewing (privacy + container simplicity).

---

## 2. Production architecture

```
Firebase Hosting (frontend: hls.js / WebRTC <video>)
        │ Firebase ID token
        ▼
Railway API ── authz (cctvAccessResolver) · presence gate (Phase 3) ·
        │       stream-token issuance · audit logging
        │ signed stream token (60–120s)
        ▼
MediaMTX (separate small service) ── remux H.264 substream → WebRTC + HLS,
        │   on-demand, fan-out, authHook → API token verify
        │ RTSP (decrypted creds, host-side only) to xx02
        ▼
     Cameras
```

- **No transcode** → near-zero CPU per stream → one small instance serves 4
  cameras + unrestricted parent viewing.
- **WebRTC** primary (H.264 native, <1s latency); **HLS** fallback (mobile/Safari).
- Media plane is identity-agnostic — trusts the signed token, not the role.

---

## 3. Database changes

**`cameras/{id}`** — add (all optional, backward-compatible):
```
mainStreamPath   string   // "/Streaming/Channels/<ch>01" (verification)
subStreamPath    string   // "/Streaming/Channels/<ch>02" (live)
substreamCodec   string   // "H264" | "H265" | "" (probed; default assume H264)
liveStreamUrl    string   // credential-free substream RTSP (derived)
```
Derived from existing `brand/ip/port/channel`; no manual entry. Existing
`streamUrl` (main) unchanged. `mediaMtxPath` (e.g. `cam/<cameraId>`) is computed,
not stored.

**`cctvAuditLogs/{id}`** (new) — see §8.

**`users/{uid}`** — `classrooms[]` already added (Phase 2B prereq C).

---

## 4. API contracts

```
POST /api/cctv/cameras/:id/live-token        (staff; CCTV_VIEW + scope)
  → 200 { protocol:"webrtc"|"hls", url, token, expiresIn, cameraId }
  → 403 { error } if scope/permission fails
  → 503 { error:"ENGINE_NOT_PROVISIONED" } until MediaMTX exists

POST /api/cctv/cameras/:id/live-stop          (staff)
  → 200 { stopped:true }   // decrements ref-count / audit LIVE_VIEW_STOPPED

POST /api/cctv/parent/live-token              (Phase 3; parent)
  body { cameraId? }  (defaults to child's classroom camera)
  guards: parent↔student link · child CHECKED_IN today · camera ∈ child classroom
  → 200 { ...token... }  | 403 { error, reason:"not-present"|"not-linked"|"scope" }

POST /internal/cctv/auth                      (MediaMTX authHook → API)
  body { path, token, ip }  → 200 allow | 403 deny   (not public)
```
Token claims: `{ sub, kind:"staff"|"parent", cameraId, sessionId, exp }`.
Existing CRUD/verify endpoints unchanged.

---

## 5. Permissions

Reuse `CCTV_VIEW` / `CCTV_MANAGE`; reuse `cctvAccessResolver.canViewCamera`.
- **2B grant:** `CCTV_VIEW` → admin-tier **+ teacher + coordinator** (flip on at 2B.2).
- **Manage** stays admin-tier.
- Scope (already built): teacher = assigned classrooms; coordinator/center-admin = center; super_admin/dev = all.

---

## 6. Parent access model (Phase 3)

- New `parent` branch in `cctvAccessResolver` — parent sees only their child's
  classroom camera(s).
- `parent/live-token` issues a token only when **all** hold: parent linked to a
  student, child is **checked in today** (reuse `securityService.getChildStatus`),
  camera ∈ child's classroom.
- Short TTL + renewal re-checks presence → access **auto-revokes** on checkout.
- Server-side burned-in watermark (parent id + timestamp) via MediaMTX/FFmpeg
  `drawtext` **only if** a transcode is already in play; for pure-remux substream,
  use a client overlay + audit log (burned-in watermark requires re-encode, which
  the substream path avoids — documented tradeoff).

---

## 7. Attendance-based access control

- "Unrestricted parent viewing **during school hours**" = presence-gated, not
  time-gated: a parent may watch whenever their child is checked in.
- Optional center "viewing window" (open/close times) can layer on top later.
- Staff are not presence-gated (role + classroom scope only).

---

## 8. Security model

- Credentials AES-256-GCM at rest (`cryptoService`); decrypted only on the
  MediaMTX host inside the RTSP source URL; never to browser; never in stored
  `streamUrl`/`liveStreamUrl`. **Prereq: activate prod encryption (TD-001).**
- Short-lived signed stream tokens; engine authHook validates every request;
  HTTPS/WSS only; unguessable paths; no public CORS.
- Network: engine→camera substream over host network; engine firewalled; only
  API may call `/internal/cctv/auth`.

## 9. Audit logging

`cctvAuditLogs`: `{ event, userId, role, kind, cameraId, classroom, centerId,
childId?, sessionId, ip, ts }` — events `LIVE_VIEW_STARTED/STOPPED/DENIED`,
`TOKEN_ISSUED/RENEWED`. Written at the API token layer.

## 10. Concurrency

Remux is cheap → limit by **bandwidth**, not CPU. Per-user session cap (e.g. 4);
per-camera fan-out unlimited; 1 active stream per parent. Ref-count in-memory
(single node is plenty for 4 cameras).

## 11. MediaMTX deployment plan (4 cameras)

- One **MediaMTX** instance, separate service (small Railway service or $5 VPS).
- Config: per-camera path `cam/<id>` with `source: rtsp://…/<ch>02` (creds
  injected at runtime), `sourceOnDemand: yes`, WebRTC + HLS enabled, `authHook`
  → `POST /internal/cctv/auth`. No FFmpeg block (remux/copy).
- TLS in front (Railway provides; VPS → caddy/nginx).
- Resource: ~1 vCPU / 512 MB total for 4 cameras + many viewers.

## 12. Rollout plan (4 cameras)

| Stage | Work | Gate |
|---|---|---|
| **2B.0** | Activate prod encryption (key+flag+migration); populate teacher `classrooms[]`; confirm Railway deploy | — |
| **2B.1 (code, now)** | Substream convention in camera model/service (`subStreamPath`, `liveStreamUrl`, mediaMtxPath); verify per-camera substream codec | — |
| **2B.2** | Provision MediaMTX (separate service); wire `authHook`; single camera end-to-end | engine host |
| **2B.3** | `live-token`/`live-stop` endpoints; audit logging; `CCTV_VIEW`→teacher/coordinator | 2B.2 |
| **2B.4** | Live View UI (scoped grid, WebRTC w/ HLS fallback) | 2B.3 |
| **3.1** | Parent branch in resolver; `parent/live-token` + presence gate | 2B done |
| **3.2** | Parent UI; parent audit; compliance/retention review | 3.1 |

**External gates I cannot do:** provision the MediaMTX host (2B.2) and set prod
env vars (2B.0). Everything else is code I can build + verify.

---

## 13. Open verification item
Confirmed substream H.264 on **ch7** only (live SDP). Each additional camera must
have its `xx02` substream **enabled + H.264** — probe per camera at 2B.1. Any
camera that is H.265-only on the substream falls back to FFmpeg transcode for
that camera (config-only NVR fix usually avoids this).
