/**
 * Payments.jsx — money received
 * ─────────────────────────────────────────────────────────────────
 * Read-only. Payments are created against an invoice from the Invoices
 * tab, never standalone — a payment with no invoice is exactly the
 * orphaned record the previous module accumulated.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { PageHeader, Table, Badge, StatsCard } from "../../components/ui";
import { INR } from "../../utils/currency";
import financeApi from "../../services/financeApi";
import FinanceNav from "./FinanceNav";

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await financeApi.payments.list();
      setPayments(r.payments || []);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Couldn't load payments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const total = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const thisMonth = payments
      .filter(p => (p.paymentDate || "").slice(0, 7) === new Date().toISOString().slice(0, 7))
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return { total, thisMonth, count: payments.length };
  }, [payments]);

  const columns = [
    { key: "receiptNumber", label: "Receipt",
      render: v => <span style={{ fontFamily: "monospace", fontSize: 12 }}>{v || "—"}</span> },
    { key: "paymentDate", label: "Date" },
    { key: "studentName", label: "Student",
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v || "—"}</div>
          <div style={{ fontSize: 11, color: "var(--yd-text-3)" }}>{r.studentId}</div>
        </div>
      ) },
    { key: "paymentMode", label: "Mode", render: v => <Badge>{v || "—"}</Badge> },
    { key: "transactionId", label: "Reference",
      render: v => <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--yd-text-3)" }}>{v || "—"}</span> },
    { key: "invoiceNumber", label: "Invoice",
      render: v => <span style={{ fontFamily: "monospace", fontSize: 12 }}>{v || "—"}</span> },
    { key: "amount", label: "Amount", align: "right",
      render: v => <span style={{ fontWeight: 700, color: "var(--yd-success)" }}>{INR(v)}</span> },
  ];

  return (
    <div className="yd-page">
      <Sidebar />
      <div className="yd-content" style={{ padding: 24, overflow: "auto" }}>
        <PageHeader title="Payments" subtitle={`${stats.count} received`} />
        <FinanceNav />

        {error && (
          <div style={{
            background: "var(--yd-danger-soft)", border: "1px solid var(--yd-danger-border)",
            color: "var(--yd-danger)", borderRadius: 10, padding: "10px 14px",
            fontSize: 13, marginBottom: 16,
          }}>{error}</div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 20 }}>
          <StatsCard label="Payments"   value={stats.count} />
          <StatsCard label="This month" value={INR(stats.thisMonth)} color="var(--yd-success)" />
          <StatsCard label="All time"   value={INR(stats.total)} />
        </div>

        <Table
          columns={columns}
          data={payments}
          loading={loading}
          empty={{ icon: "💵", title: "No payments yet",
                   description: "Record a payment against an invoice from the Invoices tab." }}
        />
      </div>
    </div>
  );
}
