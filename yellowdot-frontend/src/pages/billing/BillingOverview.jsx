/**
 * BillingOverview.jsx — "how is collection this month, and who hasn't paid"
 * ─────────────────────────────────────────────────────────────────────────────
 * The one screen Billing opens to, and the module's single dashboard.
 *
 * The audit's third finding was that finance KPIs were computed independently
 * in three places (LiveDashboard, Collections, Analytics) with overlapping,
 * sometimes-inconsistent numbers. This screen computes nothing: every figure
 * comes from GET /api/billing/summary and GET /api/billing/outstanding, which
 * are the only two aggregations in the module, so no two surfaces can disagree
 * about what a family owes.
 *
 * Design System v2 / Platform Layout Standard: PageShell → PageHeader → KpiRow
 * → DataTable, inside MainLayout's own `.yd-scroll-area`. No Sidebar here and
 * no full-viewport wrapper — the pre-deletion finance pages rendered their own
 * shell, which the audit called out as an architectural inconsistency.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Receipt } from "lucide-react";
import {
  PageShell, PageHeader, KpiRow, KpiCard, DataTable, Badge, StatusBadge,
  Tabs, PageError,
} from "../../components/ui";
import billingService from "../../services/billingService";
import { inr, prettyDate, AGING_BUCKETS } from "./billingMeta";

/** The children in one family, as a compact run of names. */
function ChildrenCell({ children: kids }) {
  const visible = kids.slice(0, 2);
  const extra   = kids.length - visible.length;
  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}
      title={kids.map(k => k.studentName).join(", ")}
    >
      {visible.map(k => <Badge key={k.studentId} variant="neutral">{k.studentName}</Badge>)}
      {extra > 0 && <span style={{ fontSize: 11, color: "var(--yd-text-muted)" }}>+{extra}</span>}
    </span>
  );
}

/**
 * How the outstanding money is spread across how overdue it is. Read straight
 * off the summary rather than bucketed here, so the dashboard and any later
 * report cannot bucket it differently.
 */
function AgingStrip({ aging, total }) {
  const rows = AGING_BUCKETS
    .map(b => ({ ...b, amount: Number(aging?.[b.key]) || 0 }))
    .filter(b => b.amount > 0);

  if (rows.length === 0) return null;

  return (
    <div className="yd-aging">
      <div className="yd-aging__title">Outstanding by age</div>
      <div className="yd-aging__bars">
        {rows.map(b => (
          <div key={b.key} className="yd-aging__row">
            <span className="yd-aging__label">{b.label}</span>
            <span className="yd-aging__track">
              <span
                className={`yd-aging__fill yd-aging__fill--${b.key === "current" ? "current" : "due"}`}
                style={{ width: total > 0 ? `${Math.max(2, (b.amount / total) * 100)}%` : "2%" }}
              />
            </span>
            <span className="yd-aging__amount">{inr(b.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BillingOverview() {
  const navigate = useNavigate();

  const [summary,  setSummary]  = useState(null);
  const [students, setStudents] = useState([]);
  const [families, setFamilies] = useState([]);
  const [totals,   setTotals]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [view,     setView]     = useState("families");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [s, o] = await Promise.all([
        billingService.getSummary(),
        billingService.getOutstanding(),
      ]);
      if (s?.success) setSummary(s.summary || null);
      if (o?.success) {
        setStudents(o.students || []);
        setFamilies(o.families || []);
        setTotals(o.totals || null);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not load billing.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const familyColumns = useMemo(() => [
    {
      key: "children", label: "Family", width: 260, sortable: false,
      render: (v) => (v?.length ? <ChildrenCell>{v}</ChildrenCell> : "—"),
    },
    {
      key: "childCount", label: "Children", width: 100, sortable: true,
      render: (v) => v || 0,
    },
    { key: "billed",  label: "Billed",  width: 120, sortable: true, render: (v) => inr(v) },
    { key: "paid",    label: "Paid",    width: 120, sortable: true, render: (v) => inr(v) },
    {
      key: "balance", label: "Outstanding", width: 130, sortable: true,
      render: (v) => (
        <strong style={{ color: v > 0 ? "var(--yd-danger)" : "var(--yd-text-muted)" }}>
          {inr(v)}
        </strong>
      ),
    },
    {
      key: "status", label: "Status", width: 130, sortable: true, filterable: true,
      filterType: "select",
      filterOptions: [
        { value: "Overdue", label: "Overdue" },
        { value: "Outstanding", label: "Outstanding" },
        { value: "Clear", label: "Clear" },
      ],
      render: (v) => <StatusBadge status={v} />,
    },
  ], []);

  const studentColumns = useMemo(() => [
    { key: "studentName", label: "Child", width: 200, sortable: true, filterable: true },
    { key: "class", label: "Class", width: 130, sortable: true, filterable: true, filterType: "select" },
    { key: "invoiceCount", label: "Invoices", width: 100, sortable: true },
    { key: "billed", label: "Billed", width: 120, sortable: true, render: (v) => inr(v) },
    { key: "paid",   label: "Paid",   width: 120, sortable: true, render: (v) => inr(v) },
    {
      key: "balance", label: "Outstanding", width: 130, sortable: true,
      render: (v) => (
        <strong style={{ color: v > 0 ? "var(--yd-danger)" : "var(--yd-text-muted)" }}>
          {inr(v)}
        </strong>
      ),
    },
    {
      key: "oldestDueDate", hidden: true, label: "Oldest due", width: 130, sortable: true,
      render: (v) => (v ? prettyDate(v) : "—"),
    },
    {
      key: "status", label: "Status", width: 140, sortable: true, filterable: true,
      filterType: "select",
      filterOptions: [
        { value: "Overdue", label: "Overdue" },
        { value: "Outstanding", label: "Outstanding" },
        { value: "Clear", label: "Clear" },
        { value: "No Invoices", label: "No Invoices" },
      ],
      render: (v) => <StatusBadge status={v} />,
    },
  ], []);

  if (error && !summary) {
    return (
      <PageShell header={<PageHeader title="Billing" tag="Billing & Payments" />}>
        <PageError message={error} onRetry={load} />
      </PageShell>
    );
  }

  const outstanding = summary?.outstanding ?? 0;

  return (
    <PageShell
      header={
        <PageHeader
          title="Billing"
          tag="Billing & Payments"
          subtitle={
            totals
              ? `${totals.families} famil${totals.families === 1 ? "y" : "ies"} · ${totals.invoices} invoice${totals.invoices === 1 ? "" : "s"}`
              : "Fees, invoices and payments"
          }
          onRefresh={load}
          primaryAction={{
            label: "Invoices",
            icon: <Receipt size={14} strokeWidth={2} />,
            onClick: () => navigate("/billing/invoices"),
          }}
          secondaryActions={[
            { key: "plans", label: "Fee Plans", onClick: () => navigate("/billing/plans") },
          ]}
        />
      }
      kpis={
        <KpiRow>
          <KpiCard
            label="Collected today"
            value={inr(summary?.collectedToday ?? 0)}
            loading={loading}
          />
          <KpiCard
            label="Collected this month"
            value={inr(summary?.collectedThisMonth ?? 0)}
            comparison={summary ? `${summary.collectionRate}% of ${inr(summary.billedThisMonth)} billed` : undefined}
            loading={loading}
          />
          <KpiCard
            label="Outstanding"
            value={inr(outstanding)}
            comparison={totals ? `across ${totals.families} famil${totals.families === 1 ? "y" : "ies"}` : undefined}
            loading={loading}
          />
          <KpiCard
            label="Overdue"
            value={inr(summary?.overdueAmount ?? 0)}
            comparison={summary ? `${summary.overdueCount} invoice${summary.overdueCount === 1 ? "" : "s"} past due` : undefined}
            loading={loading}
          />
        </KpiRow>
      }
    >
      {summary && <AgingStrip aging={summary.aging} total={outstanding} />}

      <Tabs
        tabs={[
          { id: "families", label: `By family (${families.length})` },
          { id: "students", label: `By child (${students.length})` },
        ]}
        activeTab={view}
        onChange={setView}
      />

      {view === "families" ? (
        <DataTable
          tableId="billing-outstanding-families"
          columns={familyColumns}
          data={families}
          loading={loading}
          entityLabel="families"
          searchPlaceholder="Search families…"
          exportFilename="outstanding-by-family"
          exportTitle="Outstanding by family"
          empty={{
            title: "Nothing billed yet",
            description: "Set up a fee plan, then run the month's billing to raise invoices.",
            action: { label: "Set up fee plans", onClick: () => navigate("/billing/plans") },
          }}
          emptyIllustration={<Users size={28} strokeWidth={1.5} />}
        />
      ) : (
        <DataTable
          tableId="billing-outstanding-students"
          columns={studentColumns}
          data={students}
          loading={loading}
          entityLabel="children"
          searchPlaceholder="Search children…"
          exportFilename="outstanding-by-child"
          exportTitle="Outstanding by child"
          onRowClick={(row) => navigate(`/billing/invoices?studentId=${encodeURIComponent(row.studentId)}`)}
          empty={{
            title: "Nothing billed yet",
            description: "Set up a fee plan, then run the month's billing to raise invoices.",
            action: { label: "Set up fee plans", onClick: () => navigate("/billing/plans") },
          }}
          emptyIllustration={<Users size={28} strokeWidth={1.5} />}
        />
      )}
    </PageShell>
  );
}
