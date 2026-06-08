/**
 * Parent auth guard (parentOnly): only parents (or bypass roles) pass.
 */
const test = require("node:test");
const assert = require("node:assert");
const { makeFakeFirestore } = require("../test-helpers/_fakeFirestore");

const fake = makeFakeFirestore();
const fbPath = require.resolve("../firebaseAdmin");
require.cache[fbPath] = { id: fbPath, filename: fbPath, loaded: true, exports: { db: fake.db, auth: {} } };

const parentRoutes = require("../routes/parentRoutes");
const parentOnly = parentRoutes.parentOnly;

function mockRes() {
  return { code: null, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
}
function run(user) {
  let nextCalled = false;
  const res = mockRes();
  parentOnly({ user }, res, () => { nextCalled = true; });
  return { nextCalled, res };
}

test("a parent passes", () => {
  const { nextCalled } = run({ role: "parent" });
  assert.equal(nextCalled, true);
});

test("a bypass role (developer) passes", () => {
  const { nextCalled } = run({ role: "developer" });
  assert.equal(nextCalled, true);
});

test("a staff role is rejected (403 PARENT_ONLY)", () => {
  const { nextCalled, res } = run({ role: "teacher" });
  assert.equal(nextCalled, false);
  assert.equal(res.code, 403);
  assert.equal(res.body.code, "PARENT_ONLY");
});

test("an unknown role is rejected (403)", () => {
  const { nextCalled, res } = run({ role: "unknown" });
  assert.equal(nextCalled, false);
  assert.equal(res.code, 403);
});

test("no authenticated user → 401", () => {
  let nextCalled = false;
  const res = mockRes();
  parentOnly({}, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(res.code, 401);
});
