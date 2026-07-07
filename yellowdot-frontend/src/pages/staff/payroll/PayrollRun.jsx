/**
 * PayrollRun.jsx — Process / view a monthly payroll run + per-employee payslip preview
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import payrollService, { RUN_STATUS_META } from "../../../services/payrollService";
import { T, pillStyle, inr, monthName } from "./_shared";

export default function PayrollRun() {
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear]   = useState(Number(sp.get("year"))  || now.getFullYear());
  const [month, setMonth] = useState(Number(sp.get("month")) || (now.getMonth() + 1));

  const [run, setRun]         = useState(null);
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const runs = await payrollService.listRuns();
      const match = (runs.runs || []).find(r => r.year === year && r.month === month) || null;
      setRun(match);
      if (match) {
        const ps = await payrollService.listPayslips({ runId: match.runId });
        if (ps?.success) setPayslips(ps.payslips || []);
      } else {
        setPayslips([]);
      }
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  }, [year, month]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // Sync URL
  useEffect(() => {
    const next = new URLSearchParams(sp);
    next.set("year", String(year));
    next.set("month", String(month));
    setSp(next, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  async function process() {
    setBusy(true); setError("");
    try {
      const res = await payrollService.processRun(year, month);
      if (res?.success) await load();
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setBusy(false); }
  }

  async function lock() {
    if (!run) return;
    if (!window.confirm("Lock this payroll run? Locked runs cannot be re-processed without explicit unlock.")) return;
    setBusy(true);
    try { await payrollService.lockRun(run.runId); await load(); }
    catch (err) { alert(err.response?.data?.error || err.message); }
    finally { setBusy(false); }
  }

  async function reopen() {
    if (!run) return;
    setBusy(true);
    try { await payrollService.reopenRun(run.runId); await load(); }
    catch (err) { alert(err.response?.data?.error || err.message); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <button onClick={() => navigate("/staff/payroll")} style={{ background: "none", border: "none", color: T.goldMid, fontWeight: 600, fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 4 }}>‹ Back to Payroll</button>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid }}>Payroll</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "4px 0 0" }}>Run · {monthName(month)} {year}</h1>
          {run && (() => {
            const m = RUN_STATUS_META[run.status] || RUN_STATUS_META.draft;
            return <div style={{ marginTop: 6 }}><span style={pillStyle(m.color, m.bg, m.border)}>{m.label}</span></div>;
          })()}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.textSoft }}>Year
            <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ ...inp, width: 100 }} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.textSoft }}>Month
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={inp}>
              {Array.from({length: 12}, (_, i) => i + 1).map(mm => <option key={mm} value={mm}>{monthName(mm)}</option>)}
            </select>
          </label>
          {(!run || run.status === "draft" || run.status === "processed") && (
            <button onClick={process} disabled={busy} style={btn(T.gold, "#1E1E1E")}>{busy ? "Processing…" : run ? "Re-process" : "Process Payroll"}</button>
          )}
          {run && run.status === "processed" && <button onClick={lock} disabled={busy} style={btn(T.surface, T.text, T.border)}>Lock</button>}
          {run && run.status === "locked"    && <button onClick={reopen} disabled={busy} style={btn(T.surface, T.text, T.border)}>Reopen</button>}
        </div>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      {run && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginBottom: 20 }}>
          <KPI label="Employees"   value={run.totals?.employees || 0} />
          <KPI label="Gross"       value={inr(run.totals?.gross)}                       accent={T.goldMid} />
          <KPI label="Deductions"  value={inr(run.totals?.deductions)}                  accent={T.red}     />
          <KPI label="Net Payable" value={inr(run.totals?.net)}                         accent={T.green}   />
        </div>
      )}

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.shadow, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 900 }}>
            <thead style={{ background: T.surfaceWarm, borderBottom: `1px solid ${T.border}` }}>
              <tr>
                <th style={th}>Employee</th>
                <th style={th}>Paid Days</th>
                <th style={th}>LOP</th>
                <th style={th}>Gross</th>
                <th style={th}>Deductions</th>
                <th style={th}>Net</th>
                <th style={{ ...th, textAlign: "right" }}>Payslip</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>Loading…</td></tr>}
              {!loading && !run && <tr><td colSpan={7} style={{ padding: 30, textAlign: "center", color: T.textMuted }}>No run for {monthName(month)} {year}. Click <strong>Process Payroll</strong> to create one.</td></tr>}
              {!loading && run && payslips.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>Run exists but has no payslips — make sure staff salaries are configured.</td></tr>}
              {!loading && payslips.map(p => (
                <tr key={p.payslipId} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{p.displayName}</div>
                    <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "ui-monospace, Cascadia Code, monospace" }}>{p.employeeCode}</div>
                  </td>
                  <td style={td}>{p.paidDays}</td>
                  <td style={td}>{p.lopDays || "—"}</td>
                  <td style={td}>{inr(p.gross)}</td>
                  <td style={td}>{inr(p.totalDeductions)}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{inr(p.net)}</td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    <a href={payrollService.payslipPdfUrl(p.payslipId)} target="_blank" rel="noreferrer" style={miniLink()}>PDF</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, accent = T.gold }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 18px", position: "relative", overflow: "hidden", boxShadow: T.shadow }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: accent }} />
      <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700, color: T.text }}>{value}</div>
    </div>
  );
}

const th = { textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textMuted };
const td = { padding: "10px 14px", fontSize: 13, color: T.text };
const errorBox = { background: T.redLight, color: T.red, border: `1px solid ${T.red}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 };
const inp = { border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 12px", fontSize: 13, background: T.surfaceWarm };
function btn(bg, color, border) { return { background: bg, color, border: border ? `1px solid ${border}` : "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }; }
function miniLink() { return { textDecoration: "none", background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600 }; }
