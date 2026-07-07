/**
 * LeaveApprovals.jsx — Pending leave queue for managers; full request list with filters.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import leaveService, { LEAVE_STATUS_META } from "../../../services/leaveService";
import { T, pillStyle } from "./_shared";

const STATUS_OPTIONS = [
  { value: "",          label: "All" },
  { value: "pending",   label: "Pending" },
  { value: "approved",  label: "Approved" },
  { value: "rejected",  label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

export default function LeaveApprovals() {
  const [sp]          = useSearchParams();
  const focusId       = sp.get("focus");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [status, setStatus]   = useState("pending");
  const [busyId, setBusy]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await leaveService.listRequests({ status: status || undefined });
      if (r?.success) setRows(r.requests || []);
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  }, [status]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const focusRow = useMemo(() => rows.find(r => r.requestId === focusId), [rows, focusId]);

  async function decide(id, action) {
    const comment = window.prompt(action === "approve" ? "Approval comment (optional):" : "Reason for rejection (optional):") || "";
    setBusy(id);
    try {
      if (action === "approve") await leaveService.approve(id, comment);
      else                       await leaveService.reject(id, comment);
      await load();
    } catch (err) { alert(err.response?.data?.error || err.message); }
    finally { setBusy(null); }
  }

  async function cancel(id) {
    if (!window.confirm("Cancel this request?")) return;
    setBusy(id);
    try {
      await leaveService.cancel(id);
      await load();
    } catch (err) { alert(err.response?.data?.error || err.message); }
    finally { setBusy(null); }
  }

  return (
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid }}>Leave Management</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "4px 0 0" }}>Approvals ({rows.length})</h1>
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={inp}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {error && <div style={errorBox}>{error}</div>}
      {focusRow && (
        <div style={{ background: T.goldLight, border: `1px solid ${T.borderGold}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
          Focused on <strong>{focusRow.displayName}</strong>'s {focusRow.leaveName} ({focusRow.fromDate} → {focusRow.toDate})
        </div>
      )}

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.shadow, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 1100 }}>
            <thead style={{ background: T.surfaceWarm, borderBottom: `1px solid ${T.border}` }}>
              <tr>
                <th style={th}>Employee</th>
                <th style={th}>Leave Type</th>
                <th style={th}>From → To</th>
                <th style={th}>Days</th>
                <th style={th}>Reason</th>
                <th style={th}>Applied</th>
                <th style={th}>Status</th>
                <th style={th}>Decided By</th>
                <th style={{ ...th, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>No leave requests match this filter.</td></tr>}
              {!loading && rows.map(r => {
                const m = LEAVE_STATUS_META[r.status] || LEAVE_STATUS_META.pending;
                const isFocus = focusId === r.requestId;
                return (
                  <tr key={r.requestId} style={{ borderBottom: `1px solid ${T.border}`, background: isFocus ? "#FFF9DC" : "transparent" }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{r.displayName}</div>
                      <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "ui-monospace, Cascadia Code, monospace" }}>{r.employeeCode}</div>
                    </td>
                    <td style={td}>{r.leaveName} <span style={{ color: T.textMuted, fontSize: 11 }}>({r.leaveCode})</span></td>
                    <td style={td}>{r.fromDate} → {r.toDate}</td>
                    <td style={td}>{r.days}</td>
                    <td style={{ ...td, maxWidth: 240, whiteSpace: "normal" }}>{r.reason || <span style={{ color: T.textMuted }}>—</span>}</td>
                    <td style={td}>{r.appliedAt ? r.appliedAt.slice(0, 10) : "—"}</td>
                    <td style={td}><span style={pillStyle(m.color, m.bg, m.border)}>{m.label}</span></td>
                    <td style={td}>{r.approverName || "—"}{r.approverComment && <div style={{ fontSize: 11, color: T.textSoft, marginTop: 2 }}>"{r.approverComment}"</div>}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                      {r.status === "pending" && (
                        <>
                          <button disabled={busyId === r.requestId} onClick={() => decide(r.requestId, "approve")} style={{ ...mini(), color: T.green, borderColor: "#bbf7d0" }}>Approve</button>
                          <button disabled={busyId === r.requestId} onClick={() => decide(r.requestId, "reject")}  style={{ ...mini(), color: T.red,   borderColor: `${T.red}55` }}>Reject</button>
                          <button disabled={busyId === r.requestId} onClick={() => cancel(r.requestId)}            style={mini()}>Cancel</button>
                        </>
                      )}
                    </td>
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
const td = { padding: "10px 14px", fontSize: 13, color: T.text, verticalAlign: "top" };
const errorBox = { background: T.redLight, color: T.red, border: `1px solid ${T.red}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 };
const inp = { border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, background: T.surfaceWarm };
function mini() { return { background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", marginLeft: 4 }; }
