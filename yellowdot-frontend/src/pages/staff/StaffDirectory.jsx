/**
 * StaffDirectory.jsx — Employee Directory
 * ─────────────────────────────────────────
 * Design System v2 / Platform Layout Standard: PageShell -> PageHeader ->
 * KpiRow -> DataTable (search/filters/sort/export/bulk actions/pagination
 * all supplied by DataTable's own toolbar -- no hand-rolled table/toolbar).
 * Same data (staffService/departmentService/designationService), same
 * bulk-activate/deactivate/soft-delete semantics -- presentation only.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";
import staffService, { STAFF_ENUMS } from "../../services/staffService";
import departmentService from "../../services/departmentService";
import designationService from "../../services/designationService";
import { PageShell, PageHeader, KpiRow, KpiCard, DataTable, Badge } from "../../components/ui";

function ClassroomCell({ rooms }) {
  const visible = rooms.slice(0, 2);
  const extra = rooms.length - visible.length;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "wrap" }} title={rooms.join(", ")}>
      {visible.map((r, i) => <Badge key={`${r}-${i}`} variant="neutral">{r}</Badge>)}
      {extra > 0 && <span style={{ fontSize: 11, color: "var(--yd-text-muted)" }}>+{extra}</span>}
    </span>
  );
}

export default function StaffDirectory() {
  const navigate = useNavigate();

  const [staff,        setStaff]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [departments,  setDepartments]  = useState([]);
  const [designations, setDesignations] = useState([]);
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [s, d, g] = await Promise.all([
        staffService.getAll({ includeDeleted: includeDeleted ? "true" : undefined }),
        departmentService.getAll(),
        designationService.getAll(),
      ]);
      if (s?.success) setStaff(s.staff || []);
      if (d?.success) setDepartments(d.departments || []);
      if (g?.success) setDesignations(g.designations || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to load staff.");
    } finally {
      setLoading(false);
    }
  }, [includeDeleted]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const activeCount  = staff.filter(s => s.employmentStatus === "active").length;
  const onLeaveCount = staff.filter(s => s.employmentStatus === "on_leave").length;

  const departmentOptions  = useMemo(() => departments.map(d => ({ value: d.deptId, label: d.name })), [departments]);
  const designationOptions = useMemo(() => designations.map(d => ({ value: d.designationId, label: d.name })), [designations]);

  async function bulkSetStatus(rows, employmentStatus, active) {
    const label = employmentStatus === "active" ? "activate" : "deactivate";
    if (!window.confirm(`${label[0].toUpperCase() + label.slice(1)} ${rows.length} employee${rows.length === 1 ? "" : "s"}?`)) return;
    try {
      await Promise.all(rows.map(r => staffService.update(r.staffId, { employmentStatus, active })));
      await load();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  }

  async function bulkSoftDelete(rows) {
    if (!window.confirm(`Mark ${rows.length} employee${rows.length === 1 ? "" : "s"} as inactive? (Soft delete — records are preserved.)`)) return;
    try {
      await Promise.all(rows.map(r => staffService.remove(r.staffId)));
      await load();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  }

  const columns = useMemo(() => [
    {
      key: "displayName", label: "Name", type: "avatar", sortable: true, filterable: true, width: 220,
      avatarName: r => r.displayName, avatarPhoto: r => r.photoUrl,
    },
    { key: "employeeCode", label: "Emp ID", sortable: true, width: 110 },
    { key: "mobile", label: "Mobile", width: 130 },
    { key: "email", label: "Email", width: 200 },
    {
      key: "departmentName", label: "Department", sortable: true, filterable: true,
      filterType: "multiselect", filterOptions: departmentOptions, width: 150,
    },
    {
      key: "designationName", label: "Designation", sortable: true, filterable: true,
      filterType: "multiselect", filterOptions: designationOptions, width: 160,
    },
    { key: "branch", label: "Branch", width: 110, render: (v, row) => v || row.centerId || "—" },
    {
      key: "assignedClassrooms", label: "Classrooms", width: 150,
      render: (v) => v?.length ? <ClassroomCell rooms={v} /> : "—",
    },
    {
      key: "employmentStatus", label: "Status", type: "badge", sortable: true, filterable: true,
      filterType: "select", filterOptions: STAFF_ENUMS.employmentStatuses, width: 130,
    },
    {
      key: "loginStatus", label: "Login", type: "badge", filterable: true,
      filterType: "select", filterOptions: [
        { value: "not_linked", label: "Not Linked" }, { value: "invitation_sent", label: "Invitation Sent" },
        { value: "active", label: "Active" }, { value: "disabled", label: "Disabled" },
      ], width: 130,
    },
    { key: "joiningDate", label: "Joining Date", sortable: true, width: 120 },
  ], [departmentOptions, designationOptions]);

  const bulkActions = [
    { key: "activate",   label: "Mark Active", onClick: (rows) => bulkSetStatus(rows, "active", true) },
    { key: "deactivate", label: "Deactivate",  onClick: (rows) => bulkSetStatus(rows, "inactive", false) },
    { key: "delete",     label: "Mark Inactive (Soft)", variant: "danger", onClick: bulkSoftDelete },
  ];

  return (
    <PageShell
      header={
        <PageHeader
          title="Employees"
          tag="Staff Management"
          subtitle={`${staff.length} employee${staff.length === 1 ? "" : "s"}`}
          primaryAction={{ label: "Add Employee", icon: <UserPlus size={14} strokeWidth={2} />, onClick: () => navigate("/staff/employees/new") }}
          secondaryActions={[{
            key: "deleted", label: includeDeleted ? "Hide Deleted" : "Show Deleted",
            onClick: () => setIncludeDeleted(v => !v),
          }]}
        />
      }
      kpis={
        <KpiRow maxWidth={560}>
          <KpiCard label="Total Staff" value={staff.length} loading={loading} />
          <KpiCard label="Active" value={activeCount} loading={loading} />
          <KpiCard label="On Leave" value={onLeaveCount} loading={loading} />
        </KpiRow>
      }
    >
      {error && (
        <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      <DataTable
        tableId="staff-directory"
        columns={columns}
        data={staff}
        loading={loading}
        selectable
        entityLabel="employees"
        searchPlaceholder="Search by name, employee ID, email, mobile…"
        exportFilename="staff-directory"
        exportTitle="Employees"
        exportFormats={["csv", "excel", "print"]}
        bulkActions={bulkActions}
        onRowClick={(row) => navigate(`/staff/employees/${row.staffId}`)}
        empty={{
          title: "No employees found",
          description: "Adjust filters or add your first employee.",
          action: { label: "+ Add Employee", onClick: () => navigate("/staff/employees/new") },
        }}
      />
    </PageShell>
  );
}
