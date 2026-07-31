/**
 * streamSessionService.audit() writes an explicit field whitelist to
 * Firestore -- it does not just persist whatever object it's handed.
 *
 * When `reason` was added to cctvController's LIVE_VIEW_DENIED payload
 * (parentLiveTokenDenyReasons.test.js), that test stubbed audit() out
 * entirely with a permissive fake that captured the whole payload
 * (`audits.push({ event, ...payload })`). That proved the CALLER passes
 * `reason` correctly. It could never prove the real audit() actually
 * PERSISTS it, because the fake had no whitelist to omit it from -- and the
 * real one did. `reason` was silently dropped on every write since that fix
 * shipped; every denial in cctvAuditLogs recorded no cause at all, exactly
 * the gap the fix was meant to close.
 *
 * These tests call the REAL audit() against a fake Firestore instead of
 * stubbing audit() itself, so a field genuinely missing from the whitelist
 * fails here the same way it failed in production.
 */
const test   = require("node:test");
const assert = require("node:assert");

// Minimal fake supporting exactly what audit() uses: collection().doc(id).set(data).
function makeFakeFirestore() {
  const store = new Map();
  const db = {
    collection: () => ({
      doc: id => ({
        async set(data) { store.set(id, { ...data }); },
      }),
    }),
  };
  return { db, get: id => store.get(id), all: () => [...store.values()] };
}

const fake = makeFakeFirestore();
const fbPath = require.resolve("../firebaseAdmin");
require.cache[fbPath] = { id: fbPath, filename: fbPath, loaded: true, exports: { db: fake.db, auth: {} } };

const { audit } = require("../services/streamSessionService");

test("audit() persists `reason` on a LIVE_VIEW_DENIED write", async () => {
  await audit("LIVE_VIEW_DENIED", {
    userId: "u1", userEmail: "parent@example.com", role: "parent", kind: "parent",
    cameraId: "cam-1", childId: "YD001", reason: "no-active-slot", ip: "1.2.3.4",
  }, "2026-07-30T04:37:56.069Z");

  const written = fake.all().find(d => d.event === "LIVE_VIEW_DENIED");
  assert.ok(written, "expected a LIVE_VIEW_DENIED document to be written");
  assert.equal(written.reason, "no-active-slot",
    "reason must survive audit()'s own field whitelist, not just the caller's payload");
});

test("audit() persists every other denial reason string the controller actually sends", async () => {
  const reasons = [
    "not-linked", "child-missing", "no-camera", "engine-not-provisioned",
    "not-parent", "server-error", "outside-school-hours", "parent-cctv-disabled",
    "child-not-present", "child-checked-out", "not-child-classroom",
    "different-center", "different-school", "camera-unavailable",
  ];
  for (const reason of reasons) {
    await audit("LIVE_VIEW_DENIED", { userId: "u1", reason, sessionId: `s-${reason}` }, "2026-07-30T00:00:00.000Z");
    const written = fake.get(`LIVE_VIEW_DENIED-s-${reason}-2026-07-30T00:00:00.000Z`);
    assert.equal(written?.reason, reason, `reason "${reason}" must round-trip through audit()`);
  }
});

test("a write with no reason persists an empty string, not undefined or a missing field", async () => {
  await audit("LIVE_VIEW_STARTED", { userId: "u1", sessionId: "s-started" }, "2026-07-30T00:00:00.000Z");
  const written = fake.get("LIVE_VIEW_STARTED-s-started-2026-07-30T00:00:00.000Z");
  assert.equal(written.reason, "", "missing reason should normalize to empty string, matching every other optional field here");
});

test("unrelated fields are still written correctly (no regression from adding `reason`)", async () => {
  await audit("LIVE_VIEW_STARTED", {
    userId: "u2", userName: "Parent Two", userEmail: "p2@example.com", role: "parent", kind: "parent",
    cameraId: "cam-2", cameraName: "Cam Two", classroom: "Daycare", centerId: "c1",
    childId: "YD002", sessionId: "s-regress", ip: "5.6.7.8",
  }, "2026-07-30T00:00:00.000Z");
  const written = fake.get("LIVE_VIEW_STARTED-s-regress-2026-07-30T00:00:00.000Z");
  assert.equal(written.classroom, "Daycare");
  assert.equal(written.centerId, "c1");
  assert.equal(written.cameraName, "Cam Two");
});
