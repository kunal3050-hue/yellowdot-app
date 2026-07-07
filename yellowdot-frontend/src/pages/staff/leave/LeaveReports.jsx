/**
 * LeaveReports.jsx — Annual leave consumption per employee
 */

import { useCallback, useEffect, useState } from "react";
import leaveService from "../../../services/leaveService";
import { T } from "./_shared";

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function LeaveReports() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await leaveService.report(year);
      if (r?.success) setData(r);
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  }, [year]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function exportCSV() {
    if (!data) return;
    const codes = Array.from(new Set(data.rows.flatMap(r => Object.keys(r.byType || {})))).sort();
    const lines = [["Employee Code","Name","Department","Total Days", ...codes].join(",")];
    data.rows.forEach(r => {
      lines.push([r.employeeCode, r.displayName, r.departmentName, r.totalDays, ...codes.map(c => r.byType[c] || 0)].map(csvEscape).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `leave-report-${year}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  }

  const codes = data ? Array.from(new Set(data.rows.flatMap(r => Object.keys(r.byType || {})))).sort() : [];

  return (
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid }}>Leave Management</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "4px 0 0" }}>Annual Report</h1>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.textSoft }}>Year
            <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ ...inp, width: 100 }} />
          </label>
          <button onClick={exportCSV} disabled={!data} style={btn(T.surface, T.text, T.border)}>Export CSV</button>
        </div>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.shadow, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 800 }}>
            <thead style={{ background: T.surfaceWarm, borderBottom: `1px solid ${T.border}` }}>
              <tr>
                <th style={th}>Employee</th>
                <th style={th}>Department</th>
                <th style={th}>Total Days</th>
                {codes.map(c => <th key={c} style={th}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={3 + codes.length} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>Loading…</td></tr>}
              {!loading && data && data.rows.length === 0 && <tr><td colSpan={3 + codes.length} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>No approved leave in {year}.</td></tr>}
              {!loading && data && data.rows.map(r => (
                <tr key={r.staffId} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{r.displayName}</div>
                    <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "ui-monospace, Cascadia Code, monospace" }}>{r.employeeCode}</div>
                  </td>
                  <td style={td}>{r.departmentName || "—"}</td>
                  <td style={td}><strong>{r.totalDays}</strong></td>
                  {codes.map(c => <td key={c} style={td}>{r.byType[c] || 0}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const th = { textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textMuted };
const td = { padding: "10px 14px", fontSize: 13, color: T.text };
const errorBox = { background: T.redLight, color: T.red, border: `1px solid ${T.red}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 };
const inp = { border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 12px", fontSize: 13, background: T.surfaceWarm };
function btn(bg, color, border) {
  return { background: bg, color, border: border ? `1px solid ${border}` : "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" };
}
