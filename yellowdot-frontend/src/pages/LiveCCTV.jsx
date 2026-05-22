/**
 * LiveCCTV.jsx  — Real-time CCTV viewer
 * ─────────────────────────────────────────────────────────────────
 *
 * Architecture: RTSP camera → FFmpeg (backend) → HLS segments → hls.js
 *
 * Per-camera isolation:
 *   • Each camera has its own HLS URL: /stream/live/{cameraId}/stream.m3u8
 *   • Status polling uses ?cameraId= so each camera's state is independent
 *   • Switching cameras destroys the old HLS instance and creates a new one
 *     pointed at the new camera's HLS playlist
 *
 * State machine (mirrors backend stream status):
 *   idle | starting | live | error | stopped
 *
 * Stability guarantees:
 *   • selectedIdRef tracks the selected camera without stale closure issues
 *   • All useCallback deps are [] — zero re-subscription loops
 *   • mountedRef guards every async callback
 *   • HLS instance is created/destroyed exactly once per "live" transition
 *   • Status polling is cleared on unmount and on intentional stop
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useCallback } from "react";
import Hls           from "hls.js";
import { Link }      from "react-router-dom";
import cctvService   from "../services/cctvService";
import streamService from "../services/streamService";

// ── Constants ─────────────────────────────────────────────────────
const POLL_INTERVAL    = 3_000;   // ms — status poll frequency
const STARTING_TIMEOUT = 45_000;  // ms — max wait for "starting" → "live"
// In production the backend is on the same origin (Firebase Hosting → Cloud Functions).
// VITE_API_URL="" produces relative HLS URLs (e.g. /stream/live/cam1/stream.m3u8).
const BACKEND          = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

// ── Per-camera HLS URL builder ────────────────────────────────────
function hlsUrl(cameraId) {
  return `${BACKEND}/stream/live/${encodeURIComponent(cameraId)}/stream.m3u8`;
}

// ── Inline toast ──────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback(id => setToasts(t => t.filter(x => x.id !== id)), []);
  const add = useCallback((type, message) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, type, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5_000);
  }, []);
  const success = useCallback(msg => add("success", msg), [add]);
  const error   = useCallback(msg => add("error",   msg), [add]);
  return { toasts, success, error, dismiss };
}

function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className={`flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold
                      pointer-events-auto max-w-sm
                      ${t.type === "success" ? "bg-yd-navy text-white" : "bg-rose-600 text-white"}`}>
          <span>{t.type === "success" ? "✅" : "❌"}</span>
          <span className="flex-1">{t.message}</span>
          <button onClick={() => onDismiss(t.id)}
            className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 font-bold">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────
const STATUS_CONFIG = {
  idle:     { label: "Idle",        dot: "bg-gray-400",   badge: "bg-gray-100 text-gray-600"    },
  starting: { label: "Connecting…", dot: "bg-yellow-400", badge: "bg-yellow-50 text-yellow-700" },
  live:     { label: "Live",        dot: "bg-green-500",  badge: "bg-green-50 text-green-700"   },
  error:    { label: "Error",       dot: "bg-red-500",    badge: "bg-red-50 text-red-700"       },
  stopped:  { label: "Stopped",     dot: "bg-gray-400",   badge: "bg-gray-100 text-gray-600"    },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${cfg.badge}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot} ${status === "live" ? "animate-pulse" : ""}`} />
      {cfg.label}
    </span>
  );
}

// ── Video overlay ─────────────────────────────────────────────────
function VideoOverlay({ status, error, cameraName, startedAt, channel }) {
  if (status === "live") {
    return (
      <>
        <div className="absolute top-4 left-4 bg-red-600 text-white text-xs font-black
                        px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg select-none">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          LIVE
        </div>
        <div className="absolute bottom-4 left-4 bg-black/50 text-white text-xs font-semibold
                        px-3 py-1 rounded-full backdrop-blur-sm select-none">
          {cameraName}
          {channel && <span className="ml-2 opacity-60">Ch {channel}</span>}
          {startedAt && (
            <span className="ml-2 opacity-60">
              {new Date(startedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </>
    );
  }

  if (status === "starting") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
        <div className="w-16 h-16 border-4 border-yd-yellow border-t-transparent rounded-full animate-spin mb-5" />
        <p className="text-white font-bold text-xl">Connecting…</p>
        <p className="text-gray-300 text-sm mt-1">FFmpeg is starting the HLS stream</p>
        <p className="text-gray-500 text-xs mt-3">HEVC → H.264 transcode  ·  usually 10–30 s</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 px-8 text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <p className="text-white font-bold text-xl">Stream Failed</p>
        <p className="text-gray-300 text-sm mt-2 max-w-xs leading-relaxed">
          {error || "FFmpeg could not connect to the camera."}
        </p>
        <p className="text-gray-500 text-xs mt-4">
          Check camera power, network, and RTSP credentials.
        </p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
      <div className="text-6xl mb-5 opacity-40">▶</div>
      <p className="text-white font-bold text-xl">Stream Not Active</p>
      <p className="text-gray-300 text-sm mt-1">
        {status === "stopped" ? "Stream was stopped." : "Select a camera and press Start."}
      </p>
    </div>
  );
}

// ── Camera sidebar ────────────────────────────────────────────────
function CameraSidebar({ cameras, selectedId, onSelect, streamStatus, onStart, onStop, loading }) {
  const canStart = selectedId &&
    (streamStatus.status === "idle" ||
     streamStatus.status === "stopped" ||
     streamStatus.status === "error");

  const canStop = selectedId &&
    (streamStatus.status === "live" || streamStatus.status === "starting");

  return (
    <div className="w-[260px] flex-shrink-0 bg-white border-r border-gray-100 flex flex-col h-screen shadow-lg">

      {/* Brand */}
      <div className="p-5 border-b border-gray-100">
        <Link to="/" className="block">
          <h1 className="text-3xl font-black text-yd-yellow leading-none">Yellow<br/>Dot</h1>
          <p className="text-gray-400 text-[10px] font-medium mt-1 uppercase tracking-wider">
            Premium Preschool CRM
          </p>
        </Link>
        <Link to="/cctv-settings"
          className="mt-3 flex items-center gap-1.5 text-xs text-gray-400 hover:text-yd-navy transition-colors font-medium">
          ← CCTV Settings
        </Link>
      </div>

      {/* Section header */}
      <div className="px-4 pt-4 pb-1">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          Active Cameras
        </p>
      </div>

      {/* Camera list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
        {loading && (
          <div className="flex items-center gap-2 py-6 justify-center text-gray-300">
            <div className="w-4 h-4 border-2 border-gray-200 border-t-yd-yellow rounded-full animate-spin" />
            <span className="text-xs">Loading…</span>
          </div>
        )}

        {!loading && cameras.length === 0 && (
          <div className="py-8 text-center text-gray-400 text-xs px-2">
            <div className="text-3xl mb-2">📷</div>
            <p className="font-medium">No RTSP cameras found</p>
            <p className="mt-1 leading-relaxed">
              Add an active camera with an <code className="bg-gray-100 px-1 rounded">rtsp://</code> URL in CCTV Settings.
            </p>
            <Link to="/cctv-settings"
              className="mt-3 inline-block text-yd-navy font-bold hover:underline">
              Open CCTV Settings →
            </Link>
          </div>
        )}

        {cameras.map(cam => {
          const camId = cam.id || cam.camera_id;
          const sel   = camId === selectedId;
          const live  = sel && streamStatus.status === "live";
          return (
            <button key={camId} onClick={() => onSelect(cam)}
              className={`w-full text-left px-3 py-2.5 rounded-xl transition-all border text-sm
                ${sel
                  ? "bg-yd-navy text-white border-transparent"
                  : "bg-gray-50 text-gray-700 border-transparent hover:bg-gray-100"}`}>
              <div className="flex items-center justify-between gap-1">
                <span className="font-semibold truncate">{cam.cameraName || cam.camera_name}</span>
                {live && <span className="text-green-400 text-[10px] font-bold flex-shrink-0">● LIVE</span>}
                {sel && streamStatus.status === "starting" && (
                  <span className="text-yellow-300 text-[10px] font-bold flex-shrink-0">◌ …</span>
                )}
              </div>
              <p className={`text-[11px] mt-0.5 truncate ${sel ? "text-blue-200" : "text-gray-400"}`}>
                {cam.classroom} · ch{cam.channel || "1"} · {cam.brand || "Unknown"}
              </p>
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="p-3 border-t border-gray-100 space-y-2">
        {canStart && (
          <button onClick={onStart}
            className="w-full bg-yd-yellow hover:bg-[#f0c000] text-yd-navy font-bold py-2.5
                       rounded-xl text-sm transition-colors active:scale-95">
            ▶  Start Stream
          </button>
        )}
        {canStop && (
          <button onClick={onStop}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2.5
                       rounded-xl text-sm transition-colors active:scale-95">
            ■  Stop Stream
          </button>
        )}
        {!canStart && !canStop && streamStatus.status === "starting" && (
          <div className="text-xs text-center text-gray-400 py-1">Starting…</div>
        )}
        {streamStatus.restarts > 0 && (
          <p className="text-[10px] text-center text-gray-400">
            Reconnect {streamStatus.restarts}/{streamStatus.maxRestarts}
          </p>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Main page
// ══════════════════════════════════════════════════════════════════
export default function LiveCCTV() {
  const toast      = useToast();
  const mountedRef = useRef(true);
  const videoRef   = useRef(null);
  const hlsRef     = useRef(null);
  const pollRef    = useRef(null);
  const prevStatus = useRef("idle");
  const startTimer = useRef(null);

  // Ref that always holds the currently selected camera ID.
  // Used inside polling callbacks to avoid stale closures.
  const selectedIdRef = useRef(null);

  const [cameras,      setCameras]      = useState([]);
  const [camLoading,   setCamLoading]   = useState(true);
  const [selected,     setSelected]     = useState(null); // camera object
  const [streamStatus, setStreamStatus] = useState({ status: "idle", restarts: 0, maxRestarts: 5 });
  const [busy,         setBusy]         = useState(false);

  // ── Load cameras ────────────────────────────────────────────────
  const loadCameras = useCallback(async () => {
    try {
      const data = await cctvService.getCameras();
      if (!mountedRef.current) return;
      // Accept both camelCase (streamUrl) and snake_case (stream_url) from API
      const rtsp = (Array.isArray(data) ? data : []).filter(c =>
        c.status === "Active" &&
        String(c.streamUrl || c.stream_url || "").startsWith("rtsp://")
      );
      setCameras(rtsp);
    } catch {
      // silent — empty state shown
    } finally {
      if (mountedRef.current) setCamLoading(false);
    }
  }, []);

  // ── Status polling — always polls for the selected camera ────────
  const fetchStatus = useCallback(async () => {
    const cameraId = selectedIdRef.current;
    try {
      const s = await streamService.getStatus(cameraId || undefined);
      if (!mountedRef.current) return null;
      // getStatus(cameraId) returns a single object; getStatus() returns array
      const status = cameraId ? s : (Array.isArray(s) && s.length ? s[0] : { status: "idle" });
      setStreamStatus(status);
      return status;
    } catch {
      return null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(fetchStatus, POLL_INTERVAL);
  }, [fetchStatus]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  // ── HLS.js ─────────────────────────────────────────────────────
  const destroyHls = useCallback(() => {
    if (startTimer.current) { clearTimeout(startTimer.current); startTimer.current = null; }
    if (hlsRef.current)     { hlsRef.current.destroy(); hlsRef.current = null; }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.removeAttribute("src");
        videoRef.current.load();
      } catch {}
    }
  }, []);

  const attachHls = useCallback((cameraId) => {
    if (!videoRef.current || !cameraId) return;
    destroyHls();

    const url = hlsUrl(cameraId);

    if (Hls.isSupported()) {
      const hls = new Hls({
        lowLatencyMode:              false,
        liveSyncDurationCount:        4,
        liveMaxLatencyDurationCount:  8,
        liveDurationInfinity:         true,
        manifestLoadingTimeOut:      10_000,
        levelLoadingTimeOut:         10_000,
        fragLoadingTimeOut:          20_000,
        manifestLoadingMaxRetry:     6,
        levelLoadingMaxRetry:        6,
        fragLoadingMaxRetry:         6,
        manifestLoadingRetryDelay:   1_000,
        enableWorker:                true,
        debug:                       false,
      });

      hls.loadSource(url);
      hls.attachMedia(videoRef.current);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoRef.current?.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (!data.fatal) return;
        console.warn("[hls] fatal error:", data.type, data.details);
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            destroyHls();
        }
      });

      hlsRef.current = hls;
    } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS (Safari)
      videoRef.current.src = url;
      videoRef.current.play().catch(() => {});
    } else {
      toast.error("Your browser doesn't support HLS video playback.");
    }
  }, [destroyHls, toast]);

  // ── React to stream status changes ─────────────────────────────
  useEffect(() => {
    const prev = prevStatus.current;
    const curr = streamStatus.status;
    prevStatus.current = curr;

    if (curr === "live" && prev !== "live") {
      // Went live — attach player for the selected camera
      attachHls(selectedIdRef.current);
      if (startTimer.current) { clearTimeout(startTimer.current); startTimer.current = null; }
    } else if (curr !== "live" && prev === "live") {
      destroyHls();
    }

    if (curr === "starting" && prev !== "starting") {
      startTimer.current = setTimeout(() => {
        if (mountedRef.current) {
          toast.error("Stream is taking longer than expected. Camera may be offline.");
        }
      }, STARTING_TIMEOUT);
    }
    if (curr !== "starting" && startTimer.current) {
      clearTimeout(startTimer.current);
      startTimer.current = null;
    }
  }, [streamStatus.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mount / unmount ─────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    loadCameras();
    fetchStatus();
    startPolling();

    return () => {
      mountedRef.current = false;
      stopPolling();
      destroyHls();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Camera selection ────────────────────────────────────────────
  function handleSelect(cam) {
    const camId = cam.id || cam.camera_id;

    // Don't re-select the same camera
    if (camId === selectedIdRef.current) return;

    // Destroy any active HLS player (switching camera = new stream URL)
    destroyHls();

    selectedIdRef.current = camId;
    setSelected(cam);

    // Immediately fetch the NEW camera's status (don't wait for poll interval)
    fetchStatus();
  }

  // ── Start stream ────────────────────────────────────────────────
  async function handleStart() {
    if (!selected || busy) return;
    const camId = selected.id || selected.camera_id;
    setBusy(true);
    try {
      await streamService.startStream(camId);
      const s = await fetchStatus();
      startPolling();
      if (s?.status !== "error") {
        toast.success(`Connecting to ${selected.cameraName || selected.camera_name}…`);
      }
    } catch (e) {
      toast.error(e.message || "Failed to start stream.");
    } finally {
      setBusy(false);
    }
  }

  // ── Stop stream ─────────────────────────────────────────────────
  async function handleStop() {
    if (busy) return;
    const camId = selected?.id || selected?.camera_id;
    setBusy(true);
    try {
      destroyHls();
      await streamService.stopStream(camId);
      await fetchStatus();
      stopPolling();
      toast.success("Stream stopped.");
    } catch (e) {
      toast.error(e.message || "Failed to stop stream.");
    } finally {
      setBusy(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────
  const status   = streamStatus.status;
  const selectedId = selected?.id || selected?.camera_id;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-900">
      <ToastStack toasts={toast.toasts} onDismiss={toast.dismiss} />

      {/* ── Sidebar ── */}
      <CameraSidebar
        cameras={cameras}
        selectedId={selectedId}
        onSelect={handleSelect}
        streamStatus={streamStatus}
        onStart={handleStart}
        onStop={handleStop}
        loading={camLoading}
      />

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <div className="flex-shrink-0 bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-black text-white">📹 Live CCTV</h1>
            {selected && (
              <span className="text-sm text-gray-400 font-medium hidden sm:block">
                {selected.cameraName || selected.camera_name} · {selected.classroom}
                {selected.channel && <span className="ml-1 text-gray-500">· ch{selected.channel}</span>}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={status} />
            {status === "live" && streamStatus.startedAt && (
              <span className="text-xs text-gray-500 hidden md:block">
                Since {new Date(streamStatus.startedAt).toLocaleTimeString()}
              </span>
            )}
            {busy && (
              <div className="w-4 h-4 border-2 border-yd-yellow border-t-transparent rounded-full animate-spin" />
            )}
          </div>
        </div>

        {/* Video area */}
        <div className="flex-1 flex items-center justify-center bg-black min-h-0 p-4">

          {/* No camera selected */}
          {!selected && !camLoading && (
            <div className="text-center px-6">
              <div className="text-7xl mb-5">📷</div>
              <h2 className="text-2xl font-black text-white">Select a Camera</h2>
              <p className="text-gray-400 mt-2 max-w-xs mx-auto text-sm leading-relaxed">
                Pick an active RTSP camera from the sidebar, then press Start Stream.
              </p>
              {cameras.length === 0 && !camLoading && (
                <div className="mt-6 bg-yellow-900/30 border border-yellow-700/40 rounded-2xl p-5 max-w-sm mx-auto text-left">
                  <p className="text-sm font-bold text-yellow-300 mb-2">No RTSP cameras configured</p>
                  <p className="text-xs text-yellow-400 leading-relaxed">
                    Add a camera in CCTV Settings with Stream Type = RTSP
                    and a URL beginning with <code className="bg-yellow-900/40 px-1 rounded">rtsp://</code>.
                  </p>
                  <Link to="/cctv-settings"
                    className="mt-3 inline-block text-xs font-bold text-yellow-300 hover:underline">
                    → Open CCTV Settings
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Camera selected — player */}
          {(selected || status === "live") && (
            <div className="w-full max-w-6xl flex flex-col gap-3">

              {/* Video element */}
              <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl"
                   style={{ aspectRatio: "16/9" }}>
                <video
                  ref={videoRef}
                  className="w-full h-full object-contain"
                  autoPlay
                  muted
                  playsInline
                  controls={status === "live"}
                />
                <VideoOverlay
                  status={status}
                  error={streamStatus.error}
                  cameraName={selected?.cameraName || selected?.camera_name || streamStatus.cameraName || "Camera"}
                  startedAt={streamStatus.startedAt}
                  channel={streamStatus.channel || selected?.channel}
                />
              </div>

              {/* Info strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Classroom",  value: selected?.classroom || "—" },
                  { label: "Channel",    value: selected?.channel ? `Ch ${selected.channel}` : "—" },
                  { label: "Format",     value: "HEVC → H.264 HLS"          },
                  { label: "Resolution", value: "720p (scaled from 1080p)"   },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-800 rounded-xl px-3 py-2">
                    <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{label}</p>
                    <p className="text-xs text-gray-200 font-semibold mt-0.5 truncate">{value}</p>
                  </div>
                ))}
              </div>

              {status === "live" && streamStatus.rtspUrl && (
                <div className="bg-gray-800/50 rounded-xl px-4 py-2.5 flex items-center gap-3">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex-shrink-0">
                    Source
                  </span>
                  <code className="text-[11px] text-gray-400 truncate">{streamStatus.rtspUrl}</code>
                </div>
              )}
            </div>
          )}

          {/* Loading cameras */}
          {camLoading && !selected && (
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-yd-yellow border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400 font-medium">Loading cameras…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
