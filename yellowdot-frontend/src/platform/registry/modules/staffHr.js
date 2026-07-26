/**
 * staffHr.js — Module Registry: the HR suite (Phases 1-5 of the staff module)
 * PLATFORM ARCHITECTURE §5
 *
 * Split by routeKey, not by sidebar group, because permissions.js draws real
 * distinctions the sidebar does not: staff-attendance vs staff-attendance-manage,
 * staff-leave vs staff-leave-types, staff-payroll vs staff-payroll-process,
 * staff-performance vs staff-performance-manage. Teachers hold the read-side key
 * of each pair for self-service (own attendance, leave, payslip, performance),
 * so collapsing the pairs would hand every teacher the management screens.
 *
 * All five map to the "staff_management" permission module in rbacConfig, whose
 * MODULE_ROUTE_MAP covers only staff-dashboard/staff-management/departments/
 * designations — the attendance, leave, payroll and performance routeKeys are
 * absent from it, so they too reach users only via STATIC_ROLE_PERMS
 * (a narrower instance of PLATFORM_ARCHITECTURE §0.3 gap 1).
 */
import { defineModule } from "../defineModule.js";

export const staffDashboardModule = defineModule({
  id: "staff_dashboard",
  label: "Staff Dashboard",
  icon: "Home",
  category: "staff_management",
  capability: "staff_management.view",
  actions: ["view"],
  keywords: ["staff dashboard", "hr", "team overview"],
  surfaces: { care: { order: 90, roles: { admin: 10 } } },
  routes: [
    {
      path: "/staff/dashboard", routeKey: "staff-dashboard", label: "Dashboard", icon: "Home",
      nav: [{ category: "staff_management", order: 10 }],
      grid: { section: "staff", label: "Staff", icon: "Briefcase",
              description: "Team directory, roles and staff management." },
    },
  ],
});

export const staffEmployeesModule = defineModule({
  id: "staff_management",
  label: "Employees",
  icon: "UserCheck",
  category: "staff_management",
  capability: "staff_management.view",
  actions: ["view", "create", "edit", "delete"],
  keywords: ["employee", "staff", "team", "directory", "hr"],
  routes: [
    {
      path: "/staff/employees", routeKey: "staff-management", label: "Employees", icon: "UserCheck",
      nav: [{ category: "staff_management", order: 20, matchPaths: ["/staff/employees/"] }],
    },
    { path: "/staff/employees/new",       routeKey: "staff-management", capability: "staff_management.create" },
    { path: "/staff/employees/:staffId",  routeKey: "staff-management" },
  ],
});

export const departmentsModule = defineModule({
  id: "departments",
  label: "Departments",
  icon: "Building2",
  category: "staff_management",
  capability: "staff_management.view",
  actions: ["view", "create", "edit", "delete"],
  keywords: ["department", "team", "unit", "org"],
  routes: [
    { path: "/staff/departments", routeKey: "departments", label: "Departments", icon: "Building2",
      nav: [{ category: "staff_management", order: 30 }] },
  ],
});

export const designationsModule = defineModule({
  id: "designations",
  label: "Designations",
  icon: "BookOpen",
  category: "staff_management",
  capability: "staff_management.view",
  actions: ["view", "create", "edit", "delete"],
  keywords: ["designation", "title", "role", "position", "grade"],
  routes: [
    { path: "/staff/designations", routeKey: "designations", label: "Designations", icon: "BookOpen",
      nav: [{ category: "staff_management", order: 40 }] },
  ],
});

export const staffAttendanceModule = defineModule({
  id: "staff_attendance",
  label: "Staff Attendance",
  icon: "CheckSquare",
  category: "staff_attendance",
  capability: "staff_management.view",
  actions: ["view", "mark", "edit", "export"],
  keywords: ["staff attendance", "check in", "check out", "shift", "roster", "timesheet"],
  routes: [
    { path: "/staff/attendance",          routeKey: "staff-attendance", label: "Dashboard", icon: "CheckSquare",
      nav: [{ category: "staff_attendance", order: 10, exact: true }],
      grid: { section: "staff", label: "Staff Attendance", icon: "UserCheck",
              description: "Staff check-in, check-out and shift tracking." } },
    { path: "/staff/attendance/today",    routeKey: "staff-attendance", label: "Today", icon: "UserCheck",
      nav: [{ category: "staff_attendance", order: 20 }] },
    { path: "/staff/attendance/calendar", routeKey: "staff-attendance", label: "Calendar", icon: "CalendarDays",
      nav: [{ category: "staff_attendance", order: 30 }] },
    { path: "/staff/attendance/history",  routeKey: "staff-attendance", label: "History", icon: "History",
      nav: [{ category: "staff_attendance", order: 40 }] },
    { path: "/staff/attendance/reports",  routeKey: "staff-attendance", label: "Reports", icon: "BarChart2",
      nav: [{ category: "staff_attendance", order: 50 }] },
  ],
});

export const staffShiftsModule = defineModule({
  id: "staff_shifts",
  label: "Shifts",
  icon: "Moon",
  category: "staff_attendance",
  capability: "staff_management.view",
  actions: ["view", "create", "edit"],
  keywords: ["shift", "rota", "schedule", "timing"],
  routes: [
    { path: "/staff/shifts", routeKey: "staff-shifts", label: "Shifts", icon: "Moon",
      nav: [{ category: "staff_attendance", order: 60 }] },
  ],
});

export const staffLeaveModule = defineModule({
  id: "staff_leave",
  label: "Leave Management",
  icon: "Heart",
  category: "staff_leave",
  capability: "staff_management.view",
  actions: ["view", "create", "approve", "export"],
  keywords: ["leave", "absence", "holiday request", "time off", "approval"],
  routes: [
    { path: "/staff/leave",           routeKey: "staff-leave", label: "Dashboard", icon: "Heart",
      nav: [{ category: "staff_leave", order: 10, exact: true }] },
    { path: "/staff/leave/apply",     routeKey: "staff-leave", label: "Apply Leave", icon: "CheckSquare",
      capability: "staff_management.create",
      nav: [{ category: "staff_leave", order: 20 }] },
    { path: "/staff/leave/approvals", routeKey: "staff-leave", label: "Approvals", icon: "UserCheck",
      capability: "staff_management.approve",
      nav: [{ category: "staff_leave", order: 30 }] },
    { path: "/staff/leave/calendar",  routeKey: "staff-leave", label: "Calendar", icon: "CalendarDays",
      nav: [{ category: "staff_leave", order: 40 }] },
    { path: "/staff/leave/reports",   routeKey: "staff-leave", label: "Reports", icon: "BarChart2",
      nav: [{ category: "staff_leave", order: 50 }] },
  ],
});

export const staffLeaveTypesModule = defineModule({
  id: "staff_leave_types",
  label: "Leave Types",
  icon: "BookOpen",
  category: "staff_leave",
  capability: "staff_management.edit",
  actions: ["view", "create", "edit", "delete"],
  keywords: ["leave type", "leave policy", "entitlement"],
  routes: [
    { path: "/staff/leave/types", routeKey: "staff-leave-types", label: "Leave Types", icon: "BookOpen",
      nav: [{ category: "staff_leave", order: 60 }] },
  ],
});

export const staffPayrollModule = defineModule({
  id: "staff_payroll",
  label: "Payroll",
  icon: "CreditCard",
  category: "staff_payroll",
  capability: "staff_management.view",
  featureFlag: "PAYROLL",
  actions: ["view", "export"],
  keywords: ["payroll", "salary", "payslip", "wages", "bank"],
  routes: [
    { path: "/staff/payroll",         routeKey: "staff-payroll", label: "Dashboard", icon: "CreditCard",
      nav: [{ category: "staff_payroll", order: 10, exact: true }] },
    { path: "/staff/payroll/history", routeKey: "staff-payroll", label: "History", icon: "History",
      nav: [{ category: "staff_payroll", order: 60 }] },
    { path: "/staff/payroll/bank",    routeKey: "staff-payroll", label: "Bank Report", icon: "BarChart2",
      nav: [{ category: "staff_payroll", order: 70 }] },
  ],
});

export const staffPayrollProcessModule = defineModule({
  id: "staff_payroll_process",
  label: "Payroll Processing",
  icon: "FileText",
  category: "staff_payroll",
  capability: "staff_management.edit",
  featureFlag: "PAYROLL",
  actions: ["view", "process", "edit"],
  keywords: ["run payroll", "salary structure", "components", "process"],
  routes: [
    { path: "/staff/payroll/run",        routeKey: "staff-payroll-process", label: "Run Payroll", icon: "FileText",
      nav: [{ category: "staff_payroll", order: 20 }] },
    { path: "/staff/payroll/staff",      routeKey: "staff-payroll-process", label: "Staff Salaries", icon: "Users",
      nav: [{ category: "staff_payroll", order: 30 }] },
    { path: "/staff/payroll/structures", routeKey: "staff-payroll-process", label: "Structures", icon: "Layers",
      nav: [{ category: "staff_payroll", order: 40 }] },
    { path: "/staff/payroll/components", routeKey: "staff-payroll-process", label: "Components", icon: "Grid",
      nav: [{ category: "staff_payroll", order: 50 }] },
  ],
});

export const staffPerformanceModule = defineModule({
  id: "staff_performance",
  label: "Performance",
  icon: "BarChart2",
  category: "staff_performance",
  capability: "staff_management.view",
  actions: ["view", "create", "edit"],
  keywords: ["performance", "review", "goal", "appraisal", "feedback", "award"],
  routes: [
    { path: "/staff/performance",          routeKey: "staff-performance", label: "Dashboard", icon: "BarChart2",
      nav: [{ category: "staff_performance", order: 10, exact: true }] },
    { path: "/staff/performance/reviews",  routeKey: "staff-performance", label: "Reviews", icon: "FileText",
      nav: [{ category: "staff_performance", order: 20 }] },
    { path: "/staff/performance/goals",    routeKey: "staff-performance", label: "Goals", icon: "CheckSquare",
      nav: [{ category: "staff_performance", order: 30 }] },
    { path: "/staff/performance/feedback", routeKey: "staff-performance", label: "Parent Feedback", icon: "Megaphone",
      nav: [{ category: "staff_performance", order: 40 }],
      grid: { section: "parents", label: "Parent Feedback", icon: "MessageSquareText",
              description: "Read feedback and ratings submitted by parents." } },
    { path: "/staff/performance/awards",   routeKey: "staff-performance", label: "Awards & Promotions", icon: "Heart",
      nav: [{ category: "staff_performance", order: 50 }] },
    { path: "/staff/performance/timeline", routeKey: "staff-performance", label: "Timeline & AI", icon: "History",
      nav: [{ category: "staff_performance", order: 60 }] },
  ],
});

export const staffPerformanceManageModule = defineModule({
  id: "staff_performance_manage",
  label: "Performance KPIs",
  icon: "Grid",
  category: "staff_performance",
  capability: "staff_management.edit",
  actions: ["view", "edit", "manage"],
  keywords: ["kpi", "metric", "target", "performance setup"],
  routes: [
    { path: "/staff/performance/kpis", routeKey: "staff-performance-manage", label: "KPIs", icon: "Grid",
      nav: [{ category: "staff_performance", order: 70 }] },
  ],
});

export default [
  staffDashboardModule, staffEmployeesModule, departmentsModule, designationsModule,
  staffAttendanceModule, staffShiftsModule,
  staffLeaveModule, staffLeaveTypesModule,
  staffPayrollModule, staffPayrollProcessModule,
  staffPerformanceModule, staffPerformanceManageModule,
];
