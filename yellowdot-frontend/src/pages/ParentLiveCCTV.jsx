/**
 * ParentLiveCCTV.jsx — Phase 3 parent live camera view
 * ─────────────────────────────────────────────────────────────────────────────
 * Parents watch their child's classroom camera, gated server-side by:
 *   • parent↔child link · school-hours window · child CHECKED_IN · classroom scope
 * The browser never receives RTSP/credentials — only a short-lived token + HLS URL.
 * Until MediaMTX is provisioned the token endpoint returns 503 → friendly message.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import cctvService from "../services/cctvService";

export default function ParentLiveCCTV() {
  const [state, setState] = useState("idle");   // idle | connecting | live | denied | unavailable | error
  const [message, setMessage] = useState("");
  const [info, setInfo] = useState(null);        // { classroom }
  const videoRef   = useRef(null);
  const hlsRef     = useRef(null);
  const sessionRef = useRef(null);

  const stop = useCallback(() => {
    if (hlsRef.current) { try { hlsRef.current.destroy(); } catch {} hlsRef.current = null; }
    if (videoRef.current) { try { videoRef.current.pause(); videoRef.current.removeAttribute("src"); videoRef.current.load(); } catch {} }
    sessionRef.current = null;
  }, []);

  const start = useCallback(async () => {
    stop();
    setState("connecting"); setMessage(""); setInfo(null);
    try {
      const r = await cctvService.parentLiveToken();
      sessionRef.current = r.sessionId;
      setInfo({ classroom: r.classroom });
      const url = `${r.hlsUrl}${r.hlsUrl.includes("?") ? "&" : "?"}token=${encodeURIComponent(r.token)}`;
      const video = videoRef.current;
      if (!video) return;
      if (Hls.isSupported()) {
        const hls = new Hls({ lowLatencyMode: true, backBufferLength: 10 });
        hls.loadSource(url); hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_e, d) => { if (d?.fatal) { setState("error"); setMessage("Stream error."); } });
        hlsRef.current = hls;
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
      } else { setState("error"); setMessage("This browser cannot play the live stream."); return; }
      video.play?.().catch(() => {});
      setState("live");
    } catch (e) {
      const code = e?.response?.data?.error;
      const reason = e?.response?.data?.reason;
      if (code === "ENGINE_NOT_PROVISIONED") { setState("unavailable"); setMessage("Live camera is being set up and will be available soon."); }
      else if (e?.response?.status === 403) {
        setState("denied");
        setMessage(
          reason === "child-not-present"   ? "Live view is available once your child checks in." :
          reason === "child-checked-out"   ? "Your child has checked out for today. See you tomorrow!" :
          reason === "outside-school-hours"? "Live view is only available during school hours." :
          reason === "parent-cctv-disabled"? "Live camera access is currently disabled by the school." :
          (e?.response?.data?.error || "Live view is not available right now.")
        );
      } else { setState("error"); setMessage(e?.response?.data?.error || "Could not start live view."); }
    }
  }, [stop]);

  useEffect(() => () => stop(), [stop]); // cleanup on unmount

  return (
    <div style={{ padding: 16, maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", margin: "0 0 4px" }}>Live Camera</h1>
      <p style={{ fontSize: 13, color: "#94A3B8", margin: "0 0 16px" }}>
        {info?.classroom ? `${info.classroom} classroom` : "Your child's classroom — available while checked in"}
      </p>

      <div style={{ position: "relative", background: "#000", borderRadius: 16, overflow: "hidden", aspectRatio: "16 / 9" }}>
        <video ref={videoRef} controls muted playsInline
          style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }} />
        {state !== "live" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", textAlign: "center", padding: 24 }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>
              {state === "connecting" ? "⏳" : state === "denied" ? "🔒" : state === "unavailable" ? "🛠️" : "📷"}
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, maxWidth: 360 }}>
              {state === "connecting" ? "Connecting…" : (message || "Tap below to view your child's classroom.")}
            </p>
          </div>
        )}
        {state === "live" && (
          <div style={{ position: "absolute", top: 8, right: 10, fontSize: 11, color: "rgba(255,255,255,0.75)", textShadow: "0 1px 2px #000", pointerEvents: "none" }}>
            ● LIVE
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        {state !== "live" ? (
          <button onClick={start} disabled={state === "connecting"} className="btn btn-primary"
            style={{ flex: 1 }}>
            {state === "connecting" ? "Connecting…" : "▶ View Live"}
          </button>
        ) : (
          <button onClick={() => { stop(); setState("idle"); }} className="btn btn-ghost" style={{ flex: 1 }}>
            ■ Stop
          </button>
        )}
      </div>

      <p style={{ fontSize: 11, color: "#CBD5E1", marginTop: 12, textAlign: "center" }}>
        Access is limited to school hours while your child is checked in, for their privacy and safety.
      </p>
    </div>
  );
}
