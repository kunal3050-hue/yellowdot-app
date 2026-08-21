/**
 * services.js — Service Registry entries
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §5A
 *
 * Every entry WRAPS an existing module in src/services/. Nothing here
 * reimplements a request, and no entry may call `api` directly — that is the
 * boundary the ESLint rule enforces. If a read needs an endpoint the service
 * does not expose yet, add the method to that service, not a call here.
 *
 * Registered incrementally: a service earns an entry when something consumes it
 * through the registry. The five below are what §12 Phase 3 needs to take
 * useDashboardStats off its four direct `api.get` calls. The remaining 32 are
 * registered as their consumers migrate (Phases 8-9), rather than in one
 * unverifiable sweep.
 *
 * Reads receive `(args, { scope })` — scope is a SEPARATE argument, never part
 * of args, so forwarding args to axios cannot leak it into a query string.
 * Most existing endpoints are already school-scoped server-side and take no
 * branch parameter, so none of these reads use scope yet. It becomes load
 * bearing when endpoints gain scope-aware filters (§2c.1).
 *
 * Still destructure explicitly rather than forwarding a bare `params` object:
 * it keeps each read's real API surface visible at a glance.
 */
import { defineService } from "./defineService.js";

import attendanceService from "../../services/attendanceService";
import securityService   from "../../services/securityService";
import * as studentSvc   from "../../services/studentService";
import * as incidentSvc  from "../../services/incidentService";
import * as careSvc      from "../../services/careService";

export const attendance = defineService({
  id: "attendance",
  capability: "attendance.view",
  reads: {
    // GET /api/attendance/summary?date=
    // scope: unused — endpoint is school-scoped server-side.
    summary:    ({ date })       => attendanceService.getSummary({ date }),
    // GET /api/attendance?date=&class=
    records:    ({ date, ...p }) => attendanceService.getAttendance({ date, ...p }),
  },
});

export const students = defineService({
  id: "students",
  capability: "students.view",
  reads: {
    // GET /students — raw envelope, so callers can tell failure from empty.
    listRaw: ({ search } = {}) => studentSvc.getStudentsRaw(search ? { search } : {}),
    list:    ({ search } = {}) => studentSvc.getStudents(search ? { search } : {}),
  },
});

export const pickup = defineService({
  id: "pickup_auth",
  capability: "pickup_auth.view",
  reads: {
    // GET /api/pickup-requests?status=
    requests: ({ status } = {}) => securityService.getPickupRequests(status ? { status } : {}),
  },
});

export const incidents = defineService({
  id: "incidents",
  capability: "incidents.view",
  reads: {
    dashboard: ()                        => incidentSvc.getDashboard(),
    list:      ({ status, from, to } = {}) => incidentSvc.getIncidents({ status, from, to }),
  },
});

export const careHygiene = defineService({
  id: "care_hygiene",
  capability: "care_hygiene.view",
  reads: {
    // GET /api/care/summary?date= — { date, total, counts, students: [one entry
    // per student WITH at least one event logged today] }. "Logged today" is
    // students.length, not total (an event count), so callers don't have to
    // re-derive it.
    summary: ({ date } = {}) => careSvc.getCareSummary({ date }),
  },
});

export default [attendance, students, pickup, invoices, incidents, careHygiene];
