/**
 * The settings user API must not be able to grant a platform role.
 *
 * developer and super_admin are BYPASS_ROLES: they grant unscoped,
 * cross-tenant access and are meant to be provisioned outside staff
 * management. Every other write path routes role through
 * _resolveAssignableRole, which refuses them.
 *
 * settingsService did not. createUser passed `data.role || "teacher"` straight
 * into users/{uid}, and updateUser assigned `updates.role` untouched. Both
 * routes authorize "admin", and PUT takes any userId — so an admin could set
 * their own role to super_admin and have authMiddleware resolve it on the next
 * request. That is a privilege-escalation path, not an inconsistency.
 *
 * The update case is the sharper one and is pinned first: escalation of an
 * existing account needs no new document and leaves the account otherwise
 * untouched, so nothing else would look wrong afterwards.
 *
 * These run against the Firestore emulator because the behaviour under test
 * includes what actually lands in the document.
 */
const test   = require("node:test");
const assert = require("node:assert");

const { db }      = require("../firebaseAdmin");
const settingsSvc = require("../services/settingsService");
const { BYPASS_ROLES } = require("../config/permissionsBackend");

const RUN = `roleesc${Date.now()}${Math.floor(Math.random() * 1000)}`;
const touched = [];

async function seedUser(suffix, role) {
  const uid = `${RUN}-${suffix}`;
  await db.collection("users").doc(uid).set({
    userId: uid, email: `${uid}@example.test`, name: "Seed", role,
    schoolId: "s1", status: "active",
  });
  touched.push(uid);
  return uid;
}
const roleOf = async uid => (await db.collection("users").doc(uid).get()).data()?.role;

test.after(async () => {
  await Promise.all(touched.map(id => db.collection("users").doc(id).delete().catch(() => {})));
});

async function expectRefused(fn, because) {
  try {
    await fn();
  } catch (e) {
    assert.equal(e.code, "ROLE_NOT_ASSIGNABLE", `expected ROLE_NOT_ASSIGNABLE, got ${e.code || e.message}`);
    assert.equal(e.field, "role");
    return e;
  }
  assert.fail(`expected the role to be refused — ${because}`);
}

// ── Escalating an existing account ──────────────────────────────────────────

test("an existing account cannot be escalated to super_admin", async () => {
  const uid = await seedUser("escalate", "admin");

  await expectRefused(
    () => settingsSvc.updateUser(uid, { role: "super_admin" }, { updatedBy: "tester" }),
    "this is the self-escalation path: admin -> super_admin on their own uid",
  );

  assert.equal(await roleOf(uid), "admin", "the stored role must not have changed");
});

test("nor to developer", async () => {
  const uid = await seedUser("escalate-dev", "center_admin");
  await expectRefused(
    () => settingsSvc.updateUser(uid, { role: "developer" }, { updatedBy: "tester" }),
    "developer is a bypass role too",
  );
  assert.equal(await roleOf(uid), "center_admin");
});

test("every bypass role is refused, not just the two named here", async () => {
  // Guards against a role being added to BYPASS_ROLES later without this
  // check being revisited.
  const uid = await seedUser("escalate-all", "teacher");
  for (const role of BYPASS_ROLES) {
    await expectRefused(
      () => settingsSvc.updateUser(uid, { role }, { updatedBy: "tester" }),
      `BYPASS_ROLES contains ${role}`,
    );
  }
  assert.equal(await roleOf(uid), "teacher");
});

test("an ordinary role change still works", async () => {
  // The guard must refuse escalation without breaking the feature.
  const uid = await seedUser("ordinary", "teacher");
  const updated = await settingsSvc.updateUser(uid, { role: "center_admin" }, { updatedBy: "tester" });
  assert.equal(updated.role, "center_admin");
  assert.equal(await roleOf(uid), "center_admin");
});

test("a status-only update is untouched by the role guard", async () => {
  const uid = await seedUser("status-only", "teacher");
  const updated = await settingsSvc.updateUser(uid, { status: "inactive" }, { updatedBy: "tester" });
  assert.equal(updated.status, "inactive");
  assert.equal(await roleOf(uid), "teacher", "role must be left alone when not supplied");
});

// ── Creating an account ─────────────────────────────────────────────────────

test("a new account cannot be created as super_admin", async () => {
  await expectRefused(
    () => settingsSvc.createUser(
      { name: "Escalated", email: `${RUN}-new@example.test`, role: "super_admin" },
      { actorUserId: "tester" },
    ),
    "createUser passed role straight into the document",
  );

  const q = await db.collection("users").where("email", "==", `${RUN}-new@example.test`).get();
  assert.equal(q.size, 0, "the refused account must not have been written");
});

test("a new account with an ordinary role is still created", async () => {
  const user = await settingsSvc.createUser(
    { name: "Normal", email: `${RUN}-ok@example.test`, role: "center_admin" },
    { actorUserId: "tester" },
  );
  touched.push(user.userId);
  assert.equal(user.role, "center_admin");
});

test("an unknown role falls back rather than being stored verbatim", async () => {
  // _resolveAssignableRole treats anything outside VALID_ROLES as unassignable,
  // so a typo is refused rather than written into the document where
  // authMiddleware would later resolve it to nothing useful.
  const uid = await seedUser("typo", "teacher");
  await expectRefused(
    () => settingsSvc.updateUser(uid, { role: "super-admin" }, { updatedBy: "tester" }),
    "hyphenated typo is not a valid role",
  );
  assert.equal(await roleOf(uid), "teacher");
});
