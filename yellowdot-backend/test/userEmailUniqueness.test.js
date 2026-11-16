/**
 * One email, one login profile.
 *
 * authMiddleware resolves a token to a profile by UID, and when the UID misses
 * it falls back to `users where email == <token email> limit(1)`. That fallback
 * exists for a real reason — Google sign-in mints a new UID when the address
 * already has a password account — but it means two documents sharing an email
 * make the resolution arbitrary: role, schoolId and centers all come from
 * whichever document Firestore happens to return first.
 *
 * Production had exactly that: two login accounts on one address, both
 * center_admin. Identical roles hid it. Had they differed, the account's
 * permissions would have varied between requests for no visible reason.
 *
 * These run against the Firestore emulator rather than a fake, because the
 * behaviour under test IS the query — `where(...).limit(2)` and how it treats
 * case and status. A stub would only assert our beliefs about Firestore back
 * to us.
 *
 * NOT covered here, and deliberately so: authMiddleware's auto-link path
 * writes users/{newUid} directly with a copy of the matched profile, email
 * included, so it bypasses these services entirely. That is the path that
 * produced the production duplicate and it needs its own fix.
 */
const test   = require("node:test");
const assert = require("node:assert");

const { db }      = require("../firebaseAdmin");
const userSvc     = require("../services/userService");
const settingsSvc = require("../services/settingsService");

const col = () => db.collection("users");

// Unique per run so repeated local runs never collide with their own leftovers.
const RUN = `uniq${Date.now()}${Math.floor(Math.random() * 1000)}`;
const addr = name => `${RUN}.${name}@example.test`;

const created = [];
async function seed(uid, fields) {
  await col().doc(uid).set({ userId: uid, status: "active", ...fields });
  created.push(uid);
}

test.after(async () => {
  await Promise.all(created.map(id => col().doc(id).delete().catch(() => {})));
});

async function expectDuplicate(fn, because) {
  try {
    await fn();
  } catch (e) {
    assert.equal(e.code, "DUPLICATE", `expected a DUPLICATE error, got ${e.code || e.message}`);
    assert.equal(e.field, "email");
    return e;
  }
  assert.fail(`expected a DUPLICATE error — ${because}`);
}

// ── The guard itself ────────────────────────────────────────────────────────

test("a second UID cannot take an email another profile already holds", async () => {
  const email = addr("taken");
  await seed(`${RUN}-first`, { email, role: "teacher", schoolId: "s1" });

  const err = await expectDuplicate(
    () => userSvc.create({ uid: `${RUN}-second`, email, role: "admin", schoolId: "s1" }),
    "a different UID reusing a held address",
  );
  assert.equal(err.conflictId, `${RUN}-first`, "the error should name the profile it collided with");

  const snap = await col().doc(`${RUN}-second`).get();
  assert.equal(snap.exists, false, "the rejected profile must not have been written");
});

test("re-saving the same profile is not a collision with itself", async () => {
  const email = addr("upsert");
  const uid   = `${RUN}-upsert`;
  await userSvc.create({ uid, email, name: "First Save", role: "teacher", schoolId: "s1" });
  created.push(uid);

  // create() upserts by UID. Saving the same profile again must not trip the
  // guard against the document it is about to overwrite.
  await userSvc.create({ uid, email, name: "Second Save", role: "teacher", schoolId: "s1" });

  const after = await col().doc(uid).get();
  assert.equal(after.data().name, "Second Save", "the upsert should have gone through");
});

test("case does not get you a second account", async () => {
  const lower = addr("case");
  await seed(`${RUN}-case-a`, { email: lower, role: "teacher", schoolId: "s1" });

  await expectDuplicate(
    () => userSvc.create({ uid: `${RUN}-case-b`, email: lower.toUpperCase(), role: "teacher", schoolId: "s1" }),
    "the same address in different case",
  );
});

test("a deactivated profile still holds its email", async () => {
  // Deliberate: the authMiddleware fallback applies no status filter, so an
  // inactive document can still win the limit(1). Reusing an address means
  // removing the old profile, not just deactivating it.
  const email = addr("inactive");
  await seed(`${RUN}-inactive`, { email, role: "teacher", schoolId: "s1", status: "inactive" });

  await expectDuplicate(
    () => userSvc.create({ uid: `${RUN}-reuse`, email, role: "teacher", schoolId: "s1" }),
    "an inactive profile still resolves through the email fallback",
  );
});

test("the guard is not school-scoped, because the fallback is not either", async () => {
  const email = addr("cross");
  await seed(`${RUN}-school-a`, { email, role: "teacher", schoolId: "school-a" });

  await expectDuplicate(
    () => userSvc.create({ uid: `${RUN}-school-b`, email, role: "teacher", schoolId: "school-b" }),
    "a duplicate in another school is still an ambiguous token resolution",
  );
});

test("a blank email is not treated as a collision", async () => {
  // Several legacy documents carry no email. They must not all collide with
  // each other on "".
  await seed(`${RUN}-blank-a`, { email: "", role: "teacher", schoolId: "s1" });
  const uid = `${RUN}-blank-b`;
  await userSvc.create({ uid, email: "", role: "teacher", schoolId: "s1" });
  created.push(uid);

  const snap = await col().doc(uid).get();
  assert.equal(snap.exists, true, "a profile with no email should still be creatable");
});

// ── The other reachable writer ──────────────────────────────────────────────

test("POST /api/settings/users route cannot create a duplicate either", async () => {
  const email = addr("settings");
  await seed(`${RUN}-settings-first`, { email, role: "teacher", schoolId: "s1" });

  await expectDuplicate(
    () => settingsSvc.createUser({ email, name: "Dupe", role: "teacher" }),
    "settingsService.createUser writes users/ directly with an auto-id",
  );
});

test("settingsService.createUser stores the address lowercased", async () => {
  // It previously stored the address as typed, which both evaded the duplicate
  // check and failed to match the lowercase address in a Firebase token.
  const email = addr("settings-case");
  const user  = await settingsSvc.createUser({ email: email.toUpperCase(), name: "Mixed Case", role: "teacher" });
  created.push(user.userId);

  assert.equal(user.email, email, "stored address should be lowercased");
});
