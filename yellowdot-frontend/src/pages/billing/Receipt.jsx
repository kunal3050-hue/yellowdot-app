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
 * does neither. It is one HTML document with a print stylesheet, so
 * Ctrl+P gives a clean A4 page and the browser's own "Save as PDF" gives a
 * file — no second rendering path to drift from the screen, and no server
 * endpoint promising something it does not do.
 *
 * ── A reversed payment still resolves ────────────────────────────────────────
 * A reversed payment keeps its row and its receipt number, because a family may
 * already hold the printed copy. Opening it shows the reversal and its reason
 * rather than 404ing, which is the honest answer to "what happened to this?".
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import {
  PageShell, PageHeader, Button, Badge, LoadingPage, PageError,
} from "../../components/ui";
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

  const { payment, invoice, settings } = data;
  const schoolName = settings?.schoolName || "KUE BOXS Care";

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
        <div className="yd-receipt-reversed" role="status">
          <strong>This payment was reversed.</strong> It no longer counts towards what
          the family has paid. Reason: {payment.reversalReason}
        </div>
      )}

      {/* The printable document. Everything outside it is hidden by the
          print stylesheet in styles/billing.css. */}
      <article className={`yd-receipt ${payment.reversed ? "is-reversed" : ""}`}>
        <header className="yd-receipt__head">
          <div>
            <div className="yd-receipt__school">{schoolName}</div>
            <div className="yd-receipt__kind">Receipt</div>
          </div>
          <div className="yd-receipt__ref">
            <div className="yd-receipt__ref-label">Receipt no.</div>
            <div className="yd-receipt__ref-value">{payment.receiptNumber}</div>
            <div className="yd-receipt__ref-date">{prettyDate(payment.paymentDate)}</div>
          </div>
        </header>

        {payment.reversed && <div className="yd-receipt__watermark" aria-hidden="true">REVERSED</div>}

        <section className="yd-receipt__parties">
          <div>
            <div className="yd-receipt__label">Received from</div>
            <div className="yd-receipt__value">{payment.studentName || payment.studentId}</div>
            {invoice.class && <div className="yd-receipt__sub">{invoice.class}</div>}
          </div>
          <div>
            <div className="yd-receipt__label">Against</div>
            <div className="yd-receipt__value">{invoice.invoiceNumber}</div>
            <div className="yd-receipt__sub">{prettyPeriod(invoice.period)}</div>
          </div>
        </section>

        <section className="yd-receipt__amount">
          <div className="yd-receipt__label">Amount received</div>
          <div className="yd-receipt__big">{inr(payment.amount)}</div>
          <div className="yd-receipt__sub">
            {labelFor(payment.paymentMode)}
            {payment.reference ? ` · ${payment.reference}` : ""}
          </div>
        </section>

        <section className="yd-receipt__breakdown">
          <div className="yd-receipt__label">What the bill was for</div>
          <table>
            <tbody>
              {invoice.lines.map(line => (
                <tr key={line.lineId}>
                  <td>{line.label}</td>
                  <td className="yd-num">{inr(line.amount)}</td>
                </tr>
              ))}
              {invoice.adjustments.map(adj => (
                <tr key={adj.adjustmentId}>
                  <td>Credit note — {adj.reason}</td>
                  <td className="yd-num">{inr(adj.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Invoice total</td>
                <td className="yd-num">{inr(invoice.totalAmount)}</td>
              </tr>
              <tr>
                <td>Paid to date</td>
                <td className="yd-num">{inr(invoice.paidAmount)}</td>
              </tr>
              <tr className="yd-receipt__balance">
                <td>Still outstanding</td>
                <td className="yd-num">{inr(invoice.balance)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        <footer className="yd-receipt__foot">
          {settings?.receiptFooter && (
            <p className="yd-receipt__footer-note">{settings.receiptFooter}</p>
          )}
          <p className="yd-receipt__meta">
            Recorded by {payment.receivedBy || "school staff"}
            {payment.notes ? ` · ${payment.notes}` : ""}
          </p>
        </footer>
      </article>

      <div className="yd-receipt__aside">
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
