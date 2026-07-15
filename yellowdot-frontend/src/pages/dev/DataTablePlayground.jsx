/**
 * DataTablePlayground.jsx — dev-only verification harness for DataTable v2
 * ─────────────────────────────────────────────────────────────────────────
 * Not a production page. Exercises every DataTable v2 feature against a
 * generated dataset so the component can be verified end-to-end before any
 * real module is migrated to it. Gated the same way as ModuleExplorer
 * (super_admin/developer only in production, open in dev).
 */

import { useMemo, useState } from "react";
import { DataTable, Button } from "../../components/ui";

const FIRST_NAMES = ["Aarav", "Diya", "Vihaan", "Ananya", "Reyansh", "Ishita", "Kabir", "Myra", "Arjun", "Saanvi"];
const LAST_NAMES  = ["Sharma", "Verma", "Iyer", "Nair", "Reddy", "Gupta", "Khan", "Patel", "Rao", "Singh"];
const CLASSROOMS  = ["Toddler A", "Toddler B", "Preschool A", "Preschool B", "Pre-K"];
const STATUSES    = ["Active", "Inactive", "Alumni"];

function generateStudents(count) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[(i * 7) % LAST_NAMES.length];
    rows.push({
      id: `STU-${1000 + i}`,
      name: `${first} ${last}`,
      classroom: CLASSROOMS[i % CLASSROOMS.length],
      status: STATUSES[i % STATUSES.length],
      admissionDate: new Date(2024, i % 12, (i % 27) + 1).toISOString().slice(0, 10),
      feesPaid: Math.round((i * 137) % 50000) + 5000,
      parentEmail: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
    });
  }
  return rows;
}

const SMALL_DATASET = generateStudents(48);
const LARGE_DATASET = generateStudents(5000);

const COLUMNS = [
  { key: "name", label: "Student", type: "avatar", avatarName: r => r.name, sortable: true, filterable: true, width: 200 },
  { key: "classroom", label: "Classroom", sortable: true, filterable: true, filterType: "multiselect", filterOptions: CLASSROOMS, width: 130 },
  { key: "status", label: "Status", type: "badge", sortable: true, filterable: true, filterType: "select", filterOptions: STATUSES, width: 110 },
  { key: "admissionDate", label: "Admitted", sortable: true, filterable: true, filterType: "dateRange", width: 130 },
  {
    key: "feesPaid", label: "Fees Paid", sortable: true, align: "right", width: 120,
    render: (v) => `₹${v.toLocaleString("en-IN")}`,
    exportValue: (v) => v,
  },
  { key: "parentEmail", label: "Parent Email", filterable: true, width: 220 },
  {
    key: "actions", label: "", type: "actions", width: 90, hideable: false,
    actions: (row) => (
      <Button size="xs" variant="ghost" onClick={() => alert(`View ${row.name}`)}>View</Button>
    ),
  },
];

export default function DataTablePlayground() {
  const [dataset, setDataset] = useState("small");
  const [loading, setLoading] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);

  const data = useMemo(() => {
    if (showEmpty) return [];
    return dataset === "large" ? LARGE_DATASET : SMALL_DATASET;
  }, [dataset, showEmpty]);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4, color: "var(--yd-charcoal)" }}>
        DataTable v2 Playground
      </h1>
      <p style={{ fontSize: 13, color: "var(--yd-text-muted)", marginBottom: 20 }}>
        Dev-only verification harness — not a production page. Exercises every DataTable v2 feature.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <Button size="sm" variant={dataset === "small" ? "primary" : "secondary"} onClick={() => setDataset("small")}>
          48 rows (plain table)
        </Button>
        <Button size="sm" variant={dataset === "large" ? "primary" : "secondary"} onClick={() => setDataset("large")}>
          5,000 rows (virtualized)
        </Button>
        <Button size="sm" variant={loading ? "primary" : "secondary"} onClick={() => setLoading(l => !l)}>
          Toggle loading
        </Button>
        <Button size="sm" variant={showEmpty ? "primary" : "secondary"} onClick={() => setShowEmpty(e => !e)}>
          Toggle empty state
        </Button>
      </div>

      <DataTable
        tableId="playground-students"
        columns={COLUMNS}
        data={data}
        loading={loading}
        selectable
        entityLabel="students"
        searchPlaceholder="Search students…"
        exportFilename="students"
        exportTitle="Students"
        exportFormats={["csv", "excel", "print", "pdf"]}
        bulkActions={[
          { key: "archive", label: "Archive", onClick: (rows) => alert(`Archive ${rows.length} students`) },
          { key: "status", label: "Update Status", onClick: (rows) => alert(`Update status for ${rows.length} students`) },
          { key: "delete", label: "Delete", variant: "danger", onClick: (rows) => alert(`Delete ${rows.length} students`) },
        ]}
        onRowClick={(row) => console.log("Row clicked:", row)}
        empty={{
          title: "No students found",
          description: "Add your first student to get started.",
          action: { label: "+ Add Student", onClick: () => alert("Add student") },
        }}
        toolbarExtra={<Button size="sm" variant="primary">+ Add Student</Button>}
      />
    </div>
  );
}
