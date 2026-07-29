/**
 * Parent identity resolution inside authMiddleware.authenticate.
 *
 * The gap this closes: journeyAccess.test.js unit-tests requireOwnChild against
 * a hand-built req.user that ALREADY has `student` set, and no other test drives
 * `authenticate` end-to-end for a parent. So the whole suite passed while every
 * parent holding a users/{uid} document authenticated with student=undefined and
 * was then denied by every child-scoped endpoint (403 NO_LINKED_STUDENT).
 *
 * These tests drive the real middleware, with only Firebase itself faked, and
 * assert the invariant that was missing:
 *
 *   role="parent"  ⟹  req.user.student is populated, whichever branch resolved
 *                     the profile — users/{uid}, email fallback, or students.
 */
const test   = require("node:test");
const assert = require("node:assert");

// ── Fake Firestore: doc get/set + where(...).limit(n).get() ──────────────────
// Deliberately minimal. authenticate() uses exactly these calls, and the parent
// lookup depends on `limit`, which the shared _fakeFirestore helper lacks.
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

const { authenticate, requireOwnChild } = require("../middleware/authMiddleware");

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

const PARENT_EMAIL = "meera@example.com";
const SCHOOL       = "ydseawoods";

const studentByFather = {
  studentId: "YD001", studentName: "Aarav Sharma",
  fatherEmail: PARENT_EMAIL, schoolId: SCHOOL, centerId: "c1",
};
const studentByMother = {
  studentId: "YD002", studentName: "Diya Nair",
  motherEmail: PARENT_EMAIL, schoolId: SCHOOL, centerId: "c1",
};
const parentUserDoc = {
  userId: "uid-parent", email: PARENT_EMAIL, name: "Meera Sharma",
  role: "parent", schoolId: SCHOOL, centerId: "c1", centers: ["c1"],
};
const parentToken = { uid: "uid-parent", email: PARENT_EMAIL, name: "Meera Sharma" };

/** requireOwnChild is what every child-scoped endpoint actually gates on. */
function ownChildPasses(req) {
  let ok = false;
  requireOwnChild(req, mockRes(), () => { ok = true; });
  return ok;
}

// ── 1. Parent with a users/{uid} document ────────────────────────────────────
// The P1 regression. Before the fix this resolved role="parent" with
// student=undefined, because the users/{uid} branch returned before the
// students lookup could run.

test("parent with users/{uid}: child link is attached, not dropped", async () => {
  const { req, nextCalled } = await auth(
    { users: [parentUserDoc], students: [studentByFather] },
    parentToken,
  );

  assert.equal(nextCalled, true);
  assert.equal(req.user.role, "parent");
  assert.deepEqual(req.user.student, { studentId: "YD001", studentName: "Aarav Sharma" });
  assert.equal(ownChildPasses(req), true, "requireOwnChild must let a linked parent through");
  assert.equal(req.ownChildId, "YD001");
});

test("parent with users/{uid}: user doc stays authoritative for tenant scoping", async () => {
  // The child link is ADDITIVE — it must not rewrite schoolId/centerId/centers,
  // which the users document has always owned on this path.
  const { req } = await auth(
    {
      users:    [{ ...parentUserDoc, schoolId: "school-from-user-doc", centerId: "centre-from-user-doc", centers: ["centre-from-user-doc"] }],
      students: [{ ...studentByFather, schoolId: "school-from-student", centerId: "centre-from-student" }],
    },
    parentToken,
  );

  assert.equal(req.user.schoolId, "school-from-user-doc");
  assert.equal(req.user.centerId, "centre-from-user-doc");
  assert.deepEqual(req.user.centers, ["centre-from-user-doc"]);
  assert.equal(req.user.student.studentId, "YD001");
});

// ── 2. Parent found by email (users doc under a different uid) ───────────────
// Google sign-in mints a new uid; the email fallback finds the existing profile.

test("parent found by email fallback: child link is attached", async () => {
  const { req, nextCalled } = await auth(
    {
      users:    [{ ...parentUserDoc, userId: "old-password-uid" }],
      students: [studentByFather],
    },
    { uid: "new-google-uid", email: PARENT_EMAIL, name: "Meera Sharma" },
  );

  assert.equal(nextCalled, true);
  assert.equal(req.user.role, "parent");
  assert.equal(req.user.userId, "new-google-uid", "req.user carries the CURRENT uid");
  assert.deepEqual(req.user.student, { studentId: "YD001", studentName: "Aarav Sharma" });
  assert.equal(ownChildPasses(req), true);
});

// ── 3 & 4. Parent found by fatherEmail / motherEmail (no users doc) ──────────
// The path that already worked. Pinned so a future change can't regress it.

test("parent found by fatherEmail: resolves with child link", async () => {
  const { req, nextCalled } = await auth({ students: [studentByFather] }, parentToken);

  assert.equal(nextCalled, true);
  assert.equal(req.user.role, "parent");
  assert.equal(req.user.schoolId, SCHOOL);
  assert.deepEqual(req.user.student, { studentId: "YD001", studentName: "Aarav Sharma" });
  assert.equal(ownChildPasses(req), true);
});

test("parent found by motherEmail: resolves with child link", async () => {
  const { req, nextCalled } = await auth({ students: [studentByMother] }, parentToken);

  assert.equal(nextCalled, true);
  assert.equal(req.user.role, "parent");
  assert.deepEqual(req.user.student, { studentId: "YD002", studentName: "Diya Nair" });
  assert.equal(ownChildPasses(req), true);
});

test("fatherEmail is preferred when both parents share one address", async () => {
  const { req } = await auth(
    { students: [studentByFather, { ...studentByMother, motherEmail: PARENT_EMAIL }] },
    parentToken,
  );
  assert.equal(req.user.student.studentId, "YD001");
});

// ── 5. Mixed-case email ──────────────────────────────────────────────────────
// The token email is lowercased before every lookup; student emails are
// lowercased on write by studentService.

test("mixed-case token email still resolves the child link (no users doc)", async () => {
  const { req } = await auth(
    { students: [studentByFather] },
    { uid: "uid-parent", email: "Meera@Example.COM", name: "Meera Sharma" },
  );

  assert.equal(req.user.role, "parent");
  assert.deepEqual(req.user.student, { studentId: "YD001", studentName: "Aarav Sharma" });
});

test("mixed-case token email still resolves the child link (with users doc)", async () => {
  const { req } = await auth(
    { users: [parentUserDoc], students: [studentByFather] },
    { uid: "uid-parent", email: "MEERA@example.com", name: "Meera Sharma" },
  );

  assert.equal(req.user.role, "parent");
  assert.deepEqual(req.user.student, { studentId: "YD001", studentName: "Aarav Sharma" });
});

// ── 6. Parent with no linked student ─────────────────────────────────────────
// Must stay FAIL-CLOSED. Attaching the link may never invent one.

test("parent user doc with no matching student: no student, endpoints still deny", async () => {
  const { req, nextCalled } = await auth(
    { users: [parentUserDoc], students: [{ ...studentByFather, fatherEmail: "someone@else.com" }] },
    parentToken,
  );

  assert.equal(nextCalled, true, "authentication itself still succeeds");
  assert.equal(req.user.role, "parent");
  assert.equal(req.user.student, undefined);
  assert.equal(ownChildPasses(req), false, "requireOwnChild must fail closed");
});

test("no users doc and no matching student: role is unknown, profileMissing set", async () => {
  const { req } = await auth(
    { students: [{ ...studentByFather, fatherEmail: "someone@else.com" }] },
    parentToken,
  );

  assert.equal(req.user.role, "unknown");
  assert.equal(req.user.profileMissing, true);
  assert.deepEqual(req.user.permissions, []);
});

test("token with no email at all: role is unknown, no student", async () => {
  const { req } = await auth({ students: [studentByFather] }, { uid: "uid-parent", name: "Meera" });

  assert.equal(req.user.role, "unknown");
  assert.equal(req.user.student, undefined);
});

// ── 7. Existing staff login is untouched ─────────────────────────────────────

test("staff login: profile resolves unchanged and gains no student link", async () => {
  const { req, nextCalled } = await auth(
    {
      users: [{
        userId: "uid-teacher", email: "tara@school.com", name: "Tara Teacher",
        role: "teacher", schoolId: SCHOOL, centerId: "c1", centers: ["c1"],
      }],
      // A student whose father shares the teacher's address — the lookup must
      // not run for staff at all.
      students: [{ ...studentByFather, fatherEmail: "tara@school.com" }],
    },
    { uid: "uid-teacher", email: "tara@school.com", name: "Tara Teacher" },
  );

  assert.equal(nextCalled, true);
  assert.equal(req.user.role, "teacher");
  assert.equal(req.user.schoolId, SCHOOL);
  assert.equal(req.user.centerId, "c1");
  assert.equal(req.user.student, undefined, "staff must never gain a child link");
  assert.ok(req.user.permissions.includes("attendance"));
  assert.equal(ownChildPasses(req), false, "staff still rejected from parent-only endpoints");
});

test("staff login via email fallback: unchanged, and gains no student link", async () => {
  const { req } = await auth(
    {
      users: [{
        userId: "old-uid", email: "tara@school.com", name: "Tara Teacher",
        role: "teacher", schoolId: SCHOOL, centerId: "c1", centers: ["c1"],
      }],
      students: [{ ...studentByFather, fatherEmail: "tara@school.com" }],
    },
    { uid: "new-google-uid", email: "tara@school.com", name: "Tara Teacher" },
  );

  assert.equal(req.user.role, "teacher");
  assert.equal(req.user.userId, "new-google-uid");
  assert.equal(req.user.student, undefined);
});

// ── Auth-level failures are unchanged ────────────────────────────────────────

test("missing Authorization header still 401s before any lookup", async () => {
  const req = { headers: {}, params: {}, query: {}, body: {} };
  const res = mockRes();
  let nextCalled = false;
  await authenticate(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(res._status, 401);
});

test("an expired token still 401s with TOKEN_EXPIRED", async () => {
  fake.reset({});
  fakeAuth.verifyIdToken = async () => {
    const e = new Error("expired"); e.code = "auth/id-token-expired"; throw e;
  };
  const req = { headers: { authorization: "Bearer stale" }, params: {}, query: {}, body: {} };
  const res = mockRes();
  let nextCalled = false;
  await authenticate(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(res._status, 401);
  assert.equal(res.body.code, "TOKEN_EXPIRED");
});
