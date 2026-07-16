/**
 * FeesTab — adds a KpiCard summary + payment-history chart above the
 * existing <ParentLedger>, which is left completely unchanged (same
 * Summary/Ledger/Invoices/Payments sub-tabs + Export CSV/Print). The
 * summary reuses financeService's existing fetchStudentInvoices/
 * fetchStudentPayments/computeLedgerSummary -- no new endpoints, and
 * zero changes to ParentLedger.jsx or financeService.js.
 */
import { useState, useEffect, useMemo, useRef } from "react";
import { KpiCard, LineChart, Button } from "../../../components/ui";
import ParentLedger from "../../../components/ParentLedger";
import { fetchStudentInvoices, fetchStudentPayments, computeLedgerSummary } from "../../../services/financeService";

function inr(n) {
  const v = Number(n) || 0;
  if (v >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`;
  if (v >= 1_000)    return `₹${(v / 1_000).toFixed(1)}k`;
  return `₹${v.toLocaleString("en-IN")}`;
}

export default function FeesTab({ student }) {
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading,  setLoading ] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const sid = student.Student_ID;
    if (!sid) { setLoading(false); return; }
    Promise.all([fetchStudentInvoices(sid), fetchStudentPayments(sid)])
      .then(([inv, pay]) => { if (mountedRef.current) { setInvoices(inv); setPayments(pay); } })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false); });
    return () => { mountedRef.current = false; };
  }, [student.Student_ID]);

  const summary = useMemo(() => computeLedgerSummary(invoices), [invoices]);

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return invoices
      .filter(i => (i.status || i.Payment_Status) !== "Paid" && (i.status || i.Payment_Status) !== "Overdue")
      .filter(i => (i.dueDate || "") >= today)
      .reduce((s, i) => s + (Number(i.balance ?? i.Balance) || 0), 0);
  }, [invoices]);

  const paymentHistory = useMemo(() => {
    const byMonth = {};
    payments.forEach(p => {
      const raw = p.paymentDate || p.createdAt;
      if (!raw) return;
      const month = String(raw).slice(0, 7);
      byMonth[month] ??= { month, amount: 0 };
      byMonth[month].amount += Number(p.amount) || 0;
    });
    return Object.values(byMonth)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6)
      .map(m => ({ ...m, month: new Date(`${m.month}-01`).toLocaleDateString("en-IN", { month: "short" }) }));
  }, [payments]);

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: "var(--yd-charcoal)" }}>Fees</h3>
        <Button as="a" href="/generate-invoice" size="xs" variant="primary">+ Invoice</Button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
        <KpiCard label="Total Due" value={inr(summary.totalBilled)} loading={loading} />
        <KpiCard label="Paid" value={inr(summary.totalPaid)} loading={loading} />
        <KpiCard label="Overdue" value={inr(summary.overdue)} loading={loading} />
        <KpiCard label="Upcoming" value={inr(upcoming)} loading={loading} />
      </div>

      {!loading && paymentHistory.length > 1 && (
        <LineChart
          title="Payment History" subtitle="Last 6 months"
          data={paymentHistory} xKey="month"
          series={[{ key: "amount", label: "Amount" }]}
          valueFormatter={(v) => inr(v)}
          showLegend={false}
          height={200}
        />
      )}

      <ParentLedger student={student} />
    </div>
  );
}
