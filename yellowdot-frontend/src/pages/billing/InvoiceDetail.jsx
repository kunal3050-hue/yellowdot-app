/**
 * InvoiceDetail.jsx — one bill, its payments, and the actions on it
 * ─────────────────────────────────────────────────────────────────────────────
 * The screen a staff member is on when a parent is standing in front of them:
 * what this family owes, itemised, and one button to record what they have
 * just handed over.
 *
 * ── On the UPI QR ─────────────────────────────────────────────────────────────
 * The QR encodes a `upi://pay` link built from the school's own payee details.
 * The parent scans it with their own UPI app, which pre-fills the payee and
 * amount, and they confirm the payment there. This product never touches the
 * money: no provider is called, no gateway credential exists anywhere in the
 * tree, and staff record the payment once they can see it has arrived. That is
 * also why "Record a payment" is a separate, deliberate action rather than
 * something the QR triggers.
 *
 * ── On the two destructive actions ────────────────────────────────────────────
 * Void and credit note are admin-tier, both in the UI and independently on the
 * server, and both demand a reason that is written to the audit trail. They are
 * placed apart from "Record a payment" and styled as danger, because the
 * difference between taking money and unwinding it should be visible before the
 * click, not after.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { IndianRupee, Receipt, Ban, Undo2, ScissorsLineDashed } from "lucide-react";
import {
  PageShell, PageHeader, StatusBadge, Badge, Button, Modal, Select, Input,
  FormGrid, Field, Card, EmptyState, LoadingPage, PageError, useToast,
} from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import billingService from "../../services/billingService";
import {
  inr, prettyDate, prettyPeriod, labelFor, todayLocal,
  PAYMENT_MODES, MODES_NEEDING_REFERENCE, REFERENCE_LABEL, upiLink,
} from "./billingMeta";

/** A reason-and-confirm dialog, shared by void, credit note and reversal. */
function ReasonModal({
  isOpen, onClose, onConfirm, title, lede, confirmLabel,
  amountField = false, maxAmount, busy, error,
}) {
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (isOpen) { setReason(""); setAmount(""); } }, [isOpen]);

  const amountOk = !amountField || (Number(amount) > 0 && Number(amount) <= Number(maxAmount));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="default" footer={null}>
      <p className="yd-modal-lede">{lede}</p>

      {amountField && (
        <Field label="Amount to credit" required hint={`At most ${inr(maxAmount)}`}>
          <Input
            type="number" min="0" step="0.01" max={maxAmount}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </Field>
      )}

      <Field label="Reason" required hint="Recorded in the audit trail against your name">
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is this being done?"
          maxLength={300}
        />
      </Field>

      {error && <div className="yd-inline-error">{error}</div>}

      <div className="yd-modal-actions">
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button
          variant="danger"
          loading={busy}
          disabled={busy || !reason.trim() || !amountOk}
          onClick={() => onConfirm({ reason: reason.trim(), amount })}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export default function InvoiceDetail() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const { canDo, user } = useAuth();
  const { show: toast } = useToast();

  const canCollect = canDo("billing", "create");
  // "delete" is the reversal tier: void, credit note and payment reversal.
  // The server enforces the same split independently with authorize().
  const canUnwind  = canDo("billing", "delete");

  const [invoice,  setInvoice]  = useState(null);
  const [payments, setPayments] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  const [payOpen, setPayOpen]   = useState(false);
  const [payForm, setPayForm]   = useState(null);
  const [payBusy, setPayBusy]   = useState(false);
  const [payError, setPayError] = useState("");

  const [action, setAction]     = useState(null);   // "void" | "credit" | { reverse: payment }
  const [actionBusy, setActionBusy]   = useState(false);
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [inv, set] = await Promise.all([
        billingService.getInvoice(invoiceId),
        billingService.getSettings().catch(() => null),
      ]);
      if (inv?.success) {
        setInvoice(inv.invoice);
        setPayments(inv.payments || []);
      }
      if (set?.success) setSettings(set.settings);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not load the invoice.");
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const livePayments = useMemo(() => payments.filter(p => !p.reversed), [payments]);

  function openPayment() {
    setPayError("");
    setPayForm({
      amount: String(invoice.balance), paymentMode: "cash",
      reference: "", paymentDate: todayLocal(), notes: "",
    });
    setPayOpen(true);
  }

  async function savePayment() {
    setPayBusy(true);
    setPayError("");
    try {
      const res = await billingService.recordPayment({
        invoiceId,
        amount:      payForm.amount,
        paymentMode: payForm.paymentMode,
        reference:   payForm.reference,
        paymentDate: payForm.paymentDate,
        notes:       payForm.notes,
        // Send the staff member's name so the receipt reads "Recorded by Priya
        // Principal" rather than "Recorded by demo-principal". The server falls
        // back to the actor's user id when this is absent, which is accurate but
        // is not something to print on a document a family keeps.
        receivedBy:  user?.name || "",
      });
      setPayOpen(false);
      // The settled invoice comes back in the same response, because the
      // server wrote the payment and the settlement in one transaction.
      setInvoice(res.invoice);
      setPayments(prev => [res.payment, ...prev]);
      toast(`Receipt ${res.payment.receiptNumber} · ${inr(res.payment.amount)} recorded.`, "success");
    } catch (err) {
      setPayError(err.response?.data?.error || err.message || "Could not record the payment.");
    } finally {
      setPayBusy(false);
    }
  }

  async function runAction({ reason, amount }) {
    setActionBusy(true);
    setActionError("");
    try {
      if (action === "void") {
        const res = await billingService.voidInvoice(invoiceId, reason);
        setInvoice(res.invoice);
        toast("Invoice voided. It stays in the register with your reason.", "success");
      } else if (action === "credit") {
        const res = await billingService.addCreditNote(invoiceId, { amount, reason });
        setInvoice(res.invoice);
        toast(`Credit note of ${inr(amount)} applied.`, "success");
      } else if (action?.reverse) {
        const res = await billingService.reversePayment(action.reverse.paymentId, reason);
        setInvoice(res.invoice);
        setPayments(prev => prev.map(p => (p.paymentId === res.payment.paymentId ? res.payment : p)));
        toast("Payment reversed. The receipt stays on record.", "success");
      }
      setAction(null);
    } catch (err) {
      setActionError(err.response?.data?.error || err.message || "Could not complete that.");
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) return <LoadingPage message="Loading the invoice…" />;

  if (error || !invoice) {
    return (
      <PageShell header={<PageHeader title="Invoice" tag="Billing & Payments" />}>
        <PageError
          message={error || "That invoice could not be found."}
          onRetry={load}
          onBack={() => navigate("/billing/invoices")}
        />
      </PageShell>
    );
  }

  const settled = invoice.balance <= 0 || invoice.voided;
  const qr = upiLink({
    upiId:   settings?.upiId,
    upiName: settings?.upiName || settings?.schoolName,
    amount:  invoice.balance,
    note:    invoice.invoiceNumber,
  });

  const referenceRequired = payForm && MODES_NEEDING_REFERENCE.has(payForm.paymentMode);

  return (
    <PageShell
      header={
        <PageHeader
          title={invoice.invoiceNumber}
          tag="Invoice"
          subtitle={`${invoice.studentName || invoice.studentId}${invoice.class ? ` · ${invoice.class}` : ""} · ${prettyPeriod(invoice.period)}`}
          backLabel="Invoices"
          onBack={() => navigate("/billing/invoices")}
          onRefresh={load}
          primaryAction={canCollect && !settled ? {
            label: "Record a payment",
            icon: <IndianRupee size={14} strokeWidth={2} />,
            onClick: openPayment,
          } : undefined}
          secondaryActions={[
            // The printable bill. Anyone who can open this page can print it;
            // the unwind actions stay behind canUnwind.
            { key: "print", label: "Print invoice",
              onClick: () => navigate(`/billing/invoices/${invoiceId}/print`) },
            ...(canUnwind ? [
            ...(invoice.voided || invoice.balance <= 0 ? [] : [{
              key: "credit", label: "Credit note", onClick: () => { setActionError(""); setAction("credit"); },
            }]),
            ...(invoice.voided ? [] : [{
              key: "void", label: "Void", onClick: () => { setActionError(""); setAction("void"); },
            }]),
            ] : []),
          ]}
        />
      }
    >
      <div className="yd-invoice-detail">
        {/* ── The bill ─────────────────────────────────────────────────── */}
        <Card className="yd-invoice-detail__bill">
          <div className="yd-invoice-detail__status">
            <StatusBadge status={invoice.status} size="md" />
            <span className="yd-invoice-detail__dates">
              Raised {prettyDate(invoice.invoiceDate)} · due {prettyDate(invoice.dueDate)}
            </span>
          </div>

          {invoice.voided && (
            <div className="yd-invoice-detail__void-notice">
              <strong>Voided</strong> on {prettyDate((invoice.voidedAt || "").slice(0, 10))} —
              {" "}{invoice.voidReason}
            </div>
          )}

          <table className="yd-invoice-lines">
            <thead>
              <tr>
                <th scope="col">What</th>
                <th scope="col">Type</th>
                <th scope="col" className="yd-num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map(line => (
                <tr key={line.lineId}>
                  <td>{line.label}</td>
                  <td><Badge variant="neutral">{labelFor(line.feeType)}</Badge></td>
                  <td className="yd-num">{inr(line.amount)}</td>
                </tr>
              ))}

              {invoice.adjustments.map(adj => (
                <tr key={adj.adjustmentId} className="yd-invoice-lines__adjustment">
                  <td>
                    <ScissorsLineDashed size={12} strokeWidth={2} aria-hidden="true" />
                    {" "}Credit note — {adj.reason}
                  </td>
                  <td><Badge variant="warn">Credit</Badge></td>
                  <td className="yd-num">{inr(adj.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {invoice.adjustments.length > 0 && (
                <tr>
                  <td colSpan={2}>Charged</td>
                  <td className="yd-num">{inr(invoice.subtotal)}</td>
                </tr>
              )}
              <tr className="yd-invoice-lines__total">
                <td colSpan={2}>Total owed</td>
                <td className="yd-num">{inr(invoice.totalAmount)}</td>
              </tr>
              <tr>
                <td colSpan={2}>Paid</td>
                <td className="yd-num">{inr(invoice.paidAmount)}</td>
              </tr>
              <tr className="yd-invoice-lines__balance">
                <td colSpan={2}>Balance</td>
                <td className="yd-num">{inr(invoice.balance)}</td>
              </tr>
            </tfoot>
          </table>

          {invoice.notes && <p className="yd-invoice-detail__notes">{invoice.notes}</p>}
        </Card>

        {/* ── Pay by UPI ───────────────────────────────────────────────── */}
        {!settled && (
          <Card className="yd-invoice-detail__qr">
            <h3>Pay by UPI</h3>
            {qr ? (
              <>
                <div className="yd-invoice-detail__qr-code">
                  <QRCodeSVG value={qr} size={168} level="M" marginSize={0} />
                </div>
                <p className="yd-invoice-detail__qr-meta">
                  {inr(invoice.balance)} to <strong>{settings.upiName || settings.upiId}</strong>
                </p>
                <p className="yd-invoice-detail__qr-hint">
                  The family scans this with any UPI app and confirms the payment there.
                  Once it arrives, record it below — it is not recorded automatically.
                </p>
              </>
            ) : (
              <EmptyState
                size="sm"
                title="No UPI ID set"
                description="Add the school's UPI ID in billing settings to show a QR code here."
              />
            )}
          </Card>
        )}

        {/* ── Payments against this bill ───────────────────────────────── */}
        <Card className="yd-invoice-detail__payments">
          <h3>
            Payments
            {livePayments.length > 0 && (
              <span className="yd-invoice-detail__count">
                {livePayments.length} · {inr(invoice.paidAmount)}
              </span>
            )}
          </h3>

          {payments.length === 0 ? (
            <EmptyState
              size="sm"
              title="Nothing received yet"
              description={canCollect
                ? "Record a payment once the family has paid."
                : "Payments recorded at the front desk will appear here."}
            />
          ) : (
            <ul className="yd-payment-list">
              {payments.map(p => (
                <li key={p.paymentId} className={p.reversed ? "is-reversed" : ""}>
                  <div className="yd-payment-list__main">
                    <span className="yd-payment-list__amount">{inr(p.amount)}</span>
                    <Badge variant="neutral">{labelFor(p.paymentMode)}</Badge>
                    {p.reversed && <Badge variant="danger">Reversed</Badge>}
                  </div>
                  <div className="yd-payment-list__meta">
                    {prettyDate(p.paymentDate)} · {p.receiptNumber}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </div>
                  {p.reversed && (
                    <div className="yd-payment-list__reason">{p.reversalReason}</div>
                  )}
                  <div className="yd-payment-list__actions">
                    <Button
                      variant="outline" size="xs"
                      leftIcon={<Receipt size={12} strokeWidth={2} />}
                      onClick={() => navigate(`/billing/receipts/${p.paymentId}`)}
                    >
                      Receipt
                    </Button>
                    {canUnwind && !p.reversed && (
                      <Button
                        variant="ghost" size="xs"
                        leftIcon={<Undo2 size={12} strokeWidth={2} />}
                        onClick={() => { setActionError(""); setAction({ reverse: p }); }}
                      >
                        Reverse
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ── Record a payment ───────────────────────────────────────────── */}
      <Modal
        isOpen={payOpen}
        onClose={() => setPayOpen(false)}
        title="Record a payment"
        size="default"
        footer={null}
      >
        {payForm && (
          <>
            <p className="yd-modal-lede">
              For money that has already changed hands. {inr(invoice.balance)} is outstanding
              on {invoice.invoiceNumber}.
            </p>

            <FormGrid>
              <Field label="Amount received" required>
                <Input
                  type="number" min="0" step="0.01" max={invoice.balance}
                  value={payForm.amount}
                  onChange={(e) => setPayForm(f => ({ ...f, amount: e.target.value }))}
                />
              </Field>
              <Field label="How it was paid" required>
                <Select
                  value={payForm.paymentMode}
                  onChange={(e) => setPayForm(f => ({ ...f, paymentMode: e.target.value }))}
                  options={PAYMENT_MODES}
                />
              </Field>
              <Field
                label={REFERENCE_LABEL[payForm.paymentMode] || "Reference"}
                required={referenceRequired}
                hint={referenceRequired ? "Needed to reconcile against the bank statement" : undefined}
              >
                <Input
                  value={payForm.reference}
                  onChange={(e) => setPayForm(f => ({ ...f, reference: e.target.value }))}
                />
              </Field>
              <Field label="Date received" required>
                <Input
                  type="date" max={todayLocal()}
                  value={payForm.paymentDate}
                  onChange={(e) => setPayForm(f => ({ ...f, paymentDate: e.target.value }))}
                />
              </Field>
            </FormGrid>

            <Field label="Note">
              <Input
                value={payForm.notes}
                onChange={(e) => setPayForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional"
              />
            </Field>

            {payError && <div className="yd-inline-error">{payError}</div>}

            <div className="yd-modal-actions">
              <Button variant="ghost" onClick={() => setPayOpen(false)} disabled={payBusy}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={payBusy}
                disabled={
                  payBusy ||
                  !(Number(payForm.amount) > 0) ||
                  Number(payForm.amount) > invoice.balance ||
                  (referenceRequired && !payForm.reference.trim())
                }
                onClick={savePayment}
              >
                Record {inr(payForm.amount || 0)}
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* ── Void ───────────────────────────────────────────────────────── */}
      <ReasonModal
        isOpen={action === "void"}
        onClose={() => setAction(null)}
        onConfirm={runAction}
        busy={actionBusy}
        error={actionError}
        title="Void this invoice"
        lede={
          `${invoice.invoiceNumber} will be withdrawn and stop counting towards what this ` +
          "family owes. It stays in the register with your reason, so nothing disappears."
        }
        confirmLabel="Void the invoice"
      />

      {/* ── Credit note ────────────────────────────────────────────────── */}
      <ReasonModal
        isOpen={action === "credit"}
        onClose={() => setAction(null)}
        onConfirm={runAction}
        busy={actionBusy}
        error={actionError}
        title="Add a credit note"
        lede={
          "This reduces what the family owes on this invoice, with the reason shown " +
          "alongside it. It cannot go below what they have already paid."
        }
        confirmLabel="Apply the credit note"
        amountField
        maxAmount={invoice.balance}
      />

      {/* ── Reverse a payment ──────────────────────────────────────────── */}
      <ReasonModal
        isOpen={Boolean(action?.reverse)}
        onClose={() => setAction(null)}
        onConfirm={runAction}
        busy={actionBusy}
        error={actionError}
        title="Reverse this payment"
        lede={
          action?.reverse
            ? `${inr(action.reverse.amount)} on receipt ${action.reverse.receiptNumber} ` +
              "will stop counting as received, and the balance goes back up. The receipt " +
              "stays on record, marked reversed."
            : ""
        }
        confirmLabel="Reverse the payment"
      />

      {canUnwind && !invoice.voided && (
        <div className="yd-invoice-detail__danger-hint">
          <Ban size={12} strokeWidth={2} aria-hidden="true" />
          {" "}Voiding, crediting and reversing are recorded against your name in the audit trail.
        </div>
      )}
    </PageShell>
  );
}
