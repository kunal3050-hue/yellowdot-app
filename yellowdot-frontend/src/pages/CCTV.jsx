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

import { useEffect, useState, useCallback } from "react";
import cctvService from "../services/cctvService";

// Shared classroom options — mirrors CLASSES in Students.jsx (single source of truth list).
const CLASSES = ["Daycare", "Playgroup", "Nursery", "LKG", "UKG", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5"];
const BRANDS  = ["Hikvision", "Dahua", "CP Plus", "TP-Link", "Other"];
const TABS    = ["Camera Management", "Classroom Mapping", "Camera Verification"];

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
  cameraCode: "", cameraName: "", classroom: "", brand: "Hikvision",
  ip: "", port: "554", username: "", password: "", hasStoredPassword: false, channel: "1",
  customRtsp: false, streamUrl: "",
  streamType: "RTSP", status: "Active",
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

export default function CCTV() {
  const { toast, show } = useToast();
  const [tab, setTab]         = useState(TABS[0]);
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
    setForm({
      cameraCode: cam.cameraCode || "", cameraName: cam.cameraName, classroom: cam.classroom,
      brand, ip, port,
      username: cam.username || "", password: "",
      hasStoredPassword: !!cam.password,   // API returns masked "••••••••" when set
      channel: cam.channel || "1",
      customRtsp: !!isCustom,
      streamUrl: cam.streamUrl || "",
      streamType: cam.streamType || "RTSP",
      status: cam.status || "Active",
    });
    setModalOpen(true);
  };

  // Resolve the effective stream URL: custom field, or generated from parts.
  const resolvedUrl = (f) => (f.customRtsp ? f.streamUrl.trim() : buildRtsp(f));

  const save = async () => {
    if (!form.cameraName.trim()) return show("error", "Camera name is required.");
    if (!form.classroom)         return show("error", "Please map the camera to a classroom.");

    const url = resolvedUrl(form);
    if (!url) {
      return show("error", form.customRtsp
        ? "Enter a custom RTSP URL."
        : "Enter the camera's Static IP (and pick a brand with a template).");
    }

    const payload = {
      cameraCode: form.cameraCode, cameraName: form.cameraName, classroom: form.classroom,
      brand: form.brand, ip: form.ip, port: form.port, channel: form.channel,
      username: form.username, password: form.password,
      streamType: form.streamType, status: form.status,
      streamUrl: url,
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

  // ── Derived: cameras grouped by classroom ──────────────────────────
  const byClassroom = CLASSES.map(c => ({
    classroom: c,
    cams: cameras.filter(cam => cam.classroom === c),
  })).filter(g => g.cams.length > 0);
  const unmapped = cameras.filter(cam => !CLASSES.includes(cam.classroom));

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
        {TABS.map(t => (
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
            <button onClick={openAdd} className="btn btn-primary btn-sm">+ Add Camera</button>
          </div>

          {!loading && cameras.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 16px", color: "#94A3B8", border: "1px dashed #E2E8F0", borderRadius: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
              <p style={{ fontWeight: 600, color: "#475569", margin: 0 }}>No cameras yet</p>
              <p style={{ fontSize: 13, margin: "4px 0 0" }}>Click “Add Camera” to register your first camera.</p>
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
                      {cam.classroom || "Unmapped"} · Cam {cam.channel} · {cam.brand}
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
                  <button onClick={() => openEdit(cam)} className="btn btn-ghost btn-sm">Edit</button>
                  <button onClick={() => { setTab("Camera Verification"); runVerify(cam.cameraId); }}
                    className="btn btn-ghost btn-sm">Test Camera</button>
                  <button onClick={() => del(cam)} className="btn btn-ghost btn-sm" style={{ color: "#DC2626", marginLeft: "auto" }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Classroom Mapping ─────────────────────────────────────────── */}
      {tab === "Classroom Mapping" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {byClassroom.length === 0 && unmapped.length === 0 && (
            <div style={{ color: "#94A3B8", fontSize: 13 }}>No cameras to map yet.</div>
          )}
          {byClassroom.map(g => (
            <div key={g.classroom}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748B", marginBottom: 8 }}>
                {g.classroom} · {g.cams.length}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8 }}>
                {g.cams.map(cam => (
                  <div key={cam.cameraId} style={{ background: "#fff", border: "1px solid #F1F1F1", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{cam.cameraName}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>Cam {cam.channel} · {cam.brand}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {unmapped.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#D97706", marginBottom: 8 }}>
                Unmapped · {unmapped.length}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8 }}>
                {unmapped.map(cam => (
                  <div key={cam.cameraId} style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{cam.cameraName}</div>
                    <button onClick={() => openEdit(cam)} style={{ fontSize: 11, color: "#B45309", background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 4 }}>
                      Assign classroom →
                    </button>
                  </div>
                ))}
              </div>
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Fld label="Classroom *">
                  <select value={form.classroom} onChange={e => setForm({ ...form, classroom: e.target.value })} style={selStyle}>
                    <option value="">Select…</option>
                    {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Fld>
                <Fld label="Brand">
                  <select value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} style={selStyle}>
                    {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </Fld>
              </div>
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
                          No auto-template for “{form.brand}”. Enable “Use Custom RTSP URL” to enter the URL manually.
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
