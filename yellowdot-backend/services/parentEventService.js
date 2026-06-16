/**
 * parentEventService.js — Parent Module · Events (class-filtered, read-only)
 *
 * Returns events visible to a child's class, enriched with the child's RSVP
 * response if rsvpRequired is true.
 */

const eventSvc = require("./eventService");

const DAY_MS               = 24 * 60 * 60 * 1000;
const PAST_VISIBLE_DAYS    = 7; // show events that ended up to 7 days ago

function eventStatus(eventDate) {
  if (!eventDate) return "upcoming";
  const today = new Date().toISOString().slice(0, 10);
  if (eventDate < today) return "completed";
  if (eventDate === today) return "ongoing";
  return "upcoming";
}

function isVisible(eventDate) {
  if (!eventDate) return true;
  const cutoff = new Date(Date.now() - PAST_VISIBLE_DAYS * DAY_MS)
    .toISOString().slice(0, 10);
  return eventDate >= cutoff;
}

/**
 * @param {Object} opts
 * @param {string} opts.schoolId
 * @param {string} [opts.studentClassId]   — resolved from child's classId
 * @param {string} [opts.studentId]        — for RSVP lookup
 * @param {string} [opts.parentId]         — for RSVP lookup
 */
async function getEventsView({ schoolId, studentClassId, studentId, parentId } = {}) {
  const all = await eventSvc.getEvents({ schoolId });

  const events = [];
  for (const ev of all) {
    if (!isVisible(ev.eventDate)) continue;

    // Class filter
    if (ev.appliesTo === "selected") {
      if (studentClassId && !(ev.classIds || []).includes(studentClassId)) continue;
    }

    const status = eventStatus(ev.eventDate);

    // RSVP for this student
    let myRsvp = null;
    if (ev.rsvpRequired && studentId) {
      myRsvp = await eventSvc.getParentRsvp({ eventId: ev.id, studentId });
    }

    events.push({ ...ev, status, myRsvp: myRsvp?.response || null });
  }

  return { events };
}

module.exports = { getEventsView };
