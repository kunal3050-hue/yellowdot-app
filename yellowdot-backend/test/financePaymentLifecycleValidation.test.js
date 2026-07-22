/**
 * Finance Foundation — Sprint 4 Validation: complete Payment Lifecycle
 * realistic scenarios.
 *
 * Same style and discipline as test/financeBillingEngineValidation.test.js
 * (Sprint 3's validation): runs the REAL, unmodified service code end to
 * end — financeInvoiceService, ledgerEntryService, studentLedgerService,
 * financePaymentService, financePaymentAllocationService,
 * financeAllocationStrategies, financeCreditConsumptionService,
 * financeRefundReversalService, familyAccountService,
 * financeSettingsService, financeAuditService — wired together against
 * one shared in-memory fake Firestore, not each function mocked
 * individually. Real Firestore is never touched.
 *
 * Scenarios, matching the user's exact validation checklist:
 *   1. Full payment against a single invoice
 *   2. Partial payment + remaining outstanding balance
 *   3. One payment allocated across multiple invoices/ledgers, same family
 *   4. Overpayment becomes Family Account credit
 *   5. Existing credit automatically consumed by a later invoice
 *   6. Receipt numbering + uniqueness
 *   7. Refund below the approval threshold (auto-processed)
 *   8. Refund above the approval threshold (approval workflow, + rejection path)
 *   9. Payment reversal — immutable ledger history preserved
 *  10. Ledger balance reconciliation after multiple payments/refunds
 *  11. Complete audit trail for every financial action
 *  12. Tenant isolation
 *  13. RBAC / finance-refund-approval permission separation
 *  14. Idempotency for repeated payment/allocation requests
 */
const test   = require("node:test");
const assert = require("node:assert");

const { db }           = require("../firebaseAdmin");
const { createFakeFirestore } = require("./helpers/fakeFirestore");

const fake = createFakeFirestore();
const originalCollection     = db.collection;
const originalRunTransaction = db.runTransaction;
db.collection     = fake.collection;
db.runTransaction = fake.runTransaction;

const studentLedgerSvc = require("../services/studentLedgerService");
const invoiceSvc       = require("../services/financeInvoiceService");
const ledgerEntrySvc   = require("../services/ledgerEntryService");
const paymentSvc       = require("../services/financePaymentService");
const allocationSvc    = require("../services/financePaymentAllocationService");
const creditSvc        = require("../services/financeCreditConsumptionService");
const refundSvc        = require("../services/financeRefundReversalService");
const familyAccountSvc = require("../services/familyAccountService");
const settingsSvc      = require("../services/financeSettingsService");
const auditSvc         = require("../services/financeAuditService");

const SCHOOL = "school-validate4";

// ── Fixtures: one family, two children ──────────────────────────────────
// families/{familyId} needs to exist for familyAccountService to attach
// a financeAccount sub-object to (ensureFinanceAccount requires the doc
// to already exist), and needs studentIds for the allocation engine to
// discover the family's outstanding ledgers.
fake.seed("families", "FAM-V1", { schoolId: SCHOOL, studentIds: ["YD-V-A", "YD-V-B"] });

let invA1, invB1, invA2, invA3, invB2;
let paymentIds = {};

test("Setup: ledgers, family account, refund threshold, and two students' initial invoices", async () => {
  await studentLedgerSvc.createLedger("YD-V-A", { schoolId: SCHOOL, centerId: "seawoods", familyId: "FAM-V1", actorUserId: "staff-1" });
  await studentLedgerSvc.createLedger("YD-V-B", { schoolId: SCHOOL, centerId: "seawoods", familyId: "FAM-V1", actorUserId: "staff-1" });
  await familyAccountSvc.ensureFinanceAccount("FAM-V1", { schoolId: SCHOOL, actorUserId: "staff-1" });
  await settingsSvc.updateSettings(SCHOOL, { refundApprovalThreshold: 1000 }, { actorUserId: "staff-1" });

  invA1 = await invoiceSvc.createInvoice(
    { studentId: "YD-V-A", studentName: "Child A", lines: [{ feeComponentId: "TPL-TUITION", label: "Tuition (July)", amount: 3000 }] },
    { schoolId: SCHOOL, centerId: "seawoods", actorUserId: "staff-1" }
  );
  await ledgerEntrySvc.createEntry("YD-V-A", { type: "charge", amount: 3000, sourceType: "invoice", sourceId: invA1.invoiceId }, { schoolId: SCHOOL, actorUserId: "staff-1" });

  invB1 = await invoiceSvc.createInvoice(
    { studentId: "YD-V-B", studentName: "Child B", lines: [{ feeComponentId: "TPL-DAYCARE", label: "Daycare (July)", amount: 2000 }] },
    { schoolId: SCHOOL, centerId: "seawoods", actorUserId: "staff-1" }
  );
  await ledgerEntrySvc.createEntry("YD-V-B", { type: "charge", amount: 2000, sourceType: "invoice", sourceId: invB1.invoiceId }, { schoolId: SCHOOL, actorUserId: "staff-1" });

  const ledgerA = await studentLedgerSvc.getLedger("YD-V-A", { schoolId: SCHOOL });
  const ledgerB = await studentLedgerSvc.getLedger("YD-V-B", { schoolId: SCHOOL });
  assert.equal(ledgerA.currentBalance, 3000);
  assert.equal(ledgerB.currentBalance, 2000);
});

// ── Scenario 1: full payment against a single invoice ───────────────────
test("Scenario 1 — full payment against a single invoice pays it off exactly", async () => {
  const payment = await paymentSvc.recordPayment(
    { familyId: "FAM-V1", studentId: "YD-V-A", amount: 3000, paymentMode: "UPI" },
    { schoolId: SCHOOL, centerId: "seawoods", actorUserId: "staff-1" }
  );
  paymentIds.p1 = payment.paymentId;

  const result = await allocationSvc.allocatePayment(payment.paymentId, {
    schoolId: SCHOOL, actorUserId: "staff-1", strategyOverride: "manual",
    manualAllocations: [{ studentLedgerId: "YD-V-A", amount: 3000 }],
  });

  assert.equal(result.payment.status, "Allocated");
  assert.equal(result.creditApplied, 0);

  const ledgerA = await studentLedgerSvc.getLedger("YD-V-A", { schoolId: SCHOOL });
  assert.equal(ledgerA.currentBalance, 0);
});

// ── Scenario 2: partial payment + remaining outstanding balance ─────────
test("Scenario 2 — a partial payment fully resolves the payment itself while leaving a remaining ledger balance", async () => {
  const payment = await paymentSvc.recordPayment(
    { familyId: "FAM-V1", studentId: "YD-V-B", amount: 1200, paymentMode: "Cash" },
    { schoolId: SCHOOL, actorUserId: "staff-1" }
  );
  paymentIds.p2 = payment.paymentId;

  const result = await allocationSvc.allocatePayment(payment.paymentId, {
    schoolId: SCHOOL, actorUserId: "staff-1", strategyOverride: "manual",
    manualAllocations: [{ studentLedgerId: "YD-V-B", amount: 1200 }],
  });

  // The PAYMENT is fully allocated (all 1200 of it went where intended)...
  assert.equal(result.payment.status, "Allocated");
  // ...but the INVOICE/ledger still has a remaining outstanding balance.
  const ledgerB = await studentLedgerSvc.getLedger("YD-V-B", { schoolId: SCHOOL });
  assert.equal(ledgerB.currentBalance, 800); // 2000 - 1200
});

// ── Scenario 3: one payment allocated across multiple invoices, same family ──
test("Scenario 3 — a single payment settles outstanding charges across both children in the family", async () => {
  invA2 = await invoiceSvc.createInvoice(
    { studentId: "YD-V-A", studentName: "Child A", lines: [{ feeComponentId: "TPL-TUITION", label: "Tuition (August)", amount: 1000 }] },
    { schoolId: SCHOOL, actorUserId: "staff-1" }
  );
  await ledgerEntrySvc.createEntry("YD-V-A", { type: "charge", amount: 1000, sourceType: "invoice", sourceId: invA2.invoiceId }, { schoolId: SCHOOL, actorUserId: "staff-1" });

  // Outstanding now: Child A owes 1000 (August), Child B owes 800 (remaining July).
  const payment = await paymentSvc.recordPayment(
    { familyId: "FAM-V1", amount: 1800, paymentMode: "BankTransfer" },
    { schoolId: SCHOOL, actorUserId: "staff-1" }
  );
  paymentIds.p3 = payment.paymentId;

  const result = await allocationSvc.allocatePayment(payment.paymentId, { schoolId: SCHOOL, actorUserId: "staff-1", strategyOverride: "oldestDueFirst" });

  assert.equal(result.allocations.length, 2); // both ledgers settled by one payment
  assert.equal(result.payment.status, "Allocated");
  assert.equal(result.creditApplied, 0); // exact match, no leftover

  const ledgerA = await studentLedgerSvc.getLedger("YD-V-A", { schoolId: SCHOOL });
  const ledgerB = await studentLedgerSvc.getLedger("YD-V-B", { schoolId: SCHOOL });
  assert.equal(ledgerA.currentBalance, 0);
  assert.equal(ledgerB.currentBalance, 0);
});

// ── Scenario 4: overpayment becomes Family Account credit ───────────────
test("Scenario 4 — an overpayment beyond every outstanding ledger becomes Family Account credit", async () => {
  invA3 = await invoiceSvc.createInvoice(
    { studentId: "YD-V-A", studentName: "Child A", lines: [{ feeComponentId: "TPL-TUITION", label: "Tuition (September)", amount: 500 }] },
    { schoolId: SCHOOL, actorUserId: "staff-1" }
  );
  await ledgerEntrySvc.createEntry("YD-V-A", { type: "charge", amount: 500, sourceType: "invoice", sourceId: invA3.invoiceId }, { schoolId: SCHOOL, actorUserId: "staff-1" });

  const payment = await paymentSvc.recordPayment(
    { familyId: "FAM-V1", amount: 700, paymentMode: "UPI" }, // 200 more than the 500 owed
    { schoolId: SCHOOL, actorUserId: "staff-1" }
  );
  paymentIds.p4 = payment.paymentId;

  const result = await allocationSvc.allocatePayment(payment.paymentId, { schoolId: SCHOOL, actorUserId: "staff-1", strategyOverride: "oldestDueFirst" });

  assert.equal(result.creditApplied, 200);
  assert.equal(result.payment.status, "Allocated"); // self-resolving

  const financeAccount = await familyAccountSvc.getFinanceAccount("FAM-V1", { schoolId: SCHOOL });
  assert.equal(financeAccount.creditBalance, 200);
});

// ── Scenario 5: existing credit automatically consumed by a later invoice ──
test("Scenario 5 — available Family Account credit is automatically applied to a new charge", async () => {
  invB2 = await invoiceSvc.createInvoice(
    { studentId: "YD-V-B", studentName: "Child B", lines: [{ feeComponentId: "TPL-DAYCARE", label: "Daycare (October)", amount: 150 }] },
    { schoolId: SCHOOL, actorUserId: "staff-1" }
  );
  await ledgerEntrySvc.createEntry("YD-V-B", { type: "charge", amount: 150, sourceType: "invoice", sourceId: invB2.invoiceId }, { schoolId: SCHOOL, actorUserId: "staff-1" });

  const result = await creditSvc.applyAvailableCredit("YD-V-B", 150, { schoolId: SCHOOL, actorUserId: "staff-1", familyId: "FAM-V1", sourceId: invB2.invoiceId });

  assert.equal(result.creditApplied, 150);
  assert.equal(result.remainingAmount, 0); // no fresh payment needed at all

  const ledgerB = await studentLedgerSvc.getLedger("YD-V-B", { schoolId: SCHOOL });
  assert.equal(ledgerB.currentBalance, 0);

  const financeAccount = await familyAccountSvc.getFinanceAccount("FAM-V1", { schoolId: SCHOOL });
  assert.equal(financeAccount.creditBalance, 50); // 200 - 150 remaining for future use
});

// ── Scenario 6: receipt numbering + uniqueness ───────────────────────────
test("Scenario 6 — every recorded payment has a unique, correctly-formatted, monotonically-increasing receipt number", async () => {
  const p1 = await paymentSvc.getPayment(paymentIds.p1, { schoolId: SCHOOL });
  const p2 = await paymentSvc.getPayment(paymentIds.p2, { schoolId: SCHOOL });
  const p3 = await paymentSvc.getPayment(paymentIds.p3, { schoolId: SCHOOL });
  const p4 = await paymentSvc.getPayment(paymentIds.p4, { schoolId: SCHOOL });

  const receipts = [p1, p2, p3, p4].map((p) => p.receiptNumber);
  for (const r of receipts) assert.match(r, /^FRCPT-\d{6}-\d{5}$/);

  const uniqueReceipts = new Set(receipts);
  assert.equal(uniqueReceipts.size, receipts.length, "every receipt number must be unique");

  const sequences = receipts.map((r) => Number(r.split("-")[2]));
  for (let i = 1; i < sequences.length; i++) {
    assert.ok(sequences[i] > sequences[i - 1], `receipt sequence must strictly increase: ${receipts[i - 1]} -> ${receipts[i]}`);
  }
});

// ── Scenario 7: refund below the approval threshold ─────────────────────
test("Scenario 7 — a refund below the approval threshold auto-processes immediately", async () => {
  const result = await refundSvc.requestRefund(paymentIds.p1, 300, { schoolId: SCHOOL, actorUserId: "staff-1", reason: "goodwill adjustment" });

  assert.equal(result.processed, true);
  assert.equal(result.refund.status, "Processed");
  assert.equal(result.payment.status, "PartiallyRefunded"); // 300 of 3000 refunded so far
});

// ── Scenario 8: refund above the approval threshold — approval workflow ──
test("Scenario 8 — a refund at/above the approval threshold requires explicit approval before processing, and a separate request can be rejected", async () => {
  const requestResult = await refundSvc.requestRefund(paymentIds.p1, 1500, { schoolId: SCHOOL, actorUserId: "staff-1", reason: "service cancellation" });
  assert.equal(requestResult.processed, false);
  assert.equal(requestResult.refund.status, "Requested");

  // Confirm it is genuinely pending — not silently processed.
  const pending = await refundSvc.getRefund(requestResult.refund.refundId, { schoolId: SCHOOL });
  assert.equal(pending.status, "Requested");

  const approveResult = await refundSvc.approveRefund(requestResult.refund.refundId, { schoolId: SCHOOL, actorUserId: "approver-1" });
  assert.equal(approveResult.refund.status, "Processed");
  // 300 (Scenario 7) + 1500 (this) = 1800 of 3000 refunded -> still PartiallyRefunded.
  assert.equal(approveResult.payment.status, "PartiallyRefunded");

  // A separate, above-threshold request on a DIFFERENT payment (P3, 1800,
  // still fully Allocated) can instead be rejected — the ledger and the
  // payment's refundedAmount must be completely untouched by a rejection.
  const ledgerABeforeReject = await studentLedgerSvc.getLedger("YD-V-A", { schoolId: SCHOOL });
  const rejectCandidate = await refundSvc.requestRefund(paymentIds.p3, 1200, { schoolId: SCHOOL, actorUserId: "staff-1", reason: "will be rejected" });
  assert.equal(rejectCandidate.processed, false);
  assert.equal(rejectCandidate.refund.status, "Requested");

  const rejected = await refundSvc.rejectRefund(rejectCandidate.refund.refundId, { schoolId: SCHOOL, actorUserId: "approver-1", reason: "not eligible" });
  assert.equal(rejected.status, "Rejected");

  const p3AfterReject = await paymentSvc.getPayment(paymentIds.p3, { schoolId: SCHOOL });
  assert.equal(p3AfterReject.refundedAmount, 0, "a rejected refund must never touch the payment's refundedAmount");
  const ledgerAAfterReject = await studentLedgerSvc.getLedger("YD-V-A", { schoolId: SCHOOL });
  assert.equal(ledgerAAfterReject.currentBalance, ledgerABeforeReject.currentBalance, "a rejected refund must never touch the ledger");

  // Requesting more than a payment's refundable remainder is rejected
  // outright (the refundable-remainder guard), distinct from the
  // Requested -> Rejected workflow above.
  await assert.rejects(
    () => refundSvc.requestRefund(paymentIds.p4, 1000, { schoolId: SCHOOL, actorUserId: "staff-1", reason: "exceeds refundable amount" }),
    (err) => err.code === "VALIDATION"
  );
});

// ── Scenario 9: payment reversal — immutable ledger history preserved ───
test("Scenario 9 — reversing a payment appends an offsetting entry and never mutates prior history", async () => {
  const entriesBefore = await ledgerEntrySvc.listForLedger("YD-V-B", { schoolId: SCHOOL });
  const originalPaymentEntry = entriesBefore.find((e) => e.sourceType === "payment" && e.sourceId === paymentIds.p2);
  assert.ok(originalPaymentEntry, "the original payment entry must exist before reversal");
  const originalEntrySnapshot = { ...originalPaymentEntry };

  const ledgerBBefore = await studentLedgerSvc.getLedger("YD-V-B", { schoolId: SCHOOL });

  const reversed = await refundSvc.reversePayment(paymentIds.p2, { schoolId: SCHOOL, actorUserId: "staff-1", reason: "cheque bounced" });
  assert.equal(reversed.status, "Reversed");

  const entriesAfter = await ledgerEntrySvc.listForLedger("YD-V-B", { schoolId: SCHOOL });
  assert.equal(entriesAfter.length, entriesBefore.length + 1, "exactly one new offsetting entry must be appended");

  // The ORIGINAL entry must be byte-for-byte unchanged — immutability preserved.
  const originalStillPresent = entriesAfter.find((e) => e.entryId === originalEntrySnapshot.entryId);
  assert.deepEqual(originalStillPresent, originalEntrySnapshot);

  // Balance restored: the earlier -1200 payment effect is undone (+1200).
  const ledgerBAfter = await studentLedgerSvc.getLedger("YD-V-B", { schoolId: SCHOOL });
  assert.equal(ledgerBAfter.currentBalance, ledgerBBefore.currentBalance + 1200);
});

// ── Scenario 10: ledger balance reconciliation ───────────────────────────
test("Scenario 10 — every ledger's balance still equals the exact sum of its own entries' signed amounts after payments and refunds", async () => {
  for (const studentId of ["YD-V-A", "YD-V-B"]) {
    const ledger  = await studentLedgerSvc.getLedger(studentId, { schoolId: SCHOOL });
    const entries = await ledgerEntrySvc.listForLedger(studentId, { schoolId: SCHOOL });
    const reconciledTotal = entries.reduce((sum, e) => sum + e.signedAmount, 0);
    assert.equal(reconciledTotal, ledger.currentBalance, `${studentId}: reconciliation mismatch`);
  }
});

// ── Scenario 11: complete audit trail for every financial action ────────
test("Scenario 11 — every financial action left a matching, retrievable audit log entry", async () => {
  const paymentLogsP1 = await auditSvc.listForEntity({ schoolId: SCHOOL, entityType: "payment", entityId: paymentIds.p1 });
  assert.ok(paymentLogsP1.some((l) => l.action === "financePayment.record"));
  assert.ok(paymentLogsP1.some((l) => l.action === "financePayment.allocate"));

  const paymentLogsP2 = await auditSvc.listForEntity({ schoolId: SCHOOL, entityType: "payment", entityId: paymentIds.p2 });
  assert.ok(paymentLogsP2.some((l) => l.action === "financePayment.reverse"));

  const allLogs = fake.all("financeAuditLogs").filter((l) => l.schoolId === SCHOOL);
  assert.ok(allLogs.some((l) => l.action === "financeRefund.request"));
  assert.ok(allLogs.some((l) => l.action === "financeRefund.approve"));
  assert.ok(allLogs.some((l) => l.action === "financeRefund.process"));
  assert.ok(allLogs.some((l) => l.action === "financeCredit.apply"));
  assert.ok(allLogs.some((l) => l.action === "familyAccount.adjustCredit"));
  assert.ok(allLogs.some((l) => l.action.startsWith("ledgerEntry.create.")));
});

// ── Scenario 12: tenant isolation ────────────────────────────────────────
test("Scenario 12 — a different school can never read or act on this family's payments, refunds, or ledgers", async () => {
  const OTHER_SCHOOL = "school-other4";
  const ledgerABefore = await studentLedgerSvc.getLedger("YD-V-A", { schoolId: SCHOOL });

  assert.equal(await paymentSvc.getPayment(paymentIds.p1, { schoolId: OTHER_SCHOOL }), null);
  assert.equal(await studentLedgerSvc.getLedger("YD-V-A", { schoolId: OTHER_SCHOOL }), null);
  assert.equal(await familyAccountSvc.getFinanceAccount("FAM-V1", { schoolId: OTHER_SCHOOL }), null);

  await assert.rejects(
    () => allocationSvc.allocatePayment(paymentIds.p3, { schoolId: OTHER_SCHOOL, actorUserId: "intruder" }),
    (err) => err.code === "NOT_FOUND"
  );
  await assert.rejects(
    () => refundSvc.requestRefund(paymentIds.p1, 100, { schoolId: OTHER_SCHOOL, actorUserId: "intruder" }),
    (err) => err.code === "NOT_FOUND"
  );
  await assert.rejects(
    () => refundSvc.reversePayment(paymentIds.p4, { schoolId: OTHER_SCHOOL, actorUserId: "intruder" }),
    (err) => err.code === "NOT_FOUND"
  );

  // The real school's data is completely unaffected by every attempt above.
  const ledgerAAfter = await studentLedgerSvc.getLedger("YD-V-A", { schoolId: SCHOOL });
  assert.equal(ledgerAAfter.currentBalance, ledgerABefore.currentBalance);
});

// ── Scenario 13: RBAC / finance-refund-approval permission separation ───
function findRoute(stack, path, method) {
  for (const layer of stack) {
    if (layer.route && layer.route.path === path && layer.route.methods[method]) return layer.route;
    if (layer.handle && layer.handle.stack) {
      const found = findRoute(layer.handle.stack, path, method);
      if (found) return found;
    }
  }
  return null;
}

test("Scenario 13 — the refund-approval route requires the narrower finance-refund-approval permission, distinct from the general finance-foundation routes", async () => {
  process.env.FINANCE_FOUNDATION_ENABLED = "true";
  delete require.cache[require.resolve("../server.js")];
  const app = require("../server.js");

  const approveRoute = findRoute(app.router.stack, "/api/finance/refunds/:refundId/approve", "post");
  const requestRoute = findRoute(app.router.stack, "/api/finance/refunds", "post");
  assert.ok(approveRoute, "the refund approval route must be registered");
  assert.ok(requestRoute, "the refund request route must be registered");
  assert.equal(approveRoute.stack.length, 5); // requireFlag + authenticate + staffOnly + authorizeRoute + controller
  assert.equal(requestRoute.stack.length, 5);

  delete require.cache[require.resolve("../server.js")];
  delete process.env.FINANCE_FOUNDATION_ENABLED;

  const { ROLE_PERMISSIONS } = require("../config/permissionsBackend");
  assert.ok(ROLE_PERMISSIONS.accountant.includes("finance-refund-approval"));
  assert.equal(ROLE_PERMISSIONS.center_admin.includes("finance-refund-approval"), false);

  const { authorizeRoute } = require("../middleware/authMiddleware");
  const guard = authorizeRoute("finance-refund-approval");
  function mockRes() { return { _status: 200, status(c) { this._status = c; return this; }, json(b) { this.body = b; return this; } }; }

  let res = mockRes(); let nextCalled = false;
  guard({ user: { role: "center_admin", permissions: ["finance-foundation"] } }, res, () => { nextCalled = true; });
  assert.equal(res._status, 403);
  assert.equal(nextCalled, false);

  res = mockRes(); nextCalled = false;
  guard({ user: { role: "accountant", permissions: ["finance-foundation", "finance-refund-approval"] } }, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

// ── Scenario 14: idempotency for repeated payment/allocation requests ───
test("Scenario 14 — retrying an already-fully-allocated payment is rejected, never double-posted", async () => {
  const ledgerABefore = await studentLedgerSvc.getLedger("YD-V-A", { schoolId: SCHOOL });

  await assert.rejects(
    () => allocationSvc.allocatePayment(paymentIds.p1, { schoolId: SCHOOL, actorUserId: "staff-1" }),
    (err) => err.code === "VALIDATION"
  );

  const ledgerAAfter = await studentLedgerSvc.getLedger("YD-V-A", { schoolId: SCHOOL });
  assert.equal(ledgerAAfter.currentBalance, ledgerABefore.currentBalance, "a rejected retry must never change the ledger balance");
});

test("Scenario 14b — a raw retry of the same Payment-sourced Ledger Entry (same sourceId) is deduplicated, never double-charged", async () => {
  const before = await studentLedgerSvc.getLedger("YD-V-A", { schoolId: SCHOOL });

  // Simulate a low-level retry of the exact same charge that Scenario 3
  // already posted for invA2 — same sourceType/sourceId.
  const retryResult = await ledgerEntrySvc.createEntry("YD-V-A", {
    type: "charge", amount: 1000, sourceType: "invoice", sourceId: invA2.invoiceId,
  }, { schoolId: SCHOOL, actorUserId: "staff-1" });

  assert.equal(retryResult.duplicate, true);

  const after = await studentLedgerSvc.getLedger("YD-V-A", { schoolId: SCHOOL });
  assert.equal(after.currentBalance, before.currentBalance, "a duplicate charge retry must never change the balance");
});

test.after(() => {
  db.collection     = originalCollection;
  db.runTransaction = originalRunTransaction;
});
