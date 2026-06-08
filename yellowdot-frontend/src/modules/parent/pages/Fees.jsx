/**
 * Fees.jsx — Parent Module · Phase 5
 * ──────────────────────────────────────────────────────────────────
 * Parent-facing, read-only fees. NOT the staff finance dashboard.
 *
 * Shows: outstanding balance · my invoices · payment history ·
 *        child switcher (multi-child).
 *
 * Green is used ONLY for Paid / all-clear (positive). Theme tokens only.
 * No payment gateway, receipts PDF, or editing.
 */

import { useEffect, useMemo, useState } from "react";
import useParentProfile from "../hooks/useParentProfile";
import useFees from "../hooks/useFees";
import { colors, spacing, radius, shadows, typography } from "../theme";

// ── Status → theme styling (Paid is the ONLY green) ────────────────
const STATUS = {
  Paid:    { label: "Paid",    fg: colors.successStrong, bg: colors.successSoft, border: colors.successBorder },
  Pending: { label: "Pending", fg: colors.warningStrong, bg: colors.warningSoft, border: colors.warningBorder },
  Partial: { label: "Partial", fg: colors.warningStrong, bg: colors.warningSoft, border: colors.warningBorder },
  Overdue: { label: "Overdue", fg: colors.dangerStrong,  bg: colors.dangerSoft,  border: colors.dangerBorder },
};
const statusOf = s => STATUS[s] || { label: s || "—", fg: colors.text.secondary, bg: colors.gray100, border: colors.surface.border };

const inr = n =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
    .format(Number(n) || 0);

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v.length === 10 ? `${v}T00:00:00` : v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function Fees() {
  const { children } = useParentProfile();
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (filter !== "all" && children.length && !children.some(c => c.studentId === filter)) {
      setFilter("all");
    }
  }, [children, filter]);

  const { data, loading, error } = useFees(filter === "all" ? undefined : filter);

  const nameById = useMemo(() => {
    const m = {};
    children.forEach(c => { m[c.studentId] = (c.studentName || "").split(" ")[0] || c.studentId; });
    return m;
  }, [children]);

  const summary  = data?.summary;
  const invoices = data?.invoices || [];
  const payments = data?.payments || [];
  const showChild = filter === "all" && children.length > 1;

  return (
    <div style={{ padding: spacing.lg, display: "flex", flexDirection: "column", gap: spacing.lg }}>

      <header style={{ padding: `${spacing.xs}px ${spacing.xs}px 0` }}>
        <h1 style={{ ...typography.h1, color: colors.text.primary, margin: 0 }}>Fees</h1>
        <p style={{ ...typography.caption, color: colors.text.muted, margin: `${spacing.xs}px 0 0` }}>
          Invoices & payments
        </p>
      </header>

      {/* Child switcher (multi-child) */}
      {children.length > 1 && (
        <div style={{ display: "flex", gap: spacing.sm, overflowX: "auto", paddingBottom: spacing.xs }}>
          <Pill label="All" active={filter === "all"} onClick={() => setFilter("all")} />
          {children.map(c => (
            <Pill key={c.studentId} label={nameById[c.studentId]} active={filter === c.studentId} onClick={() => setFilter(c.studentId)} />
          ))}
        </div>
      )}

      {loading ? (
        <CardSkeleton />
      ) : error ? (
        <ErrorNote message={error} />
      ) : (
        <>
          {/* Outstanding balance */}
          <OutstandingCard totalDue={summary?.totalDue || 0} counts={summary?.counts} />

          {/* My invoices */}
          <Card>
            <Label>My invoices</Label>
            {invoices.length === 0 ? (
              <Empty text="No invoices yet." />
            ) : (
              <div style={{ marginTop: spacing.sm }}>
                {invoices.map((inv, i) => {
                  const meta = statusOf(inv.status);
                  return (
                    <div key={inv.invoiceNumber + i} style={{
                      display: "flex", alignItems: "center", gap: spacing.md,
                      padding: `${spacing.md}px 0`,
                      borderBottom: i < invoices.length - 1 ? `1px solid ${colors.surface.border}` : "none",
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ ...typography.title, color: colors.text.primary }}>
                          {inv.feeType || "Fee"} {showChild ? `· ${nameById[inv.studentId] || inv.studentId}` : ""}
                        </div>
                        <div style={{ ...typography.meta, color: colors.text.muted }}>
                          {inv.invoiceNumber} · due {fmtDate(inv.dueDate)}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ ...typography.body, color: colors.text.primary, fontWeight: typography.weight.bold }}>
                          {inr(inv.totalAmount)}
                        </div>
                        {inv.balance > 0 && (
                          <div style={{ ...typography.meta, color: colors.dangerStrong }}>{inr(inv.balance)} due</div>
                        )}
                      </div>
                      <Badge meta={meta} />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Payment history */}
          <Card>
            <Label>Payment history</Label>
            {payments.length === 0 ? (
              <Empty text="No payments recorded yet." />
            ) : (
              <div style={{ marginTop: spacing.sm }}>
                {payments.map((p, i) => (
                  <div key={p.receiptNumber + i} style={{
                    display: "flex", alignItems: "center", gap: spacing.md,
                    padding: `${spacing.md}px 0`,
                    borderBottom: i < payments.length - 1 ? `1px solid ${colors.surface.border}` : "none",
                  }}>
                    {/* Payment success → the only green dot */}
                    <span style={{ width: 10, height: 10, borderRadius: radius.pill, background: colors.success, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...typography.body, color: colors.text.primary, fontWeight: typography.weight.semibold }}>
                        {inr(p.amount)} {showChild ? `· ${nameById[p.studentId] || p.studentId}` : ""}
                      </div>
                      <div style={{ ...typography.meta, color: colors.text.muted }}>
                        {fmtDate(p.paymentDate)}{p.paymentMode ? ` · ${p.paymentMode}` : ""}{p.receiptNumber ? ` · ${p.receiptNumber}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

// ── Outstanding balance ─────────────────────────────────────────────
function OutstandingCard({ totalDue, counts }) {
  const clear = totalDue <= 0;
  return (
    <div style={{
      background: clear ? colors.successSoft : colors.surface.card,
      borderRadius: radius.card,
      boxShadow: shadows.card,
      border: clear ? `1px solid ${colors.successBorder}` : `1px solid ${colors.surface.border}`,
      padding: spacing.lg,
    }}>
      <Label>Outstanding balance</Label>
      <div style={{ display: "flex", alignItems: "baseline", gap: spacing.sm, marginTop: spacing.sm }}>
        <span style={{ ...typography.hero, color: clear ? colors.successStrong : colors.text.primary }}>
          {inr(Math.max(0, totalDue))}
        </span>
        {clear && <span style={{ ...typography.caption, color: colors.successStrong, fontWeight: typography.weight.bold }}>All paid up ✓</span>}
      </div>
      {!clear && counts && (
        <div style={{ ...typography.caption, color: colors.text.muted, marginTop: spacing.xs }}>
          {(counts.overdue || 0) > 0 ? `${counts.overdue} overdue · ` : ""}
          {(counts.pending || 0) + (counts.partial || 0)} unpaid invoice{((counts.pending || 0) + (counts.partial || 0)) === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}

// ── Bits ────────────────────────────────────────────────────────────
function Badge({ meta }) {
  return (
    <span style={{
      ...typography.meta, fontWeight: typography.weight.bold,
      color: meta.fg, background: meta.bg, border: `1px solid ${meta.border}`,
      borderRadius: radius.pill, padding: `${spacing.xs}px ${spacing.md}px`, flexShrink: 0,
    }}>{meta.label}</span>
  );
}

function Pill({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      ...typography.caption, flexShrink: 0,
      padding: `${spacing.sm}px ${spacing.lg}px`, borderRadius: radius.pill, cursor: "pointer",
      fontWeight: typography.weight.bold,
      color: active ? colors.text.onYellow : colors.text.secondary,
      background: active ? colors.brand.gradient : colors.surface.card,
      border: `1px solid ${active ? "transparent" : colors.surface.border}`,
      boxShadow: active ? shadows.primary : "none",
    }}>{label}</button>
  );
}

function Card({ children }) {
  return (
    <div style={{ background: colors.surface.card, borderRadius: radius.card, boxShadow: shadows.card, padding: spacing.lg }}>
      {children}
    </div>
  );
}

function Label({ children }) {
  return (
    <span style={{
      ...typography.caption, textTransform: "uppercase", letterSpacing: typography.tracking.wider,
      color: colors.text.muted, fontWeight: typography.weight.bold,
    }}>{children}</span>
  );
}

function Empty({ text }) {
  return <p style={{ ...typography.body, color: colors.text.muted, margin: `${spacing.sm}px 0 0` }}>{text}</p>;
}

function ErrorNote({ message }) {
  return (
    <div style={{
      ...typography.body, color: colors.dangerStrong, background: colors.dangerSoft,
      border: `1px solid ${colors.dangerBorder}`, borderRadius: radius.md, padding: spacing.lg,
    }}>{message}</div>
  );
}

function CardSkeleton() {
  return (
    <Card>
      <div style={{ height: 12, width: "40%", borderRadius: radius.sm, background: colors.gray100, marginBottom: spacing.md }} />
      <div style={{ height: 36, width: "55%", borderRadius: radius.sm, background: colors.gray100 }} />
    </Card>
  );
}
