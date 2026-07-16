/**
 * QuickNav.jsx — all-modules navigation grid
 * ─────────────────────────────────────────────────────────────────
 * Design System v2 Phase 2.1: rebuilt on QuickActionCard + Lucide icons
 * + design tokens, replacing the page's former bespoke SVG-icon factory
 * and hardcoded-hex inline <style> block. The section/item list itself
 * (which pages are reachable from here) is unchanged from the prior
 * implementation — this is a presentation-only pass.
 */
import { useNavigate } from "react-router-dom";
import {
  House, Users, Briefcase, Shield, BookOpen, CreditCard, FileText,
  ChartNoAxesColumn, Calendar, Moon, Utensils, Clipboard, Heart,
  CalendarDays, Bell, Megaphone, SquareCheckBig, Car, LogOut, QrCode,
  Video, Settings,
} from "lucide-react";
import { PageHeader, QuickActionCard } from "../components/ui";

const todayLabel = () =>
  new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

const ICONS = {
  Home: House, Users, Briefcase, Shield, BookOpen, CreditCard, FileText,
  BarChart: ChartNoAxesColumn, Calendar, Moon, Utensils, Clipboard, Heart,
  CalendarDays, Bell, Megaphone, CheckSquare: SquareCheckBig, Car, LogOut,
  QrCode, Video, Settings,
};

/* ── All sections with their modules ───────────────────────────────────── */
const SECTIONS = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { label: "Live Dashboard", path: "/live-dashboard", icon: "Home",  desc: "Real-time school activity" },
    ],
  },
  {
    id: "people",
    label: "People",
    items: [
      { label: "Students",           path: "/students",          icon: "Users",      desc: "Profiles & enrolment" },
      { label: "Staff",              path: "/user-management",   icon: "Briefcase",  desc: "Team management" },
      { label: "Roles & Permissions",path: "/roles-permissions", icon: "Shield",     desc: "Access control" },
    ],
  },
  {
    id: "academics",
    label: "Academics",
    items: [
      { label: "Classes & Batches", path: "/academics/classes", icon: "BookOpen", desc: "Manage classes, batches, timings and allocations" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      { label: "Fees",     path: "/fees",      icon: "CreditCard", desc: "Collection & dues" },
      { label: "Invoices", path: "/invoice",   icon: "FileText",   desc: "Billing & payments" },
      { label: "Analytics",path: "/analytics", icon: "BarChart",   desc: "Reports & trends" },
    ],
  },
  {
    id: "daily_ops",
    label: "Daily Ops",
    items: [
      { label: "Attendance",       path: "/attendance",       icon: "Calendar",   desc: "Mark & track daily" },
      { label: "Nap Tracker",      path: "/nap-tracker",      icon: "Moon",       desc: "Sleep schedules" },
      { label: "Food Menu",        path: "/food-menu",        icon: "Utensils",   desc: "Meal planning" },
      { label: "Consumption Log",  path: "/food-consumption", icon: "Clipboard",  desc: "Intake records" },
      { label: "Care & Hygiene",   path: "/care-hygiene",     icon: "Heart",      desc: "Diaper & hygiene logs" },
    ],
  },
  {
    id: "communications",
    label: "Communications",
    items: [
      { label: "Holidays",      path: "/holidays",      icon: "CalendarDays", desc: "Academic calendar" },
      { label: "Notices",       path: "/notices",       icon: "Bell",         desc: "School notices" },
      { label: "Announcements", path: "/announcements", icon: "Megaphone",    desc: "Broadcast messages" },
    ],
  },
  {
    id: "presence",
    label: "Presence & Safety",
    items: [
      { label: "Parent Entry",   path: "/parent-checkin",       icon: "CheckSquare", desc: "Gate check-in" },
      { label: "Pickup",         path: "/pickup-authorization", icon: "Car",         desc: "Authorised pickups" },
      { label: "Staff Checkout", path: "/staff-checkout",       icon: "LogOut",      desc: "End-of-day sign-off" },
      { label: "QR Management",  path: "/qr-management",        icon: "QrCode",      desc: "Generate & print QR" },
    ],
  },
  {
    id: "surveillance",
    label: "Surveillance",
    items: [
      { label: "CCTV", path: "/cctv", icon: "Video", desc: "Camera management" },
    ],
  },
  {
    id: "system",
    label: "Settings",
    items: [
      { label: "Settings", path: "/settings", icon: "Settings", desc: "App preferences" },
    ],
  },
];

/* ── Section block ──────────────────────────────────────────────────────── */
function Section({ section, navigate }) {
  return (
    <div className="qn-section">
      <div className="qn-section-header">
        <span className="qn-section-title">{section.label}</span>
        <div className="qn-section-line" />
      </div>
      <div className="qn-grid">
        {section.items.map((item) => {
          const Icon = ICONS[item.icon] || House;
          return (
            <QuickActionCard
              key={item.path}
              icon={<Icon size={18} strokeWidth={2} />}
              title={item.label}
              description={item.desc}
              onClick={() => navigate(item.path)}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function QuickNav() {
  const navigate = useNavigate();

  return (
    <div className="qn-root">
      <PageHeader title="Quick Navigation" subtitle={todayLabel()} />

      {SECTIONS.map((section) => (
        <Section key={section.id} section={section} navigate={navigate} />
      ))}
    </div>
  );
}
