/**
 * Fees.jsx — Parent Module · what we owe, and what we've paid
 * ──────────────────────────────────────────────────────────────────────
 * The screen that exists so a parent never has to ask a human "how much do I
 * owe" or "did you get my payment" — the PRD's fourth principle, and the one
 * the deleted implementation served least well.
 *
 * It answers in this order, because that is the order a parent cares about:
 *   1. One number: what is outstanding right now.
 *   2. How to pay it: the school's UPI QR, if they have set one up.
 *   3. Each bill, itemised, so "what is this ₹8,800 for?" is answerable
 *      without ringing the school.
 *   4. Every receipt, so "did you get it?" is answerable too.
 *
 * Reads GET /api/parent/billing. Void invoices and reversed payments are
 * filtered out server-side: a withdrawn bill would raise a question about
 * money the family never owed.
 *
 * Theme tokens only, per the Parent Module rule — no hardcoded colours.
 */

import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import useBilling from "../hooks/useBilling";
import { colors, spacing, radius, shadows, typography } from "../theme";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
                "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Rupees, grouped the Indian way. */
function inr(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "₹0";
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function prettyDate(iso) {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

function prettyPeriod(period) {
  if (typeof period !== "string" || !/^\d{4}-\d{2}$/.test(period)) return "";
  const [y, m] = period.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

const MODE_LABEL = {
  cash: "Cash", upi: "UPI", card: "Card",
  bank_transfer: "Bank transfer", cheque: "Cheque", other: "Other",
};

/** A status chip whose colour says how urgent the bill is. */
function statusMeta(status) {
  switch (status) {
    case "Paid":    return { label: "Paid",    fg: colors.successStrong, bg: colors.successSoft, bd: colors.successBorder };
    case "Overdue": return { label: "Overdue", fg: colors.dangerStrong,  bg: colors.dangerSoft,  bd: colors.dangerBorder };
    case "Partial": return { label: "Part paid", fg: colors.warningStrong, bg: colors.warningSoft, bd: colors.warningBorder };
    default:        return { label: "Due",     fg: colors.yellow700,     bg: colors.yellow100,   bd: colors.yellow200 };
  }
}

/** The `upi://pay` link the QR encodes. Empty when the school has set no VPA. */
function upiLink({ upiId, upiName, amount, note }) {
  if (!upiId) return "";
  const params = new URLSearchParams({ pa: upiId, cu: "INR" });
  if (upiName) params.set("pn", upiName);
  const n = Number(amount);
  if (Number.isFinite(n) && n > 0) params.set("am", n.toFixed(2));
  if (note) params.set("tn", String(note).slice(0, 50));
  return `upi://pay?${params.toString()}`;
}

const card = {
  background: colors.surface.card,
  border: `1px solid ${colors.surface.border}`,
  borderRadius: radius.card,
  boxShadow: shadows.card,
  padding: spacing.lg,
};

function Bill({ invoice }) {
  const [open, setOpen] = useState(false);
  const meta = statusMeta(invoice.status);

  return (
    <li style={{ ...card, padding: 0, overflow: "hidden", listStyle: "none" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: spacing.md,
          padding: spacing.lg, background: "none", border: "none", cursor: "pointer",
          textAlign: "left", font: "inherit", minHeight: 52,
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: "block", fontSize: typography.size.base,
            fontWeight: typography.weight.semibold, color: colors.text.primary,
          }}>
            {prettyPeriod(invoice.period) || invoice.invoiceNumber}
          </span>
          <span style={{
            display: "block", fontSize: typography.size.xs, color: colors.text.muted,
            marginTop: 2,
          }}>
            {invoice.invoiceNumber}
            {invoice.dueDate ? ` · due ${prettyDate(invoice.dueDate)}` : ""}
          </span>
        </span>

        <span style={{ textAlign: "right", flexShrink: 0 }}>
          <span style={{
            display: "block", fontSize: typography.size.md,
            fontWeight: typography.weight.bold, color: colors.text.primary,
          }}>
            {inr(invoice.balance > 0 ? invoice.balance : invoice.totalAmount)}
          </span>
          <span style={{
            display: "inline-block", marginTop: 4, padding: "2px 8px",
            fontSize: typography.size.xs, fontWeight: typography.weight.semibold,
            color: meta.fg, background: meta.bg,
            border: `1px solid ${meta.bd}`, borderRadius: radius.pill,
          }}>
            {meta.label}
          </span>
        </span>

        <span aria-hidden="true" style={{
          color: colors.text.faint, fontSize: typography.size.sm,
          transform: open ? "rotate(180deg)" : "none", transition: "transform .18s",
        }}>
          ▾
        </span>
      </button>

      {open && (
        <div style={{
          padding: `0 ${spacing.lg}px ${spacing.lg}px`,
          borderTop: `1px solid ${colors.surface.border}`, paddingTop: spacing.md,
        }}>
          {invoice.lines.map(line => (
            <div key={line.lineId} style={{
              display: "flex", justifyContent: "space-between", gap: spacing.md,
              fontSize: typography.size.sm, color: colors.text.secondary,
              padding: "5px 0",
            }}>
              <span>{line.label}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{inr(line.amount)}</span>
            </div>
          ))}

          {invoice.adjustments.map(adj => (
            <div key={adj.adjustmentId} style={{
              display: "flex", justifyContent: "space-between", gap: spacing.md,
              fontSize: typography.size.sm, color: colors.successStrong, padding: "5px 0",
            }}>
              <span>{adj.reason || "Discount"}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{inr(adj.amount)}</span>
            </div>
          ))}

          <div style={{
            display: "flex", justifyContent: "space-between", gap: spacing.md,
            marginTop: spacing.sm, paddingTop: spacing.sm,
            borderTop: `1px solid ${colors.surface.border}`,
            fontSize: typography.size.sm, fontWeight: typography.weight.semibold,
            color: colors.text.primary,
          }}>
            <span>Total</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{inr(invoice.totalAmount)}</span>
          </div>

          {invoice.paidAmount > 0 && (
            <div style={{
              display: "flex", justifyContent: "space-between", gap: spacing.md,
              fontSize: typography.size.sm, color: colors.successStrong, padding: "4px 0",
            }}>
              <span>Already paid</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>−{inr(invoice.paidAmount)}</span>
            </div>
          )}

          {invoice.notes && (
            <p style={{
              marginTop: spacing.md, marginBottom: 0,
              fontSize: typography.size.xs, color: colors.text.muted,
            }}>
              {invoice.notes}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export default function Fees() {
  const { data, loading, error, reload } = useBilling();

  const summary  = data?.summary;
  const invoices = data?.invoices || [];
  const payments = data?.payments || [];
  const payee    = data?.payee;

  const outstanding = summary?.outstanding ?? 0;

  const qr = useMemo(() => upiLink({
    upiId:   payee?.upiId,
    upiName: payee?.upiName || payee?.schoolName,
    amount:  outstanding,
    note:    "School fees",
  }), [payee, outstanding]);

  if (loading) {
    return (
      <div style={{ padding: spacing.lg }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            ...card, height: 88, marginBottom: spacing.md,
            background: colors.gray100, border: "none", boxShadow: "none",
          }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: spacing.lg, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: spacing.md }} aria-hidden="true">💳</div>
        <p style={{ color: colors.text.secondary, fontSize: typography.size.base }}>{error}</p>
        <button
          type="button"
          onClick={reload}
          style={{
            marginTop: spacing.md, minHeight: 44, padding: `0 ${spacing.xl}px`,
            background: colors.brand.primary, color: colors.brand.onPrimary,
            border: "none", borderRadius: radius.pill,
            fontSize: typography.size.base, fontWeight: typography.weight.semibold,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  const settled = outstanding <= 0;

  return (
    <div style={{ padding: spacing.lg, display: "grid", gap: spacing.lg }}>
      {/* ── The one number ──────────────────────────────────────────── */}
      <section
        style={{
          ...card,
          background: settled ? colors.successSoft : colors.yellow50,
          border: `1px solid ${settled ? colors.successBorder : colors.yellow200}`,
          textAlign: "center",
        }}
      >
        <div style={{
          fontSize: typography.size.sm, color: colors.text.muted,
          fontWeight: typography.weight.medium,
        }}>
          {settled ? "You're all paid up" : "Outstanding"}
        </div>
        <div style={{
          fontSize: 34, lineHeight: 1.1, marginTop: spacing.xs,
          fontWeight: typography.weight.extra,
          color: settled ? colors.successStrong : colors.text.primary,
          letterSpacing: typography.tracking.tighter,
        }}>
          {settled ? "🎉" : inr(outstanding)}
        </div>

        {!settled && (
          <div style={{
            marginTop: spacing.sm, fontSize: typography.size.sm,
            color: summary.overdueCount > 0 ? colors.dangerStrong : colors.text.secondary,
          }}>
            {summary.overdueCount > 0
              ? `${summary.overdueCount} bill${summary.overdueCount === 1 ? "" : "s"} past due`
              : summary.nextDueDate
                ? `Due by ${prettyDate(summary.nextDueDate)}`
                : `${summary.unpaidCount} unpaid bill${summary.unpaidCount === 1 ? "" : "s"}`}
          </div>
        )}

        {settled && summary.paidToDate > 0 && (
          <div style={{
            marginTop: spacing.sm, fontSize: typography.size.sm, color: colors.text.secondary,
          }}>
            {inr(summary.paidToDate)} paid so far — thank you
          </div>
        )}
      </section>

      {/* ── How to pay it ───────────────────────────────────────────── */}
      {!settled && qr && (
        <section style={{ ...card, textAlign: "center" }}>
          <h2 style={{
            margin: 0, fontSize: typography.size.lg,
            fontWeight: typography.weight.bold, color: colors.text.primary,
          }}>
            Pay by UPI
          </h2>
          <p style={{
            margin: `${spacing.xs}px 0 ${spacing.md}px`,
            fontSize: typography.size.sm, color: colors.text.muted,
          }}>
            Scan with any UPI app
          </p>

          <div style={{
            display: "inline-block", padding: spacing.md,
            background: colors.white, borderRadius: radius.lg,
            border: `1px solid ${colors.surface.border}`,
          }}>
            <QRCodeSVG value={qr} size={180} level="M" marginSize={0} />
          </div>

          <p style={{
            margin: `${spacing.md}px 0 0`, fontSize: typography.size.sm,
            color: colors.text.secondary,
          }}>
            {inr(outstanding)} to{" "}
            <strong style={{ color: colors.text.primary }}>
              {payee.upiName || payee.schoolName || payee.upiId}
            </strong>
          </p>
          <p style={{
            margin: `${spacing.xs}px 0 0`, fontSize: typography.size.xs,
            color: colors.text.faint,
          }}>
            The school records your payment once it arrives, so your receipt may take a
            short while to appear here.
          </p>
        </section>
      )}

      {/* ── Each bill ───────────────────────────────────────────────── */}
      <section>
        <h2 style={{
          margin: `0 0 ${spacing.md}px`, fontSize: typography.size.lg,
          fontWeight: typography.weight.bold, color: colors.text.primary,
        }}>
          Your bills
        </h2>

        {invoices.length === 0 ? (
          <div style={{ ...card, textAlign: "center", color: colors.text.muted }}>
            <div style={{ fontSize: 32, marginBottom: spacing.sm }} aria-hidden="true">🧾</div>
            <p style={{ margin: 0, fontSize: typography.size.base }}>
              No bills yet. They'll appear here as the school raises them.
            </p>
          </div>
        ) : (
          <ul style={{ display: "grid", gap: spacing.md, margin: 0, padding: 0 }}>
            {invoices.map(inv => <Bill key={inv.invoiceId} invoice={inv} />)}
          </ul>
        )}
      </section>

      {/* ── Every receipt ───────────────────────────────────────────── */}
      {payments.length > 0 && (
        <section>
          <h2 style={{
            margin: `0 0 ${spacing.md}px`, fontSize: typography.size.lg,
            fontWeight: typography.weight.bold, color: colors.text.primary,
          }}>
            Your receipts
          </h2>

          <ul style={{ ...card, margin: 0, padding: 0, listStyle: "none" }}>
            {payments.map((p, i) => (
              <li
                key={p.paymentId}
                style={{
                  display: "flex", alignItems: "center", gap: spacing.md,
                  padding: spacing.lg,
                  borderTop: i === 0 ? "none" : `1px solid ${colors.surface.border}`,
                }}
              >
                <span aria-hidden="true" style={{
                  width: 34, height: 34, flexShrink: 0, display: "grid",
                  placeItems: "center", borderRadius: radius.pill,
                  background: colors.successSoft, color: colors.successStrong,
                  fontSize: typography.size.sm,
                }}>
                  ✓
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    display: "block", fontSize: typography.size.base,
                    fontWeight: typography.weight.semibold, color: colors.text.primary,
                  }}>
                    {inr(p.amount)}
                  </span>
                  <span style={{
                    display: "block", fontSize: typography.size.xs,
                    color: colors.text.muted, marginTop: 2,
                  }}>
                    {prettyDate(p.paymentDate)} · {MODE_LABEL[p.paymentMode] || p.paymentMode}
                    {" · "}{p.receiptNumber}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
