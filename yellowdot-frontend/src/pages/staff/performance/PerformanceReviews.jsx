/**
 * PerformanceReviews.jsx — Review list + per-staff review editor.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import performanceService, { REVIEW_STATUS_META } from "../../../services/performanceService";
import staffService from "../../../services/staffService";
import { T, pillStyle } from "./_shared";

export default function PerformanceReviews() {
  const [reviews, setReviews]   = useState([]);
  const [staff, setStaff]       = useState([]);
  const [kpis, setKpis]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [filter, setFilter]     = useState({ period: "", status: "", staffId: "" });
  const [editor, setEditor]     = useState(null); // { mode: "edit"|"create", data }
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [r, s, k] = await Promise.all([
        performanceService.listReviews(),
        staffService.getAll(),
        performanceService.listKpis({ active: true }),
      ]);
      if (r?.success) setReviews(r.reviews || []);
      if (s?.success) setStaff(s.staff || []);
      if (k?.success) setKpis(k.kpis || []);
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return reviews.filter(r =>
      (!filter.period  || r.period === filter.period)   &&
      (!filter.status  || r.status === filter.status)   &&
      (!filter.staffId || r.staffId === filter.staffId)
    );
  }, [reviews, filter]);

  function openCreate() {
    setEditor({ mode: "create", data: { staffId: "", period: defaultPeriod(), kpiScores: {}, rating: 0, strengths: "", improvements: "", comment: "", status: "draft" } });
  }
  function openEdit(r) {
    setEditor({ mode: "edit", data: { ...r, kpiScores: { ...(r.kpiScores || {}) } } });
  }

  async function save() {
    setSaving(true);
    try {
      const payload = { ...editor.data };
      await performanceService.saveReview(payload);
      setEditor(null); await load();
    } catch (err) { alert(err.response?.data?.error || err.message); }
    finally { setSaving(false); }
  }

  async function remove(r) {
    if (!window.confirm(`Delete review for ${r.displayName} (${r.period})?`)) return;
    try { await performanceService.removeReview(r.reviewId); await load(); }
    catch (err) { alert(err.response?.data?.error || err.message); }
  }

  return (
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid }}>Performance</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "4px 0 0" }}>Reviews ({filtered.length})</h1>
        </div>
        <button onClick={openCreate} style={btn(T.gold, "#1E1E1E")}>+ New Review</button>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, marginBottom: 14, display: "flex", gap: 10, flexWrap: "wrap", boxShadow: T.shadow }}>
        <input placeholder="Period (e.g. Q1-2026)" value={filter.period} onChange={(e) => setFilter(f => ({ ...f, period: e.target.value }))} style={inp} />
        <select value={filter.status} onChange={(e) => setFilter(f => ({ ...f, status: e.target.value }))} style={inp}>
          <option value="">All statuses</option>
          {Object.entries(REVIEW_STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
        </select>
        <select value={filter.staffId} onChange={(e) => setFilter(f => ({ ...f, staffId: e.target.value }))} style={inp}>
          <option value="">All staff</option>
          {staff.map(s => <option key={s.staffId} value={s.staffId}>{s.displayName}</option>)}
        </select>
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.shadow, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 900 }}>
            <thead style={{ background: T.surfaceWarm, borderBottom: `1px solid ${T.border}` }}>
              <tr>
                <th style={th}>Employee</th>
                <th style={th}>Period</th>
                <th style={th}>Reviewer</th>
                <th style={th}>Rating</th>
                <th style={th}>Status</th>
                <th style={th}>Updated</th>
                <th style={{ ...th, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>Loading…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>No reviews.</td></tr>}
              {!loading && filtered.map(r => {
                const m = REVIEW_STATUS_META[r.status] || REVIEW_STATUS_META.draft;
                return (
                  <tr key={r.reviewId} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{r.displayName}</div>
                      <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "ui-monospace, Cascadia Code, monospace" }}>{r.employeeCode}</div>
                    </td>
                    <td style={td}>{r.period}</td>
                    <td style={td}>{r.reviewerName || "—"}</td>
                    <td style={td}>{r.rating ? `${r.rating} ★` : "—"}</td>
                    <td style={td}><span style={pillStyle(m.color, m.bg, m.border)}>{m.label}</span></td>
                    <td style={td}>{r.updatedAt ? r.updatedAt.slice(0, 10) : "—"}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <button onClick={() => openEdit(r)} style={mini()}>Open</button>
                      <button onClick={() => remove(r)} style={{ ...mini(), color: T.red, borderColor: `${T.red}55` }}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editor && (
        <div onClick={() => setEditor(null)} style={backdrop}>
          <div onClick={(e) => e.stopPropagation()} style={card}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
              {editor.mode === "create" ? "New Performance Review" : `Review: ${editor.data.displayName || ""} · ${editor.data.period}`}
            </h2>

            {editor.mode === "create" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <label style={lblBlock}>
                  <span style={lblText}>Employee *</span>
                  <select value={editor.data.staffId} onChange={(e) => setEdit("staffId", e.target.value)} style={inp}>
                    <option value="">Select…</option>
                    {staff.map(s => <option key={s.staffId} value={s.staffId}>{s.displayName} ({s.employeeCode})</option>)}
                  </select>
                </label>
                <label style={lblBlock}>
                  <span style={lblText}>Period *</span>
                  <input value={editor.data.period} onChange={(e) => setEdit("period", e.target.value)} placeholder="Q1-2026 or 2026-06" style={inp} />
                </label>
              </div>
            )}

            <div style={{ fontSize: 12, fontWeight: 700, color: T.textSoft, textTransform: "uppercase", letterSpacing: "0.06em", margin: "8px 0" }}>KPI Scores</div>
            <div style={{ maxHeight: 280, overflowY: "auto", border: `1px solid ${T.border}`, borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ background: T.surfaceWarm }}>
                  <tr><th style={th}>KPI</th><th style={th}>Target</th><th style={th}>Score</th><th style={th}>Comment</th></tr>
                </thead>
                <tbody>
                  {kpis.map(k => {
                    const row = editor.data.kpiScores[k.kpiId] || {};
                    return (
                      <tr key={k.kpiId} style={{ borderBottom: `1px solid ${T.border}` }}>
                        <td style={td}>
                          {k.name}
                          {k.weight ? <span style={{ marginLeft: 6, fontSize: 10, color: T.textMuted }}>({k.weight}% wt)</span> : null}
                        </td>
                        <td style={td}>{k.target}</td>
                        <td style={td}>
                          <input type="number" step="0.1" value={row.score ?? ""} onChange={(e) => updateKpiScore(k.kpiId, { ...row, target: k.target, score: Number(e.target.value) || 0 })} style={{ ...inp, width: 90 }} />
                        </td>
                        <td style={td}>
                          <input value={row.comment ?? ""} onChange={(e) => updateKpiScore(k.kpiId, { ...row, comment: e.target.value })} style={{ ...inp, width: "100%" }} placeholder="Optional" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 14 }}>
              {fld("Overall Rating", <input type="number" step="0.5" min="0" max="5" value={editor.data.rating} onChange={(e) => setEdit("rating", Number(e.target.value) || 0)} style={inp} />)}
              {fld("Status",
                <select value={editor.data.status} onChange={(e) => setEdit("status", e.target.value)} style={inp}>
                  {Object.entries(REVIEW_STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
                </select>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <label style={lblBlock}><span style={lblText}>Strengths</span><textarea rows={3} value={editor.data.strengths} onChange={(e) => setEdit("strengths", e.target.value)} style={{ ...inp, fontFamily: "inherit" }} /></label>
              <label style={lblBlock}><span style={lblText}>Areas to Improve</span><textarea rows={3} value={editor.data.improvements} onChange={(e) => setEdit("improvements", e.target.value)} style={{ ...inp, fontFamily: "inherit" }} /></label>
            </div>
            <label style={{ ...lblBlock, marginTop: 12 }}><span style={lblText}>Overall Comment</span><textarea rows={3} value={editor.data.comment} onChange={(e) => setEdit("comment", e.target.value)} style={{ ...inp, fontFamily: "inherit" }} /></label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18, borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
              <button onClick={() => setEditor(null)} style={btn(T.surface, T.text, T.border)}>Cancel</button>
              <button onClick={save} disabled={saving} style={btn(T.gold, "#1E1E1E")}>{saving ? "Saving…" : "Save Review"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function setEdit(k, v) { setEditor(e => ({ ...e, data: { ...e.data, [k]: v } })); }
  function updateKpiScore(kpiId, row) {
    setEditor(e => ({ ...e, data: { ...e.data, kpiScores: { ...e.data.kpiScores, [kpiId]: row } } }));
  }
}

function defaultPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fld(label, control) { return <label style={lblBlock}><span style={lblText}>{label}</span>{control}</label>; }

const th = { textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textMuted };
const td = { padding: "10px 14px", fontSize: 13, color: T.text };
const errorBox = { background: T.redLight, color: T.red, border: `1px solid ${T.red}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 };
const inp = { border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, background: "#FFFFFF" };
const lblBlock = { display: "flex", flexDirection: "column", gap: 6 };
const lblText  = { fontSize: 12, fontWeight: 600, color: T.textSoft };
const backdrop = { position: "fixed", inset: 0, background: "rgba(20,18,12,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 };
const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 22, width: "min(820px, calc(100vw - 32px))", maxHeight: "calc(100vh - 64px)", overflow: "auto" };
function btn(bg, color, border) { return { background: bg, color, border: border ? `1px solid ${border}` : "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }; }
function mini() { return { background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", marginLeft: 6 }; }
