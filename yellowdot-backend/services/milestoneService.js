/**
 * milestoneService.js — Child Journey · Milestone Engine
 *
 * Handles two categories of milestones:
 *   1. Auto-detected: First Day, 30 Days, 100 Days, Birthday
 *      Call checkAutoMilestones() after each attendance record is saved.
 *   2. Teacher-created: preset + custom milestones recorded by staff.
 *      Call createTeacherMilestone() from the milestone route.
 *
 * All milestones are stored as journeyEntries with kind="milestone".
 * Dedup is enforced via milestoneId before creating.
 */

const { db }         = require("../firebaseAdmin");
const journeyService = require("./journeyService");
const notifService   = require("./notificationService");

const SCHOOL_ID = process.env.SCHOOL_ID || "ydseawoods";

// ── Teacher-created milestone presets ─────────────────────────────────────────
const TEACHER_MILESTONES = [
  { id: "first_friend",        label: "First Friend",       emoji: "🤝", category: "social"      },
  { id: "first_performance",   label: "First Performance",  emoji: "🎭", category: "achievement"  },
  { id: "reading_first_word",  label: "Reading First Word", emoji: "📚", category: "academic"     },
  { id: "writing_name",        label: "Writing My Name",    emoji: "✏️",  category: "academic"     },
  { id: "custom",              label: "Custom Milestone",   emoji: "⭐", category: "general"      },
];

// ── Auto-milestone thresholds ─────────────────────────────────────────────────
const ATTENDANCE_THRESHOLDS = [
  { count: 1,   id: "first_day",  title: "First Day at School 🎒",  category: "attendance" },
  { count: 30,  id: "day_30",     title: "30 Days at School 🌟",    category: "attendance" },
  { count: 100, id: "day_100",    title: "100 Days at School 🎉",   category: "attendance" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
async function milestoneExists(studentId, schoolId, milestoneId) {
  const snap = await db.collection("journeyEntries")
    .where("schoolId",    "==", schoolId)
    .where("studentId",   "==", studentId)
    .where("milestoneId", "==", milestoneId)
    .limit(1)
    .get();
  return !snap.empty;
}

async function getStudent(studentId) {
  const snap = await db.collection("students").doc(studentId).get();
  if (!snap.exists) return null;
  const d = snap.data();
  return { ...d, id: studentId, name: d.name || `${d.firstName || ""} ${d.lastName || ""}`.trim() };
}

async function fireMilestoneNotif(studentId, schoolId, title, message) {
  notifService.notifyAsync(() =>
    notifService.fireForStudent(studentId, schoolId, {
      type:          notifService.TYPES.MILESTONE_ACHIEVED,
      title,
      message,
      deepLink:      "/parent-journey",
      milestoneFlag: true,
    })
  );
}

// ── checkAutoMilestones ───────────────────────────────────────────────────────
// Called by the attendance route after marking a student Present.
// Returns array of newly-created milestone entries (usually 0 or 1).
async function checkAutoMilestones({ studentId, schoolId = SCHOOL_ID, date }) {
  if (!studentId) throw new Error("studentId required");
  const today = date || new Date().toISOString().slice(0, 10);

  const student = await getStudent(studentId);
  if (!student) return [];

  const centerId    = student.centerId || "";
  const studentName = student.name;

  const created = [];

  // ── Attendance-based milestones ───────────────────────────────────────────
  const attSnap = await db.collection("attendance")
    .where("schoolId",  "==", schoolId)
    .where("studentId", "==", studentId)
    .where("status",    "==", "Present")
    .get();
  const presentCount = attSnap.size;

  for (const threshold of ATTENDANCE_THRESHOLDS) {
    if (presentCount !== threshold.count) continue;
    if (await milestoneExists(studentId, schoolId, threshold.id)) continue;

    const entry = await journeyService.createEntry({
      studentId, studentName,
      kind:              "milestone",
      sourceModule:      "milestones",
      milestoneId:       threshold.id,
      milestoneTitle:    threshold.title,
      milestoneCategory: threshold.category,
      autoDetected:      true,
      momentNote:        `${studentName} has reached a wonderful milestone!`,
      date:              today,
      visibility:        "all_parents",
    }, { schoolId, centerId, actorUserId: "milestone_engine" });

    await fireMilestoneNotif(
      studentId, schoolId,
      `⭐ ${threshold.title}`,
      `${studentName} has reached a wonderful milestone!`
    );
    created.push(entry);
  }

  // ── Birthday milestone ────────────────────────────────────────────────────
  const dob = student.dateOfBirth || student.dob;
  if (dob) {
    const dobDate   = new Date(dob);
    const todayDate = new Date(`${today}T00:00:00`);
    const isBirthday =
      dobDate.getMonth() === todayDate.getMonth() &&
      dobDate.getDate()  === todayDate.getDate();

    if (isBirthday) {
      const bdayId = `birthday_${todayDate.getFullYear()}`;
      if (!(await milestoneExists(studentId, schoolId, bdayId))) {
        const entry = await journeyService.createEntry({
          studentId, studentName,
          kind:              "milestone",
          sourceModule:      "milestones",
          milestoneId:       bdayId,
          milestoneTitle:    "Happy Birthday! 🎂",
          milestoneCategory: "birthday",
          autoDetected:      true,
          momentNote:        `Wishing ${studentName} a very happy birthday!`,
          date:              today,
          visibility:        "all_parents",
        }, { schoolId, centerId, actorUserId: "milestone_engine" });

        await fireMilestoneNotif(
          studentId, schoolId,
          `🎂 Happy Birthday, ${studentName}!`,
          "Wishing a very happy birthday from the whole school team!"
        );
        created.push(entry);
      }
    }
  }

  return created;
}

// ── createTeacherMilestone ────────────────────────────────────────────────────
// Called by POST /api/milestones to record a teacher-created milestone.
async function createTeacherMilestone(data, { schoolId = SCHOOL_ID, actorUserId = "teacher" } = {}) {
  const {
    studentId, milestoneId = "custom", milestoneTitle,
    milestoneCategory = "general", momentNote = "",
    date, visibility = "all_parents",
  } = data;

  if (!studentId)     throw new Error("studentId is required.");
  if (!milestoneTitle) throw new Error("milestoneTitle is required.");

  const student = await getStudent(studentId);
  const studentName = student?.name || "";
  const centerId    = student?.centerId || "";

  const entry = await journeyService.createEntry({
    studentId, studentName,
    kind:              "milestone",
    sourceModule:      "milestones",
    milestoneId,
    milestoneTitle,
    milestoneCategory,
    autoDetected:      false,
    momentNote,
    date:              date || new Date().toISOString().slice(0, 10),
    visibility,
  }, { schoolId, centerId, actorUserId });

  await fireMilestoneNotif(
    studentId, schoolId,
    `⭐ ${milestoneTitle}`,
    momentNote || "A new milestone has been achieved."
  );

  return entry;
}

module.exports = { checkAutoMilestones, createTeacherMilestone, TEACHER_MILESTONES };
