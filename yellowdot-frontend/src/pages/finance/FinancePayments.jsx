/**
 * FinancePayments.jsx — Payments screen
 * ─────────────────────────────────────────────────────────────────────────
 * Design System v2: PageShell -> PageHeader -> FinanceSubNav -> DataTable
 * (own toolbar). No payment gateway integration — every payment mode here
 * is a manual/offline record (Cash/UPI/BankTransfer/Cheque/Card/Other),
 * matching the backend's own explicit scope.
 */
import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import financeApi from "../../services/financeApi";
import FinanceSubNav from "./components/FinanceSubNav";
import FinancePlatformDisabled from "./components/FinancePlatformDisabled";
import useFinancePlatformStatus from "./hooks/useFinancePlatformStatus";
import {
  PageShell, PageHeader, DataTable, StatusBadge, Button, Input, Select, Drawer,
} from "../../components/ui";

function formatMoney(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const PAYMENT_MODE_OPTIONS = [
  { value: "Cash", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "BankTransfer", label: "Bank Transfer" },
  { value: "Cheque", label: "Cheque" },
  { value: "Card", label: "Card" },
  { value: "Other", label: "Other" },
];

const EMPTY_RECORD_FORM = { familyId: "", studentId: "", studentName: "", amount: "", paymentMode: "Cash", transactionId: "", notes: "" };

export default function FinancePayments() {
  const { enabled: financeEnabled } = useFinancePlatformStatus();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordForm, setRecordForm] = useState(EMPTY_RECORD_FORM);
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState("");
  const [selected, setSelected] = useState(null);
  const [allocating, setAllocating] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    if (financeEnabled === null) return; // still checking platform status
    if (financeEnabled === false) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const res = await financeApi.payments.list();
      setPayments(res.payments || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to load payments.");
    } finally {
      setLoading(false);
    }
  }, [financeEnabled]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function handleRecord() {
    if (!recordForm.familyId || !recordForm.amount) return;
    setRecording(true);
    setRecordError("");
    try {
      await financeApi.payments.record({
        familyId: recordForm.familyId,
        studentId: recordForm.studentId || undefined,
        studentName: recordForm.studentName || undefined,
        amount: Number(recordForm.amount),
        paymentMode: recordForm.paymentMode,
        transactionId: recordForm.transactionId || undefined,
        notes: recordForm.notes || undefined,
      });
      setRecordOpen(false);
      setRecordForm(EMPTY_RECORD_FORM);
      await load();
    } catch (err) {
      setRecordError(err.response?.data?.error || err.message || "Failed to record payment.");
    } finally {
      setRecording(false);
    }
  }

  async function handleAllocate(payment) {
    setAllocating(true);
    setActionError("");
    try {
      await financeApi.payments.allocate(payment.paymentId, {
        strategyOverride: "oldestDueFirst",
        applyLeftoverToCredit: true,
      });
      await load();
      const refreshed = await financeApi.payments.getOne(payment.paymentId);
      setSelected(refreshed.payment);
    } catch (err) {
      setActionError(err.response?.data?.error || err.message || "Failed to allocate payment.");
    } finally {
      setAllocating(false);
    }
  }

  async function handleReverse(payment) {
    if (!window.confirm(`Reverse payment ${payment.receiptNumber || payment.paymentId}? This posts offsetting ledger entries and cannot be undone.`)) return;
    setReversing(true);
    setActionError("");
    try {
      await financeApi.payments.reverse(payment.paymentId, "Reversed via staff UI");
      await load();
      setSelected(null);
    } catch (err) {
      setActionError(err.response?.data?.error || err.message || "Failed to reverse payment.");
    } finally {
      setReversing(false);
    }
  }

  const columns = [
    { key: "receiptNumber", label: "Receipt #", sortable: true, filterable: true, width: 170 },
    { key: "familyId", label: "Family", sortable: true, filterable: true, width: 110 },
    { key: "studentId", label: "Student", width: 100 },
    { key: "amount", label: "Amount", sortable: true, width: 120,
      render: (v) => <span className="yd-fin-money">{formatMoney(v)}</span> },
    { key: "paymentMode", label: "Mode", filterable: true, filterType: "select", filterOptions: PAYMENT_MODE_OPTIONS, width: 120 },
    { key: "status", label: "Status", type: "badge", sortable: true, filterable: true,
      filterType: "select", filterOptions: ["Recorded", "Allocated", "PartiallyAllocated", "Refunded", "PartiallyRefunded", "Reversed"], width: 150 },
    { key: "paymentDate", label: "Date", sortable: true, width: 120 },
    { key: "paymentId", label: "", type: "actions", width: 80,
      actions: (row) => (
        <Button variant="outline" size="xs" onClick={() => setSelected(row)}>View</Button>
      ) },
  ];

  return (
    <PageShell
      header={
        <PageHeader
          title="Payments"
          subtitle={`${payments.length} payment${payments.length === 1 ? "" : "s"}`}
          primaryAction={financeEnabled === false ? undefined : { label: "Record Payment", icon: <Plus size={14} strokeWidth={2} />, onClick: () => setRecordOpen(true) }}
        />
      }
    >
      <FinanceSubNav active="payments" />

      {financeEnabled === false ? (
        <FinancePlatformDisabled />
      ) : (
        <>
          {error && (
            <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
              {error}
            </div>
          )}

          <DataTable
            tableId="finance-payments"
            columns={columns}
            data={payments}
            loading={loading}
            entityLabel="payments"
            searchPlaceholder="Search receipt number, family, student…"
            exportFilename="finance-payments"
            exportTitle="Payments"
            empty={{
              title: "No payments recorded yet",
              description: "Record the family's first payment to begin.",
              action: { label: "Record Payment", onClick: () => setRecordOpen(true) },
            }}
          />
        </>
      )}

      <Drawer
        isOpen={recordOpen}
        onClose={() => setRecordOpen(false)}
        title="Record Payment"
        footer={
          <>
            <Button variant="outline" onClick={() => setRecordOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={recording} onClick={handleRecord}>Record Payment</Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {recordError && (
            <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
              {recordError}
            </div>
          )}
          <Input label="Family ID" required value={recordForm.familyId} onChange={(e) => setRecordForm(f => ({ ...f, familyId: e.target.value }))} />
          <Input label="Student ID" hint="Optional — for context on the receipt" value={recordForm.studentId} onChange={(e) => setRecordForm(f => ({ ...f, studentId: e.target.value }))} />
          <Input label="Amount" type="number" required value={recordForm.amount} onChange={(e) => setRecordForm(f => ({ ...f, amount: e.target.value }))} />
          <Select label="Payment Mode" options={PAYMENT_MODE_OPTIONS} value={recordForm.paymentMode} onChange={(e) => setRecordForm(f => ({ ...f, paymentMode: e.target.value }))} />
          <Input label="Transaction / Cheque #" hint="Optional" value={recordForm.transactionId} onChange={(e) => setRecordForm(f => ({ ...f, transactionId: e.target.value }))} />
          <Input label="Notes" hint="Optional" value={recordForm.notes} onChange={(e) => setRecordForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
      </Drawer>

      <Drawer
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title="Payment Detail"
        footer={selected && (
          <>
            {["Recorded", "PartiallyAllocated"].includes(selected.status) && (
              <Button variant="primary" loading={allocating} onClick={() => handleAllocate(selected)}>Allocate</Button>
            )}
            {!["Reversed", "Refunded"].includes(selected.status) && (
              <Button variant="danger" loading={reversing} onClick={() => handleReverse(selected)}>Reverse Payment</Button>
            )}
          </>
        )}
      >
        {selected && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {actionError && (
              <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
                {actionError}
              </div>
            )}
            <div><strong>Receipt #:</strong> {selected.receiptNumber}</div>
            <div><strong>Family:</strong> {selected.familyId}</div>
            <div><strong>Student:</strong> {selected.studentId || "—"}</div>
            <div><strong>Amount:</strong> {formatMoney(selected.amount)}</div>
            <div><strong>Mode:</strong> {selected.paymentMode}{selected.transactionId ? ` (${selected.transactionId})` : ""}</div>
            <div><strong>Status:</strong> <StatusBadge status={selected.status} /></div>
            <div><strong>Credit Applied:</strong> {formatMoney(selected.creditAppliedAmount)}</div>
            <div><strong>Refunded:</strong> {formatMoney(selected.refundedAmount)}</div>
            <div>
              <strong>Allocations:</strong>
              {Array.isArray(selected.allocations) && selected.allocations.length > 0 ? (
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {selected.allocations.map((a, i) => (
                    <li key={i} style={{ fontSize: 13 }}>{a.studentLedgerId} — {formatMoney(a.amount)}</li>
                  ))}
                </ul>
              ) : (
                <span style={{ fontSize: 13, color: "var(--yd-text-muted)" }}> None yet.</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: "var(--yd-text-muted)", marginTop: 8 }}>
              Notes: {selected.notes || "—"}
            </div>
          </div>
        )}
      </Drawer>
    </PageShell>
  );
}
