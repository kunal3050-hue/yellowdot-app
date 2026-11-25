/**
 * The tenant status gate must actually run.
 *
 * tenantMiddleware was written correctly and wired so that it could never
 * execute. server.js mounted it as app-level middleware on /api:
 *
 *   app.use("/api", (req, res, next) => {
 *     if (!req.user) return next();
 *     return enforceTenant(req, res, next);
 *   });
 *
 * authenticate runs per-route, after all app-level middleware, so req.user was
 * undefined every single time and the early return always won. Suspending a
 * school wrote a field to Firestore and changed nothing about what that school
 * could do. Nothing failed, nothing logged, and the comment above the block
 * asserted the opposite.
 *
 * These tests pin the behaviour rather than the wiring, so a future refactor
 * that moves the gate somewhere else is fine as long as it still fires.
 */
const test   = require("node:test");
const assert = require("node:assert");

const tenantMw = require("../middleware/tenantMiddleware");

/** Minimal res double: records status + body, like the real handler path. */
function res() {
  const r = { statusCode: null, body: null, headers: {} };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json   = (b) => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  return r;
}

/** Run enforceTenant against a stubbed tenant lookup. */
async function run(user, tenant) {
  const svc = require("../services/tenantService");
  const original = svc.getById;
  svc.getById = async () => tenant;
  // The middleware caches per tenantId for 60s, so vary the id per case.
  try {
    const req = { user, path: "/api/students" };
    const r = res();
    let passed = false;
    await tenantMw.enforceTenant(req, r, () => { passed = true; });
    return { passed, res: r, req };
  } finally {
    svc.getById = original;
    tenantMw.invalidateTenantCache(user.schoolId);
  }
}

const staff = id => ({ role: "teacher", schoolId: id });

test("a suspended school is blocked", async () => {
  const { passed, res: r } = await run(staff("s-susp"), { status: "suspended", contactEmail: "x@example.test" });
  assert.equal(passed, false, "the request must not reach the route");
  assert.equal(r.statusCode, 403);
  assert.equal(r.body.code, "TENANT_SUSPENDED");
});

test("a cancelled school is blocked", async () => {
  const { passed, res: r } = await run(staff("s-canc"), { status: "cancelled" });
  assert.equal(passed, false);
  assert.equal(r.statusCode, 403);
  assert.equal(r.body.code, "TENANT_CANCELLED");
});

test("an expired trial is blocked", async () => {
  const yesterday = new Date(Date.now() - 2 * 86400_000).toISOString();
  const { passed, res: r } = await run(staff("s-exp"), { status: "trial", trialEndsAt: yesterday });
  assert.equal(passed, false);
  assert.equal(r.body.code, "TRIAL_EXPIRED");
});

test("an active school passes", async () => {
  const { passed } = await run(staff("s-ok"), { status: "active" });
  assert.equal(passed, true);
});

test("a live trial passes and advertises the days remaining", async () => {
  const future = new Date(Date.now() + 5 * 86400_000).toISOString();
  const { passed, res: r } = await run(staff("s-trial"), { status: "trial", trialEndsAt: future });
  assert.equal(passed, true);
  assert.ok(Number(r.headers["X-Trial-Days-Remaining"]) >= 4);
});

test("super_admin is never locked out of a suspended school", async () => {
  // Otherwise suspending a tenant would also remove the only means of
  // un-suspending it.
  const { passed } = await run({ role: "super_admin", schoolId: "s-susp2" }, { status: "suspended" });
  assert.equal(passed, true);
});

test("developer is never locked out either", async () => {
  const { passed } = await run({ role: "developer", schoolId: "s-susp3" }, { status: "suspended" });
  assert.equal(passed, true);
});

test("a school with no tenant document is allowed through", async () => {
  // Legacy pre-migration schools have no tenants/{id} doc; schoolId-based
  // isolation still applies to them.
  const { passed } = await run(staff("s-legacy"), null);
  assert.equal(passed, true);
});

// ── The wiring itself ───────────────────────────────────────────────────────

test("authenticate composes the gate, and server.js no longer fakes it", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const read = p => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

  const auth = read("middleware/authMiddleware.js");
  assert.match(auth, /enforceTenant\(req, res, next\)/,
    "authenticate must hand off to enforceTenant once the user is resolved");

  const server = read("server.js");
  assert.doesNotMatch(server, /if \(!req\.user\) return next\(\);[\s\S]{0,80}enforceTenant/,
    "the app-level /api gate could never see req.user and must not come back");
});

test("the boot call stays reachable so a blocked school learns why", () => {
  const { TENANT_GATE_EXEMPT } = require("../middleware/authMiddleware");
  assert.ok(TENANT_GATE_EXEMPT.has("/api/auth/me"),
    "blocking /api/auth/me makes a suspended school look broken, not suspended");
  assert.ok(TENANT_GATE_EXEMPT.has("/api/auth/logout"),
    "locking someone out must not also trap them signed in");
  assert.equal(TENANT_GATE_EXEMPT.has("/api/students"), false,
    "ordinary data routes must be gated");
});

// ── Telling the client why, not just refusing ───────────────────────────────

const { evaluateTenant, attachTenantStatus } = require("../middleware/tenantMiddleware");

async function evaluate(user, tenant) {
  const svc = require("../services/tenantService");
  const original = svc.getById;
  svc.getById = async () => tenant;
  try {
    return await evaluateTenant(user);
  } finally {
    svc.getById = original;
    tenantMw.invalidateTenantCache(user.schoolId);
  }
}

test("evaluateTenant reports the reason without answering the request", async () => {
  const { block } = await evaluate(staff("e-susp"), { status: "suspended", contactEmail: "head@example.test" });
  assert.equal(block.code, "TENANT_SUSPENDED");
  assert.equal(block.contact, "head@example.test");
});

test("evaluateTenant returns no block for a healthy school", async () => {
  const { block } = await evaluate(staff("e-ok"), { status: "active" });
  assert.equal(block, null);
});

test("attachTenantStatus lets the request through and leaves the verdict on req", async () => {
  // This is what makes /api/auth/me able to explain the block: it is exempt
  // from being refused, but still learns that the school is blocked.
  const svc = require("../services/tenantService");
  const original = svc.getById;
  svc.getById = async () => ({ status: "suspended", schoolName: "Example School" });
  try {
    const req = { user: staff("a-susp"), path: "/api/auth/me" };
    let passed = false;
    await attachTenantStatus(req, res(), () => { passed = true; });
    assert.equal(passed, true, "the exempt path must not be refused");
    assert.equal(req.tenantBlock.code, "TENANT_SUSPENDED");
    assert.equal(req.tenant.schoolName, "Example School");
  } finally {
    svc.getById = original;
    tenantMw.invalidateTenantCache("a-susp");
  }
});

// "a blocked school still gets a 200 from the boot call" used to live here as
// a regex over authRoutes.js source. test/authMeTenantBlocked.test.js now
// invokes the real handler and asserts the real payload, which covers the same
// contract properly — the source check was both redundant and brittle (it
// depended on how many characters sat between the branch and the field).
