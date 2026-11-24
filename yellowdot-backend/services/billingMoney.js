/**
 * billingMoney.js — Billing & Payments · money and period arithmetic
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure functions. No Firestore, no side effects, no dates read from anywhere
 * but the argument — so every rule below is testable in plain Node, which is
 * the point: this file is where the module can actually be wrong about money.
 *
 * ── Why amounts are summed as integer paise ───────────────────────────────────
 * Rupee amounts are stored as JavaScript numbers, and an itemised invoice sums
 * several of them. Adding them as floats drifts:
 *
 *   1041.35 + 2678.95 + 310.7  →  4031.000000000001
 *
 * Rounding the result hides it for three lines and stops hiding it for thirty,
 * because each addition contributes its own error. `sumMoney` converts every
 * amount to whole paise first, sums integers, and divides once at the end —
 * so the total of any number of 2-decimal amounts is exact. The old module
 * summed with a plain `.reduce((t, i) => t + i.amount, 0)`, which is how a
 * balance ends up at 0.009999999999990905 and an invoice that is fully paid
 * reads as Partial forever.
 *
 * ── Why dates are formatted in local time ─────────────────────────────────────
 * Carried over verbatim from the deleted rebuild (f1796e9), which found this
 * the hard way: `toISOString().slice(0, 10)` converts to UTC first, so in IST
 * (+05:30) local midnight lands on the previous UTC day. That turned 31 August
 * into the 30th, and dated every invoice raised before 05:30 IST as yesterday.
 */

/** Paise per rupee. Amounts are held to two decimals everywhere. */
const PAISE = 100;

/**
 * Coerce any incoming amount to a rupee value rounded to 2 decimals.
 * Form fields arrive as strings, and legacy rows carried "₹1,200" shapes, so
 * stripping non-numerics is deliberate rather than defensive.
 */
function money(v) {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * PAISE) / PAISE : 0;
  const n = parseFloat(String(v == null ? "" : v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n * PAISE) / PAISE : 0;
}

/** A rupee amount as whole paise. The unit all arithmetic happens in. */
function toPaise(v) {
  return Math.round(money(v) * PAISE);
}

/** Whole paise back to a rupee amount. */
function fromPaise(p) {
  return Math.round(Number(p) || 0) / PAISE;
}

/**
 * Exact sum of rupee amounts. Accepts raw values, or objects plus a field name:
 *   sumMoney([10.1, 20.2])
 *   sumMoney(lines, "amount")
 */
function sumMoney(items, field) {
  if (!Array.isArray(items) || items.length === 0) return 0;
  let paise = 0;
  for (const item of items) {
    paise += toPaise(field ? item?.[field] : item);
  }
  return fromPaise(paise);
}

/** a - b, exactly. */
function subtractMoney(a, b) {
  return fromPaise(toPaise(a) - toPaise(b));
}

/** a + b, exactly. */
function addMoney(a, b) {
  return fromPaise(toPaise(a) + toPaise(b));
}

/** True when the two amounts are the same to the paise. */
function equalMoney(a, b) {
  return toPaise(a) === toPaise(b);
}

// ── Dates and periods ────────────────────────────────────────────────────────

/** "YYYY-MM-DD" for a Date, in LOCAL time. Never toISOString — see the header. */
function localDate(d = new Date()) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Today as "YYYY-MM-DD", local time. */
function today() {
  return localDate();
}

/** "YYYY-MM" for a Date (or today), in local time. */
function periodOf(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** True for a well-formed "YYYY-MM". */
function isPeriod(v) {
  if (typeof v !== "string" || !/^\d{4}-\d{2}$/.test(v)) return false;
  const month = Number(v.slice(5, 7));
  return month >= 1 && month <= 12;
}

/** True for a well-formed "YYYY-MM-DD". */
function isISODate(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/** Last calendar day of a "YYYY-MM" period, as "YYYY-MM-DD". */
function periodEnd(period) {
  if (!isPeriod(period)) {
    const e = new Error(`"${period}" is not a YYYY-MM period.`);
    e.code = "VALIDATION";
    throw e;
  }
  const [y, m] = period.split("-").map(Number);
  // Day 0 of the following month is the last day of this one, and handles
  // February in a leap year without a table.
  return localDate(new Date(y, m, 0));
}

/**
 * The status an invoice has, derived from its own numbers every time it is
 * written — never stored independently of them, so it cannot drift from
 * paidAmount the way the pre-deletion module's did.
 *
 * `paid >= total` rather than the rebuild's `total > 0 && paid >= total`: an
 * invoice credited down to zero owes nothing, and under the old condition fell
 * through to Overdue once its due date passed, chasing a family for ₹0.
 */
function statusFor({ totalAmount, paidAmount, dueDate, voided = false, asOf = today() }) {
  if (voided) return "Void";

  const totalPaise = toPaise(totalAmount);
  const paidPaise  = toPaise(paidAmount);

  if (paidPaise >= totalPaise) return "Paid";
  if (isISODate(dueDate) && dueDate < asOf) return "Overdue";
  if (paidPaise > 0) return "Partial";
  return "Pending";
}

/** Every status an invoice can hold. */
const INVOICE_STATUSES = Object.freeze(["Pending", "Partial", "Paid", "Overdue", "Void"]);

/**
 * Aging bucket for an unpaid invoice, in whole days past due.
 * Buckets match what the audit asked Collections to show.
 */
function agingBucket(dueDate, asOf = today()) {
  if (!isISODate(dueDate) || dueDate >= asOf) return "current";
  const days = Math.floor((Date.parse(asOf) - Date.parse(dueDate)) / 86400000);
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

/** Collected ÷ billed as a 0-100 percentage. 0 when nothing is billed. */
function collectionRate(billed, collected) {
  const b = toPaise(billed);
  if (b <= 0) return 0;
  return Math.round((toPaise(collected) / b) * 1000) / 10;
}

module.exports = {
  PAISE,
  money, toPaise, fromPaise,
  sumMoney, addMoney, subtractMoney, equalMoney,
  localDate, today, periodOf, periodEnd, isPeriod, isISODate,
  statusFor, INVOICE_STATUSES, agingBucket, collectionRate,
};
