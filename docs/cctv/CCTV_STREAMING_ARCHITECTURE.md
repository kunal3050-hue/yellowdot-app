# CCTV Streaming Architecture — Phase 2B & Phase 3

Production design for **Staff Live View (2B)** and **Parent CCTV Access (3)**.
Design only — no code. Builds on the shipped Phase 1/2 foundation
(`cctvService`, `cameraVerifyService`, `cctvAccessResolver`, `cryptoService`).

> **Governing constraint:** cameras are **H.265/HEVC** (verified). Browsers
> cannot play H.265 reliably, so **transcoding to H.264 is mandatory**.
> Everything below is sized by *concurrent transcodes*, not camera count.

---

## 1. MediaMTX architecture

MediaMTX (formerly rtsp-simple-server) is a single Go binary that ingests RTSP
and republishes as HLS/WebRTC/RTSP, with on-demand sources, path auth hooks, and
per-path `runOnDemand` commands. We pair it with FFmpeg for the H.265→H.264
transcode.

```
                        ┌─────────────────────── Stream Engine host (separate service) ──┐
 Camera (RTSP/H.265) ──▶│ MediaMTX path "cam/<id>"                                        │
                        │   runOnDemand: ffmpeg -i <rtsp+creds> -c:v libx264 ... -f rtsp  │
                        │   → re-publishes as HLS (/cam/<id>/index.m3u8) + WebRTC          │
                        │   authHook → validates stream token with API                    │
                        └──────────────────────────────────────────────────────────────────┘
        ▲ decrypted creds injected here only            │ token-gated HLS
        │                                                ▼
   API (Railway): issues short-lived stream token   Browser (hls.js)
```

- **On-demand:** FFmpeg starts on first viewer, stops after `runOnDemandCloseAfter`
  idle. Never N transcodes for 0 viewers.
- **Fan-out:** one transcode → many viewers of the same camera.
- **Auth:** MediaMTX `authHook`/external auth calls back to the API to validate the
  stream token before serving a path. Credentials live only inside the FFmpeg
  command on the engine host — never sent to the browser.

---

## 2. RTSP → HLS flow

```
1. Browser → API:  POST /api/cctv/cameras/:id/live-token   (Firebase ID token)
2. API: authenticate → cctvAccessResolver.canViewCamera() → getOneWithSecret()
        → sign stream token { sub, cameraId, exp(60–120s), sessionId }
        → return { hlsUrl: <engine>/cam/<id>/index.m3u8, token }
3. Browser → Engine:  GET /cam/<id>/index.m3u8?token=...
4. Engine authHook → API verify token → 200/403
5. Engine: if path idle, runOnDemand spawns
        ffmpeg -rtsp_transport tcp -i rtsp://user:pass@ip:port/<path>
               -c:v libx264 -preset veryfast -tune zerolatency
               -vf scale=-2:720 -an -f hls (LL-HLS segments)
6. Browser plays HLS via hls.js; renews token before expiry
7. Last viewer leaves → idle timeout → ffmpeg stops
```

**Latency:** standard HLS 6–15s; LL-HLS 2–5s. WebRTC <1s (Phase 2B.2 option).
**Audio:** source is PCM-mulaw → drop (`-an`) for Phase 2B, or transcode to AAC later.

---

## 3. Stream server hosting options

| Option | Fit | Notes |
|---|---|---|
| **Separate Railway service** | ≤ ~15–20 concurrent transcodes | Simplest; same platform; CPU-capped per instance. Recommended to start. |
| **Dedicated VPS (Hetzner/Contabo)** | 20–100 concurrent | Best price/CPU; e.g. Hetzner CCX/CPX dedicated vCPU. Recommended for production scale. |
| **Cloud VM + autoscale (AWS/GCP)** | 100–500+ | Worker pool behind a registry; highest cost/flexibility. |
| **Managed video API (e.g. third-party)** | any | Offloads ops; recurring per-stream cost; data leaves your infra (compliance review needed for a childcare product). |

**Hard rule:** the engine is **always a separate deployable** from the `/api`
service — a hung FFmpeg must never take down the CRM API.

---

## 4. Estimated CPU / RAM per transcode

1080p H.265 → 720p H.264, `veryfast`, 15 fps, audio dropped:

| Profile | CPU per concurrent transcode | RAM per transcode |
|---|---|---|
| 1080p→720p H.264 (recommended) | ~0.5–0.8 vCPU | ~150–250 MB |
| 1080p→1080p H.264 | ~0.8–1.2 vCPU | ~250–400 MB |
| 1080p→480p (mobile-first) | ~0.3–0.5 vCPU | ~120–180 MB |

MediaMTX base overhead: ~1 vCPU / ~512 MB headroom. **Viewers of an
already-running camera add negligible CPU** (segment serving only).

---

## 5. Cost estimates

Assumption: a childcare site rarely watches all cameras at once. Planning ratio
**~25–40% of cameras concurrently transcoding** (conservative). 720p profile
(~0.7 vCPU/stream). Prices indicative (Hetzner-class dedicated vCPU ≈ $8–12 / vCPU-mo).

| Cameras | Assumed concurrent transcodes | vCPU needed (+overhead) | RAM | Indicative host | ~Monthly |
|---|---|---|---|---|---|
| **10** | 4 | ~4 vCPU | 4–6 GB | 1 small VPS (Railway or Hetzner CPX31) | **$15–30** |
| **25** | 8–10 | ~8 vCPU | 8–12 GB | 1 VPS (Hetzner CCX/CPX, 8 vCPU) | **$40–70** |
| **50** | 15–20 | ~16 vCPU | 16–24 GB | 1–2 VPS or 1 dedicated 16-core | **$90–160** |
| **100** | 30–40 | ~32 vCPU | 32–48 GB | 2-node pool + Redis + CDN | **$220–400** |

Excludes egress/CDN (add for 100+: HLS segments via CDN, est. $0.01–0.05/GB).
Downscaling to 480p roughly halves CPU/cost; LL-HLS adds modest overhead.

---

## 6. Parent access architecture (Phase 3)

Reuses the **same media plane** — parents differ only in *token issuance*, never
in stream consumption (media plane is identity-agnostic; it trusts the signed token).

```
Parent → API: POST /api/cctv/parent/live-token { cameraId }
  guard 1: requesting parent is linked to a student
  guard 2: child is CHECKED IN today (presence gate; reuses security/child-status)
  guard 3: cameraId ∈ child's classroom cameras (cctvAccessResolver parent branch)
  → sign token { sub:parentId, childId, cameraId, exp, sessionId, kind:"parent" }
Engine: identical HLS path, authHook validates token (no role logic in engine)
```

A **`parent` branch added to `cctvAccessResolver.canViewCamera`** is the only new
authorization code. No engine refactor — this seam was designed in Phase 1.

---

## 7. Classroom-scoped viewing

Already implemented in `cctvAccessResolver` (10/10 tests):

| Role | Scope |
|---|---|
| super_admin / developer | all centers |
| admin / center_admin / center_owner / coordinator | their center |
| teacher | cameras whose `classrooms` ∩ teacher `classrooms`, same center |
| parent (Phase 3) | only their child's classroom camera(s), presence-gated |

The token endpoint calls `canViewCamera` **before** issuing a token — scoping is
enforced at issuance, re-validated by the engine authHook on every segment.

---

## 8. Attendance-based access control (Phase 3)

- Parent CCTV is **gated on live presence**: a token is issued only while the
  child's most recent `parentAttendance` record today is `Check_In` (reuses
  existing `securityService.getChildStatus`).
- Token TTL is short (60–120s); renewal re-checks presence → access **revokes
  automatically** within ~2 min of checkout. No long-lived parent sessions.
- Staff (2B) are **not** presence-gated — role + classroom scope only.

---

## 9. Security model

- **Credentials:** AES-256-GCM at rest (`cryptoService`); decrypt only on the
  engine host inside the FFmpeg command; never to browser; never in `streamUrl`.
  **Prerequisite:** `CCTV_ENCRYPTION_KEY` + `CCTV_REQUIRE_ENCRYPTION=true` in prod
  + migration run (CCTV-V2-TD-001) before any streaming ships.
- **Stream tokens:** short-lived, signed (HMAC/JWT), single-purpose, bound to
  `{subject, cameraId, exp, sessionId, kind}`; separate from the Firebase auth
  token; validated by the engine on every playlist/segment fetch.
- **Transport:** HTTPS/WSS only; HLS paths use unguessable `sessionId`; **no
  public CORS** (the V1 `Access-Control-Allow-Origin:*` on `/stream/live` must
  never recur).
- **Network:** engine→camera over the host's network (public IP / VPN / on-prem
  relay for LAN cameras). Engine is firewalled; only the API may call its authHook.
- **Revocation:** logout / permission change / checkout invalidates the session
  registry entry → next segment 403s.

---

## 10. Watermarking strategy

- **Phase 2B (staff):** client-side overlay (CSS) — viewer name + timestamp +
  camera over the video. Cheap, deters casual screen-recording, **not**
  tamper-proof.
- **Phase 3 (parent):** **server-side burned-in** watermark via the FFmpeg
  `drawtext` filter — parent ID/phone + timestamp rendered into the frames so it
  survives screen-recording. Adds modest CPU (~5–10%). Recommended for any
  parent-facing feed for accountability/deterrence.
- Both reference the **audit log** (§11) as the authoritative "who watched what."

---

## 11. Audit logging strategy

New collection **`cctvAuditLogs/{id}`** (NOT YET BUILT):
```
{ event, userId, role, kind:"staff"|"parent", cameraId, classroom,
  centerId, childId?, sessionId, ip, userAgent, ts }
events: LIVE_VIEW_STARTED, LIVE_VIEW_STOPPED, LIVE_VIEW_DENIED,
        TOKEN_ISSUED, TOKEN_RENEWED
```
- Written at the **API token layer** (authoritative; engine is identity-agnostic).
- Parent views especially are a **compliance artifact** — retained per policy.
- Add an admin "CCTV Access Log" view in a later iteration.

---

## 12. Concurrent viewing limits

- **Per-engine cap:** `maxConcurrentTranscodes` sized to host vCPU (e.g. 16 vCPU →
  ~20 transcodes). New camera requests beyond cap → queued or "capacity" error.
- **Per-camera fan-out:** unlimited viewers share one transcode (cap optional).
- **Per-user sessions:** limit (e.g. 4 simultaneous cameras/user) to prevent a
  single staff grid from spawning many transcodes.
- **Parent:** 1 active stream per parent (their child's room only).
- Ref-counted registry (in-memory for single node; **Redis** for multi-node at
  100+ cameras).

---

## 13. Mobile app considerations

- **HLS is natively supported** on iOS Safari and Android Chrome → the same
  hls.js/native `<video>` path works in the responsive web app and any WebView.
- Prefer a **480–720p mobile profile** to save data + battery; offer a quality
  toggle.
- Background/lock → stop the stream + release the token (saves transcode CPU).
- A future native app reuses the **same token endpoint + HLS URL** — no backend
  change; only a native player.
- WebRTC (low-latency) is a later enhancement; HLS is the safe mobile baseline.

---

## 14. Recommended production architecture

```
                 Firebase Hosting (frontend, hls.js)
                          │  Firebase ID token
                          ▼
        Railway: Yellow Dot API  ── token issuance, authz (cctvAccessResolver),
                          │          presence gate (Phase 3), audit logging
                          │  signed stream token
                          ▼
        Stream Engine (SEPARATE service)  ── MediaMTX + FFmpeg
          • on-demand transcode H.265→H.264, fan-out, authHook→API
          • Railway service (≤25 cams) → dedicated VPS (50–100) → pool+Redis+CDN (100+)
                          │  RTSP (decrypted creds, host-side only)
                          ▼
                       Cameras
```

**Recommendation:** start with **MediaMTX on a separate Railway service** (10–25
cameras), HLS output, 720p, client watermark for staff. Graduate to a **Hetzner
dedicated-vCPU VPS** at ~50 cameras, add **Redis + CDN + server-side watermark**
for parent access at 100. Keep the API/control plane on Railway throughout; only
the media plane scales out.

---

## Implementation roadmap

| Stage | Work | Gate |
|---|---|---|
| **2B.0 (prereq)** | Activate prod encryption (key + flag + migration); populate teacher `classrooms[]`; confirm Railway deploy | none |
| **2B.1** | Provision MediaMTX (separate service); single camera; token-gated HLS; `live-token` endpoint | engine reachable |
| **2B.2** | Visibility-scoped camera grid UI + hls.js viewer; grant `CCTV_VIEW` to teacher/coordinator; client watermark | 2B.1 |
| **2B.3** | Audit logging (`cctvAuditLogs`); ref-counting; concurrency caps; hardening | 2B.2 |
| **2B.4 (opt)** | LL-HLS / WebRTC for low latency | 2B.3 |
| **3.1** | `parent` branch in resolver; `parent/live-token` with presence gate; server-side watermark | 2B complete |
| **3.2** | Parent UI (child's room only); parent audit; compliance/retention review | 3.1 |

**Open prerequisites unchanged:** encryption activation (TD-001), Railway deploy
confirmation, and provisioning the engine host — these gate 2B.1.
