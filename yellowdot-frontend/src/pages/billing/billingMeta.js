/**
 * billingMeta.js — Billing & Payments · shared labels and formatters
 *
 * The vocabulary the backend enforces (services/billingService.js FEE_TYPES,
 * CADENCES, PAYMENT_MODES), paired with the words a person should actually
 * read. Kept in one place so a fee type is spelled the same on the catalogue
 * screen, the invoice form and the receipt.
 *
 * Nothing here computes money. Totals, balances and statuses all arrive
 * already derived from the API — see services/billingService.js.
 */

/** What a plan can charge for. Mirrors the backend's FEE_TYPES exactly. */
export const FEE_TYPES = [
  { value: "tuition",   label: "Tuition" },
  { value: "admission", label: "Admission" },
  { value: "daycare",   label: "Daycare" },
  { value: "transport", label: "Transport" },
  { value: "activity",  label: "Activity" },
  { value: "meals",     label: "Meals" },
  { value: "other",     label: "Other" },
];

/** How often a plan bills. Only `monthly` is picked up by the monthly run. */
export const CADENCES = [
  { value: "monthly",  label: "Every month" },
  { value: "termly",   label: "Each term" },
  { value: "one_time", label: "One time" },
];

/** How money arrived. Mirrors the backend's PAYMENT_MODES exactly. */
export const PAYMENT_MODES = [
  { value: "cash",          label: "Cash" },
  { value: "upi",           label: "UPI" },
  { value: "card",          label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque",        label: "Cheque" },
  { value: "other",         label: "Other" },
];

/** Every mode except cash needs a reference, which the server also enforces. */
export const MODES_NEEDING_REFERENCE = new Set(
  PAYMENT_MODES.map(m => m.value).filter(v => v !== "cash"),
);

/** The right word for the reference box, per mode. */
export const REFERENCE_LABEL = {
  upi:           "UPI reference (UTR)",
  card:          "Card transaction id",
  bank_transfer: "Bank reference (UTR)",
  cheque:        "Cheque number",
  other:         "Reference",
  cash:          "Reference (optional)",
};

export const INVOICE_STATUSES = ["Pending", "Partial", "Paid", "Overdue", "Void"];

/** The status options a filter should offer, for DataTable's filter bar. */
export const INVOICE_STATUS_OPTIONS = INVOICE_STATUSES.map(s => ({ value: s, label: s }));

const LABELS = Object.fromEntries([
  ...FEE_TYPES.map(f => [f.value, f.label]),
  ...CADENCES.map(c => [c.value, c.label]),
  ...PAYMENT_MODES.map(p => [p.value, p.label]),
]);

/** A stored enum value as the word a person reads. */
export function labelFor(value) {
  return LABELS[value] || value || "—";
}

/** Aging buckets, in the order they should be read. */
export const AGING_BUCKETS = [
  { key: "current", label: "Not yet due" },
  { key: "1-30",    label: "1–30 days" },
  { key: "31-60",   label: "31–60 days" },
  { key: "61-90",   label: "61–90 days" },
  { key: "90+",     label: "Over 90 days" },
];

/** Rupees, grouped the Indian way, with no decimals on a whole amount. */
export function inr(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "₹0";
  const whole = Number.isInteger(n);
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "2026-11-24" → "24 Nov 2026". Parsed as parts, never as a Date string. */
export function prettyDate(iso) {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "2026-11" → "November 2026". */
export function prettyPeriod(period) {
  if (typeof period !== "string" || !/^\d{4}-\d{2}$/.test(period)) return "—";
  const [y, m] = period.split("-").map(Number);
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
                  "August", "September", "October", "November", "December"];
  return `${MONTHS[m - 1]} ${y}`;
}

/** The current month as "YYYY-MM", in local time — never via toISOString(). */
export function currentPeriod(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Today as "YYYY-MM-DD", in local time. */
export function todayLocal(d = new Date()) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/** The last `count` months, newest first, as { value, label } for a Select. */
export function recentPeriods(count = 12, from = new Date()) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    const value = currentPeriod(d);
    return { value, label: prettyPeriod(value) };
  });
}

/**
 * A UPI deep link for the school's own payee details.
 *
 * This is a `upi://pay` URI rendered as a QR code: a parent scans it with any
 * UPI app, which pre-fills the payee and amount, and they confirm the payment
 * in their own app. Nothing in this product touches the money — no provider is
 * called, no gateway credential exists, and the school's staff record the
 * payment once they can see it has arrived.
 *
 * Returns "" when the school has not set a UPI ID, so the caller can hide the
 * QR rather than render one that resolves nowhere.
 */
export function upiLink({ upiId, upiName, amount, note } = {}) {
  if (!upiId) return "";
  const params = new URLSearchParams({ pa: upiId, cu: "INR" });
  if (upiName) params.set("pn", upiName);
  const n = Number(amount);
  if (Number.isFinite(n) && n > 0) params.set("am", n.toFixed(2));
  if (note) params.set("tn", String(note).slice(0, 50));
  return `upi://pay?${params.toString()}`;
}

/** Why generation skipped a child, in words. */
export const SKIP_REASONS = {
  inactive:         "No longer enrolled",
  already_invoiced: "Already invoiced for this month",
};

export default {
  FEE_TYPES, CADENCES, PAYMENT_MODES, MODES_NEEDING_REFERENCE, REFERENCE_LABEL,
  INVOICE_STATUSES, INVOICE_STATUS_OPTIONS, AGING_BUCKETS, SKIP_REASONS,
  labelFor, inr, prettyDate, prettyPeriod, currentPeriod, todayLocal,
  recentPeriods, upiLink,
};
