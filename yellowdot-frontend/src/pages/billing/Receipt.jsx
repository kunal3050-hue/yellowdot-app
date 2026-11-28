/**
 * Receipt.jsx — the parent-facing proof of payment
 * ─────────────────────────────────────────────────────────────────────────────
 * A receipt is a trust artifact as much as a document: it is what a family
 * keeps, and often the only piece of the billing system they ever hold. So it
 * prints what actually happened and nothing else — the amount, how it was
 * paid, its reference, and the itemised bill it settled.
 *
 * ── Printed, not generated server-side ───────────────────────────────────────
 * The audit flagged a real inconsistency in the deleted implementation: the
 * server's PDF endpoint was a literal `501 Not Implemented`, while the client
 * faked its own PDFs with jsPDF and html2canvas in two different places. This
 * does neither. It is one HTML document with a print stylesheet, so Ctrl+P
 * gives a clean A4 page and the browser's own "Save as PDF" gives a file — no
 * second rendering path to drift from the screen, and no server endpoint
 * promising something it does not do.
 *
 * ── A reversed payment still resolves ────────────────────────────────────────
 * A reversed payment keeps its row and its receipt number, because a family may
 * already hold the printed copy. Opening it shows the reversal and its reason
 * rather than 404ing, which is the honest answer to "what happened to this?".
 *
 * The layout lives in BillingDocument, shared with the invoice, so the two
 * read as halves of the same pair.
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import {
  PageShell, PageHeader, Button, Badge, LoadingPage, PageError,
} from "../../components/ui";
import BillingDocument from "../../components/billing/BillingDocument";
import billingService from "../../services/billingService";
import { inr, prettyDate, prettyPeriod, labelFor } from "./billingMeta";

export default function Receipt() {
  const { paymentId } = useParams();
  const navigate = useNavigate();

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await billingService.getReceipt(paymentId);
      if (res?.success) setData(res);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not load the receipt.");
    } finally {
      setLoading(false);
    }
  }, [paymentId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingPage message="Loading the receipt…" />;

  if (error || !data) {
    return (
      <PageShell header={<PageHeader title="Receipt" tag="Billing & Payments" />}>
        <PageError
          message={error || "That receipt could not be found."}
          onRetry={load}
          onBack={() => navigate("/billing")}
        />
      </PageShell>
    );
  }

  const { payment, invoice, settings, school = {} } = data;
  const schoolName = school.name || settings?.schoolName || "KUE BOXS Care";

  // The bill this payment settled, itemised. A receipt that says only "₹12,500
  // received" leaves the family unable to check it against what they were
  // billed for, which is the first thing anyone does with a receipt.
  const rows = [
    ...(invoice.lines || []).map(line => ({
      key: line.lineId, label: line.label,
      price: inr(line.amount), qty: 1, total: inr(line.amount),
    })),
    ...(invoice.adjustments || []).map(adj => ({
      key: adj.adjustmentId, label: "Credit note", sub: adj.reason,
      price: `−${inr(adj.amount)}`, qty: 1, total: `−${inr(adj.amount)}`,
    })),
  ];

  return (
    <PageShell
      header={
        <PageHeader
          title={payment.receiptNumber}
          tag="Receipt"
          subtitle={`${payment.studentName || payment.studentId} · ${inr(payment.amount)} on ${prettyDate(payment.paymentDate)}`}
          backLabel="Invoice"
          onBack={() => navigate(`/billing/invoices/${payment.invoiceId}`)}
          primaryAction={{
            label: "Print",
            icon: <Printer size={14} strokeWidth={2} />,
            onClick: () => window.print(),
          }}
        />
      }
    >
      {payment.reversed && (
        <div className="yd-doc-flag" role="status">
          <strong>This payment was reversed.</strong> It no longer counts towards what
          the family has paid. Reason: {payment.reversalReason}
        </div>
      )}

      <BillingDocument
        kind="Receipt"
        school={{ ...school, name: schoolName }}
        watermark={payment.reversed ? "REVERSED" : ""}
        billTo={{
          heading: "Received from:",
          name: payment.studentName || payment.studentId,
          lines: [invoice.class, `Against ${invoice.invoiceNumber} · ${prettyPeriod(invoice.period)}`],
        }}
        meta={[
          { label: "Receipt No", value: payment.receiptNumber },
          { label: "Date",       value: prettyDate(payment.paymentDate) },
          { label: "Method",     value: labelFor(payment.paymentMode) },
          payment.reference ? { label: "Reference", value: payment.reference } : null,
        ]}
        highlight={{
          label: "Amount received",
          value: inr(payment.amount),
          sub: `${labelFor(payment.paymentMode)}${payment.reference ? ` · ${payment.reference}` : ""}`,
        }}
        rows={rows}
        totals={[
          { label: "Invoice total",     value: inr(invoice.totalAmount) },
          { label: "Paid to date",      value: inr(invoice.paidAmount) },
          { label: "Still outstanding", value: inr(invoice.balance), rule: true, strong: true },
        ]}
        aside={
          <>
            {settings?.receiptFooter && (
              <div className="yd-doc__aside-group">
                <h3>Note</h3>
                <p>{settings.receiptFooter}</p>
              </div>
            )}
            <div className="yd-doc__aside-group">
              <h3>Recorded by</h3>
              <p>{payment.receivedBy || "School staff"}</p>
              {payment.notes && <p>{payment.notes}</p>}
            </div>
          </>
        }
        signature={{ name: schoolName, role: "Authorised signatory" }}
        footerNote={
          `Computer-generated receipt · ${schoolName}` +
          (payment.reversed ? " · This payment was reversed and this receipt is void." : "")
        }
      />

      <div className="yd-doc-aside">
        <Badge variant={payment.reversed ? "danger" : "success"}>
          {payment.reversed ? "Reversed" : "Received"}
        </Badge>
        <Button variant="outline" size="sm" onClick={() => navigate(`/billing/invoices/${payment.invoiceId}`)}>
          Back to the invoice
        </Button>
      </div>
    </PageShell>
  );
}
