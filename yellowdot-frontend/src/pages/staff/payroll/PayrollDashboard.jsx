/**
 * PayrollDashboard.jsx — KPIs + recent runs + jump links to components/structures/staff salary
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import payrollService, { RUN_STATUS_META } from "../../../services/payrollService";
import { T, pillStyle, inr, monthName } from "./_shared";

function Stat({ label, value, sub, accent = T.gold }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px", position: "relative", overflow: "hidden", boxShadow: T.shadow }}>
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 3, background: accent }} />
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textMuted }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 24, fontWeight: 700, color: T.text }}>{value}</div>
      {sub && <div style={{ marginTop: 4, fontSize: 12, color: T.textSoft }}>{sub}</div>}
    </div>
  );
}

export default function PayrollDashboard() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await payrollService.listRuns();
      if (r?.success) setRuns(r.runs || []);
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const latest    = runs[0];
  const ytd       = runs.filter(r => r.year === new Date().getFullYear());
  const ytdNet    = ytd.reduce((s, r) => s + (r.totals?.net || 0), 0);
  const ytdEmps   = latest ? latest.totals?.employees : 0;

  return (
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid }}>Payroll</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "4px 0 0" }}>Dashboard</h1>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => navigate("/staff/payroll/run")}        style={btn(T.gold, "#1E1E1E")}>Process Payroll</button>
          <button onClick={() => navigate("/staff/payroll/staff")}      style={btn(T.surface, T.text, T.border)}>Staff Salaries</button>
          <button onClick={() => navigate("/staff/payroll/structures")} style={btn(T.surface, T.text, T.border)}>Structures</button>
          <button onClick={() => navigate("/staff/payroll/components")} style={btn(T.surface, T.text, T.border)}>Components</button>
          <button onClick={() => navigate("/staff/payroll/bank")}       style={btn(T.surface, T.text, T.border)}>Bank Report</button>
        </div>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
        <Stat label="Latest Run"     value={latest ? `${monthName(latest.month)} ${latest.year}` : "—"} sub={latest ? RUN_STATUS_META[latest.status]?.label : "No runs yet"} />
        <Stat label="Latest Net Pay" value={inr(latest?.totals?.net || 0)}  sub={`${latest?.totals?.employees || 0} employees`} accent={T.green} />
        <Stat label="YTD Net Paid"   value={inr(ytdNet)}                    sub={`${ytd.length} run(s) this year`}              accent={T.green} />
        <Stat label="Active Staff"   value={ytdEmps || 0}                   sub="From latest run"                                accent={T.gold}  />
      </div>

      <div style={sectionTitle}>Recent Payroll Runs</div>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.shadow, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 760 }}>
            <thead style={{ background: T.surfaceWarm, borderBottom: `1px solid ${T.border}` }}>
              <tr>
                <th style={th}>Period</th>
                <th style={th}>Status</th>
                <th style={th}>Employees</th>
                <th style={th}>Gross</th>
                <th style={th}>Deductions</th>
                <th style={th}>Net</th>
                <th style={th}>Processed</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>Loading…</td></tr>}
              {!loading && runs.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>No payroll runs yet. Use Process Payroll to create the first one.</td></tr>}
              {!loading && runs.map(r => {
                const m = RUN_STATUS_META[r.status] || RUN_STATUS_META.draft;
                return (
                  <tr key={r.runId} style={{ borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}
                      onClick={() => navigate(`/staff/payroll/run?year=${r.year}&month=${r.month}`)}>
                    <td style={td}>{monthName(r.month)} {r.year}</td>
                    <td style={td}><span style={pillStyle(m.color, m.bg, m.border)}>{m.label}</span></td>
                    <td style={td}>{r.totals?.employees || 0}</td>
                    <td style={td}>{inr(r.totals?.gross)}</td>
                    <td style={td}>{inr(r.totals?.deductions)}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{inr(r.totals?.net)}</td>
                    <td style={td}>{r.processedAt ? r.processedAt.slice(0, 10) : "—"}</td>
                  </tr>
                );
              })}
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
const sectionTitle = { fontSize: 13, fontWeight: 600, color: T.text, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 };
function btn(bg, color, border) {
  return { background: bg, color, border: border ? `1px solid ${border}` : "none", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" };
}
