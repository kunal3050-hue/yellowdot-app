/**
 * The real /api/auth/me handler, invoked for a blocked school.
 *
 * The other tests cover the pieces — evaluateTenant's verdict,
 * attachTenantStatus leaving it on req, and the route's source shape. None of
 * them runs the actual handler, so none would notice if the payload it builds
 * stopped matching what AuthContext reads.
 *
 * This invokes the registered handler directly, the same way
 * m14ParentPtmOwnership does, so it needs no server, no token and no
 * Firestore. What it pins is the contract between the two halves: the field
 * names the frontend destructures, and the 200 status that keeps a suspended
 * school looking suspended rather than broken.
 */
const test   = require("node:test");
const assert = require("node:assert");

const authRoutes = require("../routes/authRoutes");

function findRouteHandler(router, path, method) {
  const layer = router.stack.find(l => l.route && l.route.path === path && l.route.methods[method]);
  if (!layer) return null;
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function res() {
  const r = { statusCode: null, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json   = (b) => { r.body = b; return r; };
  return r;
}

const handler = findRouteHandler(authRoutes, "/api/auth/me", "get");

const BASE_USER = {
  userId: "uid-1", email: "teacher@example.test", name: "A Teacher",
  photoUrl: "", role: "teacher", schoolId: "school-1",
};

async function call({ tenantBlock = null, tenant = null, user = BASE_USER }) {
  const r = res();
  await handler({ user, tenantBlock, tenant }, r);
  return r;
}

test("the handler is registered and reachable", () => {
  assert.ok(handler, "/api/auth/me must have a GET handler");
});

test("a suspended school gets 200, not 403", async () => {
  // A 403 here would make the boot call fail and the app look like an outage.
  const r = await call({
    tenantBlock: { code: "TENANT_SUSPENDED", error: "Your school account has been suspended.", contact: "head@example.test" },
    tenant: { schoolName: "Example Preschool" },
  });
  assert.equal(r.statusCode, 200);
});

test("the payload carries exactly what the blocked screen reads", async () => {
  const r = await call({
    tenantBlock: { code: "TENANT_SUSPENDED", error: "Your school account has been suspended.", contact: "head@example.test" },
    tenant: { schoolName: "Example Preschool" },
  });
  const b = r.body.tenantBlocked;
  assert.ok(b, "tenantBlocked must be present — AuthContext branches on it");
  assert.equal(b.code, "TENANT_SUSPENDED");   // selects the copy variant
  assert.equal(b.contact, "head@example.test"); // the mailto target
  assert.equal(b.schoolName, "Example Preschool");
  assert.equal(typeof b.message, "string");
  assert.equal(r.body.homeRoute, "/account-blocked");
});

test("no permissions leak to a blocked school", async () => {
  const r = await call({
    tenantBlock: { code: "TENANT_CANCELLED", error: "This school account has been cancelled." },
    tenant: null,
  });
  assert.deepEqual(r.body.permissions, []);
  assert.deepEqual(r.body.roleMatrix, {});
});

test("a missing contact is null rather than undefined", async () => {
  // TENANT_CANCELLED carries no contact; the page hides the block on null.
  const r = await call({
    tenantBlock: { code: "TENANT_CANCELLED", error: "This school account has been cancelled." },
  });
  assert.equal(r.body.tenantBlocked.contact, null);
});

test("an expired trial reports its own code, not a generic one", async () => {
  const r = await call({
    tenantBlock: { code: "TRIAL_EXPIRED", error: "Your free trial has expired. Please upgrade to continue.", contact: "x@example.test" },
  });
  assert.equal(r.body.tenantBlocked.code, "TRIAL_EXPIRED");
});

// The unblocked path is deliberately not exercised here: with no block the
// handler proceeds to build the full profile, which needs Firestore, so it
// would only pass with an emulator and would time out without one. The rest
// of the suite covers that path against the emulator, and tenantGateRuns pins
// that the early return is conditional on req.tenantBlock in the first place.
