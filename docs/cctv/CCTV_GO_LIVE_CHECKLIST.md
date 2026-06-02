# CCTV Go-Live Checklist

Everything in **code** is complete (Phase 1 management/verification, Phase 2B
staff live view, Phase 3 parent live view). What remains is **infrastructure +
configuration**. Work top to bottom; nothing here needs new code.

Architecture: `Camera → RTSP H.264 substream (xx02) → MediaMTX (remux, no
transcode) → WebRTC/HLS → CRM`. Credentials never reach the browser.

---

## 1. Infrastructure setup

1. **API (Railway)** — already hosts the CRM API. Confirm it's live (see §7).
2. **Stream engine (MediaMTX)** — provision a **separate** host:
   - 4 cameras → small Railway service **or** a $5 VPS (remux ≈ near-zero CPU).
   - Must reach each camera's IP:554 (cameras are public-IP → any host works;
     LAN-only cameras would need a VPN/relay).
   - Never run MediaMTX inside the API process.
3. **Frontend (Firebase Hosting)** — already deployed; no engine dependency.

---

## 2. Railway environment variables (API service)

| Var | Purpose | Required for |
|---|---|---|
| `CCTV_STREAM_ENGINE_URL` | `https://<mediamtx-host>` — base for HLS/WebRTC URLs | **Live view** (flips live-token from 503→200) |
| `CCTV_STREAM_TOKEN_SECRET` | random 32+ char string — signs stream tokens | Multi-instance token consistency |
| `CCTV_ENCRYPTION_KEY` | 64 hex chars (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) | Credential encryption |
| `CCTV_REQUIRE_ENCRYPTION` | `true` — fail-closed (no plaintext saves) | Pre-production hardening |
| (existing) `FIREBASE_SERVICE_ACCOUNT`, `SCHOOL_ID`, `CORS_ORIGIN` | — | — |

Railway auto-injects `RAILWAY_GIT_COMMIT_SHA` / `RAILWAY_GIT_BRANCH` → surfaced
by `/api/version`.

---

## 3. MediaMTX installation

1. Generate config from the CRM repo:
   ```
   cd yellowdot-backend
   node scripts/generateMediaMtxConfig.js            # preview (creds redacted)
   node scripts/generateMediaMtxConfig.js --write     # writes .mediamtx/mediamtx.yml (REAL creds — gitignored)
   ```
2. Deploy (Docker):
   ```
   docker run -d --name yd-mediamtx \
     -p 8888:8888 -p 8889:8889 -p 8189:8189/udp \
     -v $(pwd)/.mediamtx/mediamtx.yml:/mediamtx.yml \
     bluenviron/mediamtx:latest
   ```
3. Enable the auth hook in `mediamtx.yml` (uncomment + point at the API):
   `authHTTPAddress: https://<api-host>/internal/cctv/auth` (validate exact keys
   for your MediaMTX version).
4. Put TLS in front (Railway auto; VPS → caddy/nginx).
5. Full runbook: `docs/cctv/MEDIAMTX_DEPLOYMENT.md`.

---

## 4. Camera requirements

- Each camera must expose an **H.264 substream** at `/Streaming/Channels/<ch>02`
  (Hikvision) — verified on ch7; **confirm per camera** in the NVR
  (Configuration → Video → Substream → H.264).
- Main `<ch>01` (H.265) stays for verification/snapshots.
- Camera record in CRM must have correct **IP, port, Camera Number (channel),
  username, password** — verify each with the **Test Camera** button (must show
  reachable + credentials + channel valid).
- Audio is dropped (privacy); no action needed.

---

## 5. Parent access configuration

1. Set parent CCTV settings (admin):
   ```
   PUT /api/cctv/parent/settings
   { "enabled":"true", "schoolOpen":"08:00", "schoolClose":"18:00",
     "enforceHours":"true", "timezone":"Asia/Kolkata" }
   ```
   (Disabled by default — parents see "disabled by the school" until enabled.)
2. Ensure each **parent account is linked to a student** (`user.student.studentId`).
3. Ensure each **student has a `class`** matching a camera's classroom mapping.
4. Parent access auto-gates: visible only while child is **checked in** and
   within school hours; auto-revokes ~2 min after checkout (short token TTL).

---

## 6. Security hardening

1. **Encryption (do before parents go live):**
   - Set `CCTV_ENCRYPTION_KEY` → deploy.
   - `node scripts/encryptCameraPasswords.js` (dry-run) → `--confirm` (migrates
     existing plaintext passwords; backs up first).
   - Set `CCTV_REQUIRE_ENCRYPTION=true` → redeploy (plaintext saves now rejected).
2. Set `CCTV_STREAM_TOKEN_SECRET` (don't rely on the per-boot fallback in prod).
3. MediaMTX: auth hook ON; no public path access; only the API may call
   `/internal/cctv/auth`; only 8888/8889 public (behind TLS); block direct
   internet RTSP.
4. Confirm `firestore.rules` `/cameras` deployed (staff read, admin write).
5. Confirm no public CORS wildcard on the engine.
6. **Compliance:** childcare surveillance → consent, retention policy, and a
   data-protection review before exposing feeds to parents (non-code, but
   gating for parent go-live).

---

## 7. Go-live validation checklist

- [ ] `curl https://<api>/api/version` → shows the **expected commit** (Railway is current).
- [ ] `curl https://<api>/api/cctv/cameras` (with staff token) → 200 list.
- [ ] **Test Camera** on each camera → reachable + credentials + channel valid.
- [ ] `curl http://<engine>/cam/<cameraId>/index.m3u8` → playlist within a few seconds.
- [ ] Staff login → CCTV → **Live View** → video plays (WebRTC/HLS).
- [ ] **Teacher** sees only assigned-classroom cameras; **coordinator/center-admin** see center; unauthorized blocked.
- [ ] Parent (child checked-in, in hours) → **Camera** tab → video plays.
- [ ] Parent with child **not** checked in → friendly "checks in" message, no stream.
- [ ] Parent **outside school hours** → blocked with correct message.
- [ ] Network tab: **no RTSP URL / credentials** ever sent to browser; only token + HLS URL.
- [ ] `cctvAuditLogs` shows `LIVE_VIEW_STARTED/STOPPED/DENIED` for the above.
- [ ] Existing CRM modules unaffected (students, attendance, fees, etc.).

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `live-token` → **503 ENGINE_NOT_PROVISIONED** | `CCTV_STREAM_ENGINE_URL` unset | Set it on Railway, redeploy |
| `live-token` / any CCTV route → **404** | Railway serving stale build | Check `/api/version` commit; redeploy |
| Any request → **401** incl. health | unauthenticated (expected for guarded routes) | Use a valid token; `/api/version` is public |
| Player loads but **black/garbled** | substream is H.265, not H.264 | Set camera substream to H.264 in NVR |
| Player **403 on segments** | stream token invalid/expired or auth hook misconfigured | Check `authHTTPAddress` → `/internal/cctv/auth`; token TTL 120s |
| Verify passes but **stream times out** | engine can't reach camera (network/vantage) | Ensure engine host can reach camera IP:554 |
| Parent always **"not present"** | child not checked in, or student `class` ≠ camera classroom | Check attendance + classroom mapping |
| Parent **"disabled by the school"** | `cctv_parent.enabled` ≠ "true" | `PUT /api/cctv/parent/settings { enabled:"true" }` |
| Camera save **rejected** | `CCTV_REQUIRE_ENCRYPTION=true` but key missing | Set `CCTV_ENCRYPTION_KEY` |
| Teacher sees **no cameras** | teacher `classrooms[]` empty | Populate teacher classroom assignment |

---

## Status

**CCTV development is COMPLETE.** All phases coded, verified, committed, and
(frontend) deployed. Remaining work is infrastructure/config per this checklist.
No further CCTV coding unless a bug surfaces during deployment.
