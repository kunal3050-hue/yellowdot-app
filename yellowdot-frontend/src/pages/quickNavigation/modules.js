/**
 * modules.js — Quick Navigation Dashboard module registry
 * ─────────────────────────────────────────────────────────────────────
 * Single source of truth for every card on /quick-navigation: which
 * section it belongs to, which existing route it links to, which
 * routeKey gates it (checked via useAuth().can()), its icon and a
 * short description.
 *
 * Every `path` below points to a route already registered in App.jsx —
 * no placeholders. routeKey values match ROUTES in config/permissions.js.
 *
 * Adding a new card: add an entry to the relevant section's items[].
 * The card appears automatically (ModuleCard resolves visibility from
 * routeKey via can()); no other wiring is needed.
 */
import {
  Home, Users, Briefcase, Shield, BookOpen, Layers, UserCheck, Grid,
  UsersRound, CheckSquare, Moon, Utensils, ClipboardList, Heart, Sparkles,
  CreditCard, FileText, Wallet, BarChart2, CalendarDays, Bell, Megaphone,
  Car, History, QrCode, Video, UserCog, Settings,
} from "lucide-react";

export const SECTIONS = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { id: "live_dashboard", label: "Live Dashboard", path: "/live-dashboard", routeKey: "dashboard", icon: Home, description: "Real-time attendance & school activity" },
    ],
  },
  {
    id: "people",
    label: "People",
    items: [
      { id: "students",           label: "Students",            path: "/students",          routeKey: "students",          icon: Users,     description: "Profiles, enrolment & records" },
      { id: "staff",               label: "Staff",                path: "/staff/dashboard",   routeKey: "staff-dashboard",   icon: Briefcase, description: "Team directory & management" },
      { id: "roles_permissions",   label: "Roles & Permissions",  path: "/roles-permissions", routeKey: "roles-permissions", icon: Shield,    description: "Access control & role matrix" },
    ],
  },
  {
    id: "academics",
    label: "Academics",
    items: [
      { id: "academics_classes",             label: "Classes",              path: "/academics/classes",              routeKey: "academics-classes",              icon: BookOpen,   description: "Manage class sections" },
      { id: "academics_batches",             label: "Batches",              path: "/academics/batches",              routeKey: "academics-batches",              icon: Layers,     description: "Timings & batch groups" },
      { id: "academics_teacher_allocation",  label: "Teacher Allocation",   path: "/academics/teacher-allocation",   routeKey: "academics-teacher-allocation",   icon: UserCheck,  description: "Assign teachers to classes" },
      { id: "academics_classroom_allocation",label: "Classroom Allocation", path: "/academics/classroom-allocation", routeKey: "academics-classroom-allocation", icon: Grid,       description: "Assign rooms to batches" },
      { id: "academics_student_allocation",  label: "Student Allocation",   path: "/academics/student-allocation",   routeKey: "academics-student-allocation",   icon: UsersRound, description: "Enrol students into batches" },
    ],
  },
  {
    id: "attendance",
    label: "Attendance",
    items: [
      { id: "student_attendance", label: "Student Attendance", path: "/attendance",       routeKey: "attendance",       icon: CheckSquare, description: "Mark & track daily attendance" },
      { id: "staff_attendance",   label: "Staff Attendance",   path: "/staff/attendance", routeKey: "staff-attendance", icon: UserCheck,   description: "Staff check-in & shift tracking" },
    ],
  },
  {
    id: "daycare",
    label: "Daycare",
    items: [
      { id: "nap_tracker",      label: "Nap Tracker",      path: "/nap-tracker",      routeKey: "nap-tracker",      icon: Moon,          description: "Sleep schedules & logs" },
      { id: "food_menu",        label: "Food Menu",        path: "/food-menu",        routeKey: "food-menu",        icon: Utensils,      description: "Plan daily meals" },
      { id: "food_consumption", label: "Food Consumption", path: "/food-consumption", routeKey: "food-consumption", icon: ClipboardList, description: "Track intake records" },
      { id: "care_hygiene",     label: "Care & Hygiene",   path: "/care-hygiene",     routeKey: "care-hygiene",     icon: Heart,         description: "Diaper & hygiene logs" },
      { id: "child_journey",    label: "Child Journey",    path: "/child-journey",    routeKey: "child-journey",    icon: Sparkles,      description: "Milestones, artwork & memories" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      { id: "fees",     label: "Fees",     path: "/fees",        routeKey: "fees",     icon: CreditCard, description: "Fee collection & dues" },
      { id: "invoices", label: "Invoices", path: "/invoice",     routeKey: "invoice",  icon: FileText,   description: "Billing & invoice templates" },
      { id: "payments", label: "Payments", path: "/collections", routeKey: "fees",     icon: Wallet,     description: "Recent payments received" },
      { id: "reports",  label: "Reports",  path: "/analytics",   routeKey: "analytics",icon: BarChart2,  description: "Trends & financial reports" },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    items: [
      { id: "holidays",      label: "Holidays",      path: "/holidays",      routeKey: "holidays",      icon: CalendarDays, description: "Academic calendar" },
      { id: "notices",       label: "Notices",       path: "/notices",       routeKey: "notices",       icon: Bell,         description: "School notices" },
      { id: "announcements", label: "Announcements", path: "/announcements", routeKey: "announcements", icon: Megaphone,    description: "Broadcast messages" },
    ],
  },
  {
    id: "security",
    label: "Security",
    items: [
      { id: "pickup_authorization", label: "Pickup Authorization", path: "/pickup-authorization", routeKey: "pickup-authorization", icon: Car,     description: "Authorised pickup persons" },
      { id: "pickup_history",       label: "Pickup History",       path: "/pickup-history",       routeKey: "pickup-history",       icon: History, description: "Past pickup records" },
      { id: "qr_management",        label: "QR Management",        path: "/qr-management",        routeKey: "qr-management",        icon: QrCode,  description: "Generate & print QR codes" },
      { id: "cctv",                 label: "CCTV",                  path: "/cctv",                  routeKey: "cctv",                 icon: Video,   description: "Camera management" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      { id: "user_management", label: "User Management", path: "/user-management", routeKey: "user-management", icon: UserCog,  description: "Staff login accounts" },
      { id: "settings",        label: "Settings",         path: "/settings",        routeKey: "settings",        icon: Settings, description: "App preferences & branding" },
    ],
  },
];

// Flat lookup — every item across every section, keyed by id.
// Used by RecentModules/FavouriteModules to resolve a stored id back to
// its full card data (label/path/icon/description) for rendering.
export const MODULES_BY_ID = Object.fromEntries(
  SECTIONS.flatMap(section => section.items.map(item => [item.id, item]))
);

// Flat list — used by QuickSearch to filter across every module at once.
export const ALL_MODULES = SECTIONS.flatMap(section =>
  section.items.map(item => ({ ...item, sectionLabel: section.label }))
);
