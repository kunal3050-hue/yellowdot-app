/**
 * AttendanceToday.jsx — Mark today's attendance for every staff member.
 *
 * Manager view (admin / center-admin / reception):
 *   - Sees a grid of all staff in scope with quick action buttons
 *   - Per-row: Check-In · Check-Out · Mark Absent · Mark Leave · Mark Half-Day
 *   - Bulk-mark absent for everyone not already marked
 *   - QR Scan button (opens prompt for staffId — full camera scanner is the existing QRManagement page)
 *
 * Self view (any staff member with a linked login):
 *   - Banner at top with "Check In" / "Check Out" for their own day
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import staffAttendanceService, { ATTENDANCE_STATUSES, STATUS_META } from "../../../services/staffAttendanceService";
import { T, pillStyle, fmtTime, fmtMins } from "./_shared";

export default function AttendanceToday() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const canManage = ["developer","super_admin","admin","center_owner","center_admin","reception"].includes(role);

  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [search, setSearch]     = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [busy, setBusy]         = useState(null); // staffId currently being mutated

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await staffAttendanceService.today();
      if (res?.success) setSnapshot(res);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!snapshot) return [];
    let rows = snapshot.rows || [];
    if (statusFilter) rows = rows.filter(r => r.status === statusFilter);
    if (search) {
      const q = search.toLowerCase().trim();
      rows = rows.filter(r =>
        (r.displayName || "").toLowerCase().includes(q) ||
        (r.employeeCode || "").toLowerCase().includes(q) ||
        (r.departmentName || "").toLowerCase().includes(q));
    }
    return rows;
  }, [snapshot, search, statusFilter]);

  async function doAction(fn, staffId, payload = {}) {
    setBusy(staffId);
    try {
      await fn({ staffId, ...payload });
      await load();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally { setBusy(null); }
  }

  async function selfCheckIn() {
    setBusy("__self_in__");
    try {
      const res = await staffAttendanceService.selfCheckIn();
      if (res?.success) await load();
    } catch (err) { alert(err.response?.data?.error || err.message); }
    finally { setBusy(null); }
  }
  async function selfCheckOut() {
    setBusy("__self_out__");
    try {
      const res = await staffAttendanceService.selfCheckOut();
      if (res?.success) await load();
    } catch (err) { alert(err.response?.data?.error || err.message); }
    finally { setBusy(null); }
  }

  async function bulkMarkAbsent() {
    if (!snapshot) return;
    const targets = (snapshot.rows || []).filter(r => r._unmarked);
    if (!targets.length) { alert("Nothing to mark — every staff record is already touched today."); return; }
    if (!window.confirm(`Mark ${targets.length} unmarked employee${targets.length === 1 ? "" : "s"} as absent for today?`)) return;
    setBusy("__bulk__");
    try {
      await Promise.all(targets.map(t => staffAttendanceService.markStatus({ staffId: t.staffId, status: "absent" })));
      await load();
    } catch (err) { alert(err.response?.data?.error || err.message); }
    finally { setBusy(null); }
  }

  async function qrPromptAndToggle() {
    const id = window.prompt("Enter staff ID from QR (e.g. STF000001). For camera QR scans, use QR Management.");
    if (!id) return;
    setBusy("__qr__");
    try {
      const res = await staffAttendanceService.qrToggle({ staffId: id.trim() });
      if (res?.success) await load();
    } catch (err) { alert(err.response?.data?.error || err.message); }
    finally { setBusy(null); }
  }

  return (
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid }}>Staff Attendance</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "4px 0 0", letterSpacing: "-0.02em" }}>Today · {snapshot?.date || ""}</h1>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={selfCheckIn}  disabled={busy === "__self_in__"} style={btn(T.surface, T.text, T.border)}>{busy === "__self_in__" ? "…" : "I'm In"}</button>
          <button onClick={selfCheckOut} disabled={busy === "__self_out__"} style={btn(T.surface, T.text, T.border)}>{busy === "__self_out__" ? "…" : "I'm Out"}</button>
          {canManage && (
            <>
              <button onClick={qrPromptAndToggle} disabled={busy === "__qr__"} style={btn(T.surface, T.goldMid, T.borderGold)}>QR Toggle</button>
              <button onClick={bulkMarkAbsent}    disabled={busy === "__bulk__"} style={btn(T.surface, T.red, T.border)}>Mark unmarked absent</button>
              <button onClick={() => navigate("/staff/attendance/history")} style={btn(T.surface, T.text, T.border)}>History</button>
            </>
          )}
        </div>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, marginBottom: 14, display: "flex", gap: 10, flexWrap: "wrap", boxShadow: T.shadow }}>
        <input
          placeholder="Search name / employee ID / department…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: "1 1 240px", minWidth: 220, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, background: T.surfaceWarm }}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
          <option value="">All statuses</option>
          {ATTENDANCE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.shadow, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 1000 }}>
            <thead style={{ background: T.surfaceWarm, borderBottom: `1px solid ${T.border}` }}>
              <tr>
                <th style={th}>Employee</th>
                <th style={th}>Department</th>
                <th style={th}>Status</th>
                <th style={th}>Check-In</th>
                <th style={th}>Check-Out</th>
                <th style={th}>Hours</th>
                <th style={th}>Late</th>
                <th style={th}>OT</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>Loading…</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>No staff match the current filters.</td></tr>
              )}
              {!loading && filtered.map(r => (
                <tr key={r.staffId} style={{ borderBottom: `1px solid ${T.border}`, background: r._unmarked ? T.surfaceWarm : "transparent" }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{r.displayName}</div>
                    <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "ui-monospace, Cascadia Code, monospace" }}>{r.employeeCode}</div>
                  </td>
                  <td style={td}>{r.departmentName || "—"}</td>
                  <td style={td}><StatusPill status={r.status} /></td>
                  <td style={td}>{fmtTime(r.checkIn)}</td>
                  <td style={td}>{fmtTime(r.checkOut)}</td>
                  <td style={td}>{r.hoursWorked ? `${r.hoursWorked}h` : "—"}</td>
                  <td style={td}>{r.isLate ? <span style={{ color: T.red, fontWeight: 600 }}>{fmtMins(r.lateBy)}</span> : "—"}</td>
                  <td style={td}>{r.overtimeMinutes ? <span style={{ color: T.green, fontWeight: 600 }}>{fmtMins(r.overtimeMinutes)}</span> : "—"}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    {canManage && (
                      <>
                        <button disabled={busy === r.staffId} onClick={() => doAction(staffAttendanceService.checkIn, r.staffId)}  style={mini()}>In</button>
                        <button disabled={busy === r.staffId} onClick={() => doAction(staffAttendanceService.checkOut, r.staffId)} style={mini()}>Out</button>
                        <button disabled={busy === r.staffId} onClick={() => doAction(staffAttendanceService.markStatus, r.staffId, { status: "absent" })}   style={{ ...mini(), color: T.red }}>Abs</button>
                        <button disabled={busy === r.staffId} onClick={() => doAction(staffAttendanceService.markStatus, r.staffId, { status: "leave" })}    style={{ ...mini(), color: T.goldMid }}>Lv</button>
                        <button disabled={busy === r.staffId} onClick={() => doAction(staffAttendanceService.markStatus, r.staffId, { status: "half_day" })} style={{ ...mini(), color: T.goldMid }}>½</button>
                      </>
                    )}
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

function StatusPill({ status }) {
  const m = STATUS_META[status] || STATUS_META.absent;
  return <span style={pillStyle(m.color, m.bg, m.border)}>{m.label}</span>;
}

const th = { textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textMuted };
const td = { padding: "10px 14px", fontSize: 13, color: T.text, verticalAlign: "middle" };
const selectStyle = { border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, background: T.surfaceWarm };
const errorBox = { background: T.redLight, color: T.red, border: `1px solid ${T.red}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 };
function btn(bg, color, border) {
  return { background: bg, color, border: border ? `1px solid ${border}` : "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" };
}
function mini() {
  return { background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", marginLeft: 4 };
}
