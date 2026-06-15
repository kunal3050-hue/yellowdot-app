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
const careService       = require("./careService");

const DEFAULT_SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const todayISO = () => new Date().toISOString().slice(0, 10);

// Format a full ISO timestamp as "12:09 PM" in IST.
// Falls back to converting a bare "HH:MM:SS" UTC string if no ISO is available
// (covers legacy records written before checkInAt was added).
function toISTDisplay(isoTimestamp, fallbackUtcHms) {
  if (isoTimestamp) {
    const d = new Date(isoTimestamp);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString("en-IN", {
        hour: "2-digit", minute: "2-digit", hour12: true,
        timeZone: "Asia/Kolkata",
      });
    }
  }
  // Legacy fallback: bare "HH:MM:SS" stored as UTC, shift by +5:30
  if (fallbackUtcHms && /^\d{2}:\d{2}/.test(fallbackUtcHms)) {
    const [h, m] = fallbackUtcHms.split(":").map(Number);
    const istMins = (h * 60 + m + 330) % 1440;
    const hh = Math.floor(istMins / 60);
    const mm = istMins % 60;
    const period = hh >= 12 ? "PM" : "AM";
    const h12   = hh % 12 || 12;
    return `${h12}:${String(mm).padStart(2, "0")} ${period}`;
  }
  return fallbackUtcHms || "";
}

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
  const [att, menus, naps, cons, mems, holidays, careLogs] = await Promise.all([
    attendanceService.getAttendance({ studentId, schoolId }),
    foodMenuService.getMenus({ schoolId }),
    napService.getNapHistory({ studentId, schoolId, limit: 50 }),
    fc.getConsumption({ studentId, schoolId }),
    memoriesService.getForChildren({ schoolId, studentId, limit: 50 }),
    comms.getHolidays({ schoolId }),
    careService.getCareHistory({ studentId, schoolId, limit: 50 }),
  ]);

  // ── 🟢🔵 Attendance — split into separate check-in and check-out events ──
  // Each event gets its own feed item and its own sort timestamp so they appear
  // at the correct positions in the timeline (check-in at 9 AM, check-out at 5 PM).
  const attItems = [];
  for (const e of (att.entries || []).filter(e => e.date)) {
    if (e.status === "Absent") {
      attItems.push({
        id: `absent-${e.date}`, kind: "absent", emoji: "⭕",
        title: "Marked Absent", subtitle: "Did not attend.",
        date: e.date, timestamp: pickTs(e.updatedAt, e.createdAt, noon(e.date)),
      });
    } else {
      if (e.checkIn || e.checkInAt) {
        const inTime = toISTDisplay(e.checkInAt, e.checkIn);
        attItems.push({
          id: `checkin-${e.date}`, kind: "checkin", emoji: "🟢",
          title: "Checked In",
          subtitle: `Arrived at daycare${inTime ? ` · ${inTime}` : ""}`,
          date: e.date, timestamp: pickTs(e.checkInAt, e.createdAt, noon(e.date)),
        });
      }
      if (e.checkOut || e.checkOutAt) {
        const outTime = toISTDisplay(e.checkOutAt, e.checkOut);
        attItems.push({
          id: `checkout-${e.date}`, kind: "checkout", emoji: "🔵",
          title: "Checked Out",
          subtitle: `Left daycare${outTime ? ` · ${outTime}` : ""}`,
          date: e.date, timestamp: pickTs(e.checkOutAt, e.updatedAt, noon(e.date)),
        });
      }
    }
  }

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

  // ── 🍽 Consumption (one item per meal entry — actual food name + quantity) ──
  const MEAL_EMOJI = {
    "Breakfast":     "🍳",
    "Mid-Morning":   "☕",
    "Morning Snack": "☕",
    "Lunch":         "🍽️",
    "Roti Sabzi":    "🫓",
    "Dal Rice":      "🍚",
    "Milk":          "🥛",
    "Water":         "💧",
    "Snacks":        "🍪",
    "Snack":         "🍪",
    "Evening Snack": "🍪",
    "Evening Snacks":"🍪",
    "Fruits":        "🍎",
    "Dinner":        "🍽️",
  };

  // Food-item keyword → emoji (checked before falling back to meal-type emoji)
  const FOOD_EMOJI_PATTERNS = [
    [/\b(dal|dhal|lentil|sambar)\b/i,                     "🍲"],
    [/\b(rice|khichdi|biryani|pulao|pongal)\b/i,          "🍚"],
    [/\b(roti|chapati|chapatti|paratha|bread|naan)\b/i,   "🫓"],
    [/\b(dosa|idli|uttapam|upma|poha|pohe|puri|vada)\b/i, "🥞"],
    [/\b(fruit|apple|banana|mango|orange|grapes|papaya|watermelon|guava)\b/i, "🍎"],
    [/\b(egg|omelette|omelet|boiled egg)\b/i,             "🥚"],
    [/\b(milk|curd|yogurt|lassi|buttermilk|chaas)\b/i,    "🥛"],
    [/\b(cookie|biscuit|cake|ladoo|laddoo|sweet)\b/i,     "🍪"],
    [/\b(soup|broth)\b/i,                                 "🥣"],
    [/\b(sandwich|toast)\b/i,                             "🥪"],
    [/\b(juice|drink|water)\b/i,                          "🥤"],
  ];

  function getFoodEmoji(mealType, foodItem) {
    if (foodItem) {
      for (const [pat, em] of FOOD_EMOJI_PATTERNS) {
        if (pat.test(foodItem)) return em;
      }
    }
    return MEAL_EMOJI[mealType] || "🍽️";
  }

  function toTitleCase(str) {
    if (!str) return str;
    return str.replace(/\b\w/g, c => c.toUpperCase());
  }

  function expandUnit(u) {
    if (!u) return u;
    const map = { pcs: "pieces", pc: "piece", tbsp: "tbsp", tsp: "tsp" };
    return map[u.toLowerCase().trim()] || u;
  }

  function buildConsSubtitle(e) {
    const food = toTitleCase((e.foodItem || "").trim());
    const unit = expandUnit(e.unit || "");
    const qty  = e.quantity ? `${e.quantity}${unit ? " " + unit : ""}` : "";
    const isLiquid = ["Milk", "Water"].includes(e.mealType);
    if (isLiquid) return qty ? `Drank ${qty}` : (food || e.status || "Logged");
    if (e.status === "Didn't Eat" || e.status === "Skipped") {
      return food ? `${food} • Didn't eat` : "Didn't eat";
    }
    if (food && qty) return `${food} • Ate ${qty}`;
    if (food)        return food;
    if (qty)         return `Ate ${qty}`;
    return e.status || "Logged";
  }

  const consItems = (cons || [])
    .filter(e => e.date && e.mealType)
    .map(e => ({
      id:        `consumption-${e.date}-${e.mealType}`,
      kind:      "consumption",
      emoji:     getFoodEmoji(e.mealType, e.foodItem),
      title:     e.mealType,
      subtitle:  buildConsSubtitle(e),
      mealType:  e.mealType,
      foodItem:  e.foodItem || "",
      quantity:  e.quantity || "",
      unit:      e.unit     || "",
      status:    e.status   || "",
      date:      e.date,
      timestamp: pickTs(e.updatedAt, e.createdAt, noon(e.date)),
    }));

  // ── 📸 Memories (per memory) ──────────────────────────────────────
  const memItems = (mems || []).map(m => ({
    id: `memory-${m.id}`, kind: "memory", emoji: "📸",
    title: "Memory Added",
    subtitle: m.caption || (m.type === "video" ? "New video" : "New photo"),
    image: m.thumbnailUrl || m.mediaUrl || "",
    date: m.date, timestamp: pickTs(m.createdAt, noon(m.date)),
  }));

  // ── 🩲 Care & Hygiene (per event) ──────────────────────────────────
  const CARE_EMOJI = {
    Urine: "🟡", Motion: "🟤", Both: "🟢",
    "Diaper Change": "🔵", "Toilet Visit": "🚽",
    Accident: "⚠️", "Water Refilled": "💧",
  };
  const careItems = (careLogs || []).map(c => ({
    id:        `care-${c.logId}`,
    kind:      "care",
    emoji:     CARE_EMOJI[c.type] || "🩺",
    title:     c.type,
    subtitle:  c.notes || "Logged at school",
    date:      c.date,
    timestamp: pickTs(c.loggedAt, c.createdAt, noon(c.date)),
  }));

  const items = [...attItems, ...menuItems, ...napItems, ...consItems, ...memItems, ...careItems]
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
