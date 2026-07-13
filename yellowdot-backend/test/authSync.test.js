/**
 * Milestone 4 — sync-user privilege-escalation fix.
 * POST /api/auth/sync-user must derive every field from the server-resolved
 * req.user (built by authMiddleware) and never from the client request body.
 */
const test = require("node:test");
const assert = require("node:assert");
const { buildSyncUserResponse } = require("../services/authSyncService");

// A forged body an attacker might send alongside a legitimate token --
// buildSyncUserResponse never receives this at all, but each test below
// still checks the response for these exact strings to prove none of them
// leak through, in case a future edit accidentally re-wires req.body in.
const FORGED_BODY = {
  role:        "super_admin",
  permissions: ["*"],
  schoolId:    "evil-tenant-school",
  tenantId:    "evil-tenant-id",
  center:      "evil-center",
};

function assertNoForgedValues(response) {
  const json = JSON.stringify(response);
  assert.ok(!json.includes("super_admin"), "response must never contain the forged role");
  assert.ok(!json.includes("evil-tenant-school"), "response must never contain the forged schoolId");
  assert.ok(!json.includes("evil-tenant-id"), "response must never contain the forged tenantId");
  assert.ok(!json.includes("evil-center"), "response must never contain the forged center");
  assert.ok(!json.includes('"*"'), "response must never contain the forged permissions wildcard");
}

// ── New parent (resolved via fatherEmail/motherEmail match, per authMiddleware) ──

test("New parent: reflects server-resolved parent identity + linked student", () => {
  const user = {
    userId: "uid-parent-1", email: "parent@example.com", name: "", photoUrl: "",
    role: "parent", schoolId: "ydseawoods", centerId: "", center: "",
    student: { studentId: "YD001", studentName: "Test Child" },
  };
  const res = buildSyncUserResponse(user); // body is never passed in -- forged fields structurally cannot apply
  assert.equal(res.user.role, "parent");
  assert.equal(res.user.schoolId, "ydseawoods");
  assert.deepEqual(res.user.student, { studentId: "YD001", studentName: "Test Child" });
  assertNoForgedValues(res);
});

// ── New staff (already provisioned via admin-gated POST /api/users) ──

test("New staff: reflects server-resolved teacher role, ignores forged body", () => {
  const user = {
    userId: "uid-staff-1", email: "teacher@example.com", name: "Teacher One", photoUrl: "",
    role: "teacher", schoolId: "ydseawoods", centerId: "center-a", center: "center-a",
  };
  const res = buildSyncUserResponse(user);
  assert.equal(res.user.role, "teacher");
  assert.equal(res.user.center, "center-a");
  assertNoForgedValues(res);
});

// ── Admin ──

test("Admin: reflects server-resolved admin role, ignores forged body", () => {
  const user = {
    userId: "uid-admin-1", email: "admin@example.com", name: "Admin One", photoUrl: "",
    role: "admin", schoolId: "ydseawoods", centerId: "", center: "",
  };
  const res = buildSyncUserResponse(user);
  assert.equal(res.user.role, "admin");
  assertNoForgedValues(res);
});

// ── Forged role=super_admin ──

test("Forged role=super_admin: response role stays whatever authMiddleware actually resolved", () => {
  // A real parent account under attack -- the endpoint has no req.body access
  // at all, so a forged {role:"super_admin"} in the request has zero effect.
  const user = { userId: "uid-attacker", email: "attacker@example.com", role: "parent", schoolId: "ydseawoods", student: { studentId: "YD002" } };
  const res = buildSyncUserResponse(user);
  assert.equal(res.user.role, "parent");
  assert.notEqual(res.user.role, "super_admin");
  assertNoForgedValues(res);
});

// ── Forged permissions ──

test("Forged permissions array never appears in the response at all", () => {
  const user = { userId: "uid-attacker-2", email: "attacker2@example.com", role: "teacher", schoolId: "ydseawoods" };
  const res = buildSyncUserResponse(user);
  assert.equal("permissions" in res.user, false, "sync-user must not echo any permissions field");
  assertNoForgedValues(res);
});

// ── Forged schoolId ──

test("Forged schoolId: response schoolId stays the server-resolved value", () => {
  const user = { userId: "uid-attacker-3", email: "attacker3@example.com", role: "teacher", schoolId: "ydseawoods" };
  const res = buildSyncUserResponse(user);
  assert.equal(res.user.schoolId, "ydseawoods");
  assertNoForgedValues(res);
});

// ── Forged tenantId ──

test("Forged tenantId: response contains no tenantId field at all", () => {
  const user = { userId: "uid-attacker-4", email: "attacker4@example.com", role: "teacher", schoolId: "ydseawoods" };
  const res = buildSyncUserResponse(user);
  assert.equal("tenantId" in res.user, false, "sync-user must not echo any tenantId field");
  assertNoForgedValues(res);
});

// ── Genuinely unregistered account ──

test("Unknown/unregistered account: profileMissing, role stays 'unknown', no privileged default", () => {
  const user = { userId: "uid-new-1", email: "brandnew@example.com", role: "unknown" };
  const res = buildSyncUserResponse(user);
  assert.equal(res.user.role, "unknown");
  assert.equal(res.profileMissing, true);
  assertNoForgedValues(res);
});

test("Unknown/unregistered account with forged role=super_admin in the (unread) body: still 'unknown'", () => {
  const user = { userId: "uid-new-2", email: "brandnew2@example.com", role: "unknown" };
  const res = buildSyncUserResponse(user); // FORGED_BODY is never passed to the function -- proves it's structurally unreachable
  assert.equal(res.user.role, "unknown");
  assert.notEqual(res.user.role, "super_admin");
  void FORGED_BODY; // referenced only to document intent; the function signature makes it inert
});

// ── Route-wiring proof: the actual registered Express handler ignores req.body ──

test("Route wiring: the real /api/auth/sync-user handler ignores a forged req.body end-to-end", async () => {
  const authRoutes = require("../routes/authRoutes");
  const layer = authRoutes.stack.find(
    l => l.route && l.route.path === "/api/auth/sync-user" && l.route.methods.post
  );
  assert.ok(layer, "sync-user route must still be registered");
  const handler = layer.route.stack[layer.route.stack.length - 1].handle; // last = the real business logic, after `authenticate`

  const req = {
    user: { userId: "uid-real", email: "real@example.com", role: "parent", schoolId: "ydseawoods", student: { studentId: "YD003" } },
    body: FORGED_BODY, // present on req, but the handler must never read it
  };
  let sent = null;
  const res = { json(body) { sent = body; return this; }, status() { return this; } };

  await handler(req, res);

  assert.ok(sent, "handler must respond");
  assert.equal(sent.user.role, "parent");
  assertNoForgedValues(sent);
});
