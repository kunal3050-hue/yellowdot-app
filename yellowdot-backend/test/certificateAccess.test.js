/**
 * certificateAccess.test.js — Certificates Module · route authorization
 *
 * Two things are asserted, and the first matters more than it looks:
 *
 *  1. EVERY route on the router carries authenticate + blockUnknown +
 *     staffOnly, discovered by walking the router rather than by listing the
 *     routes here. A test that checks a hand-written list of paths passes
 *     happily on the day someone adds an unguarded one, which is the only
 *     way this ever actually goes wrong.
 *
 *  2. The read/write split holds: a teacher may read the register but may not
 *     issue, edit or revoke, because a certificate prints a signatory's name
 *     under it. Parents and unregistered accounts get nothing at all.
 */

const test   = require("node:test");
const assert = require("node:assert");
const router = require("../routes/certificateRoutes");
const certSvc = require("../services/certificateService");

// ── Router introspection ──────────────────────────────────────────────────────

/** Every { path, method, handles } declared on the router. */
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

const READ_PATHS = [
  "/api/certificates",
  "/api/certificates/summary",
  "/api/certificates/eligibility/attendance",
  "/api/certificates/:id",
];

const WRITE_ROUTES = [
  ["post",  "/api/certificates"],
  ["post",  "/api/certificates/bulk"],
  ["patch", "/api/certificates/:id"],
  ["post",  "/api/certificates/:id/revoke"],
];

test("the router actually declares the endpoints the module needs", () => {
  const routes = allRoutes();
  for (const p of READ_PATHS) {
    assert.ok(routes.some(r => r.method === "get" && r.path === p), `missing GET ${p}`);
  }
  for (const [method, p] of WRITE_ROUTES) {
    assert.ok(routes.some(r => r.method === method && r.path === p),
      `missing ${method.toUpperCase()} ${p}`);
  }
});

test("every route on the router is guarded by authenticate + blockUnknown + staffOnly", () => {
  const routes = allRoutes();
  assert.ok(routes.length >= 8, `expected the full route set, found ${routes.length}`);

  const unguarded = routes.filter(r =>
    !(r.names.includes("authenticate") && r.names.includes("blockUnknown") && r.names.includes("staffOnly")));

  assert.deepEqual(
    unguarded.map(r => `${r.method.toUpperCase()} ${r.path}`), [],
    "these routes are missing a guard — anyone authenticated by Firebase could reach them",
  );
});

test("authenticate runs first on every route", () => {
  for (const r of allRoutes()) {
    assert.equal(r.names[0], "authenticate",
      `${r.method.toUpperCase()} ${r.path} must authenticate before anything else`);
  }
});

test("only the write routes carry the extra role check", () => {
  // Checked by chain length rather than by handler name: `authorize(...)`
  // returns an anonymous arrow, and so does every route handler, so there is
  // nothing to tell them apart by name. The behavioural proof that this split
  // is the RIGHT one is the teacher sweep further down; this is the cheap
  // structural guard that catches a guard dropped from a new route.
  for (const r of allRoutes()) {
    const expected = r.method === "get" ? 4 : 5;   // +1 for authorize on writes
    assert.equal(
      r.names.length, expected,
      `${r.method.toUpperCase()} ${r.path} has ${r.names.length} handlers, expected ${expected} ` +
      `(authenticate, blockUnknown, staffOnly${expected === 5 ? ", authorize" : ""}, handler)`,
    );
  }
});

test("the eligibility route is declared before /:id so it is not read as an id", () => {
  const paths = allRoutes().filter(r => r.method === "get").map(r => r.path);
  assert.ok(
    paths.indexOf("/api/certificates/eligibility/attendance") < paths.indexOf("/api/certificates/:id"),
    "Express matches in declaration order — /:id first would swallow /eligibility/attendance",
  );
});

// ── Live chain execution ──────────────────────────────────────────────────────

function mockRes() {
  return {
    _status: 200,
    status(c) { this._status = c; return this; },
    json(b)   { this.body = b; return this; },
  };
}

function findRouteLayer(path, method) {
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

/** Swap a service method for the duration of one test. */
async function withStub(name, impl, fn) {
  const saved = certSvc[name];
  certSvc[name] = impl;
  try { return await fn(); }
  finally { certSvc[name] = saved; }
}

test("GET the register: staff roles pass, parents and unknown accounts do not", async () => {
  const layer = findRouteLayer("/api/certificates", "get");

  await withStub("listCertificates", async () => [], async () => {
    for (const role of ["admin", "center_admin", "center_owner", "teacher", "reception", "accountant"]) {
      const { res } = await runChain(layer, reqFor(role));
      assert.equal(res._status, 200, `${role} should be able to read the register`);
    }

    const parent = await runChain(layer, reqFor("parent"));
    assert.equal(parent.res._status, 403);
    assert.equal(parent.res.body.code, "PARENT_ACCESS_DENIED");

    const unknown = await runChain(layer, reqFor("unknown"));
    assert.equal(unknown.res._status, 403);
    assert.equal(unknown.res.body.code, "ACCOUNT_NOT_REGISTERED");
  });
});

test("POST a certificate: the admin tier issues, a teacher cannot", async () => {
  const layer = findRouteLayer("/api/certificates", "post");

  await withStub("issueCertificate", async () => ({ certificateId: "CERT-x" }), async () => {
    for (const role of ["admin", "center_admin", "center_owner", "developer", "super_admin"]) {
      const { res } = await runChain(layer, reqFor(role));
      assert.equal(res._status, 201, `${role} should be able to issue`);
    }

    for (const role of ["teacher", "reception", "accountant"]) {
      const { res, reachedHandler } = await runChain(layer, reqFor(role));
      assert.equal(res._status, 403, `${role} must not be able to issue a certificate`);
      assert.equal(reachedHandler, false);
    }
  });
});

test("bulk issue, edit and revoke are all closed to a teacher", async () => {
  const stubs = {
    "/api/certificates/bulk":        ["post",  "issueBulk",         async () => ({ issued: [], skipped: [] })],
    "/api/certificates/:id":         ["patch", "updateCertificate", async () => ({ certificateId: "CERT-x" })],
    "/api/certificates/:id/revoke":  ["post",  "revokeCertificate", async () => ({ certificateId: "CERT-x" })],
  };

  for (const [path, [method, svcName, impl]] of Object.entries(stubs)) {
    const layer = findRouteLayer(path, method);
    await withStub(svcName, impl, async () => {
      const teacher = await runChain(layer, reqFor("teacher"));
      assert.equal(teacher.res._status, 403, `teacher must not reach ${method.toUpperCase()} ${path}`);
      assert.equal(teacher.reachedHandler, false);

      const admin = await runChain(layer, reqFor("admin"));
      assert.ok(admin.res._status < 400, `admin should reach ${method.toUpperCase()} ${path}`);
    });
  }
});

test("teacher sweep: readable on every GET the router declares, denied on every write", async () => {
  // Walks the router rather than a hand-written list, so a route added later
  // without the right guard fails here instead of shipping.
  const STUBS = {
    listCertificates:        async () => [],
    getSummary:              async () => ({}),
    getAttendanceEligibility: async () => ({ eligible: [] }),
    getCertificate:          async () => ({ certificateId: "CERT-x" }),
    issueCertificate:        async () => ({ certificateId: "CERT-x" }),
    issueBulk:               async () => ({ issued: [], skipped: [] }),
    updateCertificate:       async () => ({ certificateId: "CERT-x" }),
    revokeCertificate:       async () => ({ certificateId: "CERT-x" }),
  };
  const saved = {};
  for (const [k, v] of Object.entries(STUBS)) { saved[k] = certSvc[k]; certSvc[k] = v; }

  try {
    for (const r of allRoutes()) {
      const layer = findRouteLayer(r.path, r.method);
      const { res, reachedHandler } = await runChain(layer, reqFor("teacher"));
      const label = `${r.method.toUpperCase()} ${r.path}`;

      if (r.method === "get") {
        assert.ok(res._status < 400, `teacher should be able to read ${label}, got ${res._status}`);
      } else {
        assert.equal(res._status, 403, `teacher must be refused on ${label}`);
        assert.equal(reachedHandler, false, `${label} must not run its handler for a teacher`);
      }
    }
  } finally {
    for (const [k, v] of Object.entries(saved)) certSvc[k] = v;
  }
});

test("a service error is returned with its own status, not a blanket 500", async () => {
  const layer = findRouteLayer("/api/certificates", "post");
  const dup = new certSvc.CertificateError("already holds one", { status: 409, code: "CERTIFICATE_DUPLICATE" });

  await withStub("issueCertificate", async () => { throw dup; }, async () => {
    const { res } = await runChain(layer, reqFor("admin"));
    assert.equal(res._status, 409);
    assert.equal(res.body.code, "CERTIFICATE_DUPLICATE");
  });
});

test("an unexpected error is not leaked to the caller", async () => {
  const layer = findRouteLayer("/api/certificates", "post");
  const savedErr = console.error;
  console.error = () => {};

  await withStub("issueCertificate", async () => { throw new Error("firestore exploded: project yd-prod"); }, async () => {
    const { res } = await runChain(layer, reqFor("admin"));
    assert.equal(res._status, 500);
    assert.ok(!/yd-prod/.test(JSON.stringify(res.body)), "internal detail must not reach the client");
  });

  console.error = savedErr;
});

test("the route layer passes the caller's own school down, never the client's", async () => {
  const layer = findRouteLayer("/api/certificates", "get");
  let seenCtx = null;

  await withStub("listCertificates", async (_f, ctx) => { seenCtx = ctx; return []; }, async () => {
    const req = reqFor("admin", { query: { schoolId: "school-b" } });
    await runChain(layer, req);
    assert.equal(seenCtx.schoolId, "school-a",
      "a schoolId in the query string must be ignored — it is taken from the verified token");
    assert.equal(seenCtx.actorUserId, "u-admin");
  });
});
