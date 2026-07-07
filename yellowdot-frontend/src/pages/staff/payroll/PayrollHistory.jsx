/**
 * PayrollHistory.jsx — All payslips across all runs, filterable.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import payrollService from "../../../services/payrollService";
import { T, inr, monthName } from "./_shared";

export default function PayrollHistory() {
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [year, setYear]         = useState(new Date().getFullYear());
  const [staffSearch, setStaffSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await payrollService.listPayslips({ year });
      if (r?.success) setPayslips(r.payslips || []);
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  }, [year]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!staffSearch) return payslips;
    const q = staffSearch.toLowerCase();
    return payslips.filter(p => (p.displayName || "").toLowerCase().includes(q) || (p.employeeCode || "").toLowerCase().includes(q));
  }, [payslips, staffSearch]);

  return (
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid }}>Payroll</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "4px 0 0" }}>History ({filtered.length})</h1>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input placeholder="Search employee…" value={staffSearch} onChange={(e) => setStaffSearch(e.target.value)} style={{ ...inp, minWidth: 220 }} />
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.textSoft }}>Year
            <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ ...inp, width: 100 }} />
          </label>
        </div>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.shadow, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 900 }}>
            <thead style={{ background: T.surfaceWarm, borderBottom: `1px solid ${T.border}` }}>
              <tr>
                <th style={th}>Employee</th>
                <th style={th}>Period</th>
                <th style={th}>Paid Days</th>
                <th style={th}>Gross</th>
                <th style={th}>Deductions</th>
                <th style={th}>Net</th>
                <th style={{ ...th, textAlign: "right" }}>Payslip</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>Loading…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>No payslips for {year}.</td></tr>}
              {!loading && filtered.map(p => (
                <tr key={p.payslipId} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{p.displayName}</div>
                    <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "ui-monospace, Cascadia Code, monospace" }}>{p.employeeCode}</div>
                  </td>
                  <td style={td}>{monthName(p.month)} {p.year}</td>
                  <td style={td}>{p.paidDays}</td>
                  <td style={td}>{inr(p.gross)}</td>
                  <td style={td}>{inr(p.totalDeductions)}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{inr(p.net)}</td>
                  <td style={{ ...td, textAlign: "right" }}>
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

const th = { textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textMuted };
const td = { padding: "10px 14px", fontSize: 13, color: T.text };
const errorBox = { background: T.redLight, color: T.red, border: `1px solid ${T.red}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 };
const inp = { border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 12px", fontSize: 13, background: T.surfaceWarm };
function miniLink() { return { textDecoration: "none", background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600 }; }
