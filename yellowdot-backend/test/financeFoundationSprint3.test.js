/**
 * Finance Foundation — Sprint 3, M3.1: LedgerEntry Idempotency.
 *
 * Same safety discipline as the other two Finance Foundation test files:
 * never touches real Firestore. `db.runTransaction` is mocked with a fake
 * `tx` that distinguishes a Query argument (has a `.where` method) from a
 * DocumentReference argument, since createEntry's idempotency check reads
 * both inside the same transaction.
 */
const test   = require("node:test");
const assert = require("node:assert");

function isQuery(arg) {
  return typeof arg?.where === "function";
}

test("createEntry: WITHOUT sourceType/sourceId, behavior is unchanged — always creates a new entry (no regression from M3.1)", async () => {
  const { db } = require("../firebaseAdmin");
  const auditSvc = require("../services/financeAuditService");
  const ledgerEntrySvc = require("../services/ledgerEntryService");
  const { financeEvents, EVENTS } = require("../services/financeEventPublisher");

  const origRunTransaction = db.runTransaction;
  const origLogAudit = auditSvc.logFinanceAudit;

  db.runTransaction = async (fn) => {
    const fakeTx = {
      get: async (arg) => {
        if (isQuery(arg)) throw new Error("should not query for duplicates without sourceType/sourceId");
        return { exists: true, data: () => ({ schoolId: "school-a", status: "active", currentBalance: 0 }) };
      },
      set: () => {},
      update: () => {},
    };
    return fn(fakeTx);
  };
  let auditActions = [];
  auditSvc.logFinanceAudit = async (args) => { auditActions.push(args.action); };

  let eventCount = 0;
  const listener = () => { eventCount++; };
  financeEvents.on(EVENTS.LEDGER_ENTRY_CREATED, listener);

  const result = await ledgerEntrySvc.createEntry(
    "YD010", { type: "charge", amount: 200 }, { schoolId: "school-a", actorUserId: "u1" }
  );

  assert.equal(result.duplicate, false);
  assert.equal(result.newBalance, 200);
  assert.deepEqual(auditActions, ["ledgerEntry.create.charge"]);
  assert.equal(eventCount, 1);

  financeEvents.off(EVENTS.LEDGER_ENTRY_CREATED, listener);
  db.runTransaction = origRunTransaction;
  auditSvc.logFinanceAudit = origLogAudit;
});

test("createEntry: WITH sourceType/sourceId, a duplicate call returns the existing entry — no second entry, no re-publish", async () => {
  const { db } = require("../firebaseAdmin");
  const auditSvc = require("../services/financeAuditService");
  const ledgerEntrySvc = require("../services/ledgerEntryService");
  const { financeEvents, EVENTS } = require("../services/financeEventPublisher");

  const origRunTransaction = db.runTransaction;
  const origLogAudit = auditSvc.logFinanceAudit;

  const existingEntryDoc = {
    entryId: "LDG-EXISTING", schoolId: "school-a", centerId: "", studentLedgerId: "YD011",
    type: "charge", amount: 500, signedAmount: 500,
    feeComponentId: "", description: "", sourceType: "invoice", sourceId: "INV-1",
    createdAt: "2026-01-01T00:00:00.000Z", createdBy: "system",
  };

  db.runTransaction = async (fn) => {
    const fakeTx = {
      get: async (arg) => {
        if (isQuery(arg)) {
          // The duplicate-check query — simulate finding the existing entry.
          return { empty: false, docs: [{ id: existingEntryDoc.entryId, data: () => existingEntryDoc }] };
        }
        // The ledger read (only reached because the dup branch also reads current balance).
        return { exists: true, data: () => ({ schoolId: "school-a", status: "active", currentBalance: 500 }) };
      },
      set: () => { throw new Error("must not write a new entry on a duplicate"); },
      update: () => { throw new Error("must not update the ledger balance on a duplicate"); },
    };
    return fn(fakeTx);
  };
  let auditActions = [];
  auditSvc.logFinanceAudit = async (args) => { auditActions.push(args.action); };

  let eventCount = 0;
  const listener = () => { eventCount++; };
  financeEvents.on(EVENTS.LEDGER_ENTRY_CREATED, listener);

  const result = await ledgerEntrySvc.createEntry(
    "YD011",
    { type: "charge", amount: 500, sourceType: "invoice", sourceId: "INV-1" },
    { schoolId: "school-a", actorUserId: "u1" }
  );

  assert.equal(result.duplicate, true);
  assert.equal(result.entry.entryId, "LDG-EXISTING");
  assert.equal(result.newBalance, 500);
  assert.deepEqual(auditActions, ["ledgerEntry.duplicate.charge"]);
  assert.equal(eventCount, 0, "a duplicate must never re-publish LedgerEntryCreated");

  financeEvents.off(EVENTS.LEDGER_ENTRY_CREATED, listener);
  db.runTransaction = origRunTransaction;
  auditSvc.logFinanceAudit = origLogAudit;
});

test("createEntry: WITH sourceType/sourceId but no existing match, creates a genuinely new entry and publishes normally", async () => {
  const { db } = require("../firebaseAdmin");
  const auditSvc = require("../services/financeAuditService");
  const ledgerEntrySvc = require("../services/ledgerEntryService");
  const { financeEvents, EVENTS } = require("../services/financeEventPublisher");

  const origRunTransaction = db.runTransaction;
  const origLogAudit = auditSvc.logFinanceAudit;

  db.runTransaction = async (fn) => {
    const fakeTx = {
      get: async (arg) => {
        if (isQuery(arg)) return { empty: true, docs: [] }; // no duplicate found
        return { exists: true, data: () => ({ schoolId: "school-a", status: "active", currentBalance: 0 }) };
      },
      set: () => {},
      update: () => {},
    };
    return fn(fakeTx);
  };
  let auditActions = [];
  auditSvc.logFinanceAudit = async (args) => { auditActions.push(args.action); };

  let received = null;
  financeEvents.once(EVENTS.LEDGER_ENTRY_CREATED, (payload) => { received = payload; });

  const result = await ledgerEntrySvc.createEntry(
    "YD012",
    { type: "payment", amount: 300, sourceType: "payment", sourceId: "PAY-1" },
    { schoolId: "school-a", actorUserId: "u1" }
  );

  assert.equal(result.duplicate, false);
  assert.equal(result.newBalance, -300); // payment decreases balance
  assert.deepEqual(auditActions, ["ledgerEntry.create.payment"]);
  assert.ok(received, "a genuinely new entry must still publish LedgerEntryCreated");

  db.runTransaction = origRunTransaction;
  auditSvc.logFinanceAudit = origLogAudit;
});
