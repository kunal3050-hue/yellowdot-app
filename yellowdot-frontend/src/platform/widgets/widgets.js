/**
 * widgets.js — Widget Registry entries
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §3
 *
 * Every widget below reads through services already registered in §5A, which
 * means every one of these reuses an endpoint the app already calls. No new
 * API surface was added for the Dashboard (§10 — reuse before adding).
 *
 * Adding a widget is one entry here. It requires no change to Dashboard.jsx,
 * the engine, navigation, or permissions — that is the acceptance test for §3.
 */
import {
  CalendarCheck, Car, Cake, AlertTriangle, Heart,
} from "lucide-react";
import { defineWidget } from "./defineWidget.js";

const todayISO = () => new Date().toISOString().slice(0, 10);

/** Both /students envelope shapes → array. Mirrors studentService.unwrapStudents. */
const asStudents = raw => (Array.isArray(raw) ? raw : raw?.students || []);

/** DOB arrives as dd/mm/yyyy or ISO, exactly as LiveDashboard already parses it. */
function parseDOB(dob) {
  if (!dob) return null;
  const iso = dob.includes("/") ? dob.split("/").reverse().join("-") : dob;
  const d = new Date(iso);
  return isNaN(d) ? null : d;
}

const money = n => `₹${Number(n || 0).toLocaleString("en-IN")}`;

// ── Attendance ────────────────────────────────────────────────────────────────
export const attendanceToday = defineWidget({
  id: "attendance-today",
  title: "Attendance",
  description: "Children present today",
  icon: CalendarCheck,
  moduleId: "attendance",
  capability: "attendance.view",
  featureFlag: "ATTENDANCE",
  priority: 10,
  destination: "/attendance",
  layouts: ["stat"],
  reads: {
    summary:  { service: "attendance", read: "summary", args: () => ({ date: todayISO() }) },
    students: { service: "students",   read: "listRaw" },
  },
  select: ({ summary, students }) => {
    const total   = asStudents(students).length || null;
    const present = summary?.success ? (summary.summary?.present ?? null) : null;
    if (present == null) return { value: "—", sub: "Not available" };
    const pct = total ? Math.round((present / total) * 100) : null;
    return {
      value: total ? `${present}/${total}` : String(present),
      sub:   pct == null ? "Present today" : `${pct}% present`,
      tone:  pct == null ? "neutral" : pct >= 85 ? "good" : pct >= 70 ? "warn" : "bad",
    };
  },
  emptyState: "No students enrolled yet",
});

// ── Care & hygiene ────────────────────────────────────────────────────────────
// D3, Dashboard experience review (2026-07-31): Care & Hygiene had a task
// provider (careHygienePending, C3) but no widget — unlike Attendance, which
// has both, by design, as two views of the same data ("what's the state" vs
// "what needs doing"). Mirrors attendanceToday's shape exactly and reuses the
// care_hygiene.summary read C3 already registered — no new backend surface.
export const careHygieneToday = defineWidget({
  id: "care-hygiene-today",
  title: "Care & Hygiene",
  description: "Children logged today",
  icon: Heart,
  moduleId: "care_hygiene",
  capability: "care_hygiene.view",
  featureFlag: "DAILY_CARE",
  priority: 25,
  destination: "/care-hygiene",
  layouts: ["stat"],
  reads: {
    summary:  { service: "care_hygiene", read: "summary", args: () => ({ date: todayISO() }) },
    students: { service: "students",     read: "listRaw" },
  },
  select: ({ summary, students }) => {
    const total = asStudents(students).length || null;
    if (!summary?.success) return { value: "—", sub: "Not available" };
    const logged = (summary.summary?.students || []).length;
    const pct = total ? Math.round((logged / total) * 100) : null;
    return {
      value: total ? `${logged}/${total}` : String(logged),
      sub:   pct == null ? "Logged today" : `${pct}% logged`,
      tone:  pct == null ? "neutral" : pct >= 85 ? "good" : pct >= 50 ? "warn" : "bad",
    };
  },
  emptyState: "No students enrolled yet",
});

// ── Pickup ────────────────────────────────────────────────────────────────────
// W3, workflow-optimization review 2026-07-30: `status: "pending"` here means
// awaiting the PARENT's own approval (see ChildPresence.jsx's "Waiting on
// parent" state) — there is nothing for staff to act on yet. The previous
// title/description ("Pickup approvals" / "Requests waiting on staff") said
// the opposite, and read as the same concept as Gate Register's "Pending
// Approval" filter even though that's a different, larger number (it also
// includes already-approved children awaiting release, which IS a staff
// action). Renamed to say exactly what this count is.
export const pickupPending = defineWidget({
  id: "pickup-pending",
  title: "Awaiting Parent",
  description: "Pickup requests not yet approved by parent",
  icon: Car,
  moduleId: "pickup_auth",
  capability: "pickup_auth.view",
  featureFlag: "PICKUP_REQUEST",
  priority: 20,
  destination: "/child-presence",
  refreshInterval: 30_000,   // gate activity moves faster than the rest
  layouts: ["stat"],
  reads: {
    requests: { service: "pickup_auth", read: "requests", args: () => ({ status: "pending" }) },
  },
  select: ({ requests }) => {
    if (!requests?.success) return { value: "—", sub: "Not available" };
    const count = requests.count ?? (requests.requests || []).length;
    return {
      value: String(count),
      sub:   count === 0 ? "Nothing pending" : count === 1 ? "1 awaiting parent" : `${count} awaiting parent`,
      tone:  count === 0 ? "good" : count > 3 ? "bad" : "warn",
    };
  },
  emptyState: "No pickup requests today",
});


// ── Birthdays ─────────────────────────────────────────────────────────────────
// Derived client-side from the student list already fetched by the attendance
// widget — deduped by the Service Registry, so this costs no extra request.
export const birthdaysToday = defineWidget({
  id: "birthdays-today",
  title: "Birthdays",
  description: "Children celebrating today",
  icon: Cake,
  moduleId: "students",
  capability: "students.view",
  featureFlag: "STUDENTS",
  priority: 40,
  destination: "/students",
  refreshInterval: null,     // a birthday does not change during a session
  layouts: ["stat"],
  reads: {
    students: { service: "students", read: "listRaw" },
  },
  select: ({ students }) => {
    const list = asStudents(students);
    if (!list.length) return { value: "—", sub: "Not available" };
    const today = new Date();
    const names = list
      .filter(s => {
        const dob = parseDOB(s.DOB);
        return dob && dob.getMonth() === today.getMonth() && dob.getDate() === today.getDate();
      })
      .map(s => s.name || s.studentName || s.fullName)
      .filter(Boolean);
    return {
      value: String(names.length),
      sub:   names.length ? names.slice(0, 2).join(", ") + (names.length > 2 ? ` +${names.length - 2}` : "")
                          : "None today",
      tone:  names.length ? "good" : "neutral",
    };
  },
  emptyState: "No students enrolled yet",
});

// ── Incidents ─────────────────────────────────────────────────────────────────
export const incidentsOpen = defineWidget({
  id: "incidents-open",
  title: "Open incidents",
  description: "Reported and not yet resolved",
  icon: AlertTriangle,
  moduleId: "incidents",
  capability: "incidents.view",
  priority: 15,              // safety sits high, above finance
  destination: "/incidents",
  layouts: ["stat"],
  reads: {
    dashboard: { service: "incidents", read: "dashboard" },
  },
  select: ({ dashboard }) => {
    // GET /api/incidents/dashboard returns { stats: { total, open,
    // highSeverity, awaitingAck, resolvedThisMonth } }. The earlier guess of
    // `{ dashboard: { open } }` made this tile read "—" against real data —
    // the shape was never verified until the first emulator run.
    const d = dashboard?.stats ?? dashboard?.dashboard ?? dashboard;
    const open = d?.open ?? d?.openCount ?? null;
    if (open == null) return { value: "—", sub: "Not available" };
    return {
      value: String(open),
      sub:   open === 0 ? "All clear" : open === 1 ? "1 needs attention" : `${open} need attention`,
      tone:  open === 0 ? "good" : "bad",
    };
  },
  emptyState: "No incidents reported",
});

export default [
  attendanceToday, incidentsOpen, pickupPending, careHygieneToday, birthdaysToday,
];
