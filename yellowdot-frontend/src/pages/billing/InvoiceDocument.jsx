/**
 * InvoiceDocument.jsx — the bill as a family receives it
 * ─────────────────────────────────────────────────────────────────────────────
 * Separate from InvoiceDetail on purpose. That page is the register: status,
 * payments taken, credit notes, void. This is the piece of paper — what is
 * owed, for what, by when, and who to pay. A school hands this over or emails
 * it; nobody should have to explain away a "Void" button on a parent's bill.
 *
 * Same BillingDocument as the receipt, so the two are recognisably a pair: a
 * family gets the invoice, pays it, and gets back a document that looks like
 * its counterpart rather than like a different system.
 *
 * Printed, not generated server-side — see the note in Receipt.jsx. One HTML
 * document with a print stylesheet; Ctrl+P gives A4 and the browser's own
 * "Save as PDF" gives a file.
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import {
  PageShell, PageHeader, Button, LoadingPage, PageError,
} from "../../components/ui";
import BillingDocument from "../../components/billing/BillingDocument";
import billingService from "../../services/billingService";
import { inr, prettyDate, prettyPeriod } from "./billingMeta";

export default function InvoiceDocument() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await billingService.getInvoiceDocument(invoiceId);
      if (res?.success) setData(res);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not load the invoice.");
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingPage message="Loading the invoice…" />;

  if (error || !data) {
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

  const { invoice, settings, school = {} } = data;
  const schoolName = school.name || settings?.schoolName || "KUE BOXS Care";

  const rows = [
    ...(invoice.lines || []).map(line => ({
      key: line.lineId, label: line.label, sub: line.feeType,
      price: inr(line.amount), qty: 1, total: inr(line.amount),
    })),
    ...(invoice.adjustments || []).map(adj => ({
      key: adj.adjustmentId, label: "Credit note", sub: adj.reason,
      price: `−${inr(adj.amount)}`, qty: 1, total: `−${inr(adj.amount)}`,
    })),
  ];

  // What the family still has to act on is the balance, not the total — on a
  // part-paid bill those differ, and showing the total as the headline would
  // ask them for money they have already handed over.
  const settled = invoice.balance <= 0;

  // Where to send the money. Dropped entirely rather than printed empty when a
  // school has not set it up: a blank "Pay to:" block invites a wrong payment.
  const payee = [
    settings?.upiName && `${settings.upiName}`,
    settings?.upiId   && `UPI: ${settings.upiId}`,
    settings?.bankAccount,
  ].filter(Boolean);

  return (
    <PageShell
      header={
        <PageHeader
          title={invoice.invoiceNumber}
          tag="Invoice"
          subtitle={`${invoice.studentName || invoice.studentId}${invoice.class ? ` · ${invoice.class}` : ""} · ${prettyPeriod(invoice.period)}`}
          backLabel="Invoice detail"
          onBack={() => navigate(`/billing/invoices/${invoiceId}`)}
          primaryAction={{
            label: "Print",
            icon: <Printer size={14} strokeWidth={2} />,
            onClick: () => window.print(),
          }}
        />
      }
    >
      {invoice.voided && (
        <div className="yd-doc-flag" role="status">
          <strong>This invoice was voided</strong> on {prettyDate((invoice.voidedAt || "").slice(0, 10))}
          {invoice.voidReason ? ` — ${invoice.voidReason}` : ""}. It is not payable.
        </div>
      )}

      <BillingDocument
        kind="Invoice"
        school={{ ...school, name: schoolName }}
        watermark={invoice.voided ? "VOID" : ""}
        billTo={{
          heading: "Bill to:",
          name: invoice.studentName || invoice.studentId,
          lines: [invoice.class, prettyPeriod(invoice.period)],
        }}
        meta={[
          { label: "Invoice No", value: invoice.invoiceNumber },
          { label: "Date",       value: prettyDate(invoice.invoiceDate) },
          { label: "Due",        value: prettyDate(invoice.dueDate) },
        ]}
        rows={rows}
        totals={[
          { label: "Subtotal", value: inr(invoice.subtotal ?? invoice.totalAmount) },
          { label: "Total",    value: inr(invoice.totalAmount) },
          { label: "Paid",     value: inr(invoice.paidAmount) },
          {
            label: settled ? "Nothing outstanding" : "Amount due",
            value: inr(invoice.balance),
            rule: true, strong: true,
          },
        ]}
        highlight={settled ? null : {
          label: "Amount due",
          value: inr(invoice.balance),
          sub: `Payable by ${prettyDate(invoice.dueDate)}`,
        }}
        aside={
          <>
            {payee.length > 0 && (
              <div className="yd-doc__aside-group">
                <h3>Payment method</h3>
                {payee.map((l, i) => <p key={i}>{l}</p>)}
              </div>
            )}
            {settings?.invoiceTerms && (
              <div className="yd-doc__aside-group">
                <h3>Terms and conditions</h3>
                <p>{settings.invoiceTerms}</p>
              </div>
            )}
            {invoice.notes && (
              <div className="yd-doc__aside-group">
                <h3>Note</h3>
                <p>{invoice.notes}</p>
              </div>
            )}
          </>
        }
        signature={{ name: schoolName, role: "Authorised signatory" }}
        footerNote={
          `Computer-generated invoice · ${schoolName}` +
          (invoice.voided ? " · This invoice was voided and is not payable." : "")
        }
      />

      <div className="yd-doc-aside">
        <Button variant="outline" size="sm" onClick={() => navigate(`/billing/invoices/${invoiceId}`)}>
          Back to the invoice detail
        </Button>
      </div>
    </PageShell>
  );
}
