/**
 * What a platform_admin may do, and — mostly — may not.
 *
 * Step 3 of docs/platform-access-model.md. Decided 2026-11-26: view the
 * platform and suspend a school. Nothing else.
 *
 * The exclusions are the point of the role, so they are tested as hard as the
 * grants. A later "just add it to the ops guard" would otherwise widen this
 * silently: every one of these routes already works for super_admin, so
 * nothing would fail to reveal it.
 *
 * These assert the guard wired onto each route rather than calling handlers,
 * because authorize() is the thing being configured and the handlers need
 * Firestore.
 */
const test   = require("node:test");
const assert = require("node:assert");
const fs     = require("node:fs");
const path   = require("node:path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "routes/tenantRoutes.js"), "utf8");

/** The guard array a route line references. */
function guardFor(method, routePath) {
  const line = SRC.split("\n").find(l =>
    l.trimStart().startsWith(`router.${method}`) && l.includes(`"${routePath}"`));
  assert.ok(line, `no ${method.toUpperCase()} ${routePath} route found`);
  if (line.includes("...platformOps"))    return "platformOps";
  if (line.includes("...superAdminOnly")) return "superAdminOnly";
  return `unknown (${line.trim()})`;
}

// ── Allowed: see the platform, and turn a school off ────────────────────────

const ALLOWED = [
  ["get",  "/api/tenants",                        "the list — without it the console is empty"],
  ["get",  "/api/tenants/:tenantId",              "one school's detail"],
  ["get",  "/api/tenants/analytics",              "platform overview"],
  ["get",  "/api/tenants/audit-logs",             "platform audit"],
  ["get",  "/api/tenants/:tenantId/audit-logs",   "per-school audit"],
  ["post", "/api/tenants/:tenantId/status",       "suspend and reactivate — the job"],
];

for (const [method, p, why] of ALLOWED) {
  test(`platform_admin CAN ${method.toUpperCase()} ${p} — ${why}`, () => {
    assert.equal(guardFor(method, p), "platformOps");
  });
}

// ── Refused ─────────────────────────────────────────────────────────────────

const REFUSED = [
  ["post",   "/api/tenants",                               "creating a tenant is a commercial act"],
  ["put",    "/api/tenants/:tenantId",                     "update carries subscriptionPlan"],
  ["delete", "/api/tenants/:tenantId",                     "irreversible, no recovery path"],
  ["post",   "/api/tenants/:tenantId/impersonate",         "reads children's records — ruled out explicitly"],
  ["post",   "/api/tenants/:tenantId/branches",            "a school's own configuration"],
  ["delete", "/api/tenants/:tenantId/branches/:branchId",  "a school's own configuration"],
  ["post",   "/api/tenants/:tenantId/academic-years",      "a school's own configuration"],
];

for (const [method, p, why] of REFUSED) {
  test(`platform_admin CANNOT ${method.toUpperCase()} ${p} — ${why}`, () => {
    assert.equal(guardFor(method, p), "superAdminOnly");
  });
}

// ── The guards themselves ───────────────────────────────────────────────────

test("platformOps admits exactly the three intended roles", () => {
  assert.match(SRC, /const platformOps = \[authenticate, authorize\("super_admin", "developer", "platform_admin"\)\]/);
});

test("superAdminOnly did not quietly gain platform_admin", () => {
  const line = SRC.split("\n").find(l => l.startsWith("const superAdminOnly"));
  assert.doesNotMatch(line, /platform_admin/,
    "the restricted guard must stay restricted, or every exclusion above is void");
});

test("every tenant route carries one of the two guards", () => {
  // A route added later with no guard, or an ad-hoc one, should fail here
  // rather than ship unprotected.
  const routes = SRC.split("\n").filter(l => /^router\.(get|post|put|patch|delete)/.test(l));
  assert.ok(routes.length >= 13, `expected the full route surface, saw ${routes.length}`);
  const ungarded = routes.filter(l => !l.includes("...platformOps") && !l.includes("...superAdminOnly"));
  assert.deepEqual(ungarded, [], `tenant routes with no standard guard:\n${ungarded.join("\n")}`);
});

test("impersonation stays with super_admin, as decided", () => {
  // Called out on its own because it is the decision most likely to be
  // revisited casually.
  assert.equal(guardFor("post", "/api/tenants/:tenantId/impersonate"), "superAdminOnly");
});
