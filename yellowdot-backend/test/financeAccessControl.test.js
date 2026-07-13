/**
 * Milestone 3 — billing-data leak fix: parent ownership scoping,
 * staff/admin unrestricted access, and tenant isolation for
 * /api/invoices, /api/payments (and legacy equivalents).
 */
const test = require("node:test");
const assert = require("node:assert");
const { resolveContext, scopeFinanceQuery, checkInvoiceOwnership } = require("../middleware/requestScope");

// ── Parent ──────────────────────────────────────────────────────────

test("Parent: forces own studentId, ignores any client-supplied override", () => {
  const req = { user: { role: "parent", student: { studentId: "YD001" } } };
  const scope = scopeFinanceQuery(req, "YD999"); // attacker-supplied studentId
  assert.deepEqual(scope, { studentId: "YD001" });
});

test("Parent with no linked student → 403, not silently unscoped", () => {
  const req = { user: { role: "parent", student: undefined } };
  const scope = scopeFinanceQuery(req, "YD999");
  assert.equal(scope.error.status, 403);
});

// ── Teacher ─────────────────────────────────────────────────────────

test("Teacher: full school access preserved (no regression)", () => {
  const req = { user: { role: "teacher" } };
  const scope = scopeFinanceQuery(req, undefined); // no studentId filter requested
  assert.deepEqual(scope, { studentId: undefined });
});

// ── Accountant ──────────────────────────────────────────────────────

test("Accountant: full school access preserved (no regression)", () => {
  const req = { user: { role: "accountant" } };
  const scope = scopeFinanceQuery(req, "YD001"); // staff may legitimately filter by studentId
  assert.deepEqual(scope, { studentId: "YD001" });
});

// ── Admin ───────────────────────────────────────────────────────────

test("Admin: full school access preserved (no regression)", () => {
  const req = { user: { role: "admin" } };
  const scope = scopeFinanceQuery(req, undefined);
  assert.deepEqual(scope, { studentId: undefined });
});

test("Unregistered/unknown account is blocked, not defaulted to full access", () => {
  const req = { user: { role: "unknown" } };
  const scope = scopeFinanceQuery(req, undefined);
  assert.equal(scope.error.status, 403);
});

// ── Single-invoice ownership (GET /invoice/:invoiceNumber) ──────────

test("Parent viewing their own child's invoice → allowed", () => {
  const req = { user: { role: "parent", student: { studentId: "YD001" } } };
  const denied = checkInvoiceOwnership(req, { studentId: "YD001" });
  assert.equal(denied, null);
});

test("Parent viewing another child's invoice → 404 (not 403, avoids confirming existence)", () => {
  const req = { user: { role: "parent", student: { studentId: "YD001" } } };
  const denied = checkInvoiceOwnership(req, { studentId: "YD002" });
  assert.equal(denied.status, 404);
});

test("Staff viewing any child's invoice → unaffected", () => {
  const req = { user: { role: "center_admin" } };
  const denied = checkInvoiceOwnership(req, { studentId: "YD002" });
  assert.equal(denied, null);
});

// ── Cross-tenant isolation ────────────────────────────────────────────
// resolveContext must always derive schoolId from the verified req.user
// identity, never from anything the client sent — this is what makes
// cross-tenant access impossible regardless of what a caller passes in.

test("Cross-tenant: client-supplied schoolId in query/body is ignored", () => {
  const req = {
    user:  { schoolId: "school-a", userId: "u1" },
    query: { schoolId: "school-b" },   // attacker tries to override via query
    body:  { schoolId: "school-b" },   // ...and via body
  };
  const ctx = resolveContext(req);
  assert.equal(ctx.schoolId, "school-a");
});

test("Cross-tenant: a school-B staff member requesting invoices only ever resolves to school-B", () => {
  const reqA = { user: { schoolId: "school-a", userId: "staffA" } };
  const reqB = { user: { schoolId: "school-b", userId: "staffB" } };
  assert.equal(resolveContext(reqA).schoolId, "school-a");
  assert.equal(resolveContext(reqB).schoolId, "school-b");
  assert.notEqual(resolveContext(reqA).schoolId, resolveContext(reqB).schoolId);
});
