/**
 * LeaveApprovals.jsx — Pending leave queue for managers; full request list with filters.
 * Design System v2 / Platform Layout Standard retrofit: PageShell +
 * PageHeader + DataTable + StatusBadge. Same leaveService calls/semantics.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import leaveService from "../../../services/leaveService";
import { PageShell, PageHeader, DataTable, Button, Select } from "../../../components/ui";

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

  const columns = useMemo(() => [
    {
      key: "displayName", label: "Employee", sortable: true, filterable: true, width: 170,
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <div style={{ fontSize: 11, color: "var(--yd-text-muted)", fontFamily: "ui-monospace, Cascadia Code, monospace" }}>{row.employeeCode}</div>
        </div>
      ),
    },
    { key: "leaveName", label: "Leave Type", width: 140, render: (v, row) => <span>{v} <span style={{ color: "var(--yd-text-muted)", fontSize: 11 }}>({row.leaveCode})</span></span> },
    { key: "fromDate", label: "From → To", width: 170, render: (v, row) => `${v} → ${row.toDate}` },
    { key: "days", label: "Days", width: 70 },
    { key: "reason", label: "Reason", width: 200, render: (v) => v || <span style={{ color: "var(--yd-text-muted)" }}>—</span> },
    { key: "appliedAt", label: "Applied", width: 100, render: (v) => v ? v.slice(0, 10) : "—" },
    { key: "status", label: "Status", type: "badge", sortable: true, width: 110 },
    {
      key: "approverName", label: "Decided By", width: 160,
      render: (v, row) => (
        <div>
          <div>{v || "—"}</div>
          {row.approverComment && <div style={{ fontSize: 11, color: "var(--yd-text-soft)", marginTop: 2 }}>"{row.approverComment}"</div>}
        </div>
      ),
    },
    {
      key: "actions", label: "", type: "actions", width: 190, hideable: false,
      actions: (row) => row.status === "pending" ? (
        <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
          <Button size="xs" variant="ghost" disabled={busyId === row.requestId} onClick={() => decide(row.requestId, "approve")}>Approve</Button>
          <Button size="xs" variant="ghost" disabled={busyId === row.requestId} onClick={() => decide(row.requestId, "reject")}>Reject</Button>
          <Button size="xs" variant="ghost" disabled={busyId === row.requestId} onClick={() => cancel(row.requestId)}>Cancel</Button>
        </div>
      ) : null,
    },
  ], [busyId]);

  return (
    <PageShell
      header={
        <PageHeader
          title="Approvals"
          tag="Leave Management"
          subtitle={`${rows.length} request${rows.length === 1 ? "" : "s"}`}
        />
      }
    >
      {error && (
        <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}
      {focusRow && (
        <div style={{ background: "var(--yd-yellow-light, #FFF9E0)", border: "1px solid var(--yd-yellow)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
          Focused on <strong>{focusRow.displayName}</strong>'s {focusRow.leaveName} ({focusRow.fromDate} → {focusRow.toDate})
        </div>
      )}

      <div style={{ marginBottom: 14, maxWidth: 220 }}>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} options={STATUS_OPTIONS} />
      </div>

      <DataTable
        tableId="leave-approvals"
        columns={columns}
        data={rows}
        loading={loading}
        entityLabel="requests"
        searchPlaceholder="Search employee…"
        empty={{ title: "No leave requests match this filter" }}
      />
    </PageShell>
  );
}
