/**
 * Finance Foundation — Sprint 4, M4.1: Payment State Machine.
 * Pure functions only — no Firestore, no mocking needed.
 */
const test   = require("node:test");
const assert = require("node:assert");

const sm = require("../services/financePaymentStateMachine");

test("STATES exposes exactly the seven Payment lifecycle states", () => {
  assert.deepEqual(Object.values(sm.STATES).sort(), [
    "Allocated", "PartiallyAllocated", "PartiallyRefunded",
    "Pending", "Recorded", "Refunded", "Reversed",
  ].sort());
});

test("canTransition: every documented transition is allowed", () => {
  assert.ok(sm.canTransition("Pending", "Recorded"));
  assert.ok(sm.canTransition("Recorded", "Allocated"));
  assert.ok(sm.canTransition("Recorded", "PartiallyAllocated"));
  assert.ok(sm.canTransition("Recorded", "Reversed"));
  assert.ok(sm.canTransition("PartiallyAllocated", "Allocated"));
  assert.ok(sm.canTransition("PartiallyAllocated", "Reversed"));
  assert.ok(sm.canTransition("Allocated", "PartiallyRefunded"));
  assert.ok(sm.canTransition("Allocated", "Refunded"));
  assert.ok(sm.canTransition("Allocated", "Reversed"));
  assert.ok(sm.canTransition("PartiallyRefunded", "Refunded"));
});

test("canTransition: Refunded and Reversed are terminal — no outgoing transitions", () => {
  assert.equal(sm.canTransition("Refunded", "Reversed"), false);
  assert.equal(sm.canTransition("Refunded", "Recorded"), false);
  assert.equal(sm.canTransition("Reversed", "Refunded"), false);
  assert.equal(sm.canTransition("Reversed", "Recorded"), false);
});

test("canTransition: reversing an already-(partially-)refunded payment is not allowed (explicit non-goal)", () => {
  assert.equal(sm.canTransition("PartiallyRefunded", "Reversed"), false);
});

test("canTransition: skipping straight from Recorded to Refunded is not allowed", () => {
  assert.equal(sm.canTransition("Recorded", "Refunded"), false);
  assert.equal(sm.canTransition("Recorded", "PartiallyRefunded"), false);
});

test("assertTransition: returns true for a valid transition", () => {
  assert.equal(sm.assertTransition("Recorded", "Allocated"), true);
});

test("assertTransition: throws VALIDATION for an invalid transition", () => {
  assert.throws(() => sm.assertTransition("Refunded", "Reversed"), (err) => err.code === "VALIDATION");
});

test("assertTransition: throws VALIDATION for an unknown state on either side", () => {
  assert.throws(() => sm.assertTransition("NotARealState", "Recorded"), (err) => err.code === "VALIDATION");
  assert.throws(() => sm.assertTransition("Recorded", "NotARealState"), (err) => err.code === "VALIDATION");
});
