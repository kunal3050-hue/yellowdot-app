/**
 * BankReport.jsx — Bank transfer report for a payroll run (CSV exportable).
 * Design System v2 / Platform Layout Standard retrofit: PageShell +
 * PageHeader + DataTable (export free, replacing hand-rolled CSV). Same
 * payrollService.bankReport call.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import payrollService from "../../../services/payrollService";
import { PageShell, PageHeader, DataTable, Select } from "../../../components/ui";
import { inr, monthName } from "./_shared";

export default function BankReport() {
  const [runs, setRuns]   = useState([]);
  const [runId, setRunId] = useState("");
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadRuns = useCallback(async () => {
    try {
      const r = await payrollService.listRuns();
      if (r?.success) {
        setRuns(r.runs || []);
        if (!runId && r.runs?.[0]) setRunId(r.runs[0].runId);
      }
    } catch (err) { setError(err.response?.data?.error || err.message); }
  }, [runId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadRuns(); }, [loadRuns]);

  useEffect(() => {
    if (!runId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true); setError("");
    payrollService.bankReport(runId)
      .then(r => { if (r?.success) setData(r); })
      .catch(err => setError(err.response?.data?.error || err.message))
      .finally(() => setLoading(false));
  }, [runId]);

  const runOptions = runs.map(r => ({ value: r.runId, label: `${monthName(r.month)} ${r.year} (${r.totals?.employees || 0} emp)` }));

  const columns = useMemo(() => [
    { key: "employeeCode", label: "Employee Code", width: 130, render: (v) => <span style={{ fontFamily: "ui-monospace, Cascadia Code, monospace", fontSize: 12 }}>{v}</span> },
    { key: "displayName", label: "Name", sortable: true, filterable: true, width: 180 },
    { key: "bankAccountLast4", label: "Bank A/C", width: 110, render: (v) => v ? `XXXX${v}` : "—" },
    { key: "paymentMode", label: "Mode", width: 130, render: (v) => v || "—" },
    { key: "net", label: "Net Pay", sortable: true, width: 120, render: (v) => <strong>{inr(v)}</strong> },
  ], []);

  return (
    <PageShell
      header={
        <PageHeader
          title="Bank Transfer Report"
          tag="Payroll"
          actions={
            <div style={{ minWidth: 240 }}>
              <Select value={runId} onChange={(e) => setRunId(e.target.value)} options={runOptions} placeholder="Select run…" />
            </div>
          }
        />
      }
    >
      {error && (
        <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {data && (
        <div className="yd-card" style={{ marginBottom: 14, fontSize: 13, color: "var(--yd-text-soft)" }}>
          Run: <strong>{data.run ? `${monthName(data.run.month)} ${data.run.year}` : "—"}</strong> · Total to transfer: <strong style={{ color: "var(--yd-success)" }}>{inr(data.total)}</strong> · {data.rows.length} employee(s)
        </div>
      )}

      <DataTable
        tableId="payroll-bank-report"
        columns={columns}
        data={data?.rows || []}
        loading={loading}
        entityLabel="employees"
        searchPlaceholder="Search employee…"
        exportFilename={`bank-report-${data?.run ? `${data.run.year}-${String(data.run.month).padStart(2,"0")}` : "unknown"}`}
        exportTitle="Bank Transfer Report"
        exportFormats={["csv", "excel", "print"]}
        empty={{ title: data ? "No payslips in this run" : "Select a payroll run" }}
      />
    </PageShell>
  );
}
