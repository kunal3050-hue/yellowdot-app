# MediaMTX Deployment Runbook (Phase 2B.2)

Stand up the live-stream engine for Yellow Dot CCTV. Remux-only (H.264
substream → WebRTC/HLS), **no transcoding**. ~1 vCPU / 512 MB is plenty for
4 cameras + parents.

> **This step requires provisioning a host — it cannot be done from the CRM
> codebase.** Everything else (token endpoint, UI) is built once this responds.

---

## 1. Generate the config (from the CRM repo)

```
cd yellowdot-backend
node scripts/generateMediaMtxConfig.js           # preview (creds redacted)
node scripts/generateMediaMtxConfig.js --write    # writes .mediamtx/mediamtx.yml (REAL creds)
```
The written file contains RTSP credentials → it is gitignored; treat as a secret.
Regenerate whenever cameras are added/changed.

---

## 2. Choose a host

| Scale | Host | Note |
|---|---|---|
| 4 cams (now) | small VPS ($5) **or** a separate Railway service | remux ≈ near-zero CPU |
| ~50 | 1 dedicated-vCPU VPS | — |
| 100+ | worker pool + CDN + Redis | later |

The host must reach each camera's IP:554 (these cameras are public-IP, so any
host works; LAN-only cameras would need a relay).

---

## 3a. Deploy — Docker (recommended)

```
docker run -d --name yd-mediamtx \
  -p 8888:8888 -p 8889:8889 -p 8189:8189/udp \
  -v $(pwd)/.mediamtx/mediamtx.yml:/mediamtx.yml \
  bluenviron/mediamtx:latest
```
Ports: 8888 HLS, 8889 WebRTC (HTTP/signaling), 8189/udp WebRTC media.

## 3b. Deploy — Railway service
- New service in the project, image `bluenviron/mediamtx:latest`.
- Mount the generated `mediamtx.yml` (or bake via a build step / volume).
- Expose 8888 + 8889; Railway provides TLS on the public domain.

---

## 4. Verify

```
# Service up:
curl -sf http://<engine-host>:8888/    # MediaMTX responds

# Pull a stream on-demand (HLS playlist appears once a viewer hits it):
curl -s http://<engine-host>:8888/cam/<cameraId>/index.m3u8 | head
# Expect #EXTM3U ... within a few seconds (ffmpeg-free remux start).
```
Open the HLS URL in VLC or a browser `<video>`+hls.js to confirm playback of the
H.264 substream.

---

## 5. Security hardening (before parent access)

- Put TLS in front (Railway auto; VPS → caddy/nginx reverse proxy).
- **Do not leave paths public.** Enable the API auth hook so only token-bearing
  requests play (wired in the next code step — `/internal/cctv/auth`).
- Restrict inbound: only the CRM API may call the auth hook; only 8888/8889
  public (behind TLS); block direct RTSP from the internet.
- No public CORS wildcard (the V1 mistake).

---

## 6. Hand back to CRM

Once the engine is reachable, set in the API environment:
```
CCTV_STREAM_ENGINE_URL = https://<engine-host>      # base for HLS/WebRTC URLs
CCTV_STREAM_ENGINE_HLS_PORT  = 8888
CCTV_STREAM_ENGINE_WEBRTC_PORT = 8889
```
Then the next code step builds:
- `POST /api/cctv/cameras/:id/live-token` → returns `<engine>/cam/<id>/...` + token
- `/internal/cctv/auth` (MediaMTX auth hook → validates the token)
- audit logging + Live View UI.

---

## 7. What I (the engineer) need from you to continue
1. Confirm the **engine host** is up and reachable (URL).
2. Confirm Railway is serving the latest API commit.
3. Then I build the token endpoint, auth hook, audit log, and Live View UI —
   end to end — and we test the visibility matrix with real video.
