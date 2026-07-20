/**
 * modules.js — Quick Navigation Dashboard module registry
 * ─────────────────────────────────────────────────────────────────────
 * Single source of truth for every card on /quick-navigation: which
 * category it belongs to, which existing route it links to, which
 * routeKey gates it (checked via useAuth().can()), its icon and a
 * concrete, action-oriented description.
 *
 * Categories mirror how a preschool owner actually thinks about the
 * business (Admissions -> Students -> Attendance -> Academics -> Daily
 * Care -> Communication -> Finance -> Reports -> Parents -> Staff ->
 * Security -> Settings), not the org chart the sidebar happens to use.
 *
 * Every `path` below points to a route already registered in App.jsx —
 * no placeholders. routeKey values match ROUTES in config/permissions.js.
 *
 * Adding a new card: add an entry to the relevant category's items[].
 * The card appears automatically (ModuleCard resolves visibility from
 * routeKey via can()); no other wiring is needed.
 */
import {
  LayoutDashboard, UserPlus, ListChecks, Users, Sparkles, CalendarCheck,
  DoorOpen, BookOpen, Layers, GraduationCap, School, Moon, Utensils,
  ClipboardList, Heart, CalendarDays, Bell, Megaphone, CreditCard, FileText,
  Wallet, TrendingUp, Handshake, MessageSquareText, Briefcase, UserCheck,
  UserCog, Shield, Car, History, QrCode, Camera, AlertTriangle, Settings,
} from "lucide-react";

// Per-category accent — a soft color family used for that category's card
// icon chips and its section-header divider, so a category reads as a
// visual landmark while scrolling. Secondary/organizational color-coding
// only — primary actions (Quick Actions, focus rings) still use the one
// KUE BOXS yellow brand accent; this never competes with it.
const ACCENT = {
  dashboard:         { bg: "#EFF6FF", icon: "#2563EB", border: "#BFDBFE" }, // blue
  admissions:        { bg: "#ECFDF5", icon: "#059669", border: "#A7F3D0" }, // emerald
  students:          { bg: "#FFFBEB", icon: "#D97706", border: "#FDE68A" }, // amber
  attendance:        { bg: "#F0FDFA", icon: "#0D9488", border: "#99F6E4" }, // teal
  academics:         { bg: "#EEF2FF", icon: "#4F46E5", border: "#C7D2FE" }, // indigo
  daily_care:        { bg: "#FFF7ED", icon: "#EA580C", border: "#FED7AA" }, // orange
  communication:     { bg: "#FDF2F8", icon: "#DB2777", border: "#FBCFE8" }, // pink
  finance:           { bg: "#F0FDF4", icon: "#16A34A", border: "#BBF7D0" }, // green
  reports_analytics: { bg: "#ECFEFF", icon: "#0891B2", border: "#A5F3FC" }, // cyan
  parents:           { bg: "#F5F3FF", icon: "#7C3AED", border: "#DDD6FE" }, // violet
  staff:             { bg: "#F0F9FF", icon: "#0284C7", border: "#BAE6FD" }, // sky
  security:          { bg: "#FEF2F2", icon: "#DC2626", border: "#FECACA" }, // red
  settings:          { bg: "#F8FAFC", icon: "#475569", border: "#E2E8F0" }, // slate
};

export const SECTIONS = [
  {
    id: "dashboard",
    label: "Dashboard",
    accent: ACCENT.dashboard,
    items: [
      { id: "live_dashboard", label: "Live Dashboard", path: "/live-dashboard", routeKey: "dashboard", icon: LayoutDashboard, description: "See today's activity, alerts and school-wide stats at a glance." },
    ],
  },
  {
    id: "admissions",
    label: "Admissions",
    accent: ACCENT.admissions,
    items: [
      { id: "add_student",        label: "Add Student",       path: "/students/new",                  routeKey: "students",                        icon: UserPlus,   description: "Start a new admission and build the student's profile." },
      { id: "student_allocation", label: "Student Allocation", path: "/academics/student-allocation",  routeKey: "academics-student-allocation",    icon: ListChecks, description: "Place admitted students into their class and batch." },
    ],
  },
  {
    id: "students",
    label: "Students",
    accent: ACCENT.students,
    items: [
      { id: "students",      label: "Students",     path: "/students",     routeKey: "students",     icon: Users,    description: "Manage admissions, profiles and student records." },
      { id: "child_journey", label: "Child Journey", path: "/child-journey", routeKey: "child-journey", icon: Sparkles, description: "Milestones, artwork and memories for every child." },
    ],
  },
  {
    id: "attendance",
    label: "Attendance",
    accent: ACCENT.attendance,
    items: [
      { id: "student_attendance", label: "Student Attendance", path: "/attendance",     routeKey: "attendance", icon: CalendarCheck, description: "Mark attendance and monitor today's presence." },
      { id: "gate_register",      label: "Gate Register",      path: "/child-presence", routeKey: "attendance", icon: DoorOpen,      description: "Track live check-ins, pickups and gate activity." },
    ],
  },
  {
    id: "academics",
    label: "Academics",
    accent: ACCENT.academics,
    items: [
      { id: "academics_classes",             label: "Classes",              path: "/academics/classes",              routeKey: "academics-classes",              icon: BookOpen,      description: "Set up class sections and academic structure." },
      { id: "academics_batches",             label: "Batches",              path: "/academics/batches",              routeKey: "academics-batches",              icon: Layers,        description: "Organise batch timings and groupings." },
      { id: "academics_teacher_allocation",  label: "Teacher Allocation",   path: "/academics/teacher-allocation",   routeKey: "academics-teacher-allocation",   icon: GraduationCap, description: "Assign teachers to the classes they lead." },
      { id: "academics_classroom_allocation",label: "Classroom Allocation", path: "/academics/classroom-allocation", routeKey: "academics-classroom-allocation", icon: School,        description: "Assign physical rooms to classes and batches." },
    ],
  },
  {
    id: "daily_care",
    label: "Daily Care",
    accent: ACCENT.daily_care,
    items: [
      { id: "nap_tracker",      label: "Nap Tracker",      path: "/nap-tracker",      routeKey: "nap-tracker",      icon: Moon,          description: "Log sleep schedules and nap times." },
      { id: "food_menu",        label: "Food Menu",        path: "/food-menu",        routeKey: "food-menu",        icon: Utensils,      description: "Plan daily and weekly meal menus." },
      { id: "food_consumption", label: "Food Consumption", path: "/food-consumption", routeKey: "food-consumption", icon: ClipboardList, description: "Record what each child ate today." },
      { id: "care_hygiene",     label: "Care & Hygiene",   path: "/care-hygiene",     routeKey: "care-hygiene",     icon: Heart,         description: "Log diaper changes and hygiene routines." },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    accent: ACCENT.communication,
    items: [
      { id: "holidays",      label: "Holidays",      path: "/holidays",      routeKey: "holidays",      icon: CalendarDays, description: "Plan and publish the academic holiday calendar." },
      { id: "notices",       label: "Notices",       path: "/notices",       routeKey: "notices",       icon: Bell,         description: "Share important notices with staff and parents." },
      { id: "announcements", label: "Announcements", path: "/announcements", routeKey: "announcements", icon: Megaphone,    description: "Broadcast school-wide announcements instantly." },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    accent: ACCENT.finance,
    items: [
      { id: "fees",     label: "Fees",     path: "/fees",        routeKey: "fees",    icon: CreditCard, description: "Set fee structures and track dues by student." },
      { id: "invoices", label: "Invoices", path: "/invoice",     routeKey: "invoice", icon: FileText,    description: "Generate invoices and record payments." },
      { id: "payments", label: "Payments", path: "/collections", routeKey: "fees",    icon: Wallet,      description: "Review recent payments received from parents." },
    ],
  },
  {
    id: "reports_analytics",
    label: "Reports & Analytics",
    accent: ACCENT.reports_analytics,
    items: [
      { id: "analytics", label: "Analytics", path: "/analytics", routeKey: "analytics", icon: TrendingUp, description: "Attendance, revenue and enrolment trends over time." },
    ],
  },
  {
    id: "parents",
    label: "Parents",
    accent: ACCENT.parents,
    items: [
      { id: "ptm",              label: "PTM",              path: "/ptm",                          routeKey: "ptm",              icon: Handshake,         description: "Schedule and manage parent-teacher meetings." },
      { id: "parent_feedback",  label: "Parent Feedback",  path: "/staff/performance/feedback",  routeKey: "staff-performance", icon: MessageSquareText, description: "Read feedback and ratings submitted by parents." },
    ],
  },
  {
    id: "staff",
    label: "Staff",
    accent: ACCENT.staff,
    items: [
      { id: "staff",             label: "Staff",             path: "/staff/dashboard",   routeKey: "staff-dashboard",   icon: Briefcase, description: "Team directory, roles and staff management." },
      { id: "staff_attendance",  label: "Staff Attendance",  path: "/staff/attendance",  routeKey: "staff-attendance",  icon: UserCheck, description: "Staff check-in, check-out and shift tracking." },
      { id: "user_management",  label: "User Management",   path: "/user-management",   routeKey: "user-management",   icon: UserCog,   description: "Manage staff login accounts and access." },
      { id: "roles_permissions",label: "Roles & Permissions",path: "/roles-permissions",routeKey: "roles-permissions",icon: Shield,    description: "Control what each role can see and do." },
    ],
  },
  {
    id: "security",
    label: "Security",
    accent: ACCENT.security,
    items: [
      { id: "pickup_authorization", label: "Pickup Authorization", path: "/pickup-authorization", routeKey: "pickup-authorization", icon: Car,           description: "Manage the people authorised to pick up each child." },
      { id: "pickup_history",       label: "Pickup History",       path: "/pickup-history",       routeKey: "pickup-history",       icon: History,       description: "Review past pickup records and timings." },
      { id: "qr_management",        label: "QR Management",        path: "/qr-management",        routeKey: "qr-management",        icon: QrCode,        description: "Generate and print gate check-in QR codes." },
      { id: "cctv",                 label: "CCTV",                  path: "/cctv",                  routeKey: "cctv",                 icon: Camera,        description: "Manage camera coverage and surveillance zones." },
      { id: "incidents",            label: "Incident Reports",     path: "/incidents",             routeKey: "incidents",            icon: AlertTriangle, description: "Log and track safety incidents and follow-ups." },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    accent: ACCENT.settings,
    items: [
      { id: "settings", label: "Settings", path: "/settings", routeKey: "settings", icon: Settings, description: "Configure branding, preferences and school details." },
    ],
  },
];

// Flat lookup — every item across every category, keyed by id. Each item
// carries its category's accent color so Recent/Quick Access rows (which
// render outside any <ModuleSection>) still get the right color chip.
// Used by RecentModules/FavouriteModules to resolve a stored id back to
// its full card data (label/path/icon/description/accent) for rendering.
export const MODULES_BY_ID = Object.fromEntries(
  SECTIONS.flatMap(section => section.items.map(item => [item.id, { ...item, accent: section.accent }]))
);

// Flat list — used by QuickSearch to filter across every module at once.
export const ALL_MODULES = SECTIONS.flatMap(section =>
  section.items.map(item => ({ ...item, sectionLabel: section.label, accent: section.accent }))
);
