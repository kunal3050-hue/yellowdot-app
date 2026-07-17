/**
 * LeaveReports.jsx — Annual leave consumption per employee
 * Design System v2 / Platform Layout Standard retrofit: PageShell +
 * PageHeader + DataTable (dynamic per-leave-code columns, search/sort/
 * export/pagination free). Same leaveService.report call.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import leaveService from "../../../services/leaveService";
import { PageShell, PageHeader, DataTable, Input } from "../../../components/ui";

export default function LeaveReports() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await leaveService.report(year);
      if (r?.success) setData(r);
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  }, [year]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const codes = data ? Array.from(new Set(data.rows.flatMap(r => Object.keys(r.byType || {})))).sort() : [];

  // Flatten byType[code] onto each row as a real top-level property so the
  // dynamic per-code columns below have a genuine accessor key -- needed
  // for DataTable's CSV/Excel export (which reads row[col.key] directly).
  const flatRows = useMemo(() => (data?.rows || []).map(r => {
    const flat = { ...r };
    codes.forEach(c => { flat[c] = r.byType?.[c] || 0; });
    return flat;
  }), [data, codes]);

  const columns = useMemo(() => [
    {
      key: "displayName", label: "Employee", sortable: true, filterable: true, width: 180,
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <div style={{ fontSize: 11, color: "var(--yd-text-muted)", fontFamily: "ui-monospace, Cascadia Code, monospace" }}>{row.employeeCode}</div>
        </div>
      ),
    },
    { key: "departmentName", label: "Department", sortable: true, filterable: true, width: 140, render: (v) => v || "—" },
    { key: "totalDays", label: "Total Days", sortable: true, width: 100, render: (v) => <strong>{v}</strong> },
    ...codes.map(c => ({ key: c, label: c, sortable: true, width: 80 })),
  ], [codes]);

  return (
    <PageShell
      header={
        <PageHeader
          title="Annual Report"
          tag="Leave Management"
          actions={
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--yd-text-soft)" }}>
              Year <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 100 }} />
            </label>
          }
        />
      }
    >
      {error && (
        <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      <DataTable
        tableId="leave-annual-report"
        columns={columns}
        data={flatRows}
        loading={loading}
        entityLabel="employees"
        searchPlaceholder="Search employee, department…"
        exportFilename={`leave-report-${year}`}
        exportTitle={`Leave Report ${year}`}
        exportFormats={["csv", "excel", "print"]}
        empty={{ title: `No approved leave in ${year}` }}
      />
    </PageShell>
  );
}
