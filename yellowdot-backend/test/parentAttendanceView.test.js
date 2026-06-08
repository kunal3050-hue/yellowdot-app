/**
 * Attendance retrieval: percentage, day map, holiday expansion/exclusion, empty.
 */
const test = require("node:test");
const assert = require("node:assert");
const { makeFakeFirestore } = require("../test-helpers/_fakeFirestore");

const fake = makeFakeFirestore();
const fbPath = require.resolve("../firebaseAdmin");
require.cache[fbPath] = { id: fbPath, filename: fbPath, loaded: true, exports: { db: fake.db, auth: {} } };

const att = require("../services/attendanceService");
const comms = require("../services/communicationService");
const view = require("../services/parentAttendanceViewService");

test("computes percentage, day map and holiday expansion", async () => {
  att.getAttendance = async () => ({ entries: [
    { date: "2026-06-01", status: "Present", checkIn: "09:00", checkOut: "15:00" },
    { date: "2026-06-02", status: "Absent" },
    { date: "2026-06-03", status: "Late", checkIn: "10:10" },
  ] });
  comms.getHolidays = async () => [{ startDate: "2026-06-10", endDate: "2026-06-11", title: "Break" }];

  const r = await view.getChildAttendance({ studentId: "YD001", schoolId: "s", month: "2026-06" });
  // present+late = 2 of 3 recorded → 67%
  assert.equal(r.percentage, 67);
  assert.equal(r.summary.present, 1);
  assert.equal(r.summary.late, 1);
  assert.equal(r.summary.absent, 1);
  assert.equal(r.summary.holiday, 2);                 // 06-10 + 06-11 expanded
  assert.equal(r.days["2026-06-02"], "Absent");
  assert.equal(r.days["2026-06-10"], "Holiday");
  assert.equal(r.days["2026-06-11"], "Holiday");
  assert.equal(r.history.length, 3);
});

test("holidays appear in the day map and don't count as school days", async () => {
  att.getAttendance = async () => ({ entries: [{ date: "2026-06-01", status: "Present" }] });
  comms.getHolidays = async () => [{ startDate: "2026-06-10", endDate: "2026-06-10" }];
  const r = await view.getChildAttendance({ studentId: "YD001", schoolId: "s", month: "2026-06" });
  assert.equal(r.summary.recorded, 1);   // only 06-01 is a recorded school day
  assert.equal(r.percentage, 100);
  assert.equal(r.summary.holiday, 1);
  assert.equal(r.days["2026-06-10"], "Holiday");
  assert.equal(r.days["2026-06-01"], "Present");
});

test("empty month → null percentage, no error", async () => {
  att.getAttendance = async () => ({ entries: [] });
  comms.getHolidays = async () => [];
  const r = await view.getChildAttendance({ studentId: "YD001", schoolId: "s", month: "2026-06" });
  assert.equal(r.percentage, null);
  assert.equal(r.summary.recorded, 0);
  assert.deepEqual(r.days, {});
  assert.deepEqual(r.history, []);
});
