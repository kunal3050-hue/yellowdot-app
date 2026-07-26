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
  CalendarCheck, Car, Wallet, Cake, AlertTriangle,
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

// ── Pickup ────────────────────────────────────────────────────────────────────
export const pickupPending = defineWidget({
  id: "pickup-pending",
  title: "Pickup approvals",
  description: "Requests waiting on staff",
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
      sub:   count === 0 ? "Nothing waiting" : count === 1 ? "1 request waiting" : `${count} requests waiting`,
      tone:  count === 0 ? "good" : count > 3 ? "bad" : "warn",
    };
  },
  emptyState: "No pickup requests today",
});

// ── Finance ───────────────────────────────────────────────────────────────────
export const feesOutstanding = defineWidget({
  id: "fees-outstanding",
  title: "Outstanding fees",
  description: "Unpaid across all invoices",
  icon: Wallet,
  moduleId: "invoices",
  capability: "invoices.view",
  featureFlag: "INVOICES",
  priority: 30,
  destination: "/invoice",
  layouts: ["stat"],
  reads: {
    invoices: { service: "invoices", read: "listRaw" },
  },
  select: ({ invoices }) => {
    // listRaw keeps the envelope so a failure renders "—" rather than a
    // misleading ₹0 — the same distinction useDashboardStats relies on.
    if (!invoices?.success) return { value: "—", sub: "Not available" };
    const list = invoices.invoices || [];
    const unpaid = list.filter(i => ["Pending", "Partial", "Overdue"].includes(i.status));
    const total  = unpaid.reduce((s, i) => s + (Number(i.balance) || 0), 0);
    return {
      value: money(total),
      sub:   unpaid.length === 1 ? "1 unpaid invoice" : `${unpaid.length} unpaid invoices`,
      tone:  total === 0 ? "good" : "warn",
    };
  },
  emptyState: "No invoices raised yet",
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
    const d = dashboard?.dashboard ?? dashboard;
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
  attendanceToday, incidentsOpen, pickupPending, feesOutstanding, birthdaysToday,
];
