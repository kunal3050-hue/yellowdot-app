/**
 * Date handling — the bug that silently nested attendance docs.
 */
const test = require("node:test");
const assert = require("node:assert");
const { makeFakeFirestore } = require("../test-helpers/_fakeFirestore");

const fake = makeFakeFirestore();
const fbPath = require.resolve("../firebaseAdmin");
require.cache[fbPath] = { id: fbPath, filename: fbPath, loaded: true, exports: { db: fake.db, auth: {} } };

const att = require("../services/attendanceService");

test("normalizeDateToISO passes ISO through unchanged", () => {
  assert.equal(att.normalizeDateToISO("2026-06-08"), "2026-06-08");
});

test("normalizeDateToISO converts DD/MM/YYYY → ISO", () => {
  assert.equal(att.normalizeDateToISO("08/06/2026"), "2026-06-08");
});

test("buildEntryId never contains a slash (no nested-path writes)", () => {
  const id = att.buildEntryId("08/06/2026", "YD008");
  assert.equal(id, "ATT-2026-06-08-YD008");
  assert.ok(!id.includes("/"), "entryId must not contain '/'");
});

test("buildEntryId on a clean ISO date", () => {
  assert.equal(att.buildEntryId("2026-06-08", "YD001"), "ATT-2026-06-08-YD001");
});
