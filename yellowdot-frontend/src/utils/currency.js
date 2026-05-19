/**
 * currency.js — Yellow Dot centralized money utilities
 * ──────────────────────────────────────────────────────
 * Google Sheets returns every cell as a STRING.
 * Any amount field that hasn't been explicitly parsed with Number() will
 * trigger JavaScript string-concatenation in reduce():
 *
 *   0 + "5000"           → "05000"       (string)
 *   "05000" + "3000"     → "050003000"   (string) ← produces ₹18,73,35,31,910
 *
 * Rules enforced here:
 *   1. parseCurrency()  — ALWAYS use this before any arithmetic on a money field
 *   2. sumAmounts()     — use in place of .reduce((s,i) => s + i.someField, 0)
 *   3. formatCurrency() — use for display; wraps toLocaleString("en-IN")
 *
 * Import from here everywhere. Never inline `Number(x) || 0` without a comment.
 */

// ── Core parsers ──────────────────────────────────────────────────────────────

/**
 * Safely parse any value to a finite number.
 * Returns 0 for null, undefined, empty string, NaN, Infinity.
 *
 * @param {any} value — raw amount from API, sheet, or form input
 * @returns {number}
 */
export function parseCurrency(value) {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return isFinite(n) ? n : 0;
}

/**
 * Format a numeric amount as Indian Rupee string.
 * Calls parseCurrency() first so string inputs are handled safely.
 *
 * @param {any}    value   — amount (number or string)
 * @param {object} [opts]
 * @param {boolean} [opts.showSymbol=true]  — prefix with ₹
 * @param {number}  [opts.decimals]         — fixed decimal places (default: auto)
 * @returns {string}
 */
export function formatCurrency(value, opts = {}) {
  const n = parseCurrency(value);
  const { showSymbol = true, decimals } = opts;

  const formatted = decimals !== undefined
    ? n.toFixed(decimals)
    : n.toLocaleString("en-IN");

  return showSymbol ? `₹${formatted}` : formatted;
}

// Shorthand alias — matches the inline `INR` function used across the codebase
export const INR = formatCurrency;

/**
 * Sum an array of objects by a numeric field.
 * Applies parseCurrency() to every item so strings are never concatenated.
 *
 * @param {object[]} items  — array to reduce
 * @param {string}   field  — field name to extract from each item
 * @returns {number}
 *
 * @example
 *   sumAmounts(invoices, "totalAmount")   // always returns a number
 *   sumAmounts(invoices, "paidAmount")
 *   sumAmounts(invoices, "balance")
 */
export function sumAmounts(items, field) {
  if (!Array.isArray(items) || items.length === 0) return 0;
  return items.reduce((acc, item) => acc + parseCurrency(item?.[field]), 0);
}

/**
 * Sum an array of raw numbers / strings.
 * Useful when you already have an array of amount values.
 *
 * @param {any[]} values
 * @returns {number}
 *
 * @example
 *   sumValues([500, "300", null, "200"])  // → 1000
 */
export function sumValues(values) {
  if (!Array.isArray(values)) return 0;
  return values.reduce((acc, v) => acc + parseCurrency(v), 0);
}

/**
 * Calculate the percentage of paid vs total.
 * Returns 0 if total is 0 (avoids division-by-zero).
 * Clamps to [0, 100].
 *
 * @param {any} paid
 * @param {any} total
 * @returns {number} 0–100
 */
export function paymentPercent(paid, total) {
  const p = parseCurrency(paid);
  const t = parseCurrency(total);
  if (t <= 0) return 0;
  return Math.min(100, Math.max(0, (p / t) * 100));
}

/**
 * Compute invoice totals from component parts.
 * All inputs are parsed, so strings are safe.
 *
 * @param {{ amount, gst, discount }} parts
 * @returns {{ amount, gst, discount, totalAmount }}
 */
export function computeInvoiceTotals({ amount, gst, discount }) {
  const a = parseCurrency(amount);
  const g = parseCurrency(gst);
  const d = parseCurrency(discount);
  return {
    amount:      a,
    gst:         g,
    discount:    d,
    totalAmount: a + g - d,
  };
}
