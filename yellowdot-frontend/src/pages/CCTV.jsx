/**
 * CCTV.jsx — CCTV V2 Phase 1 module
 * ─────────────────────────────────────────────────────────────────────
 * Standalone module at /cctv. Metadata management only — NO streaming,
 * live view, HLS, WebRTC, or FFmpeg.
 *
 * Sub-sections (tabs):
 *   • Camera Management   — list + add/edit/delete cameras
 *   • Classroom Mapping   — cameras grouped by classroom
 *   • Connection Testing  — TCP reachability check (not stream verify)
 *
 * Reuses the shared CLASSES list (same options as Students) for classroom
 * mapping — no duplicate classroom entity.
 */

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Hls from "hls.js";
import cctvService from "../services/cctvService";
import { useAuth } from "../contexts/AuthContext";

// Shared classroom options — mirrors CLASSES in Students.jsx (single source of truth list).
const CLASSES = ["Daycare", "Playgroup", "Nursery", "LKG", "UKG", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5"];
const BRANDS  = ["Hikvision", "Dahua", "CP Plus", "TP-Link", "Other"];
const TABS    = ["Camera Management", "Classroom Mapping", "Camera Verification", "Live View", "Parent Settings", "Audit Logs"];

// ── RTSP URL templates per brand ────────────────────────────────────
// Credentials are NOT embedded — username/password are stored separately
// and composed by the stream engine later (Phase 2). The path here is the
// brand-standard main-stream channel path.
//   Hikvision: /Streaming/Channels/<ch>01   (ch1 → 101)
//   Dahua:     /cam/realmonitor?channel=<ch>&subtype=0
//   CP Plus:   /cam/realmonitor?channel=<ch>&subtype=0  (Dahua-OEM)
const RTSP_TEMPLATES = {
  Hikvision: ({ ip, port, channel }) => `rtsp://${ip}:${port}/Streaming/Channels/${channel}01`,
  Dahua:     ({ ip, port, channel }) => `rtsp://${ip}:${port}/cam/realmonitor?channel=${channel}&subtype=0`,
  "CP Plus": ({ ip, port, channel }) => `rtsp://${ip}:${port}/cam/realmonitor?channel=${channel}&subtype=0`,
};

// Build the RTSP URL for the current form. Returns "" if required parts missing
// or the brand has no template (e.g. TP-Link / Other → must use custom).
// NOTE: credential-free. This is what we persist; the Stream Engine composes
// the final authenticated URL server-side using the encrypted credentials.
function buildRtsp({ brand, ip, port, channel }) {
  const tpl = RTSP_TEMPLATES[brand];
  if (!tpl) return "";
  if (!ip || !String(ip).trim()) return "";
  const p  = String(port || "554").trim() || "554";
  const ch = String(channel || "1").trim() || "1";
  return tpl({ ip: String(ip).trim(), port: p, channel: ch });
}

// Sanitized PREVIEW only — shows username + a MASKED password so the
// operator can sanity-check the structure. The real password is never
// rendered; "*****" is a fixed placeholder, not the actual length.
//   user + pwd:  rtsp://admin:*****@192.168.1.150:554/Streaming/Channels/701
//   user only:   rtsp://admin@192.168.1.150:554/Streaming/Channels/701
//   neither:     rtsp://192.168.1.150:554/Streaming/Channels/701
function buildRtspPreview(form) {
  const base = buildRtsp(form);
  if (!base) return "";
  const user = (form.username || "").trim();
  if (!user) return base;
  // Show masked password when one is set (or, when editing, when creds exist).
  const hasPwd = !!(form.password && form.password.trim()) || !!form.hasStoredPassword;
  const cred = hasPwd ? `${user}:*****` : user;
  return base.replace(/^rtsp:\/\//, `rtsp://${cred}@`);
}

const emptyForm = () => ({
  cameraCode: "", cameraName: "", classrooms: [], brand: "Hikvision",
  ip: "", port: "554", username: "", password: "", hasStoredPassword: false, channel: "1",
  customRtsp: false, streamUrl: "",
  streamType: "RTSP", status: "Active",
  scheduleEnabled: false, scheduleStart: "08:00", scheduleEnd: "17:00",
  scheduleDays: [1, 2, 3, 4, 5],
});

// ── Tiny toast ──────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }, []);
  return { toast, show };
}

// Role sets (mirror backend)
const CONFIGURE_ROLES = new Set(["super_admin", "developer", "admin"]);
const ASSIGN_ROLES    = new Set(["super_admin", "developer", "admin", "center_admin", "center_owner"]);

export default function CCTV() {
  const { toast, show } = useToast();
  const { currentUser }  = useAuth();
  const role             = currentUser?.role || "";

  // Capabilities derived from role
  const canConfigure = CONFIGURE_ROLES.has(role); // add / edit / delete cameras
  const canAssign    = ASSIGN_ROLES.has(role);    // classroom mapping + verification
  const isViewOnly   = !canAssign;                // teacher / staff: live view only

  // Tabs visible to this role
  const visibleTabs = useMemo(() => {
    if (canConfigure) return TABS;
    if (canAssign)    return TABS.filter(t => !["Parent Settings", "Audit Logs"].includes(t));
    return ["Live View"]; // teacher / staff
  }, [canConfigure, canAssign]);

  const [tab, setTab]         = useState(() => visibleTabs[0]);
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm]           = useState(emptyForm());
  const [saving, setSaving]       = useState(false);

  // verification + diagnostic state
  const [testUrl, setTestUrl]       = useState("");
  const [testing, setTesting]       = useState(false);
  const [testResult, setTestResult] = useState(null);   // TCP diagnostic result
  const [verifying, setVerifying]   = useState(false);
  const [verifyResult, setVerifyResult] = useState(null); // 4-check verify result
  const [verifyCamId, setVerifyCamId]   = useState(null);
  const [showDevDiag, setShowDevDiag]   = useState(false); // hidden TCP tool toggle

  // parent settings state
  const [psLoading, setPsLoading] = useState(false);
  const [psSaving,  setPsSaving]  = useState(false);
  const [ps, setPs] = useState({ enabled: "false", schoolOpen: "08:00", schoolClose: "18:00", enforceHours: "true", timezone: "Asia/Kolkata" });

  const loadPs = useCallback(async () => {
    setPsLoading(true);
    try { const r = await cctvService.getParentSettings(); setPs(r.settings || r); }
    catch {} finally { setPsLoading(false); }
  }, []);

  const savePs = async () => {
    setPsSaving(true);
    try { const r = await cctvService.saveParentSettings(ps); setPs(r.settings || r); show("success", "Parent settings saved."); }
    catch (e) { show("error", e?.response?.data?.error || "Save failed."); }
    finally { setPsSaving(false); }
  };

  // If role changes make the current tab invisible, fall back to first allowed tab.
  useEffect(() => {
    if (!visibleTabs.includes(tab)) setTab(visibleTabs[0]);
  }, [visibleTabs]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (tab === "Parent Settings") loadPs(); }, [tab, loadPs]);

  // audit logs state
  const today = new Date().toISOString().slice(0, 10);
  const [auditLogs,    setAuditLogs]    = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditDate,    setAuditDate]    = useState(today);
  const [auditRole,    setAuditRole]    = useState("");
  const [auditEvent,   setAuditEvent]   = useState("");

  const loadAuditLogs = useCallback(async (date, role, event) => {
    setAuditLoading(true);
    try {
      const r = await cctvService.getAuditLogs({ date, role, event });
      setAuditLogs(r.logs || []);
    } catch (e) {
      show("error", e?.response?.data?.error || "Failed to load audit logs.");
    } finally {
      setAuditLoading(false);
    }
  }, [show]);

  useEffect(() => {
    if (tab === "Audit Logs") loadAuditLogs(auditDate, auditRole, auditEvent);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // live view state
  const [liveCam, setLiveCam]     = useState(null);  // camera being watched
  const [liveErr, setLiveErr]     = useState("");
  const [liveLoading, setLiveLoading] = useState(false);
  const videoRef   = useRef(null);
  const hlsRef     = useRef(null);
  const sessionRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await cctvService.getCameras();
      setCameras(Array.isArray(data) ? data : []);
    } catch (e) {
      show("error", e?.response?.data?.error || "Failed to load cameras.");
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => { load(); }, [load]);

  // ── CRUD handlers ──────────────────────────────────────────────────
  const openAdd = () => { setEditingId(null); setForm(emptyForm()); setModalOpen(true); };
  const openEdit = (cam) => {
    setEditingId(cam.cameraId);
    const brand = cam.brand || "Other";
    const ip   = cam.ip   || "";
    const port = cam.port || "554";
    // If we have the building blocks and the stored URL matches the generated
    // one, treat it as builder-mode; otherwise it's a custom URL.
    const generated = buildRtsp({ brand, ip, port, channel: cam.channel || "1" });
    const isCustom  = !generated || (cam.streamUrl && cam.streamUrl !== generated);
    const sched = cam.viewingSchedule || {};
    setForm({
      cameraCode: cam.cameraCode || "", cameraName: cam.cameraName,
      classrooms: cam.classrooms || (cam.classroom ? [cam.classroom] : []),
      brand, ip, port,
      username: cam.username || "", password: "",
      hasStoredPassword: !!cam.password,
      channel: cam.channel || "1",
      customRtsp: !!isCustom,
      streamUrl: cam.streamUrl || "",
      streamType: cam.streamType || "RTSP",
      status: cam.status || "Active",
      scheduleEnabled: !!sched.enabled,
      scheduleStart: sched.startTime || "08:00",
      scheduleEnd: sched.endTime || "17:00",
      scheduleDays: sched.activeDays || [1, 2, 3, 4, 5],
    });
    setModalOpen(true);
  };

  // Resolve the effective stream URL: custom field, or generated from parts.
  const resolvedUrl = (f) => (f.customRtsp ? f.streamUrl.trim() : buildRtsp(f));

  const save = async () => {
    if (!form.cameraName.trim())  return show("error", "Camera name is required.");
    if (!form.classrooms.length)  return show("error", "Please assign at least one classroom.");

    const url = resolvedUrl(form);
    if (!url) {
      return show("error", form.customRtsp
        ? "Enter a custom RTSP URL."
        : "Enter the camera's Static IP (and pick a brand with a template).");
    }

    const payload = {
      cameraCode: form.cameraCode, cameraName: form.cameraName,
      classrooms: form.classrooms, classroom: form.classrooms[0] || "",
      brand: form.brand, ip: form.ip, port: form.port, channel: form.channel,
      username: form.username, password: form.password,
      streamType: form.streamType, status: form.status,
      streamUrl: url,
      viewingSchedule: form.scheduleEnabled
        ? { enabled: true, startTime: form.scheduleStart, endTime: form.scheduleEnd, activeDays: form.scheduleDays }
        : { enabled: false },
    };

    setSaving(true);
    try {
      if (editingId) {
        await cctvService.updateCamera(editingId, payload);
        show("success", "Camera updated.");
      } else {
        await cctvService.addCamera(payload);
        show("success", "Camera added.");
      }
      setModalOpen(false);
      load();
    } catch (e) {
      show("error", e?.response?.data?.error || e?.response?.data?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const del = async (cam) => {
    if (!window.confirm(`Remove camera "${cam.cameraName}"? It will be archived (soft delete) and can be restored later.`)) return;
    try {
      await cctvService.deleteCamera(cam.cameraId);
      show("success", "Camera archived.");
      load();
    } catch (e) {
      show("error", e?.response?.data?.error || "Delete failed.");
    }
  };

  // ── Camera Verification (default Test Camera action) ───────────────
  // Real RTSP: auth + channel + stream, server-side via ffmpeg.
  const runVerify = async (camId) => {
    if (!camId) return;
    setVerifyCamId(camId);
    setVerifying(true);
    setVerifyResult(null);
    try {
      const r = await cctvService.verifyCamera({ cameraId: camId });
      setVerifyResult(r);
    } catch (e) {
      setVerifyResult({ ok: false, checks: {}, message: e?.response?.data?.error || "Verification failed." });
    } finally {
      setVerifying(false);
    }
  };

  // ── Live View ──────────────────────────────────────────────────────
  const closeLive = useCallback(() => {
    if (hlsRef.current) { try { hlsRef.current.destroy(); } catch {} hlsRef.current = null; }
    if (videoRef.current) { try { videoRef.current.pause(); videoRef.current.removeAttribute("src"); videoRef.current.load(); } catch {} }
    const cam = liveCam, sess = sessionRef.current;
    if (cam && sess) { cctvService.stopLive(cam.cameraId, sess).catch(() => {}); }
    sessionRef.current = null;
    setLiveCam(null);
    setLiveErr("");
  }, [liveCam]);

  const openLive = async (cam) => {
    setLiveErr("");
    setLiveLoading(true);
    setLiveCam(cam);
    try {
      const r = await cctvService.getLiveToken(cam.cameraId);
      sessionRef.current = r.sessionId;
      const url = `${r.hlsUrl}${r.hlsUrl.includes("?") ? "&" : "?"}token=${encodeURIComponent(r.token)}`;
      // attach hls.js (or native HLS on Safari)
      const video = videoRef.current;
      if (!video) return;
      if (Hls.isSupported()) {
        const hls = new Hls({ lowLatencyMode: true, backBufferLength: 10 });
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data?.fatal) setLiveErr("Stream error: " + (data.details || data.type));
        });
        hlsRef.current = hls;
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
      } else {
        setLiveErr("This browser cannot play HLS.");
      }
      video.play?.().catch(() => {});
    } catch (e) {
      const code = e?.response?.data?.error;
      setLiveErr(code === "ENGINE_NOT_PROVISIONED"
        ? "Live streaming is not enabled yet (stream engine not provisioned)."
        : (e?.response?.data?.error || "Could not start live view."));
    } finally {
      setLiveLoading(false);
    }
  };

  // Clean up the player on unmount / tab change away from Live View.
  useEffect(() => { if (tab !== "Live View") closeLive(); /* eslint-disable-next-line */ }, [tab]);
  useEffect(() => () => closeLive(), []); // unmount

  // ── TCP diagnostic (hidden developer tool) ─────────────────────────
  // Prefers structured ip/port (via payload or cameraId); falls back to URL.
  const runTest = async (payload) => {
    let body;
    if (payload && payload.cameraId) {
      body = { cameraId: payload.cameraId };
    } else if (payload && payload.ip) {
      body = { ip: payload.ip, port: payload.port || "554" };
    } else {
      const target = (testUrl || "").trim();
      if (!target) return show("error", "Enter a stream URL to test.");
      body = { streamUrl: target };
    }
    setTesting(true);
    setTestResult(null);
    try {
      const r = await cctvService.testConnection(body);
      setTestResult(r);
    } catch (e) {
      setTestResult({ reachable: false, message: e?.response?.data?.error || "Test failed." });
    } finally {
      setTesting(false);
    }
  };

  // ── Derived: cameras with no classroom assignment ──────────────────
  const unmapped = cameras.filter(cam => !(cam.classrooms || []).length && !cam.classroom);

  return (
    <div style={{ maxWidth: 1060, margin: "0 auto", padding: "4px 0" }}>

      {/* Header */}
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: "clamp(20px,4vw,26px)", fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em", margin: 0 }}>
          CCTV
        </h1>
        <p style={{ fontSize: 13, color: "#94A3B8", fontWeight: 500, margin: "4px 0 0" }}>
          Camera management &amp; classroom mapping · Phase 1 (no live view yet)
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #F1F1F1", margin: "16px 0 20px" }}>
        {visibleTabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              border: "none", background: "none", cursor: "pointer",
              padding: "10px 14px", fontSize: 13, fontWeight: 600,
              color: tab === t ? "#0F172A" : "#94A3B8",
              borderBottom: tab === t ? "2px solid #F4C400" : "2px solid transparent",
              marginBottom: -1,
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Camera Management ─────────────────────────────────────────── */}
      {tab === "Camera Management" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: "#64748B", fontWeight: 500 }}>
              {loading ? "Loading…" : `${cameras.length} camera${cameras.length === 1 ? "" : "s"}`}
            </span>
            {canConfigure && <button onClick={openAdd} className="btn btn-primary btn-sm">+ Add Camera</button>}
          </div>

          {!loading && cameras.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 16px", color: "#94A3B8", border: "1px dashed #E2E8F0", borderRadius: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
              <p style={{ fontWeight: 600, color: "#475569", margin: 0 }}>No cameras yet</p>
              {canConfigure && <p style={{ fontSize: 13, margin: "4px 0 0" }}>Click "Add Camera" to register your first camera.</p>}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12 }}>
            {cameras.map(cam => (
              <div key={cam.cameraId} style={{ background: "#fff", border: "1px solid #F1F1F1", borderRadius: 14, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
                      {cam.cameraName}{cam.cameraCode ? <span style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8" }}> · {cam.cameraCode}</span> : null}
                    </div>
                    <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>
                      {(cam.classrooms || (cam.classroom ? [cam.classroom] : [])).filter(Boolean).join(", ") || "Unmapped"} · Cam {cam.channel} · {cam.brand}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                    background: cam.status === "Active" ? "#F0FDF4" : "#F1F5F9",
                    color: cam.status === "Active" ? "#16A34A" : "#64748B",
                  }}>{cam.status}</span>
                </div>
                <div style={{ fontSize: 11, color: "#CBD5E1", marginTop: 8, wordBreak: "break-all" }}>{cam.streamUrl}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                  {canConfigure && <button onClick={() => openEdit(cam)} className="btn btn-ghost btn-sm">Edit</button>}
                  {canAssign && (
                    <button onClick={() => { setTab("Camera Verification"); runVerify(cam.cameraId); }}
                      className="btn btn-ghost btn-sm">Test Camera</button>
                  )}
                  {canConfigure && <button onClick={() => del(cam)} className="btn btn-ghost btn-sm" style={{ color: "#DC2626", marginLeft: "auto" }}>Delete</button>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Classroom Mapping ─────────────────────────────────────────── */}
      {tab === "Classroom Mapping" && (
        <div>
          {cameras.length === 0 && (
            <div style={{ color: "#94A3B8", fontSize: 13 }}>No cameras to map yet.</div>
          )}
          {cameras.length > 0 && (
            <div style={{ background: "#fff", border: "1px solid #F1F1F1", borderRadius: 14, overflow: "hidden" }}>
              {/* Header row */}
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 2fr 1.4fr 70px 1fr", gap: 0, padding: "10px 16px", background: "#F8FAFC", borderBottom: "1px solid #F1F1F1", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                <span>Camera</span><span>Classrooms</span><span>Schedule</span><span>Status</span><span>Actions</span>
              </div>
              {cameras.map((cam, i) => {
                const cls = cam.classrooms || (cam.classroom ? [cam.classroom] : []);
                const sched = cam.viewingSchedule;
                const DAY = ["Su","Mo","Tu","We","Th","Fr","Sa"];
                const schedLabel = sched?.enabled
                  ? `${sched.startTime}–${sched.endTime} · ${(sched.activeDays || []).map(d => DAY[d]).join(" ")}`
                  : "—";
                return (
                  <div key={cam.cameraId} style={{
                    display: "grid", gridTemplateColumns: "1.4fr 2fr 1.4fr 70px 1fr",
                    gap: 0, padding: "12px 16px", alignItems: "center",
                    borderBottom: i < cameras.length - 1 ? "1px solid #F8FAFC" : "none",
                    background: unmapped.includes(cam) ? "#FFFBEB" : "transparent",
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{cam.cameraName}</div>
                      {cam.cameraCode && <div style={{ fontSize: 11, color: "#94A3B8" }}>{cam.cameraCode}</div>}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {cls.length > 0 ? cls.map(c => (
                        <span key={c} style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "#EFF6FF", color: "#1D4ED8" }}>{c}</span>
                      )) : (
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#D97706" }}>Unmapped</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748B" }}>{schedLabel}</div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, width: "fit-content", background: cam.status === "Active" ? "#F0FDF4" : "#F1F5F9", color: cam.status === "Active" ? "#16A34A" : "#64748B" }}>{cam.status}</span>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {canAssign && <button onClick={() => openEdit(cam)} className="btn btn-ghost btn-sm">Edit</button>}
                      {canAssign && <button onClick={() => { setTab("Camera Verification"); runVerify(cam.cameraId); }} className="btn btn-ghost btn-sm">Verify</button>}
                      {canConfigure && <button onClick={() => del(cam)} className="btn btn-ghost btn-sm" style={{ color: "#DC2626" }}>Delete</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Camera Verification ───────────────────────────────────────── */}
      {tab === "Camera Verification" && (
        <div style={{ maxWidth: 620 }}>
          <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 14px" }}>
            Real camera test — connects over RTSP with the stored credentials and
            verifies the channel and video stream. Pick a camera to verify, or use
            the <strong>Test Camera</strong> button on any camera card.
          </p>

          {/* Camera picker */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {cameras.length === 0 && <span style={{ fontSize: 13, color: "#94A3B8" }}>No cameras to verify.</span>}
            {cameras.map(cam => (
              <button key={cam.cameraId} onClick={() => runVerify(cam.cameraId)} disabled={verifying}
                className="btn btn-ghost btn-sm"
                style={{ borderColor: verifyCamId === cam.cameraId ? "#F4C400" : undefined }}>
                {cam.cameraName}
              </button>
            ))}
          </div>

          {verifying && (
            <div style={{ fontSize: 13, color: "#64748B", display: "flex", alignItems: "center", gap: 8 }}>
              <span className="yd-spin" style={{ width: 14, height: 14, border: "2px solid #E2E8F0", borderTopColor: "#F4C400", borderRadius: "50%", display: "inline-block" }} />
              Connecting to camera over RTSP… (up to ~12s)
            </div>
          )}

          {!verifying && verifyResult && (
            <div style={{
              padding: "16px 18px", borderRadius: 12, fontSize: 13,
              background: verifyResult.ok ? "#F0FDF4" : "#FEF2F2",
              border: `1px solid ${verifyResult.ok ? "#BBF7D0" : "#FECACA"}`,
            }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: verifyResult.ok ? "#166534" : "#991B1B", marginBottom: 10 }}>
                {verifyResult.ok ? "Camera Verified" : "Verification Failed"}
              </div>
              {[
                ["reachable",   "Camera reachable"],
                ["credentials", "Credentials valid"],
                ["channel",     "Channel valid"],
              ].map(([k, label]) => {
                const v = verifyResult.checks?.[k];
                return (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", color: v ? "#166534" : "#64748B" }}>
                    <span style={{ fontWeight: 800 }}>{v ? "✓" : "○"}</span>
                    <span>{label}</span>
                  </div>
                );
              })}
              <div style={{ marginTop: 10, color: verifyResult.ok ? "#166534" : "#991B1B" }}>{verifyResult.message}</div>
              {verifyResult.detail && (
                <pre style={{ marginTop: 8, fontSize: 10.5, color: "#94A3B8", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 120, overflow: "auto" }}>
                  {verifyResult.detail}
                </pre>
              )}
            </div>
          )}

          {/* Hidden developer diagnostic: TCP-only reachability */}
          <div style={{ marginTop: 24, borderTop: "1px dashed #E2E8F0", paddingTop: 12 }}>
            <button onClick={() => setShowDevDiag(s => !s)}
              style={{ fontSize: 11, color: "#94A3B8", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              {showDevDiag ? "▾" : "▸"} Developer diagnostic — TCP reachability only
            </button>
            {showDevDiag && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    style={{ flex: 1, padding: "9px 11px", border: "1px solid #E2E8F0", borderRadius: 9, fontSize: 12 }}
                    placeholder="rtsp://host:554/path  (TCP host:port check only)"
                    value={testUrl}
                    onChange={e => setTestUrl(e.target.value)}
                  />
                  <button onClick={() => runTest()} disabled={testing} className="btn btn-ghost btn-sm">
                    {testing ? "…" : "TCP Test"}
                  </button>
                </div>
                {testResult && (
                  <div style={{ marginTop: 8, fontSize: 12, color: testResult.reachable ? "#166534" : "#991B1B" }}>
                    {testResult.reachable ? "✓ " : "✗ "}{testResult.message}
                    {testResult.source ? ` (${testResult.source})` : ""}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Live View ─────────────────────────────────────────────────── */}
      {tab === "Live View" && (
        <div>
          {!liveCam && (
            <>
              <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 14px" }}>
                Select a camera to watch its live feed. You only see cameras you’re
                permitted to view.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12 }}>
                {cameras.length === 0 && <span style={{ fontSize: 13, color: "#94A3B8" }}>No cameras available.</span>}
                {cameras.map(cam => (
                  <div key={cam.cameraId} style={{ background: "#fff", border: "1px solid #F1F1F1", borderRadius: 14, padding: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94A3B8" }}>
                      {cam.classroom || "Unmapped"}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginTop: 2 }}>{cam.cameraName}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: cam.status === "Active" ? "#22C55E" : "#CBD5E1" }} />
                      <span style={{ fontSize: 12, color: "#64748B" }}>{cam.status}</span>
                    </div>
                    <button onClick={() => openLive(cam)} className="btn btn-primary btn-sm" style={{ marginTop: 12, width: "100%" }}>
                      ▶ View Live
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {liveCam && (
            <div style={{ maxWidth: 900 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{liveCam.cameraName}</div>
                  <div style={{ fontSize: 12, color: "#94A3B8" }}>{liveCam.classroom}</div>
                </div>
                <button onClick={closeLive} className="btn btn-ghost btn-sm">✕ Close</button>
              </div>
              <div style={{ position: "relative", background: "#000", borderRadius: 14, overflow: "hidden", aspectRatio: "16 / 9" }}>
                <video ref={videoRef} controls muted playsInline
                  style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }} />
                {/* client-side watermark overlay (staff accountability) */}
                <div style={{ position: "absolute", top: 8, right: 10, fontSize: 11, color: "rgba(255,255,255,0.7)", textShadow: "0 1px 2px #000", pointerEvents: "none" }}>
                  {liveCam.cameraName} · live
                </div>
                {liveLoading && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13 }}>
                    Connecting…
                  </div>
                )}
              </div>
              {liveErr && (
                <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, fontSize: 13, background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B" }}>
                  {liveErr}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Parent Settings ───────────────────────────────────────────── */}
      {tab === "Parent Settings" && (
        <div style={{ maxWidth: 520 }}>
          <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 20px" }}>
            Control when parents can watch their child's classroom camera.
            The master switch must be <strong>on</strong> for any parent to see live video.
          </p>

          {psLoading ? (
            <div style={{ fontSize: 13, color: "#94A3B8" }}>Loading…</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

              {/* Master switch */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "#fff", border: "1px solid #F1F1F1", borderRadius: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Enable Parent Live View</div>
                  <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>
                    Parents can see their child's classroom camera during school hours.
                  </div>
                </div>
                <button
                  onClick={() => setPs(p => ({ ...p, enabled: p.enabled === "true" ? "false" : "true" }))}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", flexShrink: 0,
                    background: ps.enabled === "true" ? "#F4C400" : "#E2E8F0",
                    position: "relative", transition: "background 0.2s",
                  }}
                >
                  <span style={{
                    position: "absolute", top: 3, left: ps.enabled === "true" ? 23 : 3,
                    width: 18, height: 18, borderRadius: "50%", background: "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s",
                  }} />
                </button>
              </div>

              {/* School hours */}
              <div style={{ padding: "14px 16px", background: "#fff", border: "1px solid #F1F1F1", borderRadius: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>School Hours Window</div>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: "#64748B" }}>
                    <input type="checkbox"
                      checked={ps.enforceHours === "true"}
                      onChange={e => setPs(p => ({ ...p, enforceHours: e.target.checked ? "true" : "false" }))}
                    />
                    Enforce time window
                  </label>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 4 }}>Opens at</div>
                    <input type="time" value={ps.schoolOpen}
                      onChange={e => setPs(p => ({ ...p, schoolOpen: e.target.value }))}
                      disabled={ps.enforceHours !== "true"}
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, opacity: ps.enforceHours !== "true" ? 0.4 : 1 }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 4 }}>Closes at</div>
                    <input type="time" value={ps.schoolClose}
                      onChange={e => setPs(p => ({ ...p, schoolClose: e.target.value }))}
                      disabled={ps.enforceHours !== "true"}
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, opacity: ps.enforceHours !== "true" ? 0.4 : 1 }}
                    />
                  </div>
                </div>
                {ps.enforceHours !== "true" && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "#D97706" }}>
                    ⚠ No time restriction — parents can view any time their child is checked in.
                  </div>
                )}
              </div>

              {/* Save */}
              <button onClick={savePs} disabled={psSaving} className="btn btn-primary btn-sm" style={{ alignSelf: "flex-start", minWidth: 100 }}>
                {psSaving ? "Saving…" : "Save Settings"}
              </button>

              {/* Current status summary */}
              <div style={{ padding: "10px 14px", background: ps.enabled === "true" ? "#F0FDF4" : "#F8FAFC", border: `1px solid ${ps.enabled === "true" ? "#BBF7D0" : "#E2E8F0"}`, borderRadius: 10, fontSize: 12, color: ps.enabled === "true" ? "#166534" : "#64748B" }}>
                {ps.enabled === "true"
                  ? `✓ Parent live view is ON — available ${ps.enforceHours === "true" ? `${ps.schoolOpen}–${ps.schoolClose} (${ps.timezone})` : "any time (no hour restriction)"}`
                  : "Parent live view is OFF — parents will see an error when they open the Live tab."}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Audit Logs ───────────────────────────────────────────────── */}
      {tab === "Audit Logs" && (
        <div>
          {/* Filters */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20, alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 4 }}>Date</div>
              <input type="date" value={auditDate} onChange={e => setAuditDate(e.target.value)}
                style={{ padding: "7px 10px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 4 }}>Role</div>
              <select value={auditRole} onChange={e => setAuditRole(e.target.value)}
                style={{ padding: "7px 10px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, background: "#fff" }}>
                <option value="">All roles</option>
                <option value="parent">Parent</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 4 }}>Event</div>
              <select value={auditEvent} onChange={e => setAuditEvent(e.target.value)}
                style={{ padding: "7px 10px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, background: "#fff" }}>
                <option value="">All events</option>
                <option value="LIVE_VIEW_STARTED">Started</option>
                <option value="LIVE_VIEW_STOPPED">Stopped</option>
                <option value="LIVE_VIEW_DENIED">Denied</option>
              </select>
            </div>
            <button onClick={() => loadAuditLogs(auditDate, auditRole, auditEvent)}
              disabled={auditLoading}
              className="btn btn-primary btn-sm" style={{ alignSelf: "flex-end" }}>
              {auditLoading ? "Loading…" : "Search"}
            </button>
          </div>

          {/* Table */}
          {auditLoading ? (
            <div style={{ fontSize: 13, color: "#94A3B8", padding: "20px 0" }}>Loading…</div>
          ) : auditLogs.length === 0 ? (
            <div style={{ fontSize: 13, color: "#94A3B8", padding: "20px 0" }}>No audit records found for the selected filters.</div>
          ) : (
            <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #E2E8F0" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                    {["Time", "User", "Role", "Camera", "Classroom", "Center", "Event", "Duration", "IP"].map(h => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#475569", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log, i) => (
                    <tr key={log.id || i} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                      <td style={{ padding: "9px 12px", whiteSpace: "nowrap", color: "#374151" }}>
                        {log.ts ? new Date(log.ts).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                      </td>
                      <td style={{ padding: "9px 12px", maxWidth: 160 }}>
                        <div style={{ fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {log.userName || log.userId || "—"}
                        </div>
                        {log.userEmail && (
                          <div style={{ fontSize: 11, color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.userEmail}</div>
                        )}
                      </td>
                      <td style={{ padding: "9px 12px" }}>
                        <span style={{
                          display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                          background: log.role === "parent" ? "#EFF6FF" : log.role === "super_admin" ? "#FEF9C3" : "#F0FDF4",
                          color:      log.role === "parent" ? "#1D4ED8" : log.role === "super_admin" ? "#854D0E"  : "#15803D",
                        }}>{log.role || "—"}</span>
                      </td>
                      <td style={{ padding: "9px 12px", whiteSpace: "nowrap", color: "#374151" }}>
                        <div>{log.cameraName || "—"}</div>
                        {log.cameraId && log.cameraId !== log.cameraName && (
                          <div style={{ fontSize: 11, color: "#94A3B8" }}>{log.cameraId}</div>
                        )}
                      </td>
                      <td style={{ padding: "9px 12px", color: "#374151" }}>{log.classroom || "—"}</td>
                      <td style={{ padding: "9px 12px", color: "#374151" }}>{log.centerId || "—"}</td>
                      <td style={{ padding: "9px 12px" }}>
                        <span style={{
                          display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                          background: log.event === "LIVE_VIEW_STARTED" ? "#F0FDF4" : log.event === "LIVE_VIEW_DENIED" ? "#FEF2F2" : "#F8FAFC",
                          color:      log.event === "LIVE_VIEW_STARTED" ? "#15803D" : log.event === "LIVE_VIEW_DENIED" ? "#DC2626"  : "#64748B",
                        }}>
                          {log.event === "LIVE_VIEW_STARTED" ? "Started" : log.event === "LIVE_VIEW_STOPPED" ? "Stopped" : log.event === "LIVE_VIEW_DENIED" ? "Denied" : log.event}
                        </span>
                      </td>
                      <td style={{ padding: "9px 12px", whiteSpace: "nowrap", color: "#374151" }}>
                        {log.durationSec != null
                          ? log.durationSec >= 60
                            ? `${Math.floor(log.durationSec / 60)}m ${log.durationSec % 60}s`
                            : `${log.durationSec}s`
                          : "—"}
                      </td>
                      <td style={{ padding: "9px 12px", color: "#94A3B8", fontSize: 11, fontFamily: "monospace" }}>{log.ip || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: "10px 14px", fontSize: 12, color: "#94A3B8", borderTop: "1px solid #F1F5F9" }}>
                {auditLogs.length} record{auditLogs.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Add/Edit modal ────────────────────────────────────────────── */}
      {modalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}
          onClick={() => setModalOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", margin: "0 0 16px" }}>
              {editingId ? "Edit Camera" : "Add Camera"}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Fld label="Camera Name *">
                  <Inp value={form.cameraName} onChange={v => setForm({ ...form, cameraName: v })} placeholder="Main Entrance" />
                </Fld>
                <Fld label="Camera Code">
                  <Inp value={form.cameraCode} onChange={v => setForm({ ...form, cameraCode: v })} placeholder="CAM-01 (unique per center)" />
                </Fld>
              </div>
              <Fld label="Classrooms *">
                <div style={{ border: "1px solid #E2E8F0", borderRadius: 9, padding: "10px 12px", display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
                  {CLASSES.map(c => (
                    <label key={c} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 12 }}>
                      <input type="checkbox"
                        checked={form.classrooms.includes(c)}
                        onChange={e => setForm(f => ({
                          ...f,
                          classrooms: e.target.checked ? [...f.classrooms, c] : f.classrooms.filter(x => x !== c),
                        }))}
                      />
                      {c}
                    </label>
                  ))}
                </div>
              </Fld>
              <Fld label="Brand">
                <select value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} style={selStyle}>
                  {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </Fld>
              {/* ── Connection ─────────────────────────────────────────── */}
              <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748B" }}>
                    Connection
                  </span>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748B", cursor: "pointer" }}>
                    <input type="checkbox" checked={form.customRtsp}
                      onChange={e => setForm({ ...form, customRtsp: e.target.checked })} />
                    Use Custom RTSP URL
                  </label>
                </div>

                {!form.customRtsp ? (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
                      <Fld label="Static IP *"><Inp value={form.ip} onChange={v => setForm({ ...form, ip: v })} placeholder="192.168.1.64" /></Fld>
                      <Fld label="Port"><Inp value={form.port} onChange={v => setForm({ ...form, port: v })} placeholder="554" /></Fld>
                      <Fld label="Camera Number"><Inp value={form.channel} onChange={v => setForm({ ...form, channel: v })} placeholder="1" /></Fld>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                      <Fld label="Username"><Inp value={form.username} onChange={v => setForm({ ...form, username: v })} placeholder="admin" /></Fld>
                      <Fld label="Password"><Inp type="password" value={form.password} onChange={v => setForm({ ...form, password: v })} placeholder={editingId ? "(unchanged)" : ""} /></Fld>
                    </div>

                    {/* Generated URL preview (read-only) */}
                    <div style={{ marginTop: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B", display: "block", marginBottom: 4 }}>
                        Generated RTSP URL (preview)
                      </span>
                      {RTSP_TEMPLATES[form.brand] ? (
                        <div style={{ fontSize: 12, fontFamily: "monospace", color: buildRtspPreview(form) ? "#0F172A" : "#94A3B8",
                          background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 9, padding: "9px 10px", wordBreak: "break-all" }}>
                          {buildRtspPreview(form) || "Enter Static IP to generate…"}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: "#B45309", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 9, padding: "9px 10px" }}>
                          No auto-template for "{form.brand}". Enable "Use Custom RTSP URL" to enter the URL manually.
                        </div>
                      )}
                      <div style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 5 }}>
                        Preview hides the password. Credentials are stored separately &amp; encrypted; the Stream Engine composes the final URL server-side.
                      </div>
                    </div>
                  </>
                ) : (
                  <Fld label="Custom RTSP URL *">
                    <Inp value={form.streamUrl} onChange={v => setForm({ ...form, streamUrl: v })}
                      placeholder="rtsp://host:554/your/custom/path" />
                  </Fld>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Fld label="Stream Type">
                  <select value={form.streamType} onChange={e => setForm({ ...form, streamType: e.target.value })} style={selStyle}>
                    <option>RTSP</option><option>HTTP</option><option>HTTPS</option>
                  </select>
                </Fld>
                <Fld label="Status">
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={selStyle}>
                    <option>Active</option><option>Inactive</option>
                  </select>
                </Fld>
              </div>

              {/* ── Viewing Schedule ────────────────────────────────────── */}
              <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 14 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: form.scheduleEnabled ? 12 : 0 }}>
                  <input type="checkbox" checked={form.scheduleEnabled}
                    onChange={e => setForm(f => ({ ...f, scheduleEnabled: e.target.checked }))} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>Custom viewing schedule</span>
                  <span style={{ fontSize: 11, color: "#94A3B8" }}>(overrides global school-hours for this camera)</span>
                </label>
                {form.scheduleEnabled && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <Fld label="Opens">
                        <input type="time" value={form.scheduleStart}
                          onChange={e => setForm(f => ({ ...f, scheduleStart: e.target.value }))}
                          style={{ width: "100%", padding: "9px 10px", border: "1px solid #E2E8F0", borderRadius: 9, fontSize: 13, boxSizing: "border-box" }} />
                      </Fld>
                      <Fld label="Closes">
                        <input type="time" value={form.scheduleEnd}
                          onChange={e => setForm(f => ({ ...f, scheduleEnd: e.target.value }))}
                          style={{ width: "100%", padding: "9px 10px", border: "1px solid #E2E8F0", borderRadius: 9, fontSize: 13, boxSizing: "border-box" }} />
                      </Fld>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px" }}>
                      {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d, i) => (
                        <label key={d} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 12 }}>
                          <input type="checkbox"
                            checked={form.scheduleDays.includes(i)}
                            onChange={e => setForm(f => ({
                              ...f,
                              scheduleDays: e.target.checked
                                ? [...f.scheduleDays, i].sort((a, b) => a - b)
                                : f.scheduleDays.filter(x => x !== i),
                            }))}
                          />
                          {d}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setModalOpen(false)} className="btn btn-ghost btn-sm">Cancel</button>
              <button onClick={save} disabled={saving} className="btn btn-primary btn-sm">
                {saving ? "Saving…" : editingId ? "Save Changes" : "Add Camera"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 200,
          padding: "12px 18px", borderRadius: 12, fontSize: 13, fontWeight: 600, color: "#fff",
          background: toast.type === "success" ? "#16A34A" : "#DC2626",
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ── Small inputs ──────────────────────────────────────────────────────
const selStyle = { width: "100%", padding: "9px 10px", border: "1px solid #E2E8F0", borderRadius: 9, fontSize: 13, background: "#fff" };
function Fld({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B", display: "block", marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  );
}
function Inp({ value, onChange, placeholder, type = "text" }) {
  return (
    <input type={type} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={{ width: "100%", padding: "9px 10px", border: "1px solid #E2E8F0", borderRadius: 9, fontSize: 13, boxSizing: "border-box" }} />
  );
}
