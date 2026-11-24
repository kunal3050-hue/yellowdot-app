/**
 * billingAccess.test.js — Billing & Payments · route authorization
 *
 * Money routes are the ones where a dropped guard costs the most, so the
 * structural checks here walk the router rather than compare against a list of
 * paths written out in this file. A test that checks a hand-written list passes
 * happily on the day someone adds an unguarded route, which is the only way
 * this ever actually goes wrong.
 *
 * What is asserted:
 *   1. Every staff route carries authenticate + blockUnknown + staffOnly +
 *      authorize, discovered by walking the router.
 *   2. The parent route carries authenticate + blockUnknown + requireOwnChild,
 *      and is NOT staffOnly — it is the one route a parent may reach.
 *   3. The four tiers hold behaviourally: a teacher gets nothing at all,
 *      reception can read and record a payment but not raise an invoice,
 *      an accountant can bill but cannot unwind money, and only the admin tier
 *      can void, credit, reverse, read the audit trail or change the payee.
 *   4. /generate is declared before /:invoiceId, so it is not read as an id.
 */

const test   = require("node:test");
const assert = require("node:assert");
const router  = require("../routes/billingRoutes");
const billing = require("../services/billingService");
const audit   = require("../services/billingAuditService");

// ── Router introspection ─────────────────────────────────────────────────────

/** Every { path, method, names } declared on the router. */
function allRoutes() {
  return router.stack
    .filter(l => l.route)
    .flatMap(l => Object.keys(l.route.methods)
      .filter(m => l.route.methods[m])
      .map(method => ({
        path:   l.route.path,
        method,
        names:  l.route.stack.map(s => s.handle.name),
      })));
}

const PARENT_PATH = "/api/parent/billing";

const staffRoutes  = () => allRoutes().filter(r => r.path !== PARENT_PATH);
const parentRoutes = () => allRoutes().filter(r => r.path === PARENT_PATH);

const EXPECTED = [
  ["get",    "/api/billing/summary"],
  ["get",    "/api/billing/outstanding"],
  ["get",    "/api/billing/settings"],
  ["put",    "/api/billing/settings"],
  ["get",    "/api/billing/audit"],
  ["get",    "/api/billing/plans"],
  ["post",   "/api/billing/plans"],
  ["patch",  "/api/billing/plans/:planId"],
  ["delete", "/api/billing/plans/:planId"],
  ["get",    "/api/billing/invoices"],
  ["post",   "/api/billing/invoices"],
  ["post",   "/api/billing/invoices/generate"],
  ["get",    "/api/billing/invoices/:invoiceId"],
  ["post",   "/api/billing/invoices/:invoiceId/void"],
  ["post",   "/api/billing/invoices/:invoiceId/credit-note"],
  ["get",    "/api/billing/payments"],
  ["post",   "/api/billing/payments"],
  ["post",   "/api/billing/payments/:paymentId/reverse"],
  ["get",    "/api/billing/receipts/:paymentId"],
  ["get",    PARENT_PATH],
];

test("the router declares every endpoint the module needs", () => {
  const routes = allRoutes();
  for (const [method, path] of EXPECTED) {
    assert.ok(
      routes.some(r => r.method === method && r.path === path),
      `missing ${method.toUpperCase()} ${path}`,
    );
  }
});

test("every staff route is guarded by authenticate + blockUnknown + staffOnly", () => {
  const routes = staffRoutes();
  assert.ok(routes.length >= 19, `expected the full staff route set, found ${routes.length}`);

  const unguarded = routes.filter(r => !(
    r.names.includes("authenticate") &&
    r.names.includes("blockUnknown") &&
    r.names.includes("staffOnly")
  ));

  assert.deepEqual(
    unguarded.map(r => `${r.method.toUpperCase()} ${r.path}`), [],
    "these routes are missing a guard — anyone Firebase authenticated could reach a family's money",
  );
});

test("every staff route also carries a role check, not just staffOnly", () => {
  // Checked by chain length: `authorize(...)` returns an anonymous arrow, as
  // does every route handler, so there is nothing to tell them apart by name.
  // Four guards plus one handler. The behavioural proof that the tiers are the
  // RIGHT ones is the role sweep further down; this is the cheap structural
  // guard that catches one dropped from a route added later.
  for (const r of staffRoutes()) {
    assert.equal(
      r.names.length, 5,
      `${r.method.toUpperCase()} ${r.path} has ${r.names.length} handlers, expected 5 ` +
      "(authenticate, blockUnknown, staffOnly, authorize, handler)",
    );
  }
});

test("authenticate runs first on every route, the parent one included", () => {
  for (const r of allRoutes()) {
    assert.equal(r.names[0], "authenticate",
      `${r.method.toUpperCase()} ${r.path} must authenticate before anything else`);
  }
});

test("the parent route is guarded by requireOwnChild and is not staffOnly", () => {
  const routes = parentRoutes();
  assert.equal(routes.length, 1, "exactly one parent-facing route");

  const [r] = routes;
  assert.ok(r.names.includes("blockUnknown"));
  assert.ok(r.names.includes("requireOwnChild"),
    "a client-supplied studentId must not be able to pick the child");
  assert.ok(!r.names.includes("staffOnly"),
    "staffOnly would reject the only role this route exists for");
});

test("/generate is declared before /:invoiceId so it is not read as an id", () => {
  const posts = allRoutes().filter(r => r.method === "post").map(r => r.path);
  const gets  = allRoutes().filter(r => r.method === "get").map(r => r.path);

  assert.ok(
    posts.indexOf("/api/billing/invoices/generate") < posts.indexOf("/api/billing/invoices/:invoiceId/void"),
    "Express matches in declaration order",
  );
  assert.ok(gets.includes("/api/billing/invoices/:invoiceId"));
});

// ── Live chain execution ─────────────────────────────────────────────────────

function mockRes() {
  return {
    _status: 200,
    status(c) { this._status = c; return this; },
    json(b)   { this.body = b; return this; },
  };
}

function findRouteLayer(method, path) {
  return router.stack.find(l => l.route && l.route.path === path && l.route.methods[method]);
}

/**
 * Run a route's middleware chain with `authenticate` skipped — it needs a real
 * Firebase token. req.user is pre-set to stand in for what it would produce.
 */
async function runChain(layer, req) {
  const res = mockRes();
  const handles = layer.route.stack.map(l => l.handle).slice(1);
  let i = 0;
  let reachedHandler = false;
  async function dispatch() {
    if (i >= handles.length) { reachedHandler = true; return; }
    const handle = handles[i++];
    let calledNext = false;
    const maybe = handle(req, res, () => { calledNext = true; });
    if (maybe && typeof maybe.then === "function") await maybe;
    if (calledNext) await dispatch();
  }
  await dispatch();
  return { res, reachedHandler };
}

function reqFor(role, extra = {}) {
  return {
    user: { role, userId: `u-${role}`, schoolId: "school-a", centerId: "centre-1" },
    params: {}, query: {}, body: {}, ...extra,
  };
}

/** Swap a service method on either service for the duration of one test. */
async function withStub(target, name, impl, fn) {
  const saved = target[name];
  target[name] = impl;
  try { return await fn(); }
  finally { target[name] = saved; }
}

const ALL_STAFF   = ["admin", "center_admin", "center_owner", "accountant", "reception", "teacher"];
const BYPASS      = ["developer", "super_admin"];
const NON_STAFF   = ["parent", "unknown"];

/**
 * Run one route for every role and return the roles that reached the handler.
 * The stub makes the handler harmless, so the only thing being measured is
 * whether the guard chain let the role through.
 */
async function rolesReaching(method, path, { target = billing, stub, stubWith = async () => ({}), req = {} } = {}) {
  const layer = findRouteLayer(method, path);
  assert.ok(layer, `no route layer for ${method.toUpperCase()} ${path}`);

  const reached = [];
  await withStub(target, stub, stubWith, async () => {
    for (const role of [...ALL_STAFF, ...BYPASS, ...NON_STAFF]) {
      const { res } = await runChain(layer, reqFor(role, req));
      if (res._status !== 401 && res._status !== 403) reached.push(role);
    }
  });
  return reached;
}

// ── Tier 1: reading what a family owes ───────────────────────────────────────

test("reading the outstanding list: the front desk and up, never a teacher", async () => {
  const reached = await rolesReaching("get", "/api/billing/outstanding", {
    stub: "getOutstanding", stubWith: async () => ({ totals: {}, students: [], families: [] }),
  });

  // Reception answers "how much do we owe?" at pickup — the PRD's own
  // reception workflow. A classroom role has no business reading a balance.
  assert.deepEqual(
    reached.sort(),
    ["accountant", "admin", "center_admin", "center_owner", "developer", "reception", "super_admin"].sort(),
  );
  assert.ok(!reached.includes("teacher"));
  assert.ok(!reached.includes("parent"));
  assert.ok(!reached.includes("unknown"));
});

test("a teacher is refused 403 with a message, not silently handed an empty list", async () => {
  const layer = findRouteLayer("get", "/api/billing/outstanding");
  const { res, reachedHandler } = await runChain(layer, reqFor("teacher"));
  assert.equal(reachedHandler, false);
  assert.equal(res._status, 403);
  assert.match(res.body.error, /do not have access/i);
});

test("a parent cannot reach any staff billing route", async () => {
  for (const [method, path] of EXPECTED) {
    if (path === PARENT_PATH) continue;
    const layer = findRouteLayer(method, path);
    const { res } = await runChain(layer, reqFor("parent"));
    assert.equal(res._status, 403, `parent was not refused ${method.toUpperCase()} ${path}`);
    assert.equal(res.body.code, "PARENT_ACCESS_DENIED");
  }
});

test("an unregistered account cannot reach any route at all", async () => {
  for (const [method, path] of EXPECTED) {
    const layer = findRouteLayer(method, path);
    const { res } = await runChain(layer, reqFor("unknown"));
    assert.equal(res._status, 403,
      `an unknown account was not refused ${method.toUpperCase()} ${path}`);
    assert.equal(res.body.code, "ACCOUNT_NOT_REGISTERED");
  }
});

// ── Tier 2: recording money received ─────────────────────────────────────────

test("recording a payment: reception can, a teacher cannot", async () => {
  const reached = await rolesReaching("post", "/api/billing/payments", {
    stub: "recordPayment", stubWith: async () => ({ payment: {}, invoice: {} }),
  });

  assert.ok(reached.includes("reception"), "the front desk takes money at pickup");
  assert.ok(reached.includes("accountant"));
  assert.ok(reached.includes("admin"));
  assert.ok(!reached.includes("teacher"));
  assert.ok(!reached.includes("parent"));
});

// ── Tier 3: raising invoices and the fee catalogue ───────────────────────────

test("raising an invoice: the billing tier only — reception cannot bill a family", async () => {
  const reached = await rolesReaching("post", "/api/billing/invoices", {
    stub: "createInvoice", stubWith: async () => ({}),
  });

  assert.deepEqual(
    reached.sort(),
    ["accountant", "admin", "center_admin", "center_owner", "developer", "super_admin"].sort(),
  );
  assert.ok(!reached.includes("reception"), "taking a payment is not the same as deciding what is owed");
  assert.ok(!reached.includes("teacher"));
});

test("the monthly run and the fee catalogue are the billing tier", async () => {
  const cases = [
    ["post",   "/api/billing/invoices/generate", "generateForPeriod", async () => ({})],
    ["post",   "/api/billing/plans",             "createPlan",        async () => ({})],
    ["patch",  "/api/billing/plans/:planId",     "updatePlan",        async () => ({})],
    ["delete", "/api/billing/plans/:planId",     "deactivatePlan",    async () => ({})],
  ];

  for (const [method, path, stub, stubWith] of cases) {
    const reached = await rolesReaching(method, path, { stub, stubWith });
    assert.ok(reached.includes("accountant"), `accountant should reach ${method.toUpperCase()} ${path}`);
    assert.ok(!reached.includes("reception"), `reception should NOT reach ${method.toUpperCase()} ${path}`);
    assert.ok(!reached.includes("teacher"),   `teacher should NOT reach ${method.toUpperCase()} ${path}`);
  }
});

// ── Tier 4: unwinding money ──────────────────────────────────────────────────

test("voiding, crediting and reversing are admin-tier — an accountant cannot unwind money", async () => {
  const cases = [
    ["post", "/api/billing/invoices/:invoiceId/void",         "voidInvoice",    async () => ({})],
    ["post", "/api/billing/invoices/:invoiceId/credit-note",  "addCreditNote",  async () => ({})],
    ["post", "/api/billing/payments/:paymentId/reverse",      "reversePayment", async () => ({ payment: {}, invoice: {} })],
  ];

  for (const [method, path, stub, stubWith] of cases) {
    const reached = await rolesReaching(method, path, { stub, stubWith });

    // Whoever takes money should not be the one who can quietly un-take it.
    assert.deepEqual(
      reached.sort(),
      ["admin", "center_admin", "center_owner", "developer", "super_admin"].sort(),
      `wrong tier on ${method.toUpperCase()} ${path}`,
    );
    assert.ok(!reached.includes("accountant"), `accountant should NOT reach ${method.toUpperCase()} ${path}`);
    assert.ok(!reached.includes("reception"));
  }
});

test("the audit trail and the payee settings are admin-tier", async () => {
  const auditReached = await rolesReaching("get", "/api/billing/audit", {
    target: audit, stub: "listForSchool", stubWith: async () => [],
  });
  assert.deepEqual(
    auditReached.sort(),
    ["admin", "center_admin", "center_owner", "developer", "super_admin"].sort(),
  );

  const writeReached = await rolesReaching("put", "/api/billing/settings", {
    stub: "updateSettings", stubWith: async () => ({}),
  });
  assert.deepEqual(
    writeReached.sort(),
    ["admin", "center_admin", "center_owner", "developer", "super_admin"].sort(),
  );
});

test("reading the payee settings is open to anyone who can take a payment", async () => {
  // The collect screen builds its UPI QR code from these, so reception needs
  // the read even though it cannot change them.
  const reached = await rolesReaching("get", "/api/billing/settings", {
    stub: "getSettings", stubWith: async () => ({}),
  });
  assert.ok(reached.includes("reception"));
  assert.ok(!reached.includes("teacher"));
});

// ── The parent route ─────────────────────────────────────────────────────────

test("the parent route ignores a client-supplied studentId", async () => {
  const layer = findRouteLayer("get", PARENT_PATH);
  let sawStudentId = null;

  await withStub(billing, "getForStudent", async ({ studentId }) => {
    sawStudentId = studentId;
    return { summary: {}, invoices: [], payments: [], payee: {} };
  }, async () => {
    // requireOwnChild would set req.ownChildId from the parent's own link.
    // Standing in for it here, with a different id in the query — the only
    // thing that matters is which one the handler actually uses.
    const req = {
      user: { role: "parent", userId: "u-parent", schoolId: "school-a" },
      ownChildId: "YD001",
      params: {}, body: {},
      query: { studentId: "YD999" },
    };
    const handler = layer.route.stack[layer.route.stack.length - 1].handle;
    await handler(req, mockRes());
  });

  assert.equal(sawStudentId, "YD001", "the query's studentId must be ignored");
  assert.notEqual(sawStudentId, "YD999");
});
