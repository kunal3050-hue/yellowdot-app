/**
 * getActiveTimelineEntry() must prefer the timeline entry matching the
 * caller's classroom when more than one entry is simultaneously active --
 * not just whichever one was listed first.
 *
 * Production regression: every camera's timeline is a broad all-day
 * "Daycare" block plus a narrower program-specific block (Playgroup /
 * Nursery / LKG) nested inside the same window -- e.g. cam 01:
 *   [0] Mon-Fri 08:00-19:55  classroom="Daycare"
 *   [1] Mon-Fri 09:30-12:55  classroom="Playgroup"
 * At 11:25 IST both entries are active. `.find()` returned index 0 every
 * time, because Daycare is always listed first and its window always
 * contains the narrower one. A Playgroup child was compared against
 * "Daycare" and denied with "not-child-classroom" -- against their own
 * correctly-configured schedule, every single day, for the entire window
 * their program actually runs. Confirmed against two real parent accounts
 * (Manisha Vaviya / cam 01 / Playgroup, Kirti Mishra / CAm 07 / LKG) via a
 * live diagnostic run against production data.
 */
const test   = require("node:test");
const assert = require("node:assert");
const { getActiveTimelineEntry, canParentViewCamera } = require("../services/cctvAccessResolver");

// The exact real cam 01 shape, at the exact real moment that denied a real parent.
const cam01 = {
  centerId: "ydseawoods-main", schoolId: "ydseawoods",
  timeline: [
    { days: [1, 2, 3, 4, 5], startTime: "08:00", endTime: "19:55", classroom: "Daycare" },
    { days: [1, 2, 3, 4, 5], startTime: "09:30", endTime: "12:55", classroom: "Playgroup" },
  ],
};
const AT_ELEVEN_TWENTY_FIVE_IST = new Date("2026-07-30T05:55:00Z"); // 11:25 IST Thursday -- inside both windows

test("THE BUG, pinned: with no classroom preference, the broader entry always wins the overlap", () => {
  const entry = getActiveTimelineEntry(cam01, AT_ELEVEN_TWENTY_FIVE_IST);
  assert.equal(entry.classroom, "Daycare", "documents the pre-fix default -- unchanged for callers that don't pass a preference");
});

test("a Playgroup child's own overlapping slot is now correctly preferred", () => {
  const entry = getActiveTimelineEntry(cam01, AT_ELEVEN_TWENTY_FIVE_IST, undefined, "Playgroup");
  assert.ok(entry, "expected an active entry");
  assert.equal(entry.classroom, "Playgroup");
});

test("a Daycare child is unaffected -- still correctly matches Daycare", () => {
  const entry = getActiveTimelineEntry(cam01, AT_ELEVEN_TWENTY_FIVE_IST, undefined, "Daycare");
  assert.equal(entry.classroom, "Daycare");
});

test("a classroom that genuinely isn't active falls back to the first active entry (still correctly denies downstream)", () => {
  const entry = getActiveTimelineEntry(cam01, AT_ELEVEN_TWENTY_FIVE_IST, undefined, "Nursery");
  assert.equal(entry.classroom, "Daycare", "no active entry matches Nursery on this camera, so the fallback is unchanged");
});

test("explicit timezone argument still works alongside the new preference argument", () => {
  const entry = getActiveTimelineEntry(cam01, AT_ELEVEN_TWENTY_FIVE_IST, "Asia/Kolkata", "Playgroup");
  assert.equal(entry.classroom, "Playgroup");
});

// ── Integration level: canParentViewCamera(), the actual call site ──────────

test("canParentViewCamera: a real Playgroup child on the real cam 01 shape is now ALLOWED", () => {
  const child    = { studentId: "YD015", classroom: "Playgroup", centerId: "ydseawoods-main", schoolId: "ydseawoods" };
  const presence = { status: "PRESENT" };
  const decision = canParentViewCamera(child, presence, cam01, { schoolHoursOpen: true, now: AT_ELEVEN_TWENTY_FIVE_IST });
  assert.equal(decision.allowed, true, `expected ALLOWED, got denied with reason="${decision.reason}"`);
});

test("canParentViewCamera: a Daycare child on the same camera at the same moment is unaffected", () => {
  const child    = { studentId: "YD099", classroom: "Daycare", centerId: "ydseawoods-main", schoolId: "ydseawoods" };
  const presence = { status: "PRESENT" };
  const decision = canParentViewCamera(child, presence, cam01, { schoolHoursOpen: true, now: AT_ELEVEN_TWENTY_FIVE_IST });
  assert.equal(decision.allowed, true);
});

test("canParentViewCamera: a genuinely wrong classroom still correctly denies", () => {
  const child    = { studentId: "YD099", classroom: "Nursery", centerId: "ydseawoods-main", schoolId: "ydseawoods" };
  const presence = { status: "PRESENT" };
  const decision = canParentViewCamera(child, presence, cam01, { schoolHoursOpen: true, now: AT_ELEVEN_TWENTY_FIVE_IST });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "not-child-classroom");
});

// ── The second real account, a different camera, confirming this isn't cam-01-specific ──

test("CAm 07 / LKG (the second real account's camera) resolves the same way", () => {
  const cam07 = {
    centerId: "ydseawoods-main", schoolId: "ydseawoods",
    timeline: [
      { days: [1, 2, 3, 4, 5], startTime: "08:00", endTime: "17:55", classroom: "Daycare" },
      { days: [1, 2, 3, 4, 5], startTime: "09:30", endTime: "12:20", classroom: "LKG" },
    ],
  };
  const now = new Date("2026-07-30T06:11:00Z"); // 11:41 IST -- inside both windows
  const entry = getActiveTimelineEntry(cam07, now, undefined, "LKG");
  assert.equal(entry.classroom, "LKG");
});

// ── No preference argument at all: existing callers (and the timezone-fix
// tests from cctvTimelineTimezone.test.js) must resolve identically ──────────

test("omitting preferredClassroom entirely preserves prior behaviour exactly", () => {
  const withoutPreference = getActiveTimelineEntry(cam01, AT_ELEVEN_TWENTY_FIVE_IST);
  const withUndefinedPref = getActiveTimelineEntry(cam01, AT_ELEVEN_TWENTY_FIVE_IST, undefined, undefined);
  assert.deepEqual(withoutPreference, withUndefinedPref);
});

test("a camera with only one active entry is unaffected by the preference logic", () => {
  const singleEntryCam = {
    timeline: [{ days: [1, 2, 3, 4, 5], startTime: "08:00", endTime: "20:00", classroom: "Daycare" }],
  };
  const entry = getActiveTimelineEntry(singleEntryCam, AT_ELEVEN_TWENTY_FIVE_IST, undefined, "Playgroup");
  assert.equal(entry.classroom, "Daycare", "the only active entry is returned regardless of preference, same as before");
});
