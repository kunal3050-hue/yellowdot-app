/**
 * useStudentFinance — invoices/payments/summary + monthly payment-history
 * trend. Same financeService helpers already used elsewhere (ParentLedger,
 * the original inline FeesTab) -- no new endpoints.
 */
import { useState, useEffect, useMemo, useRef } from "react";
import { fetchStudentInvoices, fetchStudentPayments, computeLedgerSummary } from "../../../services/financeService";

export default function useStudentFinance(studentId) {
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading,  setLoading ] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!studentId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([fetchStudentInvoices(studentId), fetchStudentPayments(studentId)])
      .then(([inv, pay]) => { if (mountedRef.current) { setInvoices(inv); setPayments(pay); } })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false); });
    return () => { mountedRef.current = false; };
  }, [studentId]);

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

  return { invoices, payments, loading, summary, upcoming, paymentHistory };
}
