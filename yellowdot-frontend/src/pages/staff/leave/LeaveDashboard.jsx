/**
 * LeaveDashboard.jsx — KPIs + recent leave requests + my balances widget
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import leaveService, { LEAVE_STATUS_META } from "../../../services/leaveService";
import { T, pillStyle } from "./_shared";

function Stat({ label, value, sub, accent = T.gold, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 14, padding: "18px 20px",
      cursor: onClick ? "pointer" : "default",
      boxShadow: T.shadow, position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 3, background: accent }} />
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textMuted }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 28, fontWeight: 700, color: T.text }}>{value}</div>
      {sub && <div style={{ marginTop: 4, fontSize: 12, color: T.textSoft }}>{sub}</div>}
    </div>
  );
}

export default function LeaveDashboard() {
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [myBalances, setMy]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [d, b] = await Promise.all([
        leaveService.dashboard(),
        leaveService.myBalances().catch(() => ({ balances: [] })),
      ]);
      if (d?.success) setData(d);
      setMy(b?.balances || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid }}>Leave Management</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "4px 0 0", letterSpacing: "-0.02em" }}>Dashboard</h1>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => navigate("/staff/leave/apply")}      style={btn(T.gold, "#1E1E1E")}>+ Apply Leave</button>
          <button onClick={() => navigate("/staff/leave/approvals")}  style={btn(T.surface, T.text, T.border)}>Approvals</button>
          <button onClick={() => navigate("/staff/leave/calendar")}   style={btn(T.surface, T.text, T.border)}>Calendar</button>
          <button onClick={() => navigate("/staff/leave/reports")}    style={btn(T.surface, T.text, T.border)}>Reports</button>
        </div>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
        <Stat label="Total Requests"   value={data?.total ?? 0}                                       />
        <Stat label="Pending Approval" value={data?.pending ?? 0}              accent={T.goldMid}     onClick={() => navigate("/staff/leave/approvals")} />
        <Stat label="Approved (MTD)"   value={data?.approvedThisMonth ?? 0}    accent={T.green}       />
        <Stat label="On Leave Today"   value={data?.onLeaveToday ?? 0}         accent={T.red}         />
      </div>

      {myBalances.length > 0 && (
        <>
          <div style={sectionTitle}>My Leave Balances ({myBalances[0]?.year})</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12, marginBottom: 24 }}>
            {myBalances.map(b => (
              <div key={b.balanceId} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px", boxShadow: T.shadow }}>
                <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, textTransform: "uppercase" }}>{b.leaveCode} · {b.leaveName}</div>
                <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700, color: T.text }}>{b.remaining}</div>
                <div style={{ fontSize: 11, color: T.textSoft }}>of {b.entitled + b.carriedForward} · used {b.used}{b.pending ? ` · pending ${b.pending}` : ""}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={sectionTitle}>Recent Requests</div>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.shadow, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 880 }}>
            <thead style={{ background: T.surfaceWarm, borderBottom: `1px solid ${T.border}` }}>
              <tr>
                <th style={th}>Employee</th>
                <th style={th}>Leave Type</th>
                <th style={th}>From</th>
                <th style={th}>To</th>
                <th style={th}>Days</th>
                <th style={th}>Status</th>
                <th style={th}>Applied</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>Loading…</td></tr>}
              {!loading && (data?.recent || []).length === 0 && (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>No leave requests yet.</td></tr>
              )}
              {!loading && (data?.recent || []).map(r => {
                const m = LEAVE_STATUS_META[r.status] || LEAVE_STATUS_META.pending;
                return (
                  <tr key={r.requestId} style={{ borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}
                      onClick={() => navigate(`/staff/leave/approvals?focus=${r.requestId}`)}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{r.displayName}</div>
                      <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "ui-monospace, Cascadia Code, monospace" }}>{r.employeeCode}</div>
                    </td>
                    <td style={td}>{r.leaveName} <span style={{ color: T.textMuted, fontSize: 11 }}>({r.leaveCode})</span></td>
                    <td style={td}>{r.fromDate}</td>
                    <td style={td}>{r.toDate}</td>
                    <td style={td}>{r.days}</td>
                    <td style={td}><span style={pillStyle(m.color, m.bg, m.border)}>{m.label}</span></td>
                    <td style={td}>{r.appliedAt ? r.appliedAt.slice(0, 10) : "—"}</td>
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
