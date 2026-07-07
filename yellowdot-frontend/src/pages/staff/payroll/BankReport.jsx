/**
 * BankReport.jsx — Bank transfer report for a payroll run (CSV exportable).
 */

import { useCallback, useEffect, useState } from "react";
import payrollService from "../../../services/payrollService";
import { T, inr, monthName } from "./_shared";

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function BankReport() {
  const [runs, setRuns]   = useState([]);
  const [runId, setRunId] = useState("");
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadRuns = useCallback(async () => {
    try {
      const r = await payrollService.listRuns();
      if (r?.success) {
        setRuns(r.runs || []);
        if (!runId && r.runs?.[0]) setRunId(r.runs[0].runId);
      }
    } catch (err) { setError(err.response?.data?.error || err.message); }
  }, [runId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadRuns(); }, [loadRuns]);

  useEffect(() => {
    if (!runId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true); setError("");
    payrollService.bankReport(runId)
      .then(r => { if (r?.success) setData(r); })
      .catch(err => setError(err.response?.data?.error || err.message))
      .finally(() => setLoading(false));
  }, [runId]);

  function exportCSV() {
    if (!data) return;
    const lines = [["Employee Code","Name","Bank A/C (last 4)","Mode","Net Pay (INR)"].join(",")];
    data.rows.forEach(r => lines.push([r.employeeCode, r.displayName, r.bankAccountLast4 || "", r.paymentMode, r.net].map(csvEscape).join(",")));
    lines.push("", `,,Total,,${data.total}`);
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `bank-report-${data.run ? `${data.run.year}-${String(data.run.month).padStart(2,"0")}` : "unknown"}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  }

  return (
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid }}>Payroll</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "4px 0 0" }}>Bank Transfer Report</h1>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select value={runId} onChange={(e) => setRunId(e.target.value)} style={inp}>
            <option value="">Select run…</option>
            {runs.map(r => <option key={r.runId} value={r.runId}>{monthName(r.month)} {r.year} ({r.totals?.employees || 0} emp)</option>)}
          </select>
          <button onClick={exportCSV} disabled={!data} style={btn(T.surface, T.text, T.border)}>Export CSV</button>
        </div>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      {data && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 14, boxShadow: T.shadow, fontSize: 13, color: T.textSoft }}>
          Run: <strong>{data.run ? `${monthName(data.run.month)} ${data.run.year}` : "—"}</strong> · Total to transfer: <strong style={{ color: T.green }}>{inr(data.total)}</strong> · {data.rows.length} employee(s)
        </div>
      )}

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.shadow, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 720 }}>
            <thead style={{ background: T.surfaceWarm, borderBottom: `1px solid ${T.border}` }}>
              <tr>
                <th style={th}>Employee Code</th>
                <th style={th}>Name</th>
                <th style={th}>Bank A/C</th>
                <th style={th}>Mode</th>
                <th style={{ ...th, textAlign: "right" }}>Net Pay</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>Loading…</td></tr>}
              {!loading && !data && <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>Select a payroll run.</td></tr>}
              {!loading && data && data.rows.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>No payslips in this run.</td></tr>}
              {!loading && data && data.rows.map((r, i) => (
                <tr key={`${r.employeeCode}-${i}`} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ ...td, fontFamily: "ui-monospace, Cascadia Code, monospace", fontSize: 12 }}>{r.employeeCode}</td>
                  <td style={td}>{r.displayName}</td>
                  <td style={td}>{r.bankAccountLast4 ? `XXXX${r.bankAccountLast4}` : "—"}</td>
                  <td style={td}>{r.paymentMode || "—"}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{inr(r.net)}</td>
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
const inp = { border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, background: T.surfaceWarm, minWidth: 220 };
function btn(bg, color, border) { return { background: bg, color, border: border ? `1px solid ${border}` : "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }; }
