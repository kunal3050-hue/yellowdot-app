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
const TABS    = ["Camera Management", "Classroom Mapping", "Connection Testing"];

const emptyForm = () => ({
  cameraCode: "", cameraName: "", classroom: "", brand: "Hikvision",
  streamUrl: "", username: "", password: "", channel: "1",
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

  // test-connection state
  const [testUrl, setTestUrl]     = useState("");
  const [testing, setTesting]     = useState(false);
  const [testResult, setTestResult] = useState(null);

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
    setForm({
      cameraCode: cam.cameraCode || "", cameraName: cam.cameraName, classroom: cam.classroom, brand: cam.brand || "Other",
      streamUrl: cam.streamUrl, username: cam.username || "", password: "",
      channel: cam.channel || "1", streamType: cam.streamType || "RTSP",
      status: cam.status || "Active",
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.cameraName.trim()) return show("error", "Camera name is required.");
    if (!form.classroom)         return show("error", "Please map the camera to a classroom.");
    if (!form.streamUrl.trim())  return show("error", "Stream URL is required.");
    setSaving(true);
    try {
      if (editingId) {
        await cctvService.updateCamera(editingId, form);
        show("success", "Camera updated.");
      } else {
        await cctvService.addCamera(form);
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

  // ── Test connection ────────────────────────────────────────────────
  const runTest = async (url) => {
    const target = (url || testUrl).trim();
    if (!target) return show("error", "Enter a stream URL to test.");
    setTesting(true);
    setTestResult(null);
    try {
      const r = await cctvService.testConnection({ streamUrl: target });
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
                      {cam.classroom || "Unmapped"} · ch{cam.channel} · {cam.brand}
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
                  <button onClick={() => { setTab("Connection Testing"); setTestUrl(cam.streamUrl); runTest(cam.streamUrl); }}
                    className="btn btn-ghost btn-sm">Test</button>
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
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>ch{cam.channel} · {cam.brand}</div>
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

      {/* ── Connection Testing ────────────────────────────────────────── */}
      {tab === "Connection Testing" && (
        <div style={{ maxWidth: 560 }}>
          <div style={{ display: "inline-block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#92600A", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "4px 10px", marginBottom: 10 }}>
            Network Reachability Test Only
          </div>
          <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 12px" }}>
            Checks whether the camera’s host/port is reachable on the network.
            <strong> This does not verify camera credentials or the video stream</strong> — stream
            verification arrives with Live View in a later phase.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="yd-input"
              style={{ flex: 1, padding: "10px 12px", border: "1px solid #E2E8F0", borderRadius: 10, fontSize: 13 }}
              placeholder="rtsp://user:pass@host:554/Streaming/Channels/101"
              value={testUrl}
              onChange={e => setTestUrl(e.target.value)}
            />
            <button onClick={() => runTest()} disabled={testing} className="btn btn-primary btn-sm">
              {testing ? "Testing…" : "Test"}
            </button>
          </div>
          {testResult && (
            <div style={{
              marginTop: 14, padding: "12px 14px", borderRadius: 10, fontSize: 13,
              background: testResult.reachable ? "#F0FDF4" : "#FEF2F2",
              border: `1px solid ${testResult.reachable ? "#BBF7D0" : "#FECACA"}`,
              color: testResult.reachable ? "#166534" : "#991B1B",
            }}>
              <div style={{ fontWeight: 700 }}>{testResult.reachable ? "✓ Reachable" : "✗ Not reachable"}</div>
              <div style={{ marginTop: 4 }}>{testResult.message}</div>
              {testResult.note && <div style={{ marginTop: 6, fontSize: 11, opacity: 0.75 }}>{testResult.note}</div>}
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
              <Fld label="Stream URL *">
                <Inp value={form.streamUrl} onChange={v => setForm({ ...form, streamUrl: v })} placeholder="rtsp://host:554/Streaming/Channels/101" />
              </Fld>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <Fld label="Username"><Inp value={form.username} onChange={v => setForm({ ...form, username: v })} /></Fld>
                <Fld label="Password"><Inp type="password" value={form.password} onChange={v => setForm({ ...form, password: v })} placeholder={editingId ? "(unchanged)" : ""} /></Fld>
                <Fld label="Channel"><Inp value={form.channel} onChange={v => setForm({ ...form, channel: v })} /></Fld>
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
