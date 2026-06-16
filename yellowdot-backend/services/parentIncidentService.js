/**
 * parentIncidentService.js — Parent-facing incident view
 * ────────────────────────────────────────────────────────
 * Parents only see incidents for their own children.
 * Attaches acknowledgement status to each incident.
 */

const incSvc = require("./incidentService");

async function getIncidentsForParent({ schoolId, studentIds = [] } = {}) {
  if (studentIds.length === 0) return { incidents: [] };

  const incidents = [];
  for (const studentId of studentIds) {
    const list = await incSvc.getIncidents({ schoolId, studentId });
    for (const inc of list) {
      const ack = await incSvc.getAcknowledgement(inc.id);
      incidents.push({
        ...inc,
        acknowledged:    !!ack,
        acknowledgedAt:  ack?.acknowledgedAt  || null,
        acknowledgementNotes: ack?.acknowledgementNotes || "",
      });
    }
  }

  // Sort critical first, then date desc
  const ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
  incidents.sort((a, b) => {
    const diff = (ORDER[a.severity] ?? 4) - (ORDER[b.severity] ?? 4);
    if (diff !== 0) return diff;
    return (b.incidentDate + b.incidentTime || "").localeCompare(a.incidentDate + a.incidentTime || "");
  });

  return { incidents };
}

module.exports = { getIncidentsForParent };
