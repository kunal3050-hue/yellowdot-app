/**
 * Every route module that server.js requires must also be mounted.
 *
 * On 2026-08-21, 29d19f9 ("refactor(finance): delete both finance modules
 * ahead of rebuild") removed a contiguous block of app.use() calls and took
 * three non-finance mounts with it: journeyRoutes, releaseRoutes and
 * parentRoutes. Child Journey and the entire parent-facing API returned 404
 * in production for about three months.
 *
 * The suite stayed green throughout, because every existing route test
 * require()s its route module and inspects the router object directly --
 * findRouteLayer(journeyRoutes, "/api/journey", "get") passes whether or not
 * server.js ever mounts that router. Nothing asserted the join between the
 * two, so the one line that actually puts a router on the app was untested.
 *
 * This closes that gap at the only place it can be closed cheaply: the
 * require/mount pairing in server.js. It is deliberately a source check
 * rather than a behavioural one, so it needs no credentials, no emulator and
 * no network, and it fails loudly the moment a mount is dropped again.
 */
const test   = require("node:test");
const assert = require("node:assert");
const fs     = require("node:fs");
const path   = require("node:path");

const SERVER = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");

/** Identifiers required as `const xRoutes = require("./routes/...")`. */
function requiredRouters(src) {
  return [...src.matchAll(/^const\s+([A-Za-z0-9_]*Routes)\s*=\s*require\(/gm)].map(m => m[1]);
}

/** Identifiers passed to app.use(...) as a bare argument. */
function mountedRouters(src) {
  return new Set([...src.matchAll(/app\.use\(\s*([A-Za-z0-9_]*Routes)\s*[),]/g)].map(m => m[1]));
}

test("every *Routes module required by server.js is mounted on the app", () => {
  const required = requiredRouters(SERVER);
  const mounted  = mountedRouters(SERVER);

  assert.ok(required.length > 20, `expected to find the route requires, got ${required.length}`);

  const unmounted = required.filter(r => !mounted.has(r));
  assert.deepEqual(
    unmounted, [],
    `required but never mounted — every path these serve returns 404:\n` +
    unmounted.map(r => `  - ${r}`).join("\n"),
  );
});

test("the three mounts lost in 29d19f9 are present, in an order that works", () => {
  // journeyRoutes owns GET /api/parent/journey and guards it with
  // requireOwnChild. parentRoutes applies `router.use("/api/parent", ...,
  // parentOnly)` across the whole prefix, so mounting parentRoutes first
  // would put that blanket guard in front of the journey handler.
  // notificationRoutes carries the same before-parentRoutes requirement and
  // says so in its own comment.
  const at = name => SERVER.indexOf("app.use(" + name + ")");

  for (const name of ["journeyRoutes", "releaseRoutes", "parentRoutes", "notificationRoutes"]) {
    assert.notEqual(at(name), -1, `${name} is not mounted`);
  }

  assert.ok(at("journeyRoutes") < at("parentRoutes"),
    "journeyRoutes must be mounted before parentRoutes");
  assert.ok(at("notificationRoutes") < at("parentRoutes"),
    "notificationRoutes must be mounted before parentRoutes");
});

test("billingRoutes is mounted before parentRoutes", () => {
  // billingRoutes owns GET /api/parent/billing and guards it with
  // requireOwnChild, so it needs to reach the handler ahead of parentRoutes'
  // blanket `router.use("/api/parent", ..., parentOnly)`. Mounted after, the
  // parent-facing fees view 404s for every family — the same failure mode
  // 29d19f9 caused for Child Journey and the whole parent API.
  const at = name => SERVER.indexOf("app.use(" + name + ")");

  assert.notEqual(at("billingRoutes"), -1, "billingRoutes is not mounted");
  assert.ok(at("billingRoutes") < at("parentRoutes"),
    "billingRoutes must be mounted before parentRoutes");
});
