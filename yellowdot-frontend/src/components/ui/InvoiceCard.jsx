/**
 * InvoiceCard — compact invoice summary card for list views
 *
 * @prop {object}   invoice       invoice record from Firestore
 * @prop {function} onClick       called when card is clicked
 * @prop {function} onPay         "Record Payment" action
 * @prop {function} onView        "View Invoice" action
 * @prop {boolean}  selected      highlights the card
 * @prop {string}   className
 */

import StatusBadge from "./StatusBadge";

function INR(val) {
  const n = Number(val) || 0;
  return "₹" + n.toLocaleString("en-IN");
}

function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function InvoiceCard({
  invoice,
  onClick,
  onPay,
  onView,
  selected = false,
  className = "",
}) {
  if (!invoice) return null;

  const balance   = (invoice.totalAmount ?? 0) - (invoice.paidAmount ?? 0);
  const isOverdue = invoice.status === "Overdue";
  const isPaid    = invoice.status === "Paid";

  return (
    <div
      className={`yd-card yd-card-hover ${className}`}
      onClick={onClick}
      style={{
        cursor:       onClick ? "pointer" : "default",
        borderColor:  selected ? "var(--yd-yellow)" : isOverdue ? "var(--yd-danger-border)" : undefined,
        boxShadow:    selected ? "0 0 0 2px rgba(244,196,0,0.25), var(--yd-shadow)" : undefined,
        transition:   "all 0.15s ease",
      }}
    >
      <div style={{ padding: "12px 16px" }}>
        {/* Top row: invoice number + status */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--yd-charcoal)", fontFamily: "monospace" }}>
              {invoice.invoiceNumber}
            </div>
            <div style={{ fontSize: 11, color: "var(--yd-text-muted)", marginTop: 1 }}>
              {invoice.studentName || "—"}
            </div>
          </div>
          <StatusBadge status={invoice.status} size="xs" />
        </div>

        {/* Fee type + billing cycle */}
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          {invoice.feeType && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: "var(--yd-text-muted)",
              background: "var(--yd-soft)", border: "1px solid var(--yd-border)",
              padding: "1px 6px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
              {invoice.feeType}
            </span>
          )}
          {invoice.billingCycle && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: "var(--yd-text-muted)",
              background: "var(--yd-soft)", border: "1px solid var(--yd-border)",
              padding: "1px 6px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
              {invoice.billingCycle}
            </span>
          )}
          {invoice.class && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: "var(--yd-info)",
              background: "var(--yd-info-soft)", border: "1px solid var(--yd-info-border)",
              padding: "1px 6px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
              {invoice.class}
            </span>
          )}
        </div>

        {/* Amounts row */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "var(--yd-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
              Total
            </div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "var(--yd-charcoal)" }}>
              {INR(invoice.totalAmount)}
            </div>
          </div>
          {invoice.paidAmount > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "var(--yd-success)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                Paid
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--yd-success)" }}>
                {INR(invoice.paidAmount)}
              </div>
            </div>
          )}
          {balance > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: isOverdue ? "var(--yd-danger)" : "var(--yd-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                Balance
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: isOverdue ? "var(--yd-danger)" : "var(--yd-text-soft)" }}>
                {INR(balance)}
              </div>
            </div>
          )}
        </div>

        {/* Payment progress bar */}
        {!isPaid && invoice.totalAmount > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ height: 4, background: "var(--yd-border-light)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.min(100, ((invoice.paidAmount ?? 0) / invoice.totalAmount) * 100)}%`,
                background: isOverdue ? "var(--yd-danger)" : "var(--yd-success)",
                borderRadius: 4,
                transition: "width 0.4s ease",
              }} />
            </div>
          </div>
        )}

        {/* Dates row */}
        <div style={{ display: "flex", gap: 12, fontSize: 10, color: "var(--yd-text-muted)" }}>
          {invoice.invoiceDate && (
            <span>📅 {fmtDate(invoice.invoiceDate)}</span>
          )}
          {invoice.dueDate && !isPaid && (
            <span style={{ color: isOverdue ? "var(--yd-danger)" : undefined }}>
              ⏰ Due {fmtDate(invoice.dueDate)}
            </span>
          )}
        </div>
      </div>

      {/* Action strip */}
      {(onView || onPay) && (
        <div style={{
          display:       "flex",
          gap:           1,
          borderTop:     "1px solid var(--yd-border-light)",
          background:    "var(--yd-soft)",
        }}>
          {onView && (
            <button
              onClick={e => { e.stopPropagation(); onView(invoice); }}
              style={actionBtnStyle}
            >
              View
            </button>
          )}
          {onPay && !isPaid && (
            <button
              onClick={e => { e.stopPropagation(); onPay(invoice); }}
              style={{ ...actionBtnStyle, color: "var(--yd-success)", fontWeight: 800 }}
            >
              💰 Pay
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const actionBtnStyle = {
  flex:        1,
  padding:     "7px 12px",
  border:      "none",
  background:  "transparent",
  fontSize:    11,
  fontWeight:  700,
  color:       "var(--yd-text-soft)",
  cursor:      "pointer",
  fontFamily:  "var(--yd-font)",
  transition:  "background 0.12s ease",
};
