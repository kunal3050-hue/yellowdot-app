/**
 * AttendanceToday.jsx — Mark today's attendance for every staff member.
 * Design System v2 / Platform Layout Standard retrofit: PageShell +
 * PageHeader + DataTable (search/filter/sort/pagination free) +
 * StatusBadge. Same staffAttendanceService calls/semantics.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import staffAttendanceService, { ATTENDANCE_STATUSES } from "../../../services/staffAttendanceService";
import { PageShell, PageHeader, DataTable, Button } from "../../../components/ui";
import { fmtTime, fmtMins } from "./_shared";

export default function AttendanceToday() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const canManage = ["developer","super_admin","admin","center_owner","center_admin","reception"].includes(role);

  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
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

  const columns = useMemo(() => [
    {
      key: "displayName", label: "Employee", type: "avatar", sortable: true, filterable: true, width: 200,
      avatarName: r => r.displayName, avatarPhoto: r => r.photoUrl,
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <div style={{ fontSize: 11, color: "var(--yd-text-muted)", fontFamily: "ui-monospace, Cascadia Code, monospace" }}>{row.employeeCode}</div>
        </div>
      ),
    },
    { key: "departmentName", label: "Department", sortable: true, filterable: true, width: 140, render: (v) => v || "—" },
    {
      key: "status", label: "Status", type: "badge", sortable: true, filterable: true,
      filterType: "select", filterOptions: ATTENDANCE_STATUSES, width: 120,
    },
    { key: "checkIn", label: "Check-In", width: 100, render: (v) => fmtTime(v) },
    { key: "checkOut", label: "Check-Out", width: 100, render: (v) => fmtTime(v) },
    { key: "hoursWorked", label: "Hours", width: 90, render: (v) => v ? `${v}h` : "—" },
    { key: "lateBy", label: "Late", width: 90, render: (v, row) => row.isLate ? <span style={{ color: "var(--yd-danger)", fontWeight: 600 }}>{fmtMins(v)}</span> : "—" },
    { key: "overtimeMinutes", label: "OT", width: 90, render: (v) => v ? <span style={{ color: "var(--yd-success)", fontWeight: 600 }}>{fmtMins(v)}</span> : "—" },
    {
      key: "actions", label: "", type: "actions", width: 220, hideable: false,
      actions: (row) => canManage ? (
        <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
          <Button size="xs" variant="ghost" disabled={busy === row.staffId} onClick={() => doAction(staffAttendanceService.checkIn, row.staffId)}>In</Button>
          <Button size="xs" variant="ghost" disabled={busy === row.staffId} onClick={() => doAction(staffAttendanceService.checkOut, row.staffId)}>Out</Button>
          <Button size="xs" variant="ghost" disabled={busy === row.staffId} onClick={() => doAction(staffAttendanceService.markStatus, row.staffId, { status: "absent" })}>Abs</Button>
          <Button size="xs" variant="ghost" disabled={busy === row.staffId} onClick={() => doAction(staffAttendanceService.markStatus, row.staffId, { status: "leave" })}>Lv</Button>
          <Button size="xs" variant="ghost" disabled={busy === row.staffId} onClick={() => doAction(staffAttendanceService.markStatus, row.staffId, { status: "half_day" })}>½</Button>
        </div>
      ) : null,
    },
  ], [canManage, busy]);

  return (
    <PageShell
      header={
        <PageHeader
          title={`Today · ${snapshot?.date || ""}`}
          tag="Staff Attendance"
          secondaryActions={[
            { key: "in", label: busy === "__self_in__" ? "…" : "I'm In", onClick: selfCheckIn, disabled: busy === "__self_in__" },
            { key: "out", label: busy === "__self_out__" ? "…" : "I'm Out", onClick: selfCheckOut, disabled: busy === "__self_out__" },
            ...(canManage ? [
              { key: "qr", label: "QR Toggle", onClick: qrPromptAndToggle, disabled: busy === "__qr__" },
              { key: "bulk", label: "Mark unmarked absent", onClick: bulkMarkAbsent, disabled: busy === "__bulk__" },
              { key: "history", label: "History", onClick: () => navigate("/staff/attendance/history") },
            ] : []),
          ]}
        />
      }
    >
      {error && (
        <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      <DataTable
        tableId="staff-attendance-today"
        columns={columns}
        data={snapshot?.rows || []}
        loading={loading}
        entityLabel="staff"
        searchPlaceholder="Search name / employee ID / department…"
        empty={{ title: "No staff match the current filters" }}
      />
    </PageShell>
  );
}
