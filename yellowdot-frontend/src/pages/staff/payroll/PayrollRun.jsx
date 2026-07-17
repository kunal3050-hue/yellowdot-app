/**
 * PayrollRun.jsx — Process / view a monthly payroll run + per-employee payslip preview
 * Design System v2 / Platform Layout Standard retrofit: PageShell +
 * PageHeader + KpiRow + DataTable + StatusBadge. Same payrollService calls.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import payrollService from "../../../services/payrollService";
import { PageShell, PageHeader, KpiRow, KpiCard, DataTable, StatusBadge, Select } from "../../../components/ui";
import { inr, monthName } from "./_shared";

export default function PayrollRun() {
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear]   = useState(Number(sp.get("year"))  || now.getFullYear());
  const [month, setMonth] = useState(Number(sp.get("month")) || (now.getMonth() + 1));

  const [run, setRun]         = useState(null);
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const runs = await payrollService.listRuns();
      const match = (runs.runs || []).find(r => r.year === year && r.month === month) || null;
      setRun(match);
      if (match) {
        const ps = await payrollService.listPayslips({ runId: match.runId });
        if (ps?.success) setPayslips(ps.payslips || []);
      } else {
        setPayslips([]);
      }
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  }, [year, month]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const next = new URLSearchParams(sp);
    next.set("year", String(year));
    next.set("month", String(month));
    setSp(next, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  async function process() {
    setBusy(true); setError("");
    try {
      const res = await payrollService.processRun(year, month);
      if (res?.success) await load();
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setBusy(false); }
  }

  async function lock() {
    if (!run) return;
    if (!window.confirm("Lock this payroll run? Locked runs cannot be re-processed without explicit unlock.")) return;
    setBusy(true);
    try { await payrollService.lockRun(run.runId); await load(); }
    catch (err) { alert(err.response?.data?.error || err.message); }
    finally { setBusy(false); }
  }

  async function reopen() {
    if (!run) return;
    setBusy(true);
    try { await payrollService.reopenRun(run.runId); await load(); }
    catch (err) { alert(err.response?.data?.error || err.message); }
    finally { setBusy(false); }
  }

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: monthName(i + 1) }));

  const secondaryActions = [];
  if (run && run.status === "processed") secondaryActions.push({ key: "lock", label: "Lock", onClick: lock, disabled: busy });
  if (run && run.status === "locked")    secondaryActions.push({ key: "reopen", label: "Reopen", onClick: reopen, disabled: busy });

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
    { key: "paidDays", label: "Paid Days", width: 100 },
    { key: "lopDays", label: "LOP", width: 80, render: (v) => v || "—" },
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
          title={`Run · ${monthName(month)} ${year}`}
          tag="Payroll"
          backLabel="Back to Payroll"
          onBack={() => navigate("/staff/payroll")}
          subtitle={run && <StatusBadge status={run.status} />}
          primaryAction={(!run || run.status === "draft" || run.status === "processed")
            ? { label: busy ? "Processing…" : run ? "Re-process" : "Process Payroll", onClick: process, disabled: busy }
            : undefined}
          secondaryActions={secondaryActions}
        />
      }
      kpis={run && (
        <KpiRow maxWidth={640}>
          <KpiCard label="Employees" value={run.totals?.employees || 0} />
          <KpiCard label="Gross" value={inr(run.totals?.gross)} />
          <KpiCard label="Deductions" value={inr(run.totals?.deductions)} />
          <KpiCard label="Net Payable" value={inr(run.totals?.net)} />
        </KpiRow>
      )}
    >
      {error && (
        <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--yd-text-soft)" }}>
          Year <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="yd-input" style={{ width: 100 }} />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--yd-text-soft)" }}>
          Month <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} options={monthOptions} />
        </label>
      </div>

      <DataTable
        tableId="payroll-run-payslips"
        columns={columns}
        data={payslips}
        loading={loading}
        entityLabel="payslips"
        searchPlaceholder="Search employee…"
        empty={{ title: !run ? `No run for ${monthName(month)} ${year}` : "Run exists but has no payslips", description: !run ? 'Click "Process Payroll" to create one.' : "Make sure staff salaries are configured." }}
      />
    </PageShell>
  );
}
