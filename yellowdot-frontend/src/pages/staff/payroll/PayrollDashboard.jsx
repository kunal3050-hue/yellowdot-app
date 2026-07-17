/**
 * PayrollDashboard.jsx — KPIs + recent runs + jump links to components/structures/staff salary
 * Design System v2 / Platform Layout Standard retrofit: PageShell +
 * PageHeader + KpiRow + StatusBadge. Same payrollService.listRuns call.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import payrollService from "../../../services/payrollService";
import { PageShell, PageHeader, KpiRow, KpiCard, StatusBadge, SkeletonTable } from "../../../components/ui";
import { inr, monthName } from "./_shared";

export default function PayrollDashboard() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await payrollService.listRuns();
      if (r?.success) setRuns(r.runs || []);
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const latest    = runs[0];
  const ytd       = runs.filter(r => r.year === new Date().getFullYear());
  const ytdNet    = ytd.reduce((s, r) => s + (r.totals?.net || 0), 0);
  const ytdEmps   = latest ? latest.totals?.employees : 0;

  return (
    <PageShell
      header={
        <PageHeader
          title="Dashboard"
          tag="Payroll"
          primaryAction={{ label: "Process Payroll", onClick: () => navigate("/staff/payroll/run") }}
          secondaryActions={[
            { key: "staff", label: "Staff Salaries", onClick: () => navigate("/staff/payroll/staff") },
            { key: "structures", label: "Structures", onClick: () => navigate("/staff/payroll/structures") },
            { key: "components", label: "Components", onClick: () => navigate("/staff/payroll/components") },
            { key: "bank", label: "Bank Report", onClick: () => navigate("/staff/payroll/bank") },
          ]}
        />
      }
      kpis={
        <KpiRow>
          <KpiCard label="Latest Run" value={latest ? `${monthName(latest.month)} ${latest.year}` : "—"} trendLabel={latest ? undefined : "No runs yet"} loading={loading} />
          <KpiCard label="Latest Net Pay" value={inr(latest?.totals?.net || 0)} trendLabel={`${latest?.totals?.employees || 0} employees`} loading={loading} />
          <KpiCard label="YTD Net Paid" value={inr(ytdNet)} trendLabel={`${ytd.length} run(s) this year`} loading={loading} />
          <KpiCard label="Active Staff" value={ytdEmps || 0} trendLabel="From latest run" loading={loading} />
        </KpiRow>
      }
    >
      {error && (
        <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--yd-charcoal)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Recent Payroll Runs</div>
      <div className="yd-card" style={{ overflow: "hidden", padding: 0 }}>
        {loading ? (
          <div style={{ padding: 20 }}><SkeletonTable rows={5} columns={7} /></div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 760 }}>
              <thead style={{ background: "var(--yd-soft)", borderBottom: "1px solid var(--yd-border)" }}>
                <tr>
                  <th style={th}>Period</th>
                  <th style={th}>Status</th>
                  <th style={th}>Employees</th>
                  <th style={th}>Gross</th>
                  <th style={th}>Deductions</th>
                  <th style={th}>Net</th>
                  <th style={th}>Processed</th>
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--yd-text-muted)" }}>No payroll runs yet. Use Process Payroll to create the first one.</td></tr>
                )}
                {runs.map(r => (
                  <tr key={r.runId} style={{ borderBottom: "1px solid var(--yd-border-light)", cursor: "pointer" }}
                      onClick={() => navigate(`/staff/payroll/run?year=${r.year}&month=${r.month}`)}>
                    <td style={td}>{monthName(r.month)} {r.year}</td>
                    <td style={td}><StatusBadge status={r.status} /></td>
                    <td style={td}>{r.totals?.employees || 0}</td>
                    <td style={td}>{inr(r.totals?.gross)}</td>
                    <td style={td}>{inr(r.totals?.deductions)}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{inr(r.totals?.net)}</td>
                    <td style={td}>{r.processedAt ? r.processedAt.slice(0, 10) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}

const th = { textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--yd-text-muted)" };
const td = { padding: "10px 14px", fontSize: 13, color: "var(--yd-text)" };
