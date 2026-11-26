/**
 * platform_admin resolves to exactly the console, and nothing else.
 *
 * The point of this role is an account that can manage WHICH schools are
 * live without being able to read inside any of them. Two ways that could
 * quietly fail — it gains "*", or it gains a school routeKey — and neither
 * would be obvious from the console working correctly, because the console
 * would work either way.
 *
 * These exercise roleService directly: the role is defined in code
 * (STATIC_ROLE_PERMS) with short-circuits in both resolvers, so no Firestore
 * document, no emulator and no network are involved.
 */
const test   = require("node:test");
const assert = require("node:assert");

const roleSvc = require("../services/roleService");
const { BYPASS_ROLES, ROLE_HOME } = require("../config/permissionsBackend");

const SCHOOL = "any-school";

test("resolves to exactly profile + tenant-management", async () => {
  const perms = await roleSvc.getPermissionsForRole("platform_admin", SCHOOL);
  assert.deepEqual([...perms].sort(), ["profile", "tenant-management"]);
});

test("does NOT hold the wildcard", async () => {
  // The failure this role exists to prevent.
  const perms = await roleSvc.getPermissionsForRole("platform_admin", SCHOOL);
  assert.equal(perms.includes("*"), false,
    'platform_admin must not hold "*" — that is what developer/super_admin already are');
});

test("is not a bypass role", () => {
  assert.equal(BYPASS_ROLES.has("platform_admin"), false,
    "a bypass role cannot be scoped; adding a fourth would rename the problem, not solve it");
});

test("holds no school-scoped permission", async () => {
  const perms = await roleSvc.getPermissionsForRole("platform_admin", SCHOOL);
  const schoolish = [
    "students", "attendance", "nap-tracker", "medical", "child-journey",
    "care-hygiene", "incidents", "cctv", "staff", "settings",
    "user-management", "roles-permissions", "parent-checkin",
  ];
  const leaked = perms.filter(p => schoolish.includes(p));
  assert.deepEqual(leaked, [],
    `platform_admin must not reach into a school: ${leaked.join(", ")}`);
});

test("resolves the same for every school, because it belongs to none", async () => {
  const a = await roleSvc.getPermissionsForRole("platform_admin", "school-a");
  const b = await roleSvc.getPermissionsForRole("platform_admin", "school-b");
  assert.deepEqual(a, b);
});

test("its matrix is empty, so there is one source of truth for the grant", async () => {
  const m = await roleSvc.getRoleMatrix("platform_admin", SCHOOL);
  assert.deepEqual(m, {});
  assert.notEqual(m._bypass, true, "an empty matrix must not be confused with a bypass");
});

test("lands on the console, not a school dashboard", () => {
  assert.equal(ROLE_HOME.platform_admin, "/platform/tenants");
});

// ── Nothing else moved ──────────────────────────────────────────────────────

test("tenant_management stays out of MODULE_ROUTE_MAP", () => {
  // If this ever gains an entry, the grant becomes reachable through the
  // school roles editor — which is exactly what the static route avoids.
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(path.join(__dirname, "..", "services/roleService.js"), "utf8");
  const mapStart = src.indexOf("MODULE_ROUTE_MAP");
  assert.notEqual(mapStart, -1);
  const mapBody = src.slice(mapStart, src.indexOf("};", mapStart));
  assert.doesNotMatch(mapBody, /tenant_management/,
    "granting tenant-management via the matrix would let the school roles UI widen it");
});

test("platform_admin is not seeded as an editable system role", async () => {
  // Same shape as `parent`: code-defined, so there is no Firestore document
  // for anyone to edit.
  const ids = roleSvc.SYSTEM_ROLES.map(r => r.roleId);
  assert.equal(ids.includes("platform_admin"), false);
  assert.equal(ids.includes("parent"), false, "parent is the precedent this follows");
});

test("an existing role's permissions are unchanged", async () => {
  // The whole change should be additive. teacher is the broadest non-bypass
  // school role that resolves without Firestore in this environment.
  const perms = await roleSvc.getPermissionsForRole("parent", SCHOOL);
  assert.ok(Array.isArray(perms) && perms.length > 0);
  assert.equal(perms.includes("tenant-management"), false,
    "no school role may pick up the console");
});
