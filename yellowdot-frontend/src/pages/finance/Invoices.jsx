/**
 * Invoices.jsx — every bill raised, and how to settle one
 * ─────────────────────────────────────────────────────────────────
 * Recording a payment happens here, against a specific invoice, because
 * that is the only way the API accepts one. The response carries the
 * updated invoice back, so the row refreshes to "Paid" from the same
 * round trip that recorded the money — no second fetch, and no window in
 * which the payment exists but the invoice still says Pending.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { PageHeader, Table, StatusBadge, Button, Drawer, Input, Select } from "../../components/ui";
import { INR } from "../../utils/currency";
import financeApi from "../../services/financeApi";
import FinanceNav from "./FinanceNav";

const MODES = ["Cash", "UPI", "Card", "BankTransfer", "Cheque", "Other"];
const STATUSES = ["All", "Pending", "Partial", "Paid", "Overdue"];

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [filter,   setFilter]   = useState("All");

  const [target,  setTarget]  = useState(null);   // invoice being settled
  const [form,    setForm]    = useState({ amount: "", paymentMode: "UPI", transactionId: "", paymentDate: "" });
  const [saving,  setSaving]  = useState(false);
  const [formErr, setFormErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await financeApi.invoices.list();
      setInvoices(r.invoices || []);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Couldn't load invoices.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(
    () => (filter === "All" ? invoices : invoices.filter(i => i.status === filter)),
    [invoices, filter]
  );

  function openPayment(inv) {
    if (inv.balance <= 0) return;               // nothing left to collect
    setTarget(inv);
    setForm({ amount: String(inv.balance), paymentMode: "UPI", transactionId: "", paymentDate: "" });
    setFormErr("");
  }

  async function submitPayment() {
    setSaving(true); setFormErr("");
    try {
      const { invoice } = await financeApi.payments.record({
        invoiceId:     target.invoiceId,
        amount:        Number(form.amount),
        paymentMode:   form.paymentMode,
        transactionId: form.transactionId,
        paymentDate:   form.paymentDate || undefined,
      });
      // The API returns the settled invoice — patch it in rather than refetch.
      setInvoices(prev => prev.map(i => (i.invoiceId === invoice.invoiceId ? invoice : i)));
      setTarget(null);
    } catch (e) {
      setFormErr(e?.response?.data?.error || e.message || "Couldn't record the payment.");
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    { key: "invoiceNumber", label: "Invoice",
      render: (v, r) => (
        <div>
          <div style={{ fontFamily: "monospace", fontSize: 12 }}>{v || "—"}</div>
          <div style={{ fontSize: 11, color: "var(--yd-text-3)" }}>{r.period}</div>
        </div>
      ) },
    { key: "studentName", label: "Student",
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v || "—"}</div>
          <div style={{ fontSize: 11, color: "var(--yd-text-3)" }}>{r.studentId} · {r.class || "—"}</div>
        </div>
      ) },
    { key: "feeType", label: "Fee" },
    { key: "dueDate", label: "Due" },
    { key: "totalAmount", label: "Amount",  align: "right", render: v => INR(v) },
    { key: "balance",     label: "Balance", align: "right",
      render: v => <span style={{ fontWeight: 700, color: v > 0 ? "var(--yd-danger)" : "var(--yd-text-3)" }}>{INR(v)}</span> },
    { key: "status", label: "Status", render: v => <StatusBadge status={v} /> },
    { key: "invoiceId", label: "", align: "right",
      render: (_v, r) => (
        r.balance > 0
          ? <Button size="xs" variant="primary" onClick={(e) => { e.stopPropagation(); openPayment(r); }}>Record payment</Button>
          : <span style={{ fontSize: 11, color: "var(--yd-success)" }}>Settled</span>
      ) },
  ];

  return (
    <div className="yd-page">
      <Sidebar />
      <div className="yd-content" style={{ padding: 24, overflow: "auto" }}>
        <PageHeader title="Invoices" subtitle={`${invoices.length} raised`} />
        <FinanceNav />

        {error && (
          <div style={{
            background: "var(--yd-danger-soft)", border: "1px solid var(--yd-danger-border)",
            color: "var(--yd-danger)", borderRadius: 10, padding: "10px 14px",
            fontSize: 13, marginBottom: 16,
          }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {STATUSES.map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{
                padding: "5px 12px", fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: "pointer",
                border: `1px solid ${filter === s ? "var(--yd-yellow)" : "var(--yd-border)"}`,
                background: filter === s ? "var(--yd-yellow-soft)" : "var(--yd-surface)",
                color: "var(--yd-text)",
              }}>{s}</button>
          ))}
        </div>

        <Table
          columns={columns}
          data={shown}
          loading={loading}
          empty={{ icon: "🧾", title: "No invoices",
                   description: "Generate this month's invoices from the Fees tab." }}
        />

        <Drawer
          isOpen={!!target}
          onClose={() => setTarget(null)}
          title={target ? `Record payment — ${target.studentName}` : ""}
        >
          {target && (
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ background: "var(--yd-bg)", borderRadius: 10, padding: 12, fontSize: 13 }}>
                <div>{target.invoiceNumber} · {target.feeType}</div>
                <div style={{ color: "var(--yd-text-3)", fontSize: 12, marginTop: 2 }}>
                  Total {INR(target.totalAmount)} · already paid {INR(target.paidAmount)}
                </div>
                <div style={{ fontWeight: 800, marginTop: 6 }}>Outstanding {INR(target.balance)}</div>
              </div>

              <Input
                label="Amount"
                type="number"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                hint={`Cannot exceed the ${INR(target.balance)} outstanding.`}
              />
              <Select
                label="Mode"
                value={form.paymentMode}
                onChange={e => setForm(f => ({ ...f, paymentMode: e.target.value }))}
                options={MODES.map(m => ({ value: m, label: m }))}
              />
              <Input
                label="Transaction / reference"
                value={form.transactionId}
                onChange={e => setForm(f => ({ ...f, transactionId: e.target.value }))}
                placeholder="UPI ref, cheque no., …"
              />
              <Input
                label="Date received"
                type="date"
                value={form.paymentDate}
                onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))}
                hint="Leave blank for today."
              />

              {formErr && (
                <div style={{ color: "var(--yd-danger)", fontSize: 12, fontWeight: 600 }}>{formErr}</div>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Button variant="outline" onClick={() => setTarget(null)}>Cancel</Button>
                <Button variant="primary" onClick={submitPayment}
                        disabled={saving || !(Number(form.amount) > 0)}>
                  {saving ? "Recording…" : `Record ${INR(Number(form.amount) || 0)}`}
                </Button>
              </div>
            </div>
          )}
        </Drawer>
      </div>
    </div>
  );
}
