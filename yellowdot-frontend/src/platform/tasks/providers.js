/**
 * providers.js — Task providers, one per contributing module
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §4
 *
 * Keyed by `moduleId`, which the engine validates against the Module Registry —
 * so a provider cannot exist for a module that is not registered.
 *
 * ── Why these live here and not in the registry entry ─────────────────────
 * §4 says "task providers are part of module registration". In practice the
 * Module Registry must stay SERIALISABLE — it carries no imports and no
 * functions, because verify-registry.mjs runs it in plain Node to prove it
 * matches the app. Providers are functions, so they are joined to their module
 * by id instead. Same one-module-one-owner property, without breaking the
 * drift gate. This is an implementation detail, not an architecture change.
 *
 * Every read below is one the Dashboard's widgets already use (§5A), so Care
 * and Dashboard share one service layer and one set of endpoints — no second
 * copy of the business rules, and no new API surface.
 */
import { defineTaskProvider } from "./defineTaskProvider.js";

const todayISO = () => new Date().toISOString().slice(0, 10);
const asStudents = raw => (Array.isArray(raw) ? raw : raw?.students || []);

/** Today at HH:MM local, as an ISO string — used for same-day cutoffs. */
function todayAt(hours, minutes = 0) {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

const MINUTES = 60 * 1000;

// ── Pickup approvals ──────────────────────────────────────────────────────────
export const pickupApprovals = defineTaskProvider({
  id: "pickup-approvals",
  moduleId: "pickup_auth",
  capability: "pickup_auth.view",
  featureFlag: "PICKUP_REQUEST",
  basePriority: "high",
  // A parent waiting at the gate is the canonical "urgent as the day ends"
  // case: inside the last 30 minutes before pickup this escalates to critical.
  urgentWindowMs: 30 * MINUTES,
  deepLink: "/child-presence",
  reads: {
    requests: { service: "pickup_auth", read: "requests", args: () => ({ status: "pending" }) },
  },
  toTasks: ({ requests }) => {
    if (!requests?.success) return [];
    const list = requests.requests || [];
    return list.map(r => ({
      id: `pickup:${r.id ?? r.requestId ?? r.studentId}`,
      title: "Pickup approval pending",
      context: [r.studentName || r.student?.name, r.requestedBy && `requested by ${r.requestedBy}`]
        .filter(Boolean).join(" · ") || "Awaiting staff approval",
      // Binary source state: pending → gone. No in_progress concept exists
      // in the pickup model, so Care does not invent one (§3c).
      status: "pending",
      dueAt: r.schoolEndTime || todayAt(17, 0),
      owner: { type: "role", id: "reception", label: "Reception" },
      createdAt: r.createdAt ?? null,
      deepLink: "/child-presence",
    }));
  },
});

// ── Incidents ─────────────────────────────────────────────────────────────────
export const openIncidents = defineTaskProvider({
  id: "open-incidents",
  moduleId: "incidents",
  capability: "incidents.view",
  basePriority: "high",
  deepLink: "/incidents",
  reads: {
    // Deliberately UNFILTERED. Querying `?status=open` excluded `under_review`
    // entirely, so an incident someone was actively working on vanished from
    // Care — and this provider's own `under_review → in_progress` mapping
    // below could never fire. For child-safety records the correct behaviour
    // is that the item stays visible until it is RESOLVED, not until someone
    // starts looking at it. Found on the first live-backend run.
    incidents: { service: "incidents", read: "list" },
  },
  toTasks: ({ incidents }) => {
    const all = incidents?.incidents || incidents?.data || (Array.isArray(incidents) ? incidents : []);
    const list = all.filter(i => i.status === "open" || i.status === "under_review");
    return list.map(i => ({
      id: `incident:${i.id ?? i.incidentId}`,
      title: i.severity === "high" ? "Serious incident awaiting review" : "Incident awaiting acknowledgement",
      context: [i.studentName || i.childName, i.type || i.category].filter(Boolean).join(" · ")
               || "Reported and not yet resolved",
      // The incidents model has a real middle state, so Care reflects it (§3c).
      status: i.status === "under_review" ? "in_progress" : "pending",
      basePriority: i.severity === "high" ? "critical" : "high",
      dueAt: i.dueAt ?? null,
      owner: { type: "role", id: "admin", label: "Principal" },
      createdAt: i.createdAt ?? i.reportedAt ?? null,
      deepLink: "/incidents",
    }));
  },
});

// ── Attendance not marked ─────────────────────────────────────────────────────
export const attendancePending = defineTaskProvider({
  id: "attendance-pending",
  moduleId: "attendance",
  capability: "attendance.view",
  featureFlag: "ATTENDANCE",
  basePriority: "medium",
  deepLink: "/attendance",
  reads: {
    summary:  { service: "attendance", read: "summary", args: () => ({ date: todayISO() }) },
    students: { service: "students",   read: "listRaw" },
  },
  toTasks: ({ summary, students }) => {
    if (!summary?.success) return [];
    const total = asStudents(students).length;
    const s = summary.summary || {};
    const marked = (s.present ?? 0) + (s.absent ?? 0);
    const unmarked = total - marked;
    if (!total || unmarked <= 0) return [];

    return [{
      id: `attendance:${todayISO()}`,
      title: "Attendance not marked",
      context: `${unmarked} of ${total} children still unmarked`,
      // Binary: either today's register is complete or it is not.
      status: "pending",
      // Escalates once the 9:30 cutoff passes — the rule the worked example
      // in §3b describes.
      dueAt: todayAt(9, 30),
      owner: { type: "role", id: "teacher", label: "Teacher" },
      createdAt: todayAt(8, 0),
      deepLink: "/attendance",
    }];
  },
});

// ── Overdue invoices ──────────────────────────────────────────────────────────
export const overdueInvoices = defineTaskProvider({
  id: "overdue-invoices",
  moduleId: "invoices",
  capability: "invoices.view",
  featureFlag: "INVOICES",
  basePriority: "medium",
  deepLink: "/invoice",
  reads: {
    invoices: { service: "invoices", read: "listRaw" },
  },
  toTasks: ({ invoices }) => {
    if (!invoices?.success) return [];
    const overdue = (invoices.invoices || []).filter(i => i.status === "Overdue");
    if (!overdue.length) return [];

    const total = overdue.reduce((s, i) => s + (Number(i.balance) || 0), 0);
    // One aggregate task, not one per invoice: a queue of 200 individual
    // invoice rows would drown every other domain in the feed. The deep link
    // takes the accountant to the list that DOES itemise them.
    return [{
      id: "invoices:overdue",
      title: "Overdue fees need chasing",
      context: `${overdue.length} invoice${overdue.length === 1 ? "" : "s"} · ₹${total.toLocaleString("en-IN")} outstanding`,
      status: "pending",
      // Overdue by definition — escalated once by the ladder, not repeatedly.
      dueAt: todayAt(0, 1),
      owner: { type: "role", id: "accountant", label: "Accountant" },
      createdAt: null,
      deepLink: "/invoice",
    }];
  },
});

export default [pickupApprovals, openIncidents, attendancePending, overdueInvoices];
