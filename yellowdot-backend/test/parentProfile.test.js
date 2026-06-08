/**
 * Parent provisioning, self-heal sync, and ownership.
 */
const test = require("node:test");
const assert = require("node:assert");
const { makeFakeFirestore } = require("../test-helpers/_fakeFirestore");

// Inject a fake Firestore before any service loads firebaseAdmin.
const fake = makeFakeFirestore();
const fbPath = require.resolve("../firebaseAdmin");
require.cache[fbPath] = { id: fbPath, filename: fbPath, loaded: true, exports: { db: fake.db, auth: {} } };

const parentSvc = require("../services/parentProfileService");
const studentService = require("../services/studentService");

test("provisions a parent from email match (single child)", async () => {
  fake.reset({ students: [{ studentId: "YD001", fatherEmail: "a@x.com", schoolId: "sch1" }] });
  const p = await parentSvc.getOrCreateParent({ userId: "u1", email: "a@x.com" });
  assert.ok(p);
  assert.deepEqual(p.studentIds, ["YD001"]);
  assert.equal(p.schoolId, "sch1");
  assert.equal(fake.store.parents.u1.studentIds[0], "YD001");
});

test("provisioning returns null when no child matches", async () => {
  fake.reset({ students: [{ studentId: "YD001", fatherEmail: "a@x.com" }] });
  const p = await parentSvc.getOrCreateParent({ userId: "u2", email: "nobody@x.com" });
  assert.equal(p, null);
});

test("multi-child provisioning links both children sharing the email", async () => {
  fake.reset({ students: [
    { studentId: "YD001", fatherEmail: "p@x.com", schoolId: "sch1" },
    { studentId: "YD002", fatherEmail: "p@x.com", schoolId: "sch1" },
  ] });
  const p = await parentSvc.getOrCreateParent({ userId: "u3", email: "p@x.com" });
  assert.deepEqual([...p.studentIds].sort(), ["YD001", "YD002"]);
});

test("sync self-heals when a child is ADDED", async () => {
  fake.reset({
    parents: { u4: { uid: "u4", email: "p@x.com", studentIds: ["YD001"], schoolId: "sch1" } },
    students: [
      { studentId: "YD001", fatherEmail: "p@x.com", schoolId: "sch1" },
      { studentId: "YD002", fatherEmail: "p@x.com", schoolId: "sch1" },
    ],
  });
  const p = await parentSvc.getOrCreateParent({ userId: "u4", email: "p@x.com" }, { sync: true });
  assert.deepEqual([...p.studentIds].sort(), ["YD001", "YD002"]);
});

test("sync self-heals when a child is REMOVED", async () => {
  fake.reset({
    parents: { u5: { uid: "u5", email: "p@x.com", studentIds: ["YD001", "YD002"], schoolId: "sch1" } },
    students: [{ studentId: "YD001", fatherEmail: "p@x.com", schoolId: "sch1" }],
  });
  const p = await parentSvc.getOrCreateParent({ userId: "u5", email: "p@x.com" }, { sync: true });
  assert.deepEqual(p.studentIds, ["YD001"]);
});

test("sync does NOT wipe links when email is missing (safety)", async () => {
  fake.reset({
    parents: { u6: { uid: "u6", email: "p@x.com", studentIds: ["YD001"], schoolId: "sch1" } },
    students: [{ studentId: "YD001", fatherEmail: "p@x.com", schoolId: "sch1" }],
  });
  const p = await parentSvc.getOrCreateParent({ userId: "u6", email: "" }, { sync: true });
  assert.deepEqual(p.studentIds, ["YD001"]);
});

test("fast path (sync=false) returns cached doc without re-resolving", async () => {
  fake.reset({
    parents: { u7: { uid: "u7", email: "p@x.com", studentIds: ["YD001", "YD002"], schoolId: "sch1" } },
    students: [{ studentId: "YD001", fatherEmail: "p@x.com", schoolId: "sch1" }], // would shrink if synced
  });
  const p = await parentSvc.getOrCreateParent({ userId: "u7", email: "p@x.com" }); // no sync
  assert.deepEqual(p.studentIds, ["YD001", "YD002"]); // unchanged (cached)
});

test("sameIds is order-independent set-equality", () => {
  assert.equal(parentSvc.sameIds(["a", "b"], ["b", "a"]), true);
  assert.equal(parentSvc.sameIds(["a"], ["a", "b"]), false);
  assert.equal(parentSvc.sameIds([], []), true);
});

test("getChild rejects a non-linked student (ownership)", async () => {
  const child = await parentSvc.getChild({ studentIds: ["YD001"] }, "YD999");
  assert.equal(child, null);
});

test("getChild returns a linked student (ownership)", async () => {
  studentService.getOne = async (id) => ({ studentId: id, studentName: "Aarav", class: "Nursery" });
  const child = await parentSvc.getChild({ studentIds: ["YD001"] }, "YD001");
  assert.equal(child.studentId, "YD001");
  assert.equal(child.studentName, "Aarav");
});
