/**
 * parentActivityFeedService.js — Parent Module · Home (Unified Activity Timeline)
 * ───────────────────────────────────────────────────────────────────────────────
 * Turns Home from a notice board into a real, child-specific activity timeline.
 * Merges what staff already enters across the existing collections — no new
 * collections, no schema change:
 *
 *   ✅ Attendance Marked   ← attendance     (per child / day)
 *   🍽️ Food Menu Updated   ← foodMenus      (school-scoped / day)
 *   😴 Nap Recorded         ← napLogs        (per child / nap)
 *   🍎 Consumption Logged   ← foodConsumption(per child / day)
 *   📸 Memory Added         ← memories       (per child)
 *   📅 Upcoming Holiday      ← holidays       (nearest upcoming ONLY — pinned)
 *
 * Returns:
 *   { studentId, upcomingHoliday, items[], generatedAt }
 *
 * items are sorted newest-first by `timestamp` (ISO of when staff entered the
 * data). The client groups them into Today / Yesterday / Earlier This Week /
 * Older and flags unseen items. The holiday is returned separately so the
 * client can pin exactly one nearest-upcoming holiday at the top.
 */

const attendanceService = require("./attendanceService");
const napService        = require("./napService");
const fc                = require("./foodConsumptionService");
const foodMenuService   = require("./foodMenuService");
const memoriesService   = require("./memoriesService");
const comms             = require("./communicationService");

const DEFAULT_SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const todayISO = () => new Date().toISOString().slice(0, 10);

// First non-empty, comparable timestamp-ish string.
function pickTs(...vals) {
  for (const v of vals) if (v && typeof v === "string" && v.length >= 10) return v;
  return "";
}
// Date-only → midday ISO so it sorts/sections sensibly when no createdAt exists.
const noon = (date) => (date ? `${date}T12:00:00.000Z` : "");

function hm(min) {
  const m = Number(min) || 0;
  if (m <= 0) return "0m";
  const h = Math.floor(m / 60), r = m % 60;
  return h ? `${h}h${r ? ` ${r}m` : ""}` : `${r}m`;
}

const EMPTY = (studentId, date) => ({ studentId: studentId || null, upcomingHoliday: null, items: [], generatedAt: new Date().toISOString() });

/**
 * @param {Object} opts
 * @param {string} opts.schoolId
 * @param {string} opts.studentId  (caller enforces ownership)
 */
async function getActivityFeed({ schoolId = DEFAULT_SCHOOL_ID, studentId } = {}) {
  if (!studentId) return EMPTY(studentId);

  // All equality-only queries (schoolId [+ studentId]) — no composite indexes.
  const [att, menus, naps, cons, mems, holidays] = await Promise.all([
    attendanceService.getAttendance({ studentId, schoolId }),
    foodMenuService.getMenus({ schoolId }),
    napService.getNapHistory({ studentId, schoolId, limit: 50 }),
    fc.getConsumption({ studentId, schoolId }),
    memoriesService.getForChildren({ schoolId, studentId, limit: 50 }),
    comms.getHolidays({ schoolId }),
  ]);

  // ── ✅ Attendance (per day) ───────────────────────────────────────
  const attItems = (att.entries || [])
    .filter(e => e.date)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, 21)
    .map(e => {
      const subtitle = e.status === "Absent"
        ? "Marked absent"
        : `${e.status || "Present"}${e.checkIn ? ` · In ${e.checkIn}` : ""}${e.checkOut ? ` · Out ${e.checkOut}` : ""}`;
      return {
        id: `attendance-${e.date}`, kind: "attendance", emoji: "✅",
        title: "Attendance Marked", subtitle, status: e.status || "Present",
        date: e.date, timestamp: pickTs(e.updatedAt, e.createdAt, noon(e.date)),
      };
    });

  // ── 🍽️ Food Menu (per day, school-scoped) ─────────────────────────
  const menuByDate = {};
  for (const m of menus) {
    if (!m.date || !m.itemName) continue;
    const o = menuByDate[m.date] || (menuByDate[m.date] = { items: [], meals: new Set(), ts: "" });
    o.items.push(m); o.meals.add(m.mealType);
    const t = pickTs(m.updatedAt, m.createdAt);
    if (t > o.ts) o.ts = t;
  }
  const menuItems = Object.entries(menuByDate)
    .sort((a, b) => b[0].localeCompare(a[0])).slice(0, 10)
    .map(([date, o]) => ({
      id: `foodMenu-${date}`, kind: "foodMenu", emoji: "🍽️",
      title: "Food Menu Updated",
      subtitle: `${o.items.length} item${o.items.length === 1 ? "" : "s"} · ${o.meals.size} meal${o.meals.size === 1 ? "" : "s"}`,
      date, timestamp: o.ts || noon(date),
    }));

  // ── 😴 Naps (per nap) ─────────────────────────────────────────────
  const napItems = (naps || []).map(n => {
    const sleeping = n.status === "sleeping";
    return {
      id: `nap-${n.napId}`, kind: "nap", emoji: "😴",
      title: "Nap Recorded",
      subtitle: sleeping ? "Sleeping…" : `Slept ${hm(n.duration)}${n.mood ? ` · ${n.mood}` : ""}`,
      date: n.date, timestamp: pickTs(n.updatedAt, n.endTime, n.startTime, n.createdAt, noon(n.date)),
    };
  });

  // ── 🍎 Consumption (per day) ──────────────────────────────────────
  const consByDate = {};
  for (const e of cons) {
    if (!e.date || !(e.foodItem || e.status)) continue;
    const o = consByDate[e.date] || (consByDate[e.date] = { ate: 0, skipped: 0, n: 0, ts: "" });
    o.n++;
    if (e.status === "Ate") o.ate++; else if (e.status) o.skipped++;
    const t = pickTs(e.updatedAt, e.createdAt);
    if (t > o.ts) o.ts = t;
  }
  const consItems = Object.entries(consByDate)
    .sort((a, b) => b[0].localeCompare(a[0])).slice(0, 21)
    .map(([date, o]) => ({
      id: `consumption-${date}`, kind: "consumption", emoji: "🍎",
      title: "Consumption Logged",
      subtitle: `Ate ${o.ate}${o.skipped ? ` · Skipped ${o.skipped}` : ""} of ${o.n} meal${o.n === 1 ? "" : "s"}`,
      date, timestamp: o.ts || noon(date),
    }));

  // ── 📸 Memories (per memory) ──────────────────────────────────────
  const memItems = (mems || []).map(m => ({
    id: `memory-${m.id}`, kind: "memory", emoji: "📸",
    title: "Memory Added",
    subtitle: m.caption || (m.type === "video" ? "New video" : "New photo"),
    image: m.thumbnailUrl || m.mediaUrl || "",
    date: m.date, timestamp: pickTs(m.createdAt, noon(m.date)),
  }));

  const items = [...attItems, ...menuItems, ...napItems, ...consItems, ...memItems]
    .filter(i => i.timestamp)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 100);

  // ── 📅 Nearest upcoming holiday (single; never past) ──────────────
  const today = todayISO();
  const upcoming = holidays
    .filter(h => (h.endDate || h.startDate || "") >= today)
    .sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
  const nh = upcoming[0];
  const upcomingHoliday = nh ? {
    id: nh.id, title: nh.title || "", startDate: nh.startDate || "",
    endDate: nh.endDate || nh.startDate || "", type: nh.type || "Holiday",
    description: nh.description || "",
  } : null;

  return { studentId, upcomingHoliday, items, generatedAt: new Date().toISOString() };
}

module.exports = { getActivityFeed };
