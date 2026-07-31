/**
 * getActiveTimelineEntry() must resolve a camera's timeline against the
 * SCHOOL's timezone, not whatever timezone the server process happens to be
 * running in.
 *
 * Production regression: the container has no TZ env var, so Node's ambient
 * clock was UTC. Every timeline was authored in IST. Real IST 08:00-13:29
 * (server UTC 02:30-08:00) fell before every camera's configured start time,
 * so parents were denied with "no-active-slot" for the first ~5.5h of every
 * real school day -- and conversely, cameras stayed reachable ~5.5h past
 * their real IST cutoff every night. It never threw and never logged
 * anything distinguishable from a legitimately-closed camera, which is why
 * it shipped unnoticed.
 *
 * These tests deliberately do NOT rely on the test runner's own ambient
 * timezone (which on a dev machine is often already IST -- exactly the
 * condition that made the bug invisible to a same-machine diagnostic run
 * during the actual investigation). Every case passes an explicit timezone
 * and/or a fixed UTC instant, so the assertions hold identically in CI, on a
 * UTC container, or on an IST laptop.
 */
const test   = require("node:test");
const assert = require("node:assert");
const { getActiveTimelineEntry, SCHOOL_TIMEZONE } = require("../services/cctvAccessResolver");

const daycare = {
  timeline: [
    { days: [1, 2, 3, 4, 5], startTime: "08:00", endTime: "19:55", classroom: "Daycare" },
    { days: [1, 2, 3, 4, 5], startTime: "09:30", endTime: "12:20", classroom: "Playgroup" },
  ],
};

test("SCHOOL_TIMEZONE defaults to Asia/Kolkata — the only zone any real school uses today", () => {
  assert.equal(SCHOOL_TIMEZONE, "Asia/Kolkata");
});

// ── The exact production scenario ────────────────────────────────────────────
// 2026-07-30T04:20:00Z is 09:50 IST on Thursday -- squarely inside the
// Daycare 08:00-19:55 window. Interpreted as raw UTC (the pre-fix bug), it's
// 04:20 -- before the window even opens.

test("real IST mid-morning: interpreted in the school's timezone, the slot is active", () => {
  const now = new Date("2026-07-30T04:20:00Z");
  const entry = getActiveTimelineEntry(daycare, now, "Asia/Kolkata");
  assert.ok(entry, "expected the Daycare slot to be active at 09:50 IST");
  assert.equal(entry.classroom, "Daycare");
});

test("THE BUG, pinned: the same instant interpreted as UTC finds no slot", () => {
  const now = new Date("2026-07-30T04:20:00Z");
  const entry = getActiveTimelineEntry(daycare, now, "UTC");
  assert.equal(entry, null, "04:20 UTC-interpreted is before the 08:00 start -- this was the production denial");
});

test("default timezone argument matches explicit Asia/Kolkata — the fix is actually wired in", () => {
  const now = new Date("2026-07-30T04:20:00Z");
  const withDefault  = getActiveTimelineEntry(daycare, now);
  const withExplicit = getActiveTimelineEntry(daycare, now, "Asia/Kolkata");
  assert.deepEqual(withDefault, withExplicit);
  assert.ok(withDefault, "the default call must find the active slot, not just the explicit one");
});

// ── Day-of-week boundary ─────────────────────────────────────────────────────
// IST is UTC+5:30, so UTC late-evening rolls into the NEXT calendar day in
// IST. A pure day-of-week bug (not just hour-of-day) would be masked by an
// hour-only test.

test("day boundary: UTC evening that's already past midnight in IST resolves to the correct weekday", () => {
  // 2026-07-29 20:00 UTC (Wednesday) = 2026-07-30 01:30 IST (Thursday).
  const now = new Date("2026-07-29T20:00:00Z");
  const thursdayOvernight = {
    timeline: [{ days: [4], startTime: "00:00", endTime: "06:00", classroom: "NightWatch" }],
  };
  const wrongDayCamera = {
    timeline: [{ days: [3], startTime: "00:00", endTime: "06:00", classroom: "WedOnly" }],
  };

  const entry = getActiveTimelineEntry(thursdayOvernight, now, "Asia/Kolkata");
  assert.ok(entry, "01:30 IST Thursday should match a Thursday-only slot");
  assert.equal(entry.classroom, "NightWatch");

  const noEntry = getActiveTimelineEntry(wrongDayCamera, now, "Asia/Kolkata");
  assert.equal(noEntry, null, "a Wednesday-only slot must NOT match 01:30 IST Thursday");
});

// ── Unaffected behaviour, pinned so the fix doesn't regress it ──────────────

test("camera with no timeline still returns null (static classrooms[] fallback path, untouched)", () => {
  assert.equal(getActiveTimelineEntry({ timeline: [] }, new Date()), null);
  assert.equal(getActiveTimelineEntry({}, new Date()), null);
});

test("a day genuinely outside the schedule still returns null", () => {
  // 2026-08-01 is a Saturday; the fixture only runs Mon-Fri.
  const now = new Date("2026-08-01T06:00:00Z"); // 11:30 IST Saturday
  assert.equal(getActiveTimelineEntry(daycare, now, "Asia/Kolkata"), null);
});

test("a time genuinely outside every window still returns null", () => {
  // 2026-07-30 21:00 IST Thursday -- after the 19:55 Daycare cutoff.
  const now = new Date("2026-07-30T15:30:00Z");
  assert.equal(getActiveTimelineEntry(daycare, now, "Asia/Kolkata"), null);
});
