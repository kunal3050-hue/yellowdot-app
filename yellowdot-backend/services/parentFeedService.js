/**
 * parentFeedService.js — Parent Module · Phase 2 (Home Feed)
 * ──────────────────────────────────────────────────────────────────
 * Builds a simple, Instagram-style feed for parents by merging existing
 * school content. No new collections, no per-child derivation.
 *
 * Card types (only three):
 *   announcement ← announcements where type !== "Activity"
 *   activity     ← announcements where type === "Activity"
 *   event        ← holidays  +  notices where type === "Event"
 *
 * Returns date-sorted (newest first) FeedItem[]:
 *   { id, type, title, body, image, date, tag }
 *
 * No likes, comments, chat, CCTV, or notifications — purely read content.
 */

const comms = require("./communicationService");

const DEFAULT_SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";
const DAY_MS = 24 * 60 * 60 * 1000;
const EVENT_PAST_WINDOW_DAYS = 30;

function pickDate(...vals) {
  return vals.find(v => !!v) || "";
}

/**
 * Event visibility window:
 *   • Upcoming events (date >= today) — always visible.
 *   • Past events — visible for EVENT_PAST_WINDOW_DAYS (30) days.
 *   • Older — hidden.
 * A single threshold (today − 30 days) satisfies all three rules.
 * Undated events are kept (cannot be classified as stale).
 */
function isEventVisible(dateStr) {
  if (!dateStr) return true;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return true;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return d.getTime() >= todayStart - EVENT_PAST_WINDOW_DAYS * DAY_MS;
}

function mapAnnouncement(a) {
  const isActivity = String(a.type).toLowerCase() === "activity";
  return {
    id:    a.id,
    type:  isActivity ? "activity" : "announcement",
    title: a.title || "",
    body:  a.body || "",
    image: a.mediaUrl || "",
    date:  pickDate(a.publishAt, a.createdAt),
    tag:   isActivity ? "Activity" : (a.type || "Update"),
  };
}

function mapHolidayEvent(h) {
  return {
    id:    h.id,
    type:  "event",
    title: h.title || "",
    body:  h.description || "",
    image: "",
    date:  pickDate(h.startDate, h.createdAt),
    tag:   h.type || "Event",
  };
}

function mapNoticeEvent(n) {
  return {
    id:    n.id,
    type:  "event",
    title: n.title || "",
    body:  n.body || "",
    image: "",
    date:  pickDate(n.publishAt, n.createdAt),
    tag:   "Event",
  };
}

/**
 * Build the merged feed for a parent's school.
 * @param {{schoolId?: string}} opts
 * @returns {Promise<Array>} feed items, newest first
 */
async function getFeed({ schoolId = DEFAULT_SCHOOL_ID } = {}) {
  const [announcements, holidays, notices] = await Promise.all([
    comms.getAnnouncements({ schoolId }),
    comms.getHolidays({ schoolId }),
    comms.getNotices({ schoolId, type: "Event" }),
  ]);

  // Events: keep upcoming + past-within-30-days; hide older.
  // Holidays are measured from endDate (still "upcoming" until they end).
  const visibleHolidays = holidays.filter(h =>
    isEventVisible(pickDate(h.endDate, h.startDate, h.createdAt)));
  const visibleEventNotices = notices.filter(n =>
    n.status !== "draft" && isEventVisible(pickDate(n.publishAt, n.createdAt)));

  const feed = [
    ...announcements.map(mapAnnouncement),
    ...visibleHolidays.map(mapHolidayEvent),
    ...visibleEventNotices.map(mapNoticeEvent),
  ];

  // Newest first; items without a date sink to the bottom.
  feed.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return feed;
}

module.exports = { getFeed };
