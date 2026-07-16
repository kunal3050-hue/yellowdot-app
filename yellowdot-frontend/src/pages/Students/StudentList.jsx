/**
 * StudentList.jsx — premium student directory
 * ─────────────────────────────────────────────────────────────────
 * Replaces the old 280px "compact directory" side panel with a
 * full-width DataTable v2 view: KPI summary + search/filters/bulk
 * actions/export, all built on the canonical v2 component. Row click
 * opens the student's profile within the same /students route (no
 * new routes were added).
 * ─────────────────────────────────────────────────────────────────
 */
import { useMemo } from "react";
import { UserPlus } from "lucide-react";
import { KpiCard, DataTable, Badge, Button } from "../../components/ui";
import { calcAge } from "./shared";

export default function StudentList({
  students,
  loading,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  onBulkDelete,
  canAdd = true,
  canEdit = true,
  canDelete = true,
}) {
  const activeCount = students.filter(s => (s.Status || "Active") === "Active").length;
  const classCount  = new Set(students.map(s => s.Class).filter(Boolean)).size;

  const classOptions = useMemo(() => {
    return Array.from(new Set(students.map(s => s.Class).filter(Boolean))).sort();
  }, [students]);

  const columns = useMemo(() => [
    {
      key: "Student_Name", label: "Student", type: "avatar", sortable: true, filterable: true, width: 220,
      avatarName: r => r.Student_Name, avatarPhoto: r => r.Profile_Image,
    },
    {
      key: "Class", label: "Class", sortable: true, filterable: true,
      filterType: "multiselect", filterOptions: classOptions, width: 130,
      render: (v) => v ? <Badge variant="neutral">{v}</Badge> : "—",
    },
    {
      key: "Status", label: "Status", type: "badge", sortable: true, filterable: true,
      filterType: "select", filterOptions: ["Active", "Inactive", "Alumni"], width: 110,
    },
    {
      key: "DOB", label: "Age", width: 90,
      render: (v) => calcAge(v),
    },
    { key: "Center", label: "Center", sortable: true, filterable: true, width: 120 },
    {
      key: "Father_Name", label: "Parent Contact", width: 200,
      render: (v, row) => {
        const name = row.Father_Name || row.Mother_Name;
        const phone = row.Father_WhatsApp || row.Mother_WhatsApp;
        if (!name) return "—";
        return (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{name}</div>
            {phone && <div style={{ fontSize: 11, color: "var(--yd-text-muted)" }}>{phone}</div>}
          </div>
        );
      },
    },
    { key: "Student_ID", label: "ID", width: 110 },
    {
      key: "actions", label: "", type: "actions", width: 90, hideable: false,
      actions: (row) => (
        <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
          {canEdit && <Button size="xs" variant="ghost" onClick={() => onEdit(row)}>Edit</Button>}
          {canDelete && <Button size="xs" variant="ghost" onClick={() => onDelete(row)}>Delete</Button>}
        </div>
      ),
    },
  ], [classOptions, canEdit, canDelete, onEdit, onDelete]);

  const bulkActions = [];
  if (canDelete) {
    bulkActions.push({
      key: "delete", label: "Delete", variant: "danger",
      onClick: (rows) => onBulkDelete(rows),
    });
  }

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16, height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--yd-charcoal)" }}>Students</h1>
          <p style={{ fontSize: 12, color: "var(--yd-text-muted)", marginTop: 2 }}>{students.length} students enrolled</p>
        </div>
        {canAdd && (
          <Button variant="primary" leftIcon={<UserPlus size={14} strokeWidth={2} />} onClick={onAdd}>
            Add Student
          </Button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, maxWidth: 560 }}>
        <KpiCard label="Total Students" value={students.length} loading={loading} />
        <KpiCard label="Active" value={activeCount} loading={loading} />
        <KpiCard label="Classes" value={classCount} loading={loading} />
      </div>

      <DataTable
        tableId="students-list"
        columns={columns}
        data={students}
        loading={loading}
        selectable={canDelete}
        entityLabel="students"
        searchPlaceholder="Search name, ID, class…"
        exportFilename="students"
        exportTitle="Students"
        exportFormats={["csv", "excel", "print"]}
        bulkActions={bulkActions}
        onRowClick={(row) => onSelect(row.Student_ID || row.id)}
        empty={{
          title: "No students found",
          description: "Adjust filters or add your first student.",
          action: canAdd ? { label: "+ Add Student", onClick: onAdd } : undefined,
        }}
      />
    </div>
  );
}
