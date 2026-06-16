/**
 * parentNoticesService.js — Parent-scoped Notices view
 *
 * Filters published notices by the child's classId using the same
 * appliesTo / classIds schema used by Holidays.
 *
 *   appliesTo === "all"      → show to every parent
 *   appliesTo === "selected" → show only if classIds includes student.classId
 *                              (if classId unknown, show all — safe fallback)
 */

const communicationSvc = require("./communicationService");

async function getNoticesView({ schoolId, studentClassId } = {}) {
  const all = await communicationSvc.getNotices({ schoolId });

  const notices = all
    .filter(n => n.status === "published")
    .filter(n => {
      const appliesTo = n.appliesTo || "all";
      if (appliesTo === "selected") {
        if (!studentClassId) return true;
        return (n.classIds || []).includes(studentClassId);
      }
      return true;
    });

  return { notices };
}

module.exports = { getNoticesView };
