/**
 * A users/{uid} document with no `role` field must NOT authenticate as staff.
 *
 * The gap this closes: _buildUserFromDoc resolved the role as
 * `docData.role || "teacher"`. A half-provisioned user document — created
 * without a role, or with the field cleared — therefore authenticated as a
 * teacher, and firestore.rules grants `teacher` read access to EVERY student
 * in the school. That is a fail-open default: the absence of a grant produced
 * a working staff account.
 *
 * Nothing in the suite covered it, because every other auth test seeds a
 * document that already carries a role.
 *
 * The invariant asserted here:
 *
 *   users/{uid} with no role  ⟹  role="unknown" + profileMissing
 *                                 ⟹ blockUnknown and staffOnly both reject
 *
 * "unknown" is the sentinel the middleware already used for "authenticated by
 * Firebase, but no profile in this system", so a roleless document now lands
 * on the same well-plumbed deny path — including the friendly
 * ACCOUNT_NOT_REGISTERED response from /api/auth.
 */
const test   = require("node:test");
const assert = require("node:assert");

// ── Fake Firestore: doc get/set + where(...).limit(n).get() ──────────────────
// Same minimal shape as parentAuthResolution.test.js — authenticate() uses
// exactly these calls, and the parent lookup depends on `limit`.
function makeFakeFirestore() {
  const store = {};
  const coll  = n => (store[n] = store[n] || new Map());
  const snap  = (id, data) => ({ id, exists: !!data, data: () => data });

  function query(name, filters, lim) {
    return {
      where: (f, op, v) => query(name, [...filters, [f, op, v]], lim),
      limit: n => query(name, filters, n),
      async get() {
        let rows = [...coll(name).entries()]
          .filter(([, d]) => filters.every(([f, , v]) => d[f] === v));
        if (lim != null) rows = rows.slice(0, lim);
        const docs = rows.map(([id, d]) => snap(id, d));
        return { empty: docs.length === 0, size: docs.length, docs };
      },
    };
  }

  const db = {
    collection(name) {
      return {
        doc(id) {
          return {
            id,
            async get() { return snap(id, coll(name).get(id)); },
            async set(data, opts) {
              coll(name).set(id, opts && opts.merge
                ? { ...(coll(name).get(id) || {}), ...data }
                : { ...data });
            },
          };
        },
        where: (f, op, v) => query(name, [[f, op, v]]),
      };
    },
  };

  return {
    db,
    reset(seed = {}) {
      for (const k of Object.keys(store)) delete store[k];
      for (const [name, rows] of Object.entries(seed)) {
        rows.forEach((r, i) => coll(name).set(r.userId || r.studentId || `d${i}`, r));
      }
    },
  };
}

const fake     = makeFakeFirestore();
const fakeAuth = { verifyIdToken: async () => ({}) };

// Inject before authMiddleware pulls in firebaseAdmin.
const fbPath = require.resolve("../firebaseAdmin");
require.cache[fbPath] = {
  id: fbPath, filename: fbPath, loaded: true,
  exports: { db: fake.db, auth: fakeAuth, admin: {} },
};

const { authenticate, blockUnknown, staffOnly } = require("../middleware/authMiddleware");

// ── Harness ──────────────────────────────────────────────────────────────────
function mockRes() {
  return { _status: 200, status(c) { this._status = c; return this; }, json(b) { this.body = b; return this; } };
}

/** Runs the real authenticate() and returns { req, res, nextCalled }. */
async function auth(seed, decoded) {
  fake.reset(seed);
  fakeAuth.verifyIdToken = async () => decoded;
  const req = { headers: { authorization: "Bearer test-token" }, params: {}, query: {}, body: {} };
  const res = mockRes();
  let nextCalled = false;
  await authenticate(req, res, () => { nextCalled = true; });
  return { req, res, nextCalled };
}

/** Runs a guard against an already-authenticated req. */
function guardPasses(guard, req) {
  let ok = false;
  const res = mockRes();
  guard(req, res, () => { ok = true; });
  return { ok, res };
}

const SCHOOL = "ydseawoods";
const TOKEN  = { uid: "uid-norole", email: "halfsetup@example.com", name: "Half Setup" };

// A user document that exists but was never given a role.
const rolelessUserDoc = {
  userId: "uid-norole", email: "halfsetup@example.com", name: "Half Setup",
  schoolId: SCHOOL, centerId: "c1", centers: ["c1"],
};

// ── 1. The role itself ───────────────────────────────────────────────────────

test("users/{uid} with no role resolves to unknown, never to a staff role", async () => {
  const { req, nextCalled } = await auth({ users: [rolelessUserDoc] }, TOKEN);

  assert.equal(nextCalled, true, "authenticate still runs — the token is valid");
  assert.equal(req.user.role, "unknown");
  assert.notEqual(req.user.role, "teacher", "must not fall open to the old default");
  assert.equal(req.user.profileMissing, true, "frontend needs this to explain itself");
  assert.deepEqual(req.user.permissions, [], "a roleless account carries no permissions");
});

test("an empty-string role is treated the same as a missing one", async () => {
  const { req } = await auth({ users: [{ ...rolelessUserDoc, role: "" }] }, TOKEN);
  assert.equal(req.user.role, "unknown");
});

// ── 2. The guards every route relies on ──────────────────────────────────────

test("blockUnknown rejects a roleless account", async () => {
  const { req } = await auth({ users: [rolelessUserDoc] }, TOKEN);
  const { ok, res } = guardPasses(blockUnknown, req);

  assert.equal(ok, false, "a roleless account must not reach any handler");
  assert.equal(res._status, 403);
  assert.equal(res.body.code, "ACCOUNT_NOT_REGISTERED");
});

test("staffOnly rejects a roleless account", async () => {
  const { req } = await auth({ users: [rolelessUserDoc] }, TOKEN);
  const { ok, res } = guardPasses(staffOnly, req);

  assert.equal(ok, false, "the old 'teacher' default would have sailed through here");
  assert.equal(res._status, 403);
  assert.equal(res.body.code, "ACCOUNT_NOT_REGISTERED");
});

// ── 3. Tenant fields are still carried, so logs//api/auth can explain why ────

test("tenant scoping from the document is preserved on the deny path", async () => {
  const { req } = await auth({ users: [rolelessUserDoc] }, TOKEN);

  assert.equal(req.user.schoolId, SCHOOL);
  assert.equal(req.user.centerId, "c1");
  assert.equal(req.user.email, "halfsetup@example.com");
});

// ── 4. The fix must not have broken the normal case ──────────────────────────

test("a document WITH a role is unaffected", async () => {
  const { req, nextCalled } = await auth(
    { users: [{ ...rolelessUserDoc, role: "teacher" }] },
    TOKEN,
  );

  assert.equal(nextCalled, true);
  assert.equal(req.user.role, "teacher");
  assert.notEqual(req.user.profileMissing, true);
  assert.equal(guardPasses(staffOnly, req).ok, true, "a real teacher still gets through");
});
