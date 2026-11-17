/**
 * An employee's role has to reach the login it is linked to.
 *
 * users/{uid}.role used to be written exactly once — by _ensureAuthUser during
 * invite, behind `if (!userSnap.exists)` — and never again. So changing an
 * employee's role updated the HR record and silently left their permissions
 * alone: the save succeeded, the screen showed the new role, and
 * authMiddleware kept resolving the old one. That matters more now that
 * Employees is meant to be the single place staff are managed.
 *
 * The interesting half of this is what must NOT be written. Production data
 * made the hazard concrete: the super_admin's staff record carries role ""
 * (staffService.create routes role through _resolveAssignableRole, which
 * refuses bypass roles, so nothing was stored) while the login correctly holds
 * "super_admin". A naive copy would resolve "" to the "teacher" fallback and
 * demote the only super_admin in the system the next time anyone saved an
 * unrelated field on that employee.
 *
 * So the invariants are:
 *
 *   assignable staff role        ⟹ login role follows
 *   blank / unassignable role    ⟹ login untouched
 *   login holds a bypass role    ⟹ login untouched, in either direction
 */
const test   = require("node:test");
const assert = require("node:assert");

const { db }   = require("../firebaseAdmin");
const { _syncLoginRole } = require("../controllers/staffController");

const RUN = `rolesync${Date.now()}${Math.floor(Math.random() * 1000)}`;
const touched = [];

async function seedLogin(suffix, role) {
  const uid = `${RUN}-${suffix}`;
  await db.collection("users").doc(uid).set({
    userId: uid, email: `${uid}@example.test`, role, schoolId: "s1", status: "active",
  });
  touched.push(uid);
  return uid;
}

const staffRecord = (linkedUserId, role) => ({
  staffId: `${RUN}-staff`, linkedUserId, role, schoolId: "s1",
});

async function roleOf(uid) {
  const s = await db.collection("users").doc(uid).get();
  return s.exists ? (s.data().role || "") : null;
}

test.after(async () => {
  await Promise.all(touched.map(id => db.collection("users").doc(id).delete().catch(() => {})));
});

test("an assignable role is pushed onto the linked login", async () => {
  const uid = await seedLogin("promote", "teacher");
  await _syncLoginRole(staffRecord(uid, "center_admin"), "tester");
  assert.equal(await roleOf(uid), "center_admin");
});

test("a blank employee role never overwrites the login", async () => {
  // The production shape: staff.role "" because the bypass guard refused to
  // store it. Copying it through would resolve to "teacher" and demote.
  const uid = await seedLogin("blank", "admin");
  await _syncLoginRole(staffRecord(uid, ""), "tester");
  assert.equal(await roleOf(uid), "admin", "a blank staff role must leave the login alone");
});

test("a super_admin login is never demoted from the employee screen", async () => {
  // The exact account this would have broken.
  const uid = await seedLogin("superadmin", "super_admin");
  await _syncLoginRole(staffRecord(uid, "teacher"), "tester");
  assert.equal(await roleOf(uid), "super_admin", "bypass roles are provisioned outside these APIs");
});

test("a developer login is never demoted either", async () => {
  const uid = await seedLogin("developer", "developer");
  await _syncLoginRole(staffRecord(uid, "center_admin"), "tester");
  assert.equal(await roleOf(uid), "developer");
});

test("a bypass role cannot be granted through the employee screen either", async () => {
  // _resolveAssignableRole refuses it, so the sync is a no-op rather than an
  // escalation. Guards the other direction of the same rule.
  const uid = await seedLogin("escalate", "teacher");
  await _syncLoginRole(staffRecord(uid, "super_admin"), "tester");
  assert.equal(await roleOf(uid), "teacher", "the HR screen must not be able to grant super_admin");
});

test("an employee with no linked login is a no-op, not an error", async () => {
  await _syncLoginRole(staffRecord("", "teacher"), "tester");
  await _syncLoginRole({ staffId: `${RUN}-none`, role: "teacher" }, "tester");
});

test("a linked uid with no users document is a no-op, not a crash", async () => {
  await _syncLoginRole(staffRecord(`${RUN}-does-not-exist`, "teacher"), "tester");
});

test("an unchanged role writes nothing", async () => {
  const uid = await seedLogin("same", "teacher");
  const before = (await db.collection("users").doc(uid).get()).data();
  await _syncLoginRole(staffRecord(uid, "teacher"), "tester");
  const after = (await db.collection("users").doc(uid).get()).data();
  assert.equal(after.role, "teacher");
  assert.equal(after.updatedBy, before.updatedBy, "an unchanged role should not touch the document");
});
