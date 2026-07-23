/**
 * FinanceDashboard.jsx — Finance Dashboard screen
 * ─────────────────────────────────────────────────────────────────────────
 * Design System v2: PageShell -> PageHeader -> FinanceSubNav -> KpiRow ->
 * quick actions -> Recent Payments / Recent Invoices. Every KPI is computed
 * from real data returned by the school-wide list endpoints (no sample/
 * placeholder values) — see docs/finance-design/13_FINANCE_UI_DESIGN_SYSTEM.md §4.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Wallet, BookOpen, Repeat } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { ROUTES } from "../../config/permissions";
import financeApi from "../../services/financeApi";
import FinanceSubNav from "./components/FinanceSubNav";
import FinancePlatformDisabled from "./components/FinancePlatformDisabled";
import useFinancePlatformStatus from "./hooks/useFinancePlatformStatus";
import {
  PageShell, PageHeader, KpiRow, KpiCard, DataTable, QuickActionCard,
} from "../../components/ui";

function formatMoney(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function isToday(dateStr) {
  if (!dateStr) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr.slice(0, 10) === today;
}

function isThisMonth(dateStr) {
  if (!dateStr) return false;
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return dateStr.slice(0, 7) === ym;
}

export default function FinanceDashboard() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const canApproveRefunds = can(ROUTES.FINANCE_REFUND_APPROVAL);
  const { enabled: financeEnabled } = useFinancePlatformStatus();

  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [familyAccounts, setFamilyAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (financeEnabled === null) return; // still checking platform status
    if (financeEnabled === false) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const calls = [
        financeApi.invoices.list(),
        financeApi.payments.list(),
        financeApi.familyAccount.list(),
      ];
      if (canApproveRefunds) calls.push(financeApi.refunds.list({ status: "Requested" }));

      const results = await Promise.all(calls);
      setInvoices(results[0].invoices || []);
      setPayments(results[1].payments || []);
      setFamilyAccounts(results[2].accounts || []);
      if (canApproveRefunds) setRefunds(results[3].refunds || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [financeEnabled, canApproveRefunds]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const kpis = useMemo(() => {
    const outstandingReceivables = invoices.reduce((sum, i) => sum + Math.max(0, Number(i.balance) || 0), 0);
    const collectedToday = payments.filter(p => isToday(p.paymentDate)).reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const collectedThisMonth = payments.filter(p => isThisMonth(p.paymentDate)).reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const overdueInvoices = invoices.filter(i => i.status === "Overdue");
    const overdueAmount = overdueInvoices.reduce((sum, i) => sum + Number(i.balance || 0), 0);
    const familyCredits = familyAccounts.reduce((sum, a) => sum + Number(a.creditBalance || 0), 0);
    return {
      outstandingReceivables, collectedToday, collectedThisMonth,
      overdueCount: overdueInvoices.length, overdueAmount, familyCredits,
    };
  }, [invoices, payments, familyAccounts]);

  const recentPayments = useMemo(
    () => [...payments].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 5),
    [payments]
  );
  const recentInvoices = useMemo(
    () => [...invoices].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 5),
    [invoices]
  );

  const paymentColumns = [
    { key: "receiptNumber", label: "Receipt #", width: 150 },
    { key: "familyId", label: "Family", width: 100 },
    { key: "amount", label: "Amount", width: 110, render: (v) => <span className="yd-fin-money">{formatMoney(v)}</span> },
    { key: "status", label: "Status", type: "badge", width: 130 },
  ];
  const invoiceColumns = [
    { key: "invoiceNumber", label: "Invoice #", width: 150 },
    { key: "studentId", label: "Student", width: 100 },
    { key: "totalAmount", label: "Total", width: 110, render: (v) => <span className="yd-fin-money">{formatMoney(v)}</span> },
    { key: "status", label: "Status", type: "badge", width: 120 },
  ];

  return (
    <PageShell
      header={<PageHeader title="Finance Dashboard" subtitle="An overview of billing, payments and refunds across the school" />}
      kpis={
        financeEnabled === false ? undefined : (
          <KpiRow>
            <KpiCard label="Outstanding Receivables" value={formatMoney(kpis.outstandingReceivables)} icon={<Wallet size={18} />} loading={loading} />
            <KpiCard label="Collected Today" value={formatMoney(kpis.collectedToday)} icon={<Wallet size={18} />} loading={loading} />
            <KpiCard label="Collected This Month" value={formatMoney(kpis.collectedThisMonth)} icon={<Wallet size={18} />} loading={loading} />
            <KpiCard
              label="Overdue Invoices"
              value={kpis.overdueCount}
              trendLabel={kpis.overdueCount > 0 ? `${formatMoney(kpis.overdueAmount)} overdue` : "None overdue"}
              icon={<FileText size={18} />}
              loading={loading}
            />
            {canApproveRefunds && (
              <KpiCard label="Pending Refund Approvals" value={refunds.length} icon={<BookOpen size={18} />} loading={loading} onClick={() => navigate("/finance/refunds")} />
            )}
            <KpiCard label="Family Credits" value={formatMoney(kpis.familyCredits)} icon={<Wallet size={18} />} loading={loading} />
          </KpiRow>
        )
      }
    >
      <FinanceSubNav active="dashboard" />

      {financeEnabled === false ? (
        <FinancePlatformDisabled />
      ) : (
        <>
          {error && (
            <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
            <QuickActionCard title="Generate Invoice" icon={<FileText size={20} />} onClick={() => navigate("/finance/invoices")} />
            <QuickActionCard title="Record Payment" icon={<Wallet size={20} />} onClick={() => navigate("/finance/payments")} />
            <QuickActionCard title="View Ledger" icon={<BookOpen size={20} />} onClick={() => navigate("/finance/ledger")} />
            <QuickActionCard title="Create Billing Plan" icon={<Repeat size={20} />} onClick={() => navigate("/finance/billing-plans")} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Recent Payments</h3>
              <DataTable
                tableId="finance-dashboard-recent-payments"
                columns={paymentColumns}
                data={recentPayments}
                loading={loading}
                entityLabel="payments"
                showToolbar={false}
                empty={{ title: "No recent payments" }}
              />
            </div>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Recent Invoices</h3>
              <DataTable
                tableId="finance-dashboard-recent-invoices"
                columns={invoiceColumns}
                data={recentInvoices}
                loading={loading}
                entityLabel="invoices"
                showToolbar={false}
                empty={{ title: "No recent invoices" }}
              />
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
