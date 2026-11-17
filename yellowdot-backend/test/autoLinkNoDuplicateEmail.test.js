/**
 * The Google auto-link must not manufacture a second profile for one address.
 *
 * When someone with a password account signs in with Google, Firebase's Email
 * Enumeration Protection mints a NEW uid rather than linking. authMiddleware
 * handles that: the uid lookup misses, an email fallback finds the existing
 * profile, and a document is written for the Google uid so later sign-ins take
 * the fast path.
 *
 * That write used to copy the matched profile wholesale — address included —
 * leaving two documents claiming one address. The same fallback resolves an
 * address with limit(1), so which profile, and therefore which role, won was
 * down to Firestore's ordering. This is how the production duplicate was made:
 * not by anyone creating an account twice, but by this write, every time.
 *
 * The mirror cannot simply be skipped. firestore.rules resolves a caller's
 * role with get(/databases/../users/$(request.auth.uid)), so a Google uid with
 * no document of its own loses client-side Firestore access entirely. It has
 * to exist and it has to carry the role — it just must not claim the address.
 */
const test   = require("node:test");
const assert = require("node:assert");

// ── Minimal Firestore stand-in — same shape as rolelessUserFailsClosed ──────
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
    rows: name => [...coll(name).entries()].map(([id, d]) => ({ id, ...d })),
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

const fbPath = require.resolve("../firebaseAdmin");
require.cache[fbPath] = {
  id: fbPath, filename: fbPath, loaded: true,
  exports: { db: fake.db, auth: fakeAuth, admin: {} },
};

const { authenticate } = require("../middleware/authMiddleware");

function mockRes() {
  return { _status: 200, status(c) { this._status = c; return this; }, json(b) { this.body = b; return this; } };
}

const ORIGINAL_UID = "uid-password-original";
const GOOGLE_UID   = "uid-google-new";
const ADDRESS      = "shared.address@example.test";

async function signInAsGoogle() {
  fake.reset({
    users: [{
      userId:   ORIGINAL_UID,
      email:    ADDRESS,
      name:     "Shared Person",
      role:     "center_admin",
      schoolId: "s1",
      centerId: "c1",
      status:   "active",
    }],
  });

  fakeAuth.verifyIdToken = async () => ({ uid: GOOGLE_UID, email: ADDRESS });

  const req = { headers: { authorization: "Bearer token" } };
  const res = mockRes();
  let nexted = false;
  await authenticate(req, res, () => { nexted = true; });

  // The mirror write is fire-and-forget; let its promise settle.
  await new Promise(r => setImmediate(r));
  return { req, res, nexted };
}

test("the fallback still resolves the caller to the existing profile", async () => {
  const { req, nexted } = await signInAsGoogle();
  assert.ok(nexted, "authenticate should have called next()");
  assert.equal(req.user.role, "center_admin", "role comes from the matched profile");
  assert.equal(req.user.userId, GOOGLE_UID, "the request runs as the current uid");
});

test("the mirror written for the Google uid carries NO email", async () => {
  await signInAsGoogle();
  const mirror = fake.rows("users").find(r => r.id === GOOGLE_UID);

  assert.ok(mirror, "a mirror document must exist — firestore.rules reads users/{request.auth.uid}");
  assert.ok(
    !mirror.email,
    `the mirror must not claim the address, got ${JSON.stringify(mirror.email)}`,
  );
});

test("exactly one document claims the address", async () => {
  await signInAsGoogle();
  const claiming = fake.rows("users").filter(r => (r.email || "").toLowerCase() === ADDRESS);

  assert.equal(claiming.length, 1, "two documents claiming one address is the bug itself");
  assert.equal(claiming[0].id, ORIGINAL_UID, "the original profile keeps the address");
});

test("the mirror still carries what firestore.rules needs", async () => {
  // rules do get(users/$(request.auth.uid)).data.role — a mirror without a
  // role would cost this user client-side Firestore access.
  await signInAsGoogle();
  const mirror = fake.rows("users").find(r => r.id === GOOGLE_UID);

  assert.equal(mirror.role, "center_admin");
  assert.equal(mirror.schoolId, "s1");
});

test("the mirror is marked so other code can find it", async () => {
  // staffController's role sync updates docs with aliasOf set, so the mirror
  // and the profile it points at cannot drift to different roles.
  await signInAsGoogle();
  const mirror = fake.rows("users").find(r => r.id === GOOGLE_UID);

  assert.equal(mirror.aliasOf, ORIGINAL_UID);
});
