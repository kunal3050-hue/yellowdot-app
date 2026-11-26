/**
 * A platform operator resolves without a school, and nothing else moves.
 *
 * Step 2 of docs/platform-access-model.md. Two halves, and the risky half is
 * the second: authMiddleware is the single gate every request passes through,
 * so a change here that misorders the lookups could quietly re-home staff or
 * parents. These pin the order as much as the new branch.
 *
 * The tenant half matters for a specific failure: a platform operator has no
 * schoolId, and evaluateTenant used to refuse exactly that. Un-suspending a
 * school is done from the console, so a tenant gate that locked operators out
 * would bite hardest at the only moment it counts.
 */
const test   = require("node:test");
const assert = require("node:assert");

const tenantMw = require("../middleware/tenantMiddleware");
const { evaluateTenant } = tenantMw;

// ── The tenant gate does not apply to platform operators ────────────────────

async function evaluate(user, tenant) {
  const svc = require("../services/tenantService");
  const original = svc.getById;
  svc.getById = async () => tenant;
  try { return await evaluateTenant(user); }
  finally { svc.getById = original; if (user?.schoolId) tenantMw.invalidateTenantCache(user.schoolId); }
}

test("a platform operator is not blocked by a suspended school", async () => {
  const { block } = await evaluate(
    { role: "platform_admin", isPlatform: true },
    { status: "suspended" },
  );
  assert.equal(block, null, "the console must stay reachable — it is where un-suspending happens");
});

test("a platform operator is not refused for having no schoolId", async () => {
  // The branch that would otherwise catch them: NO_TENANT_CONTEXT.
  const { block } = await evaluate({ role: "platform_admin", isPlatform: true }, null);
  assert.equal(block, null);
});

test("the exemption keys on the platform marker, not on a role name list", async () => {
  // isPlatform is set by authMiddleware when the account came from
  // platformUsers, so a future platform role is covered without editing this.
  const { block } = await evaluate({ role: "platform_support", isPlatform: true }, { status: "cancelled" });
  assert.equal(block, null);
});

test("a school account with no schoolId is still refused", async () => {
  // The exemption must not have widened into "anyone without a school".
  const { block } = await evaluate({ role: "teacher" }, null);
  assert.equal(block?.code, "NO_TENANT_CONTEXT");
});

test("an ordinary staff account is still blocked by suspension", async () => {
  const { block } = await evaluate({ role: "teacher", schoolId: "s-1" }, { status: "suspended" });
  assert.equal(block?.code, "TENANT_SUSPENDED");
});

// ── The lookup order in authMiddleware ──────────────────────────────────────

test("platformUsers is consulted AFTER the users collection", () => {
  // Order is the whole safety argument. Resolving platform identity first
  // would mean anyone holding both docs loses their school identity — the
  // lockout fixed in e24e37d. School identity wins; a pure operator has no
  // users doc.
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(path.join(__dirname, "..", "middleware/authMiddleware.js"), "utf8");

  const usersUid   = src.indexOf('db.collection("users").doc(uid)');
  const usersEmail = src.indexOf('db.collection("users")\n          .where("email"');
  const platform   = src.indexOf('db.collection("platformUsers").doc(uid)');
  const parent     = src.indexOf("── 2. Parent");

  assert.ok(usersUid   !== -1, "users uid lookup not found");
  assert.ok(platform   !== -1, "platformUsers lookup not found");
  assert.ok(parent     !== -1, "parent section not found");

  assert.ok(usersUid < platform, "the users collection must be consulted first");
  if (usersEmail !== -1) assert.ok(usersEmail < platform, "the users email fallback must also come first");
  assert.ok(platform < parent, "platformUsers must be consulted before parent resolution, or an operator resolves as unknown");
});

test("a platform operator is given no schoolId", () => {
  // The absence of one is what keeps them out of every school's data, both
  // through enforceTenant and through firestore.rules, which keys on
  // me().schoolId.
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(path.join(__dirname, "..", "middleware/authMiddleware.js"), "utf8");
  const start = src.indexOf("── 1c. Platform operator");
  const end   = src.indexOf("── 2. Parent", start);
  const block = src.slice(start, end);

  assert.doesNotMatch(block, /schoolId:/,
    "assigning a schoolId to a platform operator would make them a member of that school");
  assert.match(block, /isPlatform:\s*true/, "the marker the tenant gate keys on must be set");
});

test("an inactive operator account is refused", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(path.join(__dirname, "..", "middleware/authMiddleware.js"), "utf8");
  assert.match(src, /PLATFORM_ACCOUNT_INACTIVE/,
    "a deactivated operator must not keep working just because their doc exists");
});
