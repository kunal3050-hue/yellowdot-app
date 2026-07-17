/**
 * LeaveDashboard.jsx — KPIs + recent leave requests + my balances widget
 * Design System v2 / Platform Layout Standard retrofit: PageShell +
 * PageHeader + KpiRow + StatusBadge. Same leaveService calls/shape.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import leaveService from "../../../services/leaveService";
import { PageShell, PageHeader, KpiRow, KpiCard, StatusBadge, Card, SkeletonTable } from "../../../components/ui";

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--yd-charcoal)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
      {children}
    </div>
  );
}

export default function LeaveDashboard() {
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [myBalances, setMy]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [d, b] = await Promise.all([
        leaveService.dashboard(),
        leaveService.myBalances().catch(() => ({ balances: [] })),
      ]);
      if (d?.success) setData(d);
      setMy(b?.balances || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  return (
    <PageShell
      header={
        <PageHeader
          title="Dashboard"
          tag="Leave Management"
          primaryAction={{ label: "Apply Leave", onClick: () => navigate("/staff/leave/apply") }}
          secondaryActions={[
            { key: "approvals", label: "Approvals", onClick: () => navigate("/staff/leave/approvals") },
            { key: "calendar", label: "Calendar", onClick: () => navigate("/staff/leave/calendar") },
            { key: "reports", label: "Reports", onClick: () => navigate("/staff/leave/reports") },
          ]}
        />
      }
      kpis={
        <KpiRow>
          <KpiCard label="Total Requests" value={data?.total ?? 0} loading={loading} />
          <KpiCard label="Pending Approval" value={data?.pending ?? 0} loading={loading} onClick={() => navigate("/staff/leave/approvals")} />
          <KpiCard label="Approved (MTD)" value={data?.approvedThisMonth ?? 0} loading={loading} />
          <KpiCard label="On Leave Today" value={data?.onLeaveToday ?? 0} loading={loading} />
        </KpiRow>
      }
    >
      {error && (
        <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {myBalances.length > 0 && (
        <>
          <SectionLabel>My Leave Balances ({myBalances[0]?.year})</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12, marginBottom: 24 }}>
            {myBalances.map(b => (
              <Card key={b.balanceId} padding="14px 16px">
                <div style={{ fontSize: 11, color: "var(--yd-text-muted)", fontWeight: 600, textTransform: "uppercase" }}>{b.leaveCode} · {b.leaveName}</div>
                <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700, color: "var(--yd-charcoal)" }}>{b.remaining}</div>
                <div style={{ fontSize: 11, color: "var(--yd-text-soft)" }}>of {b.entitled + b.carriedForward} · used {b.used}{b.pending ? ` · pending ${b.pending}` : ""}</div>
              </Card>
            ))}
          </div>
        </>
      )}

      <SectionLabel>Recent Requests</SectionLabel>
      <div className="yd-card" style={{ overflow: "hidden", padding: 0 }}>
        {loading ? (
          <div style={{ padding: 20 }}><SkeletonTable rows={5} columns={7} /></div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 880 }}>
              <thead style={{ background: "var(--yd-soft)", borderBottom: "1px solid var(--yd-border)" }}>
                <tr>
                  <th style={th}>Employee</th>
                  <th style={th}>Leave Type</th>
                  <th style={th}>From</th>
                  <th style={th}>To</th>
                  <th style={th}>Days</th>
                  <th style={th}>Status</th>
                  <th style={th}>Applied</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recent || []).length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--yd-text-muted)" }}>No leave requests yet.</td></tr>
                )}
                {(data?.recent || []).map(r => (
                  <tr key={r.requestId} style={{ borderBottom: "1px solid var(--yd-border-light)", cursor: "pointer" }}
                      onClick={() => navigate(`/staff/leave/approvals?focus=${r.requestId}`)}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{r.displayName}</div>
                      <div style={{ fontSize: 11, color: "var(--yd-text-muted)", fontFamily: "ui-monospace, Cascadia Code, monospace" }}>{r.employeeCode}</div>
                    </td>
                    <td style={td}>{r.leaveName} <span style={{ color: "var(--yd-text-muted)", fontSize: 11 }}>({r.leaveCode})</span></td>
                    <td style={td}>{r.fromDate}</td>
                    <td style={td}>{r.toDate}</td>
                    <td style={td}>{r.days}</td>
                    <td style={td}><StatusBadge status={r.status} /></td>
                    <td style={td}>{r.appliedAt ? r.appliedAt.slice(0, 10) : "—"}</td>
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
