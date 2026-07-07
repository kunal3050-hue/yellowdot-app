/**
 * PerformanceTimeline.jsx — Per-staff timeline + (optional) AI Summary JSON viewer.
 * Pick a staff member, then see all performance events for them.
 */

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import performanceService from "../../../services/performanceService";
import staffService from "../../../services/staffService";
import { T } from "./_shared";

export default function PerformanceTimeline() {
  const [sp, setSp]   = useSearchParams();
  const staffId       = sp.get("staffId") || "";
  const [staff, setStaff]     = useState([]);
  const [events, setEvents]   = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  // Load staff directory once
  useEffect(() => {
    staffService.getAll().then(r => { if (r?.success) setStaff(r.staff || []); }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!staffId) { setEvents([]); setSummary(null); return; }
    setLoading(true); setError("");
    try {
      const [t, s] = await Promise.all([
        performanceService.timeline(staffId),
        performanceService.aiSummary(staffId).catch(() => null),
      ]);
      if (t?.success) setEvents(t.events || []);
      if (s?.success) setSummary(s.summary);
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  }, [staffId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function selectStaff(id) {
    const next = new URLSearchParams(sp);
    if (id) next.set("staffId", id); else next.delete("staffId");
    setSp(next);
  }

  function downloadSummary() {
    if (!summary) return;
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: "application/json" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `performance-summary-${summary.staff.staffId}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  }

  return (
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid }}>Performance</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "4px 0 0" }}>Timeline & AI Summary</h1>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select value={staffId} onChange={(e) => selectStaff(e.target.value)} style={inp}>
            <option value="">Select employee…</option>
            {staff.map(s => <option key={s.staffId} value={s.staffId}>{s.displayName} ({s.employeeCode})</option>)}
          </select>
          <button onClick={downloadSummary} disabled={!summary} style={btn(T.surface, T.text, T.border)}>Download AI Summary JSON</button>
        </div>
      </div>

      {error && <div style={errorBox}>{error}</div>}
      {!staffId && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 40, textAlign: "center", color: T.textMuted }}>
          Select an employee to see their performance history + an AI-ready structured summary.
        </div>
      )}

      {staffId && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 18, boxShadow: T.shadow }}>
            <div style={sectionTitle}>Timeline</div>
            {loading && <div style={{ color: T.textMuted, fontSize: 13, padding: "10px 0" }}>Loading…</div>}
            {!loading && events.length === 0 && <div style={{ color: T.textMuted, fontSize: 13 }}>No events yet.</div>}
            {!loading && events.map(e => (
              <div key={e.eventId} style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 14, padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 12, color: T.textMuted }}>{e.createdAt ? new Date(e.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{e.type}</div>
                  <div style={{ fontSize: 13, color: T.textSoft, marginTop: 2 }}>{e.description}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 18, boxShadow: T.shadow }}>
            <div style={sectionTitle}>AI-Ready Summary</div>
            {summary ? (
              <>
                <div style={{ fontSize: 13, color: T.textSoft, marginBottom: 10 }}>
                  Structured JSON ready to feed into an LLM for narrative generation.
                  Generated: {summary.generatedAt.slice(0, 19).replace("T", " ")}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <Stat label="Reviews"           value={summary.snapshot.reviewsCount} />
                  <Stat label="Goals"             value={summary.snapshot.goalsTotal} />
                  <Stat label="Goal Completion"   value={`${summary.snapshot.goalCompletionPct}%`} />
                  <Stat label="Parent Avg Rating" value={`${summary.snapshot.parentFeedback.average || "—"} (${summary.snapshot.parentFeedback.count})`} />
                  <Stat label="Promotions"        value={summary.snapshot.promotionsCount} />
                  <Stat label="Awards"            value={summary.snapshot.awardsCount} />
                </div>
                <pre style={{
                  background: T.surfaceWarm, border: `1px solid ${T.border}`,
                  borderRadius: 10, padding: 12, fontSize: 11,
                  fontFamily: "ui-monospace, Cascadia Code, monospace",
                  maxHeight: 420, overflow: "auto",
                }}>{JSON.stringify(summary, null, 2)}</pre>
              </>
            ) : <div style={{ color: T.textMuted, fontSize: 13 }}>{loading ? "Loading…" : "No summary available."}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ background: T.surfaceWarm, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700, color: T.text }}>{value}</div>
    </div>
  );
}

const errorBox = { background: T.redLight, color: T.red, border: `1px solid ${T.red}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 };
const inp = { border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 12px", fontSize: 13, background: T.surfaceWarm, minWidth: 220 };
const sectionTitle = { fontSize: 13, fontWeight: 700, color: T.text, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 };
function btn(bg, color, border) { return { background: bg, color, border: border ? `1px solid ${border}` : "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }; }
