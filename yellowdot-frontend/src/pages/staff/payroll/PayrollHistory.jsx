/**
 * PayrollHistory.jsx — All payslips across all runs, filterable.
 * Design System v2 / Platform Layout Standard retrofit: PageShell +
 * PageHeader + DataTable (search/sort/pagination free). Year stays a
 * server-side query param (re-fetches on change). Same
 * payrollService.listPayslips call.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import payrollService from "../../../services/payrollService";
import { PageShell, PageHeader, DataTable } from "../../../components/ui";
import { inr, monthName } from "./_shared";

export default function PayrollHistory() {
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [year, setYear]         = useState(new Date().getFullYear());

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await payrollService.listPayslips({ year });
      if (r?.success) setPayslips(r.payslips || []);
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  }, [year]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

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
    { key: "month", label: "Period", sortable: true, width: 130, render: (v, row) => `${monthName(v)} ${row.year}` },
    { key: "paidDays", label: "Paid Days", width: 100 },
    { key: "gross", label: "Gross", sortable: true, width: 110, render: (v) => inr(v) },
    { key: "totalDeductions", label: "Deductions", width: 110, render: (v) => inr(v) },
    { key: "net", label: "Net", sortable: true, width: 110, render: (v) => <strong>{inr(v)}</strong> },
    {
      key: "actions", label: "", type: "actions", width: 90, hideable: false,
      actions: (row) => (
        <a href={payrollService.payslipPdfUrl(row.payslipId)} target="_blank" rel="noreferrer" className="btn btn-ghost btn-xs" style={{ display: "inline-flex", alignItems: "center", gap: 4 }} onClick={e => e.stopPropagation()}>
          <ExternalLink size={11} strokeWidth={2} /> PDF
        </a>
      ),
    },
  ], []);

  return (
    <PageShell
      header={
        <PageHeader
          title="History"
          tag="Payroll"
          subtitle={`${payslips.length} payslip${payslips.length === 1 ? "" : "s"}`}
          actions={
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--yd-text-soft)" }}>
              Year <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="yd-input" style={{ width: 100 }} />
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
        tableId="payroll-history"
        columns={columns}
        data={payslips}
        loading={loading}
        entityLabel="payslips"
        searchPlaceholder="Search employee…"
        exportFilename={`payroll-history-${year}`}
        exportTitle={`Payroll History ${year}`}
        exportFormats={["csv", "excel", "print"]}
        empty={{ title: `No payslips for ${year}` }}
      />
    </PageShell>
  );
}
