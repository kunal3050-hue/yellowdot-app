/**
 * domain/valueObjects.js — Finance domain value objects (Sprint 1 review,
 * Recommended Improvement 2).
 * ────────────────────────────────────────────────────────────────────
 * Immutable primitives for the Finance domain, per the review: "Introduce
 * immutable domain value objects instead of passing primitive values
 * throughout the Finance domain... improves readability, consistency and
 * reduces financial bugs."
 *
 * Deliberately a new `domain/` folder rather than `services/` — these are
 * pure, dependency-free (no Firestore, no I/O) value types, unlike every
 * `services/*.js` file, which is a distinction worth keeping visible in
 * the folder structure.
 *
 * NOT yet adopted inside the Sprint 1 services (studentLedgerService,
 * ledgerEntryService, billingPlanService, familyAccountService,
 * financeSettingsService) — those already work, are tested, and pass
 * plain numbers today. Rewiring them to these types is future work, not
 * this pass. `admissionFinanceService.js` (Sprint 2) uses `Money` where it
 * naturally fits, since that file is new code with nothing to risk.
 *
 * Every value object is immutable: constructing one never mutates its
 * inputs, and every operation (`.add()`, `.of()`, etc.) returns a *new*
 * instance rather than modifying `this`. Instances are frozen with
 * `Object.freeze()`.
 */

// ── Money ───────────────────────────────────────────────────────────

class Money {
  constructor(amount, currency = "INR") {
    const n = Number(amount);
    if (!isFinite(n)) { const e = new Error("Money amount must be a finite number."); e.code = "VALIDATION"; throw e; }
    this.amount   = Math.round(n * 100) / 100; // 2 decimal places, avoids float drift
    this.currency = currency;
    Object.freeze(this);
  }

  static zero(currency = "INR") { return new Money(0, currency); }

  _assertSameCurrency(other) {
    if (other.currency !== this.currency) {
      const e = new Error(`Cannot combine Money in different currencies (${this.currency} vs ${other.currency}).`);
      e.code = "VALIDATION"; throw e;
    }
  }

  add(other) {
    this._assertSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other) {
    this._assertSameCurrency(other);
    return new Money(this.amount - other.amount, this.currency);
  }

  isNegative() { return this.amount < 0; }
  isZero()     { return this.amount === 0; }

  toNumber() { return this.amount; }
  toString() { return `${this.currency} ${this.amount.toFixed(2)}`; }
}

// ── Percentage ──────────────────────────────────────────────────────

class Percentage {
  constructor(value) {
    const n = Number(value);
    if (!isFinite(n) || n < 0 || n > 100) {
      const e = new Error("Percentage must be a number between 0 and 100."); e.code = "VALIDATION"; throw e;
    }
    this.value = n;
    Object.freeze(this);
  }

  /** of(money) — returns a new Money representing this percentage of the given amount. */
  of(money) {
    if (!(money instanceof Money)) { const e = new Error("Percentage.of() requires a Money instance."); e.code = "VALIDATION"; throw e; }
    return new Money(money.amount * (this.value / 100), money.currency);
  }

  toString() { return `${this.value}%`; }
}

// ── BillingPeriod ───────────────────────────────────────────────────

const VALID_CADENCES = new Set(["monthly", "termly", "oneTime"]);

class BillingPeriod {
  constructor(cadence, startDate, endDate = "") {
    if (!VALID_CADENCES.has(cadence)) { const e = new Error(`Invalid cadence "${cadence}".`); e.code = "VALIDATION"; throw e; }
    if (!startDate) { const e = new Error("startDate is required."); e.code = "VALIDATION"; throw e; }
    this.cadence   = cadence;
    this.startDate = startDate;
    this.endDate   = endDate;
    Object.freeze(this);
  }

  /** includes(dateStr) — true if the given YYYY-MM-DD date falls within [startDate, endDate). Open-ended (no endDate) means "still running". */
  includes(dateStr) {
    if (dateStr < this.startDate) return false;
    if (this.endDate && dateStr >= this.endDate) return false;
    return true;
  }

  isOpenEnded() { return !this.endDate; }
}

// ── LedgerBalance ───────────────────────────────────────────────────
// A semantic wrapper distinguishing "owed" vs "settled" vs "in credit" —
// the same signed number ledgerEntryService already computes, given a name
// that makes its meaning explicit wherever it's read.

class LedgerBalance {
  constructor(amount, currency = "INR") {
    this.money = new Money(amount, currency);
    Object.freeze(this);
  }

  get status() {
    if (this.money.isZero())     return "settled";
    if (this.money.isNegative()) return "credit";
    return "owed";
  }

  toNumber() { return this.money.toNumber(); }
  toString() { return `${this.money.toString()} (${this.status})`; }
}

// ── FeeAmount ───────────────────────────────────────────────────────
// A Money amount labeled with the Fee Component category it belongs to —
// e.g. one line of a multi-line invoice ("Tuition: INR 5000.00").

class FeeAmount {
  constructor(feeComponentId, label, money) {
    if (!feeComponentId) { const e = new Error("feeComponentId is required."); e.code = "VALIDATION"; throw e; }
    if (!(money instanceof Money)) { const e = new Error("FeeAmount requires a Money instance."); e.code = "VALIDATION"; throw e; }
    this.feeComponentId = feeComponentId;
    this.label          = label || "";
    this.money          = money;
    Object.freeze(this);
  }

  toString() { return `${this.label || this.feeComponentId}: ${this.money.toString()}`; }
}

module.exports = { Money, Percentage, BillingPeriod, LedgerBalance, FeeAmount };
