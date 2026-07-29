/**
 * LiveView.jsx — Parent Module · Live Camera View
 *
 * Auto-starts on mount. Auto-reconnects on stream drop with exponential
 * backoff (5 s → 30 s max). Permanent access errors (403 with a known
 * reason) stop the retry loop and show a friendly message.
 *
 * Token TTL is 120 s; refreshes every 90 s automatically.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import cctvService from "../../../services/cctvService";
import { colors, spacing, radius, shadows, typography } from "../theme";

const REFRESH_INTERVAL_MS = 90_000; // token refresh (30 s before 120 s TTL)
const RETRY_BASE_MS       = 5_000;  // first retry delay
const RETRY_MAX_MS        = 30_000; // cap on retry delay
const MAX_RETRIES         = 6;      // ~2 min of backoff, then stop and show why

/**
 * Should this failure be retried?
 *
 * Retry ONLY genuinely transient conditions. This used to be the other way
 * round — an allow-list of "permanent" reasons, everything else retried — which
 * meant any reason the list didn't know about (and any response with no `reason`
 * at all) span forever behind "Reconnecting…" with its message discarded. The
 * server's reason vocabulary is larger than any list kept in sync by hand, so
 * the DEFAULT has to be "stop and show", not "retry".
 *
 * Every 4xx is a decision — authorization, presence, scheduling, configuration —
 * that will not change inside a 2-minute retry window. A 503 here means the
 * streaming engine isn't deployed, which needs a release, not a retry.
 */
function isRetryable(err) {
  const status = err?.response?.status;
  if (status == null) return true;   // no response — offline / DNS / dropped connection
  if (status === 429) return true;   // rate-limited — backoff is exactly the fix
  if (status === 503) return false;  // ENGINE_NOT_PROVISIONED — needs a deploy
  return status >= 500;              // 500 / 502 / 504 — transient server or proxy
}

// ── Error reason → friendly message ─────────────────────────────────
function friendlyError(err) {
  if (!err) return "Could not connect to the camera.";
  const r = err.reason || "";
  const m = err.message || err.error || "";
  if (r === "parent-cctv-disabled" || r === "master-switch-off") return "Live viewing is currently disabled by the school.";
  if (r === "outside-hours" || r === "not-school-hours")          return "Live view is only available during school hours.";
  if (r === "outside-school-hours")                               return "Live view is only available during school hours.";
  if (r === "child-not-present" || r === "not-checked-in")        return "Your child is not checked in today.";
  if (r === "child-checked-out")                                  return "Your child has checked out for today.";
  if (r === "no-camera-in-classroom" || r === "no-camera")        return "No camera is set up for your child's classroom.";
  if (r === "no-active-slot")                                      return "No session is scheduled for this camera right now.";
  if (r === "not-linked" || r === "no-linked-child")              return "No student is linked to your account. Contact the school.";
  if (r === "child-missing")                                      return "Student record not found. Contact the school.";
  // Reasons the resolver can return that previously had no message at all —
  // they reached the retry branch and were never rendered.
  if (r === "not-child-classroom")                                return "This camera isn't covering your child's classroom right now.";
  if (r === "different-center" || r === "different-school")        return "This camera is not available for your child.";
  if (r === "camera-unavailable")                                 return "This camera is currently unavailable.";
  if (r === "not-parent")                                         return "This account cannot view live cameras.";
  if (r === "engine-not-provisioned" || m.includes("ENGINE_NOT_PROVISIONED")) return "Live streaming is not enabled yet.";
  // Never surface a raw server exception to a parent.
  if (r === "server-error")                                       return "Something went wrong on our end. Please try again.";
  if (m) return m;
  return "Live view is not available right now.";
}

function errIcon(reason) {
  if (!reason) return "📷";
  if (reason === "child-not-present" || reason === "not-checked-in") return "🏠";
  if (reason === "child-checked-out")                                 return "🏠";
  if (reason === "outside-hours" || reason === "outside-school-hours" || reason === "not-school-hours") return "🕐";
  if (reason === "no-camera-in-classroom" || reason === "no-camera")  return "📷";
  if (reason === "parent-cctv-disabled" || reason === "master-switch-off") return "🔒";
  return "⚠️";
}

// ── Main component ───────────────────────────────────────────────────

export default function LiveView() {
  const videoRef     = useRef(null);
  const hlsRef       = useRef(null);
  const refreshTimer = useRef(null);
  const retryTimer   = useRef(null);
  const sessionRef   = useRef(null);
  const retryCount   = useRef(0);
  const activeCamRef = useRef(null); // mirrors activeCam for use inside callbacks

  // Camera list
  const [cameras,   setCameras]   = useState([]);
  const [classroom, setClassroom] = useState("");
  const [activeCam, setActiveCam] = useState(null);

  // Player state: "loading" | "live" | "reconnecting" | "error"
  const [status,  setStatus]  = useState("loading");
  const [errInfo, setErrInfo] = useState(null);

  // ── Teardown ─────────────────────────────────────────────────────
  const destroyPlayer = useCallback(() => {
    clearTimeout(refreshTimer.current);
    clearTimeout(retryTimer.current);
    if (hlsRef.current) { try { hlsRef.current.destroy(); } catch {} hlsRef.current = null; }
    const v = videoRef.current;
    if (v) { try { v.pause(); v.removeAttribute("src"); v.load(); } catch {} }
  }, []);

  // ── Schedule auto-retry (exponential backoff) ─────────────────────
  const scheduleRetry = useCallback((camId) => {
    clearTimeout(retryTimer.current);
    const delay = Math.min(RETRY_BASE_MS * Math.pow(1.5, retryCount.current), RETRY_MAX_MS);
    retryTimer.current = setTimeout(() => {
      retryCount.current += 1;
      // startStream is defined below but captured via ref to avoid circular deps
      startStreamRef.current?.(camId);
    }, delay);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Attach HLS ───────────────────────────────────────────────────
  const attachHls = useCallback((url, camId) => {
    const video = videoRef.current;
    if (!video) return;
    // Destroy old instance but keep retry state
    clearTimeout(refreshTimer.current);
    if (hlsRef.current) { try { hlsRef.current.destroy(); } catch {} hlsRef.current = null; }
    try { video.pause(); video.removeAttribute("src"); video.load(); } catch {}

    if (Hls.isSupported()) {
      const hls = new Hls({ lowLatencyMode: true, backBufferLength: 10 });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play?.().catch(() => {}));
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data?.fatal) {
          if (hlsRef.current) { try { hlsRef.current.destroy(); } catch {} hlsRef.current = null; }
          setStatus("reconnecting");
          scheduleRetry(camId);
        }
      });
      hlsRef.current = hls;
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      video.play?.().catch(() => {});
    } else {
      setStatus("error");
      setErrInfo({ message: "Your browser cannot play this stream." });
    }
  }, [scheduleRetry]);

  // ── Fetch token + start/refresh stream ───────────────────────────
  const startStream = useCallback(async (camId) => {
    setErrInfo(null);
    try {
      const r = await cctvService.parentLiveToken(camId || null);
      sessionRef.current = r.sessionId;
      if (r.classroom && !classroom) setClassroom(r.classroom);

      // Successful connect — reset retry backoff
      retryCount.current = 0;

      const url = `${r.hlsUrl}${r.hlsUrl.includes("?") ? "&" : "?"}token=${encodeURIComponent(r.token)}`;
      attachHls(url, camId || r.cameraId);
      setStatus("live");

      // Schedule token refresh before TTL expires
      refreshTimer.current = setTimeout(
        () => startStream(camId || r.cameraId),
        REFRESH_INTERVAL_MS
      );
    } catch (e) {
      const info = e?.response?.data || { message: "Could not load live stream." };

      if (isRetryable(e) && retryCount.current < MAX_RETRIES) {
        // Transient — keep retrying, but hold on to `info` so that if we do give
        // up, the final error state can still explain what went wrong.
        setStatus("reconnecting");
        setErrInfo(info);
        scheduleRetry(camId || activeCamRef.current?.cameraId || null);
      } else {
        // Permanent, or we've exhausted the retry budget — stop and say why.
        destroyPlayer();
        setStatus("error");
        setErrInfo(info);
      }
    }
  }, [attachHls, destroyPlayer, scheduleRetry, classroom]);

  // Keep a ref so scheduleRetry can call it without a circular dep
  const startStreamRef = useRef(startStream);
  useEffect(() => { startStreamRef.current = startStream; }, [startStream]);

  // ── Load camera list on mount ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await cctvService.parentCameras();
        if (cancelled) return;
        const cams = r.cameras || [];
        setCameras(cams);
        if (r.classroom) setClassroom(r.classroom);
        const first = cams[0] || null;
        setActiveCam(first);
        activeCamRef.current = first;
        if (first) startStream(first.cameraId);
        else { setStatus("error"); setErrInfo({ reason: "no-camera", message: "No camera in classroom." }); }
      } catch (e) {
        if (!cancelled) { setStatus("error"); setErrInfo(e?.response?.data || { message: "Could not load cameras." }); }
      }
    })();
    return () => { cancelled = true; destroyPlayer(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Switch camera ─────────────────────────────────────────────────
  const switchCam = useCallback((cam) => {
    if (cam.cameraId === activeCam?.cameraId) return;
    setActiveCam(cam);
    activeCamRef.current = cam;
    retryCount.current = 0;
    clearTimeout(retryTimer.current);
    setStatus("loading");
    destroyPlayer();
    startStream(cam.cameraId);
  }, [activeCam, destroyPlayer, startStream]);

  const reason = errInfo?.reason || "";
  const isReconnecting = status === "reconnecting";
  const isLoading      = status === "loading";

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: colors.surface.background }}>

      {/* Header */}
      <div style={{ padding: `${spacing.lg}px ${spacing.xl}px ${spacing.sm}px`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.text.primary }}>
            Live Camera
          </div>
          {classroom && (
            <div style={{ fontSize: typography.size.sm, color: colors.text.secondary, marginTop: 2 }}>{classroom}</div>
          )}
        </div>
        {status === "live" && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: radius.pill, background: "#FEE2E2", border: "1px solid #FCA5A5" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#EF4444", animation: "yd-pulse 1.5s ease-in-out infinite" }} />
            <span style={{ fontSize: 11, fontWeight: typography.weight.bold, color: "#B91C1C", letterSpacing: "0.05em" }}>LIVE</span>
          </div>
        )}
      </div>

      {/* Camera picker — only shown when multiple cameras */}
      {cameras.length > 1 && (
        <div style={{ display: "flex", gap: spacing.sm, overflowX: "auto", padding: `0 ${spacing.xl}px ${spacing.sm}px`, scrollbarWidth: "none" }}>
          {cameras.map(cam => {
            const sel = cam.cameraId === activeCam?.cameraId;
            return (
              <button key={cam.cameraId} onClick={() => switchCam(cam)} style={{
                flexShrink: 0,
                padding: "6px 14px", borderRadius: radius.pill, border: "none", cursor: "pointer",
                fontSize: typography.size.xs, fontWeight: typography.weight.semibold,
                background: sel ? colors.brand.gradient : colors.surface.raised,
                color: sel ? colors.text.onYellow : colors.text.secondary,
                boxShadow: sel ? shadows.primary : "none",
                transition: "all 0.15s",
              }}>
                {cam.cameraName}
              </button>
            );
          })}
        </div>
      )}

      {/* Video player */}
      <div style={{ margin: `0 ${spacing.lg}px`, borderRadius: radius.xl, overflow: "hidden", background: "#0F172A", position: "relative", aspectRatio: "16/9", boxShadow: shadows.lg }}>
        <video
          ref={videoRef}
          style={{ width: "100%", height: "100%", display: status === "live" ? "block" : "none", objectFit: "cover" }}
          playsInline muted controls={false}
        />

        {(isLoading || isReconnecting) && (
          <div style={overlayStyle}>
            <Spinner />
            <span style={{ color: "#94A3B8", fontSize: typography.size.sm, marginTop: spacing.sm }}>
              {isReconnecting ? "Reconnecting…" : "Connecting…"}
            </span>
          </div>
        )}

        {status === "error" && (
          <div style={overlayStyle}>
            <div style={{ fontSize: 40, marginBottom: spacing.sm }}>{errIcon(reason)}</div>
            <div style={{ color: "#F1F5F9", fontSize: typography.size.base, fontWeight: typography.weight.semibold, textAlign: "center", padding: `0 ${spacing.xl}px`, lineHeight: 1.5 }}>
              {friendlyError(errInfo)}
            </div>
          </div>
        )}
      </div>

      {/* Security strip */}
      {status === "live" && (
        <div style={{ margin: `${spacing.sm}px ${spacing.lg}px 0`, padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radius.lg, background: colors.surface.raised, border: `1px solid ${colors.surface.border}`, display: "flex", alignItems: "center", gap: spacing.sm }}>
          <span style={{ fontSize: 14 }}>🔒</span>
          <span style={{ fontSize: typography.size.xs, color: colors.text.secondary, lineHeight: 1.5 }}>
            Secure · School hours only · Your child's classroom
          </span>
        </div>
      )}

      {/* Manual retry — only for permanent errors, not transient ones */}
      {status === "error" && !["not-linked", "child-missing"].includes(reason) && (
        <div style={{ margin: `${spacing.lg}px ${spacing.lg}px 0` }}>
          <button
            onClick={() => { retryCount.current = 0; setStatus("loading"); startStream(activeCam?.cameraId || null); }}
            style={{ width: "100%", padding: spacing.md, borderRadius: radius.lg, border: "none", background: colors.brand.gradient, color: colors.text.onYellow, fontSize: typography.size.base, fontWeight: typography.weight.semibold, cursor: "pointer", boxShadow: shadows.primary }}
          >
            Try Again
          </button>
          {(reason === "outside-hours" || reason === "outside-school-hours") && (
            <p style={{ textAlign: "center", fontSize: typography.size.xs, color: colors.text.faint, margin: `${spacing.sm}px 0 0`, padding: `0 ${spacing.xl}px` }}>
              Live view opens when school starts and closes after dismissal.
            </p>
          )}
          {(reason === "child-not-present" || reason === "child-checked-out") && (
            <p style={{ textAlign: "center", fontSize: typography.size.xs, color: colors.text.faint, margin: `${spacing.sm}px 0 0`, padding: `0 ${spacing.xl}px` }}>
              Your child's attendance is recorded by staff at check-in.
            </p>
          )}
          {reason === "no-active-slot" && (
            <p style={{ textAlign: "center", fontSize: typography.size.xs, color: colors.text.faint, margin: `${spacing.sm}px 0 0`, padding: `0 ${spacing.xl}px` }}>
              The camera will connect automatically when the next session begins.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const overlayStyle = { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" };

function Spinner() {
  return <div style={{ width: 36, height: 36, border: "3px solid rgba(255,255,255,0.15)", borderTop: "3px solid #FBBF24", borderRadius: "50%", animation: "yd-spin 0.8s linear infinite" }} />;
}

if (typeof document !== "undefined" && !document.getElementById("yd-live-kf")) {
  const s = document.createElement("style");
  s.id = "yd-live-kf";
  s.textContent = `@keyframes yd-spin{to{transform:rotate(360deg)}}@keyframes yd-pulse{0%,100%{opacity:1}50%{opacity:0.4}}`;
  document.head.appendChild(s);
}
