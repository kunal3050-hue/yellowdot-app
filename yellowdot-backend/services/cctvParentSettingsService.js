/**
 * cctvParentSettingsService.js — Parent CCTV settings + school-hours gate
 * ─────────────────────────────────────────────────────────────────────────────
 * Settings live in Firestore settings/cctv_parent (generic key/value section):
 *   enabled        "true"|"false"   master switch for parent live view
 *   schoolOpen     "HH:MM"          start of viewing window (local)
 *   schoolClose    "HH:MM"          end of viewing window (local)
 *   enforceHours   "true"|"false"   if false, presence alone gates (no time window)
 *   timezone       e.g. "Asia/Kolkata"
 *
 * No streaming, no credentials. Pure settings + a time check.
 */

const { db } = require("../firebaseAdmin");

const DEFAULTS = {
  enabled:      "false",          // off until an admin enables it
  schoolOpen:   "08:00",
  schoolClose:  "18:00",
  enforceHours: "true",
  timezone:     "Asia/Kolkata",
};

async function getSettings() {
  const snap = await db.collection("settings").doc("cctv_parent").get();
  return { ...DEFAULTS, ...(snap.exists ? snap.data() : {}) };
}

async function saveSettings(data, actorUserId = "system") {
  const clean = {};
  ["enabled", "schoolOpen", "schoolClose", "enforceHours", "timezone"].forEach(k => {
    if (data[k] !== undefined) clean[k] = String(data[k]);
  });
  clean.updatedAt = new Date().toISOString();
  clean.updatedBy = actorUserId;
  await db.collection("settings").doc("cctv_parent").set(clean, { merge: true });
  return getSettings();
}

// "HH:MM" in the configured timezone → minutes since midnight.
function nowMinutesInTz(tz) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date());
    const h = +parts.find(p => p.type === "hour").value;
    const m = +parts.find(p => p.type === "minute").value;
    return h * 60 + m;
  } catch {
    const d = new Date(); return d.getHours() * 60 + d.getMinutes();
  }
}

function toMin(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ""));
  return m ? (+m[1]) * 60 + (+m[2]) : null;
}

/**
 * Is parent live viewing currently open?
 * @returns {{ open:boolean, reason:string, settings }}
 */
async function isParentViewingOpen() {
  const s = await getSettings();
  if (String(s.enabled).toLowerCase() !== "true") {
    return { open: false, reason: "parent-cctv-disabled", settings: s };
  }
  if (String(s.enforceHours).toLowerCase() !== "true") {
    return { open: true, reason: "no-hour-restriction", settings: s };
  }
  const now   = nowMinutesInTz(s.timezone);
  const open  = toMin(s.schoolOpen);
  const close = toMin(s.schoolClose);
  if (open == null || close == null) return { open: true, reason: "hours-misconfigured-allow", settings: s };
  const within = open <= close ? (now >= open && now <= close)
                               : (now >= open || now <= close); // overnight window
  return { open: within, reason: within ? "within-hours" : "outside-school-hours", settings: s };
}

module.exports = { getSettings, saveSettings, isParentViewingOpen, DEFAULTS };
