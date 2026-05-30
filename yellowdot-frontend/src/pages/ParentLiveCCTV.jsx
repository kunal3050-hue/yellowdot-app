/**
 * ParentLiveCCTV.jsx — Parent-facing classroom camera viewer
 * ──────────────────────────────────────────────────────────────────
 *
 * Access gating:
 *   PRESENT     → shows live camera list + HLS player
 *   NOT_ARRIVED → locked; prompt to check in first
 *   CHECKED_OUT → locked; child has left for the day
 *
 * Architecture: same HLS.js pipeline as LiveCCTV (staff), but:
 *   • Read-only — no start/stop controls
 *   • Parent gets camera info from /api/cctv-access (no RTSP URLs exposed)
 *   • Stream starts automatically when a camera is selected
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import Hls from "hls.js";
import securityService from "../services/securityService";

const BACKEND       = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
const POLL_INTERVAL = 30_000; // re-check access every 30 s

function hlsUrl(cameraId) {
  return `${BACKEND}/stream/live/${encodeURIComponent(cameraId)}/stream.m3u8`;
}

// ── Status label helpers ───────────────────────────────────────────
const STATUS_META = {
  PRESENT:     { emoji: "🟢", label: "Present",     color: "#16a34a" },
  CHECKED_OUT: { emoji: "🔴", label: "Checked Out", color: "#dc2626" },
  NOT_ARRIVED: { emoji: "⚪", label: "Not Arrived", color: "#6b7280" },
};

function elapsed(isoStr) {
  if (!isoStr) return null;
  const diff = Math.round((Date.now() - new Date(isoStr).getTime()) / 60_000);
  if (diff < 1)  return "just now";
  if (diff < 60) return `${diff} min ago`;
  const h = Math.floor(diff / 60), m = diff % 60;
  return `${h}h ${m}m ago`;
}

// ── Camera tile ────────────────────────────────────────────────────
function CameraTile({ cam, selected, onClick }) {
  return (
    <button
      onClick={() => onClick(cam)}
      style={{
        display:        "flex",
        alignItems:     "center",
        gap:            12,
        width:          "100%",
        padding:        "12px 14px",
        borderRadius:   14,
        border:         selected ? "2px solid #0F4C75" : "1.5px solid #E5E7EB",
        background:     selected ? "#0F4C75"           : "#F9FAFB",
        cursor:         "pointer",
        transition:     "all 0.15s ease",
        textAlign:      "left",
      }}
    >
      <span style={{ fontSize: 22, flexShrink: 0 }}>📷</span>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize:    13,
          fontWeight:  700,
          color:       selected ? "#FFF" : "#111",
          overflow:    "hidden",
          textOverflow:"ellipsis",
          whiteSpace:  "nowrap",
        }}>
          {cam.cameraName}
        </div>
        <div style={{ fontSize: 11, color: selected ? "#93C5FD" : "#6B7280", marginTop: 2 }}>
          {cam.classroom}{cam.channel ? ` · Ch ${cam.channel}` : ""}
        </div>
      </div>
    </button>
  );
}

// ── Locked screen ──────────────────────────────────────────────────
function LockedScreen({ status, reason, checkinTime, checkoutTime }) {
  const navigate = useNavigate();
  const meta = STATUS_META[status] || STATUS_META.NOT_ARRIVED;

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "40px 24px", textAlign: "center",
    }}>
      <div style={{
        width: 88, height: 88, borderRadius: "50%",
        background: "#F3F4F6",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 40, marginBottom: 24,
      }}>
        🔒
      </div>

      <div style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "6px 14px", borderRadius: 999,
        background: "#F3F4F6",
        fontSize: 13, fontWeight: 600,
        color: meta.color,
        marginBottom: 16,
      }}>
        <span>{meta.emoji}</span>
        {meta.label}
      </div>

      <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111", margin: "0 0 10px" }}>
        CCTV Access Locked
      </h2>
      <p style={{
        fontSize: 14, color: "#6B7280", maxWidth: 320, lineHeight: 1.6,
        margin: "0 0 28px",
      }}>
        {reason}
      </p>

      {checkoutTime && (
        <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 24 }}>
          Checked out {elapsed(checkoutTime)}
        </p>
      )}

      {status === "NOT_ARRIVED" && (
        <button
          onClick={() => navigate("/parent-checkin")}
          style={{
            padding: "12px 28px", borderRadius: 14,
            background: "#F4C400", border: "none",
            fontWeight: 700, fontSize: 14, color: "#111",
            cursor: "pointer",
          }}
        >
          📷 Scan Check-In QR
        </button>
      )}

      <Link
        to="/parent-home"
        style={{
          marginTop: 16, fontSize: 13, color: "#6B7280", textDecoration: "none",
          fontWeight: 500,
        }}
      >
        ← Back to Home
      </Link>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════
export default function ParentLiveCCTV() {
  const [access,      setAccess     ] = useState(null);   // getCctvAccess response
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [selected,    setSelected   ] = useState(null);   // camera object
  const [hlsStatus,   setHlsStatus  ] = useState("idle"); // idle|loading|live|error

  const videoRef = useRef(null);
  const hlsRef   = useRef(null);
  const pollRef  = useRef(null);
  const mounted  = useRef(true);

  // ── Fetch access ────────────────────────────────────────────────
  const fetchAccess = useCallback(async () => {
    try {
      const data = await securityService.getCctvAccess();
      if (!mounted.current) return;
      setAccess(data);

      // If child was PRESENT but just checked out, revoke stream
      if (!data.accessGranted && hlsRef.current) {
        destroyHls();
        setHlsStatus("idle");
        setSelected(null);
      }
    } catch {
      // silent — keeps current state
    } finally {
      if (mounted.current) setLoadingAccess(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    mounted.current = true;
    fetchAccess();
    pollRef.current = setInterval(fetchAccess, POLL_INTERVAL);
    return () => {
      mounted.current = false;
      clearInterval(pollRef.current);
      destroyHls();
    };
  }, []); // eslint-disable-line

  // ── HLS player ──────────────────────────────────────────────────
  function destroyHls() {
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.removeAttribute("src");
        videoRef.current.load();
      } catch {}
    }
  }

  function startHls(cameraId) {
    if (!videoRef.current) return;
    destroyHls();
    setHlsStatus("loading");

    const url = hlsUrl(cameraId);

    if (Hls.isSupported()) {
      const hls = new Hls({
        lowLatencyMode:             false,
        liveSyncDurationCount:       4,
        liveMaxLatencyDurationCount: 8,
        liveDurationInfinity:        true,
        manifestLoadingTimeOut:     12_000,
        manifestLoadingMaxRetry:    4,
        fragLoadingMaxRetry:        4,
        enableWorker:               true,
        debug:                      false,
      });
      hls.loadSource(url);
      hls.attachMedia(videoRef.current);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (mounted.current) setHlsStatus("live");
        videoRef.current?.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        if (mounted.current) setHlsStatus("error");
        destroyHls();
      });
      hlsRef.current = hls;
    } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
      videoRef.current.src = url;
      videoRef.current.play().catch(() => {});
      setHlsStatus("live");
    } else {
      setHlsStatus("error");
    }
  }

  function handleSelectCamera(cam) {
    if (cam.cameraId === selected?.cameraId) return;
    setSelected(cam);
    startHls(cam.cameraId);
  }

  // ── Render ───────────────────────────────────────────────────────
  if (loadingAccess) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "#FFF", gap: 16,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          border: "3px solid #E5E7EB", borderTopColor: "#F4C400",
          animation: "spin 0.75s linear infinite",
        }}/>
        <p style={{ fontSize: 14, color: "#6B7280" }}>Checking access…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const cameras = access?.cameras || [];
  const childStatus = access?.childStatus || "NOT_ARRIVED";

  return (
    <div style={{
      minHeight:  "100vh",
      background: "#F9FAFB",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", sans-serif',
      WebkitFontSmoothing: "antialiased",
    }}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{
        background: "#FFF",
        borderBottom: "1px solid #E5E7EB",
        padding: "14px 20px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <Link to="/parent-home" style={{
          width: 36, height: 36, borderRadius: 10,
          background: "#F3F4F6",
          display: "flex", alignItems: "center", justifyContent: "center",
          textDecoration: "none", fontSize: 18, color: "#374151",
          flexShrink: 0,
        }}>
          ←
        </Link>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 800, color: "#111", margin: 0 }}>
            📹 Classroom Camera
          </h1>
          {access?.accessGranted && (
            <p style={{ fontSize: 11, color: "#10B981", margin: "2px 0 0", fontWeight: 600 }}>
              🟢 Access granted · Child is present
            </p>
          )}
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────── */}
      {!access?.accessGranted ? (
        <LockedScreen
          status={childStatus}
          reason={access?.reason || ""}
          checkinTime={access?.checkinTime}
          checkoutTime={access?.checkoutTime}
        />
      ) : (
        <div style={{
          maxWidth: 680, margin: "0 auto",
          padding: "20px 16px 40px",
          display: "flex", flexDirection: "column", gap: 16,
        }}>

          {/* Camera list */}
          {cameras.length === 0 ? (
            <div style={{
              padding: "32px 24px", background: "#FFF",
              borderRadius: 18, textAlign: "center",
              border: "1.5px solid #E5E7EB",
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📷</div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>No cameras configured</p>
              <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>
                Your school hasn't set up live cameras yet.
              </p>
            </div>
          ) : (
            <>
              {/* Camera selector */}
              <div style={{
                background: "#FFF", borderRadius: 18,
                border: "1.5px solid #E5E7EB",
                padding: 16,
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 10px" }}>
                  Classroom Cameras
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {cameras.map(cam => (
                    <CameraTile
                      key={cam.cameraId}
                      cam={cam}
                      selected={selected?.cameraId === cam.cameraId}
                      onClick={handleSelectCamera}
                    />
                  ))}
                </div>
              </div>

              {/* Video player */}
              <div style={{
                background: "#000", borderRadius: 18,
                overflow: "hidden",
                aspectRatio: "16/9",
                position: "relative",
              }}>
                <video
                  ref={videoRef}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  autoPlay muted playsInline
                  controls={hlsStatus === "live"}
                />

                {/* Overlay states */}
                {!selected && (
                  <div style={{
                    position: "absolute", inset: 0,
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    color: "#FFF",
                  }}>
                    <span style={{ fontSize: 48, opacity: 0.4 }}>▶</span>
                    <p style={{ marginTop: 10, fontSize: 13, opacity: 0.6 }}>Select a camera above</p>
                  </div>
                )}

                {selected && hlsStatus === "loading" && (
                  <div style={{
                    position: "absolute", inset: 0,
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    background: "rgba(0,0,0,0.7)",
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%",
                      border: "3px solid rgba(255,255,255,0.2)",
                      borderTopColor: "#F4C400",
                      animation: "spin 0.75s linear infinite",
                      marginBottom: 12,
                    }}/>
                    <p style={{ color: "#FFF", fontSize: 14, fontWeight: 600 }}>Connecting…</p>
                    <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 4 }}>
                      Usually 10–30 seconds
                    </p>
                  </div>
                )}

                {selected && hlsStatus === "error" && (
                  <div style={{
                    position: "absolute", inset: 0,
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    background: "rgba(0,0,0,0.8)", padding: 24, textAlign: "center",
                  }}>
                    <span style={{ fontSize: 36, marginBottom: 10 }}>⚠️</span>
                    <p style={{ color: "#FFF", fontSize: 14, fontWeight: 700 }}>Stream Unavailable</p>
                    <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 6, maxWidth: 240 }}>
                      The camera stream could not be loaded. Please try again later.
                    </p>
                    <button
                      onClick={() => startHls(selected.cameraId)}
                      style={{
                        marginTop: 16, padding: "8px 20px", borderRadius: 10,
                        background: "#F4C400", border: "none",
                        fontWeight: 700, fontSize: 12, color: "#111", cursor: "pointer",
                      }}
                    >
                      Retry
                    </button>
                  </div>
                )}

                {/* LIVE badge */}
                {hlsStatus === "live" && (
                  <div style={{
                    position: "absolute", top: 12, left: 12,
                    background: "#DC2626", color: "#FFF",
                    fontSize: 10, fontWeight: 800,
                    padding: "3px 9px", borderRadius: 999,
                    display: "flex", alignItems: "center", gap: 5,
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: "#FFF", animation: "pulse 1.2s infinite",
                    }}/>
                    LIVE
                  </div>
                )}
              </div>

              {/* Check-in time strip */}
              {access?.checkinTime && (
                <div style={{
                  padding: "10px 16px",
                  background: "#ECFDF5",
                  borderRadius: 12,
                  fontSize: 12, color: "#065F46",
                  fontWeight: 500,
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span>🟢</span>
                  Your child checked in {elapsed(access.checkinTime)}
                  {access.gate ? ` at ${access.gate}` : ""}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes pulse  { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}
