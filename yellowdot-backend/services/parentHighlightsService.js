/**
 * parentHighlightsService.js — Parent Module · Home · Smart Highlights
 * ───────────────────────────────────────────────────────────────────────────
 * Builds the ranked list of "highlight" cards shown in the Home carousel.
 * Merges existing school content (no new collections, no schema change):
 *
 *   🚨 Emergency Alert ← holidays/notices/announcements typed emergency/alert
 *   🎉 Event           ← holidays typed event/festival/special · notices type Event
 *   🎂 Birthday        ← the selected child's dob (next occurrence, ≤ 30 days)
 *   📅 Holiday         ← holidays (upcoming / ongoing)
 *   📢 Announcement    ← announcements (recent, ≤ 14 days)
 *   📋 Notice          ← notices (published, not expired)
 *
 * Ordering rules:
 *   • Emergency alerts ALWAYS first.
 *   • Then by nearest date (soonest first); current/undated info treated as "now".
 *   • Visual priority (Emergency > Event > Holiday > Announcement > Notice) is the
 *     tie-breaker. Birthdays rank alongside events.
 *   • Expired/past items are hidden automatically.
 *
 * Dates are returned as raw YYYY-MM-DD (event date) + ISO postedAt; the client
 * formats them in IST so the card label, tile and countdown always agree.
 */

const comms          = require("./communicationService");
const studentService = require("./studentService");

const DAY = 86400000;
const todayISO = () => new Date().toISOString().slice(0, 10);

// Visual priority — lower sorts earlier.
const PRIORITY = { emergency: 0, event: 1, birthday: 1, holiday: 2, announcement: 3, notice: 4 };

const ANNOUNCEMENT_WINDOW_DAYS = 14; // recent announcements stay highlighted this long
const BIRTHDAY_WINDOW_DAYS     = 30; // a birthday becomes a highlight this far ahead
const MAX_HIGHLIGHTS           = 8;

const isEmergency = (t) => /emerg|alert|urgent|evacuat|closure/i.test(String(t || ""));
const isEventType = (t) => /event|festival|special|function|celebrat|fest\b/i.test(String(t || ""));

function daysBetween(fromISO, toISO) {
  const a = new Date(`${fromISO}T00:00:00Z`), b = new Date(`${toISO}T00:00:00Z`);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
  return Math.round((b - a) / DAY);
}

/** Next occurrence (this year or next) of a MM-DD birthday, within the window. */
function nextBirthday(dob, today) {
  if (!dob) return null;
  const m = String(dob).match(/(\d{4})-(\d{2})-(\d{2})/) || String(dob).match(/(\d{2})[/-](\d{2})[/-](\d{4})/);
  let mm, dd;
  if (!m) return null;
  if (m[0].length === 10 && m[1].length === 4) { mm = m[2]; dd = m[3]; }   // YYYY-MM-DD
  else { dd = m[1]; mm = m[2]; }                                            // DD-MM-YYYY
  const yr = Number(today.slice(0, 4));
  for (const y of [yr, yr + 1]) {
    const cand = `${y}-${mm}-${dd}`;
    const diff = daysBetween(today, cand);
    if (diff !== null && diff >= 0 && diff <= BIRTHDAY_WINDOW_DAYS) return cand;
  }
  return null;
}

/**
 * @param {Object} opts
 * @param {string} opts.schoolId
 * @param {string} [opts.studentId]  selected child (for birthday)
 */
async function getHighlights({ schoolId, studentId } = {}) {
  const today = todayISO();
  const nowMs = Date.now();

  const [holidays, notices, announcements, child] = await Promise.all([
    comms.getHolidays({ schoolId }),
    comms.getNotices({ schoolId }),
    comms.getAnnouncements({ schoolId }),
    studentId ? studentService.getOne(studentId).catch(() => null) : Promise.resolve(null),
  ]);

  const out = [];

  // ── Holidays → emergency / event / holiday (hide past) ──────────────
  for (const h of holidays) {
    const start = h.startDate || "";
    const end   = h.endDate || start;
    if (!start || end < today) continue; // expired
    const kind = isEmergency(h.type) ? "emergency" : isEventType(h.type) ? "event" : "holiday";
    out.push({
      id: `holiday-${h.id}`, kind, priority: PRIORITY[kind],
      title: h.title || (kind === "holiday" ? "Holiday" : "Event"),
      body: h.description || "",
      date: start, endDate: end, postedAt: "",
      type: h.type || "Holiday",
    });
  }

  // ── Notices → emergency / event / notice (published, not expired) ───
  for (const n of notices) {
    if (n.status && n.status !== "published") continue;            // drafts hidden
    if (n.expiresAt && new Date(n.expiresAt).getTime() < nowMs) continue; // expired
    const kind = isEmergency(n.type) ? "emergency" : (String(n.type) === "Event" ? "event" : "notice");
    out.push({
      id: `notice-${n.id}`, kind, priority: PRIORITY[kind],
      title: n.title || "Notice", body: n.body || "",
      date: "", postedAt: n.publishAt || n.createdAt || "",
      type: n.type || "Notice",
    });
  }

  // ── Announcements → emergency / announcement (recent only) ──────────
  for (const a of announcements) {
    const posted = a.publishAt || a.createdAt || "";
    const ageDays = posted ? (nowMs - new Date(posted).getTime()) / DAY : 0;
    const kind = isEmergency(a.type) ? "emergency" : "announcement";
    if (kind !== "emergency" && ageDays > ANNOUNCEMENT_WINDOW_DAYS) continue; // stale
    out.push({
      id: `announcement-${a.id}`, kind, priority: PRIORITY[kind],
      title: a.title || "Announcement", body: a.body || "",
      image: a.mediaUrl || "",
      date: "", postedAt: posted, type: a.type || "Announcement",
    });
  }

  // ── Birthday (selected child) ──────────────────────────────────────
  if (child?.dob) {
    const bday = nextBirthday(child.dob, today);
    if (bday) {
      const first = (child.studentName || "").split(" ")[0] || "your child";
      out.push({
        id: `birthday-${child.studentId}-${bday}`, kind: "birthday", priority: PRIORITY.birthday,
        title: `${first}'s Birthday`,
        body: `It's almost ${first}'s birthday — let's make it special! 🎉`,
        date: bday, postedAt: "", type: "Birthday",
      });
    }
  }

  // ── Rank: emergencies first, then nearest date, then visual priority ─
  const proximity = (it) => {
    if (it.kind === "emergency") return -1e9;
    if (it.date) { const d = daysBetween(today, it.date); return d == null ? 0 : d; }
    return 0; // undated info = "now"
  };
  out.sort((a, b) => {
    const pa = proximity(a), pb = proximity(b);
    if (pa !== pb) return pa - pb;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return String(b.postedAt || "").localeCompare(String(a.postedAt || "")); // newer info first
  });

  return out.slice(0, MAX_HIGHLIGHTS);
}

module.exports = { getHighlights };
