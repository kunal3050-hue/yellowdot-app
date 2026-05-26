/**
 * ModuleExplorer.jsx — /dev/modules
 * ─────────────────────────────────────────────────────────────────────────────
 * Super Admin–only developer panel.
 * Scans every registered route, cross-references sidebar config, permissions,
 * and feature flags — giving a live inventory of the entire app surface.
 *
 * Access:  super_admin + developer only (checked in App.jsx ProtectedRoute)
 * Storage: localStorage key "yd_module_flags"
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Component, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { SIDEBAR_GROUPS, PARENT_MENU } from "../../config/sidebarConfig";
import { ROUTES, ROLE_PERMISSIONS, ROLE_LABELS, ROLE_HIERARCHY } from "../../config/permissions";

// ── LocalStorage helpers ──────────────────────────────────────────────────────
const LS_KEY = "yd_module_flags";

function loadFlags() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); }
  catch { return {}; }
}
function saveFlags(f) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(f)); } catch {}
}

// ── Complete route registry (mirrors App.jsx) ─────────────────────────────────
// category: "public" | "auth" | "app" | "parent" | "dev" | "sub"
const ROUTE_REGISTRY = [
  // Public / auth
  { path: "/login",               routeKey: null,                           label: "Login",                category: "public", layout: "none"   },
  { path: "/unauthorized",        routeKey: null,                           label: "Unauthorized",         category: "auth",   layout: "bare"   },
  { path: "/select-center",       routeKey: null,                           label: "Select Center",        category: "auth",   layout: "bare"   },
  { path: "/profile",             routeKey: ROUTES.PROFILE,                 label: "My Profile",           category: "app",    layout: "bare"   },
  { path: "/settings/security",   routeKey: ROUTES.SETTINGS,               label: "Security Settings",    category: "sub",    layout: "bare"   },

  // Dashboard
  { path: "/dashboard",           routeKey: ROUTES.DASHBOARD,              label: "Dashboard",            category: "app",    layout: "main"   },
  { path: "/analytics",           routeKey: ROUTES.ANALYTICS,              label: "Analytics",            category: "app",    layout: "main"   },

  // Students
  { path: "/students",            routeKey: ROUTES.STUDENTS,               label: "Students",             category: "app",    layout: "bare"   },
  { path: "/students/new",        routeKey: ROUTES.STUDENTS,               label: "New Admission",        category: "sub",    layout: "bare"   },
  { path: "/add-student",         routeKey: ROUTES.STUDENTS,               label: "Add Student",          category: "sub",    layout: "bare"   },
  { path: "/edit-student/:id",    routeKey: ROUTES.STUDENTS,               label: "Edit Student",         category: "sub",    layout: "bare"   },
  { path: "/student-profile/:id", routeKey: ROUTES.STUDENTS,               label: "Student Profile",      category: "sub",    layout: "bare"   },

  // Attendance & Daily Ops
  { path: "/attendance",          routeKey: ROUTES.ATTENDANCE,             label: "Attendance",           category: "app",    layout: "bare"   },
  { path: "/nap-tracker",         routeKey: ROUTES.NAP_TRACKER,            label: "Nap Tracker",          category: "app",    layout: "bare"   },
  { path: "/food-menu",           routeKey: ROUTES.FOOD_MENU,              label: "Food Menu",            category: "app",    layout: "bare"   },
  { path: "/food-consumption",    routeKey: ROUTES.FOOD_CONSUMPTION,       label: "Food Consumption",     category: "app",    layout: "bare"   },

  // Finance
  { path: "/fees",                routeKey: ROUTES.FEES,                   label: "Fees",                 category: "app",    layout: "bare"   },
  { path: "/invoice",             routeKey: ROUTES.INVOICE,                label: "Invoices",             category: "app",    layout: "bare"   },
  { path: "/invoice/new",         routeKey: ROUTES.INVOICE,                label: "New Invoice",          category: "sub",    layout: "bare"   },
  { path: "/invoice/templates",   routeKey: ROUTES.INVOICE,                label: "Fee Templates",        category: "sub",    layout: "bare"   },
  { path: "/invoice-view/:n",     routeKey: ROUTES.INVOICE,                label: "Invoice View",         category: "sub",    layout: "bare"   },
  { path: "/receipt/:id",         routeKey: ROUTES.INVOICE,                label: "Receipt View",         category: "sub",    layout: "bare"   },
  { path: "/generate-invoice",    routeKey: ROUTES.INVOICE,                label: "Generate Invoice",     category: "app",    layout: "bare",  orphan: true },
  { path: "/record-payment/:n",   routeKey: ROUTES.FEES,                   label: "Record Payment",       category: "sub",    layout: "bare"   },

  // CCTV
  { path: "/live-cctv",           routeKey: ROUTES.LIVE_CCTV,              label: "Live CCTV",            category: "app",    layout: "bare"   },
  { path: "/cctv-settings",       routeKey: ROUTES.CCTV_SETTINGS,          label: "CCTV Settings",        category: "app",    layout: "bare"   },

  // Pickup & Checkout
  { path: "/pickup-authorization", routeKey: ROUTES.PICKUP_AUTHORIZATION,  label: "Pickup Authorization", category: "app",    layout: "bare"   },
  { path: "/pickup-history",      routeKey: ROUTES.PICKUP_HISTORY,         label: "Pickup History",       category: "app",    layout: "bare"   },
  { path: "/staff-checkout",      routeKey: ROUTES.STAFF_CHECKOUT,         label: "Staff Checkout",       category: "app",    layout: "main"   },
  { path: "/pickup-migration",    routeKey: ROUTES.ATTENDANCE,             label: "Family Safety Setup",  category: "app",    layout: "bare",  orphan: true },

  // Communications
  { path: "/holidays",            routeKey: ROUTES.HOLIDAYS,               label: "Holidays",             category: "app",    layout: "bare"   },
  { path: "/notices",             routeKey: ROUTES.NOTICES,                label: "Notices",              category: "app",    layout: "bare"   },
  { path: "/announcements",       routeKey: ROUTES.ANNOUNCEMENTS,          label: "Announcements",        category: "app",    layout: "bare"   },

  // Admin
  { path: "/user-management",     routeKey: ROUTES.USER_MANAGEMENT,        label: "User Management",      category: "app",    layout: "main"   },
  { path: "/roles-permissions",   routeKey: ROUTES.ROLES_PERMISSIONS,      label: "Roles & Permissions",  category: "app",    layout: "main"   },
  { path: "/settings",            routeKey: ROUTES.SETTINGS,               label: "Settings",             category: "app",    layout: "main"   },

  // Parent layout
  { path: "/parent-home",         routeKey: ROUTES.DASHBOARD,              label: "Parent Dashboard",     category: "parent", layout: "parent" },
  { path: "/parent-checkin",      routeKey: ROUTES.PARENT_CHECKIN,         label: "Parent Check-In",      category: "parent", layout: "parent" },
  { path: "/parent-cctv",         routeKey: ROUTES.LIVE_CCTV,              label: "Parent CCTV",          category: "parent", layout: "parent" },

  // Dev
  { path: "/dev/modules",         routeKey: ROUTES.DEV_TOOLS,              label: "Module Explorer",      category: "dev",    layout: "main"   },
];

// ── Build sidebar route-key lookup (safe) ─────────────────────────────────────
function buildSidebarLookup() {
  const map = {};
  try {
    const groups = Array.isArray(SIDEBAR_GROUPS) ? SIDEBAR_GROUPS : [];
    for (const group of groups) {
      if (!group || !Array.isArray(group.items)) continue;
      for (const item of group.items) {
        if (item?.routeKey) {
          map[item.routeKey] = { ...item, groupId: group.id, groupLabel: group.label };
        }
      }
    }
    const parentItems = Array.isArray(PARENT_MENU) ? PARENT_MENU : [];
    for (const item of parentItems) {
      if (item?.routeKey) {
        map[`parent::${item.routeKey}`] = { ...item, groupId: "parent", groupLabel: "Parent" };
      }
    }
  } catch (err) {
    console.error("[ModuleExplorer] buildSidebarLookup failed:", err);
  }
  return map;
}

let SIDEBAR_LOOKUP = {};
try {
  SIDEBAR_LOOKUP = buildSidebarLookup();
  console.log("[ModuleExplorer] SIDEBAR_LOOKUP built, keys:", Object.keys(SIDEBAR_LOOKUP).length);
} catch (err) {
  console.error("[ModuleExplorer] Module-level SIDEBAR_LOOKUP init failed:", err);
}

// ── Which roles have access to a routeKey ────────────────────────────────────
function getRolesFor(routeKey) {
  try {
    if (!routeKey) return [];
    const rp = ROLE_PERMISSIONS || {};
    return Object.entries(rp)
      .filter(([, perms]) => Array.isArray(perms) && (perms.includes("*") || perms.includes(routeKey)))
      .map(([role]) => role);
  } catch {
    return [];
  }
}

// ── Status pill colors ────────────────────────────────────────────────────────
const STATUS_STYLES = {
  live:   { bg: "#F0FDF4", color: "#15803D", border: "#BBF7D0", dot: "#16A34A", label: "Live"   },
  beta:   { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE", dot: "#2563EB", label: "Beta"   },
  hidden: { bg: "#F8F8F8", color: "#64748B", border: "#E8E8E8", dot: "#94A3B8", label: "Hidden" },
  wip:    { bg: "#FFFBEB", color: "#92400E", border: "#FDE68A", dot: "#D97706", label: "WIP"    },
};
const CATEGORY_STYLES = {
  app:    { bg: "#F0FDF4", color: "#15803D", label: "App"    },
  sub:    { bg: "#EFF6FF", color: "#1D4ED8", label: "Sub"    },
  parent: { bg: "#F5F3FF", color: "#6D28D9", label: "Parent" },
  auth:   { bg: "#FFF7ED", color: "#C2410C", label: "Auth"   },
  public: { bg: "#F8F8F8", color: "#64748B", label: "Public" },
  dev:    { bg: "#0F172A", color: "#F4C400", label: "Dev"    },
};
const ROLE_COLORS = {
  developer: "#7C3AED", super_admin: "#0F172A", admin: "#2563EB",
  center_admin: "#0891B2", center_owner: "#059669", teacher: "#D97706",
  accountant: "#DB2777", reception: "#EA580C", cctv_viewer: "#DC2626", parent: "#64748B",
};

// ── Error boundary ────────────────────────────────────────────────────────────
class ModuleExplorerBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("[ModuleExplorer] Render error caught by boundary:", error, info);
    this.setState({ info });
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: "100vh", background: "#FAFAFA", display: "flex",
          alignItems: "flex-start", justifyContent: "center", padding: "60px 32px",
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        }}>
          <div style={{
            maxWidth: 640, width: "100%", background: "#fff",
            border: "1px solid #FCA5A5", borderRadius: 16,
            padding: "32px 36px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 20 }}>🚨</span>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#DC2626", margin: 0 }}>
                Module Explorer — Render Error
              </h2>
            </div>
            <p style={{ fontSize: 13, color: "#64748B", marginBottom: 16, lineHeight: 1.6 }}>
              A runtime error prevented this page from rendering. The error boundary caught it so
              the rest of the app remains functional.
            </p>
            <div style={{
              background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8,
              padding: "12px 14px", marginBottom: 16,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                Error
              </div>
              <pre style={{ fontSize: 12, color: "#7F1D1D", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "monospace" }}>
                {String(this.state.error)}
              </pre>
            </div>
            {this.state.info?.componentStack && (
              <details style={{ marginBottom: 16 }}>
                <summary style={{ fontSize: 12, color: "#64748B", cursor: "pointer", fontWeight: 600 }}>
                  Component stack
                </summary>
                <pre style={{ fontSize: 11, color: "#94A3B8", whiteSpace: "pre-wrap", marginTop: 8, fontFamily: "monospace" }}>
                  {this.state.info.componentStack}
                </pre>
              </details>
            )}
            <button
              onClick={() => this.setState({ error: null, info: null })}
              style={{
                padding: "8px 16px", background: "#0F172A", color: "#fff",
                border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Tiny UI primitives ────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      style={{
        width: 36, height: 20, borderRadius: 10, padding: 2,
        background: checked ? "#0F172A" : "#E8E8E8",
        border: "none", cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 0.15s", display: "flex", alignItems: "center",
        opacity: disabled ? 0.4 : 1, flexShrink: 0,
      }}
    >
      <span style={{
        width: 16, height: 16, borderRadius: 8, background: "#fff",
        transform: checked ? "translateX(16px)" : "translateX(0)",
        transition: "transform 0.15s", display: "block",
        boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
      }} />
    </button>
  );
}

function StatusPill({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.live;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: 99, fontSize: 10,
      fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 99, background: s.dot, display: "block", flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

function CategoryPill({ category }) {
  const c = CATEGORY_STYLES[category] || CATEGORY_STYLES.app;
  return (
    <span style={{
      display: "inline-block", padding: "2px 7px", borderRadius: 4, fontSize: 10,
      fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
      background: c.bg, color: c.color,
    }}>
      {c.label}
    </span>
  );
}

function RolePill({ role }) {
  const color = ROLE_COLORS[role] || "#64748B";
  const label = (ROLE_LABELS || {})[role] || role;
  return (
    <span style={{
      display: "inline-block", padding: "1px 6px", borderRadius: 4, fontSize: 10,
      fontWeight: 600, background: color + "16", color, border: `1px solid ${color}30`,
      whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

function Kbd({ children }) {
  return (
    <kbd style={{
      display: "inline-block", padding: "1px 5px", borderRadius: 4, fontSize: 10,
      fontFamily: "monospace", fontWeight: 700, background: "#F1F1F1", color: "#64748B",
      border: "1px solid #E8E8E8",
    }}>
      {children}
    </kbd>
  );
}

// ── Debug panel ───────────────────────────────────────────────────────────────
function DebugPanel({ rows }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      marginTop: 24, border: "1px solid #E8E8E8", borderRadius: 12,
      overflow: "hidden", background: "#fff",
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", padding: "10px 16px", display: "flex", alignItems: "center",
          justifyContent: "space-between", background: "transparent", border: "none",
          cursor: "pointer", fontFamily: "inherit",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          🔧 Raw Registry JSON ({rows.length} entries)
        </span>
        <span style={{ fontSize: 11, color: "#94A3B8" }}>{open ? "▲ collapse" : "▼ expand"}</span>
      </button>
      {open && (
        <pre style={{
          margin: 0, padding: "12px 16px", fontSize: 10.5, fontFamily: "monospace",
          color: "#475569", background: "#F8FAFC", borderTop: "1px solid #F1F1F1",
          overflowX: "auto", maxHeight: 400, overflowY: "auto",
        }}>
          {JSON.stringify(rows.map(r => ({
            path: r.path, label: r.label, category: r.category,
            routeKey: r.routeKey, inSidebar: r.inSidebar,
            isOrphan: r.isOrphan, explicitOrphan: r.explicitOrphan,
            status: r.status, rolesCount: r.rolesAllowed?.length ?? 0,
          })), null, 2)}
        </pre>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
function ModuleExplorerInner() {
  const navigate = useNavigate();
  const { role, devRole, user } = useAuth();
  const [flags,    setFlags]    = useState(loadFlags);
  const [search,   setSearch]   = useState("");
  const [tab,      setTab]      = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [copied,   setCopied]   = useState(null);

  // Persist flags to localStorage on every change
  const updateFlag = useCallback((path, key, val) => {
    setFlags(prev => {
      const next = { ...prev, [path]: { ...(prev[path] || {}), [key]: val } };
      saveFlags(next);
      return next;
    });
  }, []);

  const getFlag = useCallback((path, key, def) => {
    try { return flags?.[path]?.[key] ?? def; }
    catch { return def; }
  }, [flags]);

  // ── Augmented route list ──────────────────────────────────────────────────
  const rows = useMemo(() => {
    try {
      return ROUTE_REGISTRY.map(route => {
        try {
          const sidebarItem  = route.routeKey ? (SIDEBAR_LOOKUP[route.routeKey] ?? null) : null;
          const rolesAllowed = getRolesFor(route.routeKey);
          const inSidebar    = !!sidebarItem;
          const isOrphan     = route.category === "app" && !inSidebar && !route.orphan;
          const explicitOrphan = !!route.orphan;
          const status       = getFlag(route.path, "status", "live");
          const sidebarVis   = getFlag(route.path, "sidebarVisible", inSidebar);
          const mobileVis    = getFlag(route.path, "mobileVisible", true);
          return { ...route, sidebarItem, rolesAllowed, inSidebar, isOrphan, explicitOrphan, status, sidebarVis, mobileVis };
        } catch (rowErr) {
          console.error("[ModuleExplorer] Row mapping error for", route?.path, rowErr);
          return { path: route?.path || "?", label: route?.label || "Error", category: "app", routeKey: null, rolesAllowed: [], inSidebar: false, isOrphan: false, explicitOrphan: false, status: "live", sidebarVis: false, mobileVis: true, layout: "bare" };
        }
      });
    } catch (err) {
      console.error("[ModuleExplorer] rows useMemo failed:", err);
      return [];
    }
  }, [flags, getFlag]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    try {
      const appRoutes = rows.filter(r => r.category === "app" || r.category === "sub");
      const inSidebar = rows.filter(r => r.inSidebar);
      const orphans   = rows.filter(r => r.isOrphan || r.explicitOrphan);
      const hidden    = rows.filter(r => r.status === "hidden");
      const beta      = rows.filter(r => r.status === "beta");
      return { total: rows.length, appRoutes: appRoutes.length, inSidebar: inSidebar.length, orphans: orphans.length, hidden: hidden.length, beta: beta.length };
    } catch {
      return { total: 0, appRoutes: 0, inSidebar: 0, orphans: 0, hidden: 0, beta: 0 };
    }
  }, [rows]);

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    try {
      const q = (search || "").toLowerCase();
      return rows.filter(row => {
        if (!row) return false;
        if (tab === "sidebar"  && !row.inSidebar)                        return false;
        if (tab === "orphaned" && !row.isOrphan && !row.explicitOrphan)  return false;
        if (tab === "hidden"   && row.status !== "hidden")                return false;
        if (tab === "beta"     && row.status !== "beta")                  return false;
        if (tab === "app"      && row.category !== "app")                 return false;
        if (q && !(row.label || "").toLowerCase().includes(q) &&
                 !(row.path  || "").toLowerCase().includes(q) &&
                 !(row.routeKey || "").toLowerCase().includes(q))        return false;
        return true;
      });
    } catch {
      return rows;
    }
  }, [rows, tab, search]);

  function copyPath(path) {
    try { navigator.clipboard?.writeText(path).catch(() => {}); } catch {}
    setCopied(path);
    setTimeout(() => setCopied(null), 1500);
  }

  const TABS = [
    { id: "all",      label: "All Routes",  count: stats.total      },
    { id: "app",      label: "App",         count: stats.appRoutes  },
    { id: "sidebar",  label: "In Sidebar",  count: stats.inSidebar  },
    { id: "orphaned", label: "Orphaned",    count: stats.orphans,    warn: true },
    { id: "beta",     label: "Beta",        count: stats.beta       },
    { id: "hidden",   label: "Hidden",      count: stats.hidden     },
  ];

  const safeRoleHierarchy = Array.isArray(ROLE_HIERARCHY) ? ROLE_HIERARCHY : [];

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAFA", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <style>{`
        .me-grid-header, .me-grid-row {
          grid-template-columns: 1fr 160px 80px 70px 70px 80px 100px 90px;
        }
        @media (max-width: 1023px) {
          .me-grid-header, .me-grid-row {
            grid-template-columns: 1fr 150px 80px 65px 65px 80px 100px;
          }
          .me-col-actions { display: none !important; }
        }
        @media (max-width: 639px) {
          .me-grid-header, .me-grid-row {
            grid-template-columns: 1fr 120px 70px 75px;
          }
          .me-col-sidebar,
          .me-col-mobile,
          .me-col-permissions,
          .me-col-actions { display: none !important; }
          .me-table-wrap { padding: 12px 12px 60px !important; }
        }
      `}</style>

      {/* ── Hero header ────────────────────────────────────────────────── */}
      <div style={{ background: "#0F172A", borderBottom: "1px solid #1E293B", padding: "28px 32px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
            <span style={{ fontSize: 11, color: "#475569", fontWeight: 600 }}>Developer</span>
            <span style={{ color: "#334155", fontSize: 11 }}>/</span>
            <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>Module Explorer</span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#F4C400", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="#0F172A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                    <rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/>
                    <rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/>
                  </svg>
                </div>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: "#F8FAFC", letterSpacing: "-0.02em", margin: 0 }}>
                  Module Explorer
                </h1>
                <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: "#F4C400", color: "#0F172A", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Super Admin
                </span>
              </div>
              <p style={{ fontSize: 13, color: "#64748B", margin: 0, fontWeight: 500 }}>
                Live registry of all routes, sidebar visibility, permissions &amp; feature flags
              </p>
            </div>

            {/* Search */}
            <div style={{ position: "relative", width: 260 }}>
              <svg viewBox="0 0 16 16" fill="none" stroke="#475569" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
                width="14" height="14" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <circle cx="7" cy="7" r="4.5"/><path d="M11 11l2.5 2.5"/>
              </svg>
              <input
                type="text"
                placeholder="Search modules, paths…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: "100%", height: 36, paddingLeft: 32, paddingRight: 12,
                  border: "1px solid #1E293B", borderRadius: 8, background: "#1E293B",
                  color: "#F8FAFC", fontSize: 13, outline: "none", boxSizing: "border-box",
                  fontFamily: "inherit", fontWeight: 500,
                }}
              />
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 20, marginTop: 20, flexWrap: "wrap" }}>
            {[
              { label: "Total Routes",  value: stats.total,     color: "#F8FAFC" },
              { label: "App Modules",   value: stats.appRoutes, color: "#F8FAFC" },
              { label: "In Sidebar",    value: stats.inSidebar, color: "#4ADE80" },
              { label: "Orphaned",      value: stats.orphans,   color: stats.orphans > 0 ? "#FCD34D" : "#4ADE80" },
              { label: "Beta",          value: stats.beta,      color: "#93C5FD" },
              { label: "Hidden",        value: stats.hidden,    color: "#94A3B8" },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</span>
                <span style={{ fontSize: 11, color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Debug info bar ─────────────────────────────────────────────── */}
      <div style={{
        background: "#1E293B", borderBottom: "1px solid #0F172A",
        padding: "8px 32px", display: "flex", flexWrap: "wrap", gap: 20,
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%", display: "flex", flexWrap: "wrap", gap: 20 }}>
          {[
            { label: "Current Role",       value: devRole ? `${devRole} (override)` : (role || "—") },
            { label: "User",               value: user?.email || user?.name || "—"  },
            { label: "Detected Modules",   value: rows.length                        },
            { label: "Sidebar Items",      value: Object.keys(SIDEBAR_LOOKUP).length },
            { label: "Orphan Routes",      value: stats.orphans                      },
            { label: "Routes in Sidebar",  value: stats.inSidebar                   },
          ].map(d => (
            <div key={d.label} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                {d.label}:
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8", fontFamily: typeof d.value === "string" && d.value.includes("@") ? "inherit" : "monospace" }}>
                {String(d.value)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filter tabs ────────────────────────────────────────────────── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #F1F1F1", padding: "0 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 0, overflowX: "auto" }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "12px 14px",
                background: "transparent", border: "none",
                borderBottom: tab === t.id ? "2px solid #0F172A" : "2px solid transparent",
                cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit", marginBottom: -1,
                fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
                color: tab === t.id ? "#0F172A" : "#64748B",
              }}
            >
              {t.label}
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                minWidth: 18, height: 18, padding: "0 5px", borderRadius: 99,
                fontSize: 10, fontWeight: 700, lineHeight: 1,
                background: t.warn && t.count > 0 ? "#FFFBEB" : tab === t.id ? "#0F172A" : "#F1F1F1",
                color: t.warn && t.count > 0 ? "#D97706" : tab === t.id ? "#fff" : "#94A3B8",
              }}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Module table ───────────────────────────────────────────────── */}
      <div className="me-table-wrap" style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 32px 60px" }}>

        {filtered.length === 0 ? (
          <div style={{ padding: "60px 0", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>No modules found</div>
            <div style={{ fontSize: 13, color: "#94A3B8", fontWeight: 500 }}>
              Try adjusting your search or switching tabs.
            </div>
          </div>
        ) : (
          <div style={{ background: "#fff", border: "1px solid #F1F1F1", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>

            {/* Table header */}
            <div className="me-grid-header" style={{
              display: "grid",
              padding: "10px 16px",
              background: "#FAFAFA", borderBottom: "1px solid #F1F1F1",
              fontSize: 10, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.07em", color: "#94A3B8",
            }}>
              <span>Module</span>
              <span>Route Path</span>
              <span>Category</span>
              <span className="me-col-sidebar" style={{ textAlign: "center" }}>Sidebar</span>
              <span className="me-col-mobile" style={{ textAlign: "center" }}>Mobile</span>
              <span>Status</span>
              <span className="me-col-permissions">Permissions</span>
              <span className="me-col-actions" style={{ textAlign: "right" }}>Actions</span>
            </div>

            {/* Rows — each one individually safe */}
            {filtered.map((row, idx) => {
              // Safe fallback if row is malformed
              if (!row || !row.path) return null;

              const isExpanded = expanded === row.path;
              const isLast     = idx === filtered.length - 1;

              return (
                <div key={row.path}>
                  {/* Main row */}
                  <div
                    className="me-grid-row"
                    style={{
                      display: "grid",
                      alignItems: "center",
                      padding: "11px 16px",
                      borderBottom: isLast && !isExpanded ? "none" : "1px solid #F8F8F8",
                      background: isExpanded ? "#F8FAFF" : "transparent",
                      cursor: "pointer",
                    }}
                    onClick={() => setExpanded(isExpanded ? null : row.path)}
                  >
                    {/* Module name */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <svg viewBox="0 0 12 12" fill="none" stroke="#94A3B8" strokeWidth="1.5"
                        strokeLinecap="round" strokeLinejoin="round" width="12" height="12"
                        style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", flexShrink: 0 }}>
                        <path d="M4 2l4 4-4 4"/>
                      </svg>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          {row.label || row.path}
                          {(row.isOrphan || row.explicitOrphan) && (
                            <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "#FFFBEB", color: "#D97706", border: "1px solid #FDE68A", fontWeight: 700, textTransform: "uppercase" }}>Orphan</span>
                          )}
                          {row.inSidebar && row.sidebarItem?.badge && (
                            <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", fontWeight: 700, textTransform: "uppercase" }}>
                              {row.sidebarItem.badge}
                            </span>
                          )}
                        </div>
                        {row.routeKey && (
                          <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: "monospace", marginTop: 1 }}>{row.routeKey}</div>
                        )}
                      </div>
                    </div>

                    {/* Route path */}
                    <div
                      onClick={e => { e.stopPropagation(); copyPath(row.path); }}
                      style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
                    >
                      <code style={{ fontSize: 11, color: "#2563EB", fontFamily: "monospace", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.path}
                      </code>
                      {copied === row.path ? (
                        <svg viewBox="0 0 12 12" fill="none" stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="11" height="11" style={{ flexShrink: 0 }}>
                          <path d="M2 6l3 3 5-5"/>
                        </svg>
                      ) : (
                        <svg viewBox="0 0 12 12" fill="none" stroke="#CBD5E1" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" width="11" height="11" style={{ flexShrink: 0 }}>
                          <rect x="4" y="4" width="7" height="7" rx="1"/><path d="M1 8V2a1 1 0 011-1h6"/>
                        </svg>
                      )}
                    </div>

                    {/* Category */}
                    <div onClick={e => e.stopPropagation()}>
                      <CategoryPill category={row.category} />
                    </div>

                    {/* Sidebar toggle */}
                    <div className="me-col-sidebar" style={{ display: "flex", justifyContent: "center" }} onClick={e => e.stopPropagation()}>
                      <Toggle
                        checked={!!row.sidebarVis}
                        onChange={v => updateFlag(row.path, "sidebarVisible", v)}
                        disabled={row.category === "public" || row.category === "auth"}
                      />
                    </div>

                    {/* Mobile toggle */}
                    <div className="me-col-mobile" style={{ display: "flex", justifyContent: "center" }} onClick={e => e.stopPropagation()}>
                      <Toggle
                        checked={!!row.mobileVis}
                        onChange={v => updateFlag(row.path, "mobileVisible", v)}
                        disabled={row.category === "public"}
                      />
                    </div>

                    {/* Status */}
                    <div onClick={e => e.stopPropagation()}>
                      <StatusPill status={row.status || "live"} />
                    </div>

                    {/* Permissions */}
                    <div className="me-col-permissions" style={{ display: "flex", flexWrap: "wrap", gap: 3 }} onClick={e => e.stopPropagation()}>
                      {!row.rolesAllowed || row.rolesAllowed.length === 0 ? (
                        <span style={{ fontSize: 10, color: "#CBD5E1" }}>—</span>
                      ) : row.rolesAllowed.length > 4 ? (
                        <span style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8" }}>{row.rolesAllowed.length} roles</span>
                      ) : (
                        row.rolesAllowed.slice(0, 3).map(r => <RolePill key={r} role={r} />)
                      )}
                      {row.rolesAllowed && row.rolesAllowed.length > 3 && row.rolesAllowed.length <= 4 && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8" }}>+{row.rolesAllowed.length - 3}</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="me-col-actions" style={{ display: "flex", gap: 4, justifyContent: "flex-end" }} onClick={e => e.stopPropagation()}>
                      {/* Open page */}
                      <button
                        onClick={() => { try { navigate(row.path.replace(/:[\w]+/g, "1")); } catch {} }}
                        title={`Open ${row.path}`}
                        style={{
                          width: 28, height: 28, borderRadius: 6, border: "1px solid #F1F1F1",
                          background: "#fff", cursor: "pointer", display: "flex",
                          alignItems: "center", justifyContent: "center", color: "#64748B",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor="#0F172A"; e.currentTarget.style.color="#0F172A"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor="#F1F1F1"; e.currentTarget.style.color="#64748B"; }}
                      >
                        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                          <path d="M7 1h4v4M5 7L11 1M3 3H1v8h8V9"/>
                        </svg>
                      </button>
                      {/* Status select */}
                      <div style={{ position: "relative" }}>
                        <select
                          value={row.status || "live"}
                          onChange={e => updateFlag(row.path, "status", e.target.value)}
                          style={{
                            appearance: "none", width: 28, height: 28, borderRadius: 6,
                            border: "1px solid #F1F1F1", background: "#fff",
                            cursor: "pointer", fontSize: 11, fontFamily: "inherit",
                            paddingLeft: 6, color: "#64748B", outline: "none",
                          }}
                        >
                          {Object.keys(STATUS_STYLES).map(s => (
                            <option key={s} value={s}>{STATUS_STYLES[s].label}</option>
                          ))}
                        </select>
                        <svg viewBox="0 0 8 8" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                          width="8" height="8" style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                          <path d="M1 3l3 3 3-3"/>
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail panel */}
                  {isExpanded && (
                    <div style={{
                      padding: "16px 20px 20px 36px",
                      background: "#F8FAFF",
                      borderBottom: isLast ? "none" : "1px solid #EFF2FF",
                    }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>

                        {/* Route details */}
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94A3B8", marginBottom: 8 }}>Route Details</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            {[
                              ["Path",      <Kbd key="path">{row.path}</Kbd>],
                              ["Route Key", row.routeKey ? <Kbd key="rk">{row.routeKey}</Kbd> : <span key="rk-none" style={{ color: "#CBD5E1", fontSize: 12 }}>—</span>],
                              ["Layout",    <span key="layout" style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>{row.layout || "—"}</span>],
                              ["Category",  <CategoryPill key="cat" category={row.category} />],
                            ].map(([k, v]) => (
                              <div key={String(k)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, width: 72, flexShrink: 0 }}>{k}</span>
                                {v}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Sidebar info */}
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94A3B8", marginBottom: 8 }}>Sidebar</div>
                          {row.inSidebar && row.sidebarItem ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                              {[
                                ["Group",   <span key="grp" style={{ fontSize: 12, color: "#0F172A", fontWeight: 600 }}>{row.sidebarItem.groupLabel || "—"}</span>],
                                ["Icon",    <Kbd key="icon">{row.sidebarItem.icon || "—"}</Kbd>],
                                ["Item ID", <Kbd key="iid">{row.sidebarItem.id || "—"}</Kbd>],
                                ["Badge",   row.sidebarItem.badge ? <StatusPill key="bdg" status="live" /> : <span key="bdg-none" style={{ color: "#CBD5E1", fontSize: 12 }}>none</span>],
                              ].map(([k, v]) => (
                                <div key={String(k)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, width: 60, flexShrink: 0 }}>{k}</span>
                                  {v}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: "#94A3B8", fontWeight: 500 }}>
                              {row.category === "public" || row.category === "auth" ? "Not a navigable route" :
                               row.category === "sub"    ? "Sub-route — no sidebar entry expected" :
                               row.category === "parent" ? "Parent-only route" :
                               "⚠ Not linked in sidebar"}
                            </div>
                          )}
                        </div>

                        {/* All roles */}
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94A3B8", marginBottom: 8 }}>
                            Role Access ({(row.rolesAllowed || []).length})
                          </div>
                          {!row.rolesAllowed || row.rolesAllowed.length === 0 ? (
                            <span style={{ fontSize: 12, color: "#CBD5E1" }}>No role restrictions</span>
                          ) : (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {safeRoleHierarchy
                                .filter(r => row.rolesAllowed.includes(r))
                                .map(r => <RolePill key={r} role={r} />)
                              }
                            </div>
                          )}
                        </div>

                        {/* Feature flags */}
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94A3B8", marginBottom: 8 }}>Feature Flags</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {[
                              { label: "Show in Sidebar",  key: "sidebarVisible", def: row.inSidebar, disabled: row.category === "public" || row.category === "auth" },
                              { label: "Show on Mobile",   key: "mobileVisible",  def: true,          disabled: row.category === "public" },
                              { label: "Require Review",   key: "requireReview",  def: false,         disabled: false },
                            ].map(flag => (
                              <div key={flag.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                <span style={{ fontSize: 12, color: "#475569", fontWeight: 500 }}>{flag.label}</span>
                                <Toggle
                                  checked={!!getFlag(row.path, flag.key, flag.def)}
                                  onChange={v => updateFlag(row.path, flag.key, v)}
                                  disabled={flag.disabled}
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Status */}
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94A3B8", marginBottom: 8 }}>Module Status</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {Object.entries(STATUS_STYLES).map(([s, style]) => (
                              <label key={s} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                                <input type="radio" name={`status-${row.path}`} value={s}
                                  checked={row.status === s}
                                  onChange={() => updateFlag(row.path, "status", s)}
                                  style={{ accentColor: "#0F172A" }}
                                />
                                <StatusPill status={s} />
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* Notes */}
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94A3B8", marginBottom: 8 }}>Dev Notes</div>
                          <textarea
                            value={getFlag(row.path, "notes", "")}
                            onChange={e => updateFlag(row.path, "notes", e.target.value)}
                            placeholder="Add notes about this module…"
                            rows={3}
                            style={{
                              width: "100%", padding: "8px 10px", borderRadius: 8, resize: "vertical",
                              border: "1px solid #E8E8E8", background: "#fff", fontSize: 12,
                              color: "#0F172A", fontFamily: "inherit", outline: "none",
                              boxSizing: "border-box",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Orphan alert ─────────────────────────────────────────────── */}
        {stats.orphans > 0 && tab === "all" && (
          <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 12, background: "#FFFBEB", border: "1px solid #FDE68A", display: "flex", alignItems: "center", gap: 10 }}>
            <svg viewBox="0 0 16 16" fill="none" stroke="#D97706" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <path d="M8 1L1 14h14L8 1z"/><path d="M8 6v4"/><circle cx="8" cy="12" r="0.5" fill="#D97706" stroke="none"/>
            </svg>
            <span style={{ fontSize: 13, color: "#92400E", fontWeight: 600 }}>
              {stats.orphans} orphaned route{stats.orphans > 1 ? "s" : ""} detected — pages with no sidebar link.{" "}
              <button onClick={() => setTab("orphaned")}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#D97706", fontWeight: 700, textDecoration: "underline", fontSize: 13, fontFamily: "inherit", padding: 0 }}>
                View orphaned routes →
              </button>
            </span>
          </div>
        )}

        {/* ── Debug panel ──────────────────────────────────────────────── */}
        <DebugPanel rows={rows} />

        {/* ── Footer note ──────────────────────────────────────────────── */}
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <svg viewBox="0 0 14 14" fill="none" stroke="#CBD5E1" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
            <circle cx="7" cy="7" r="6"/><path d="M7 6v4"/><circle cx="7" cy="4" r="0.5" fill="#CBD5E1" stroke="none"/>
          </svg>
          <span style={{ fontSize: 11, color: "#CBD5E1", fontWeight: 500 }}>
            Flags stored in <Kbd>localStorage</Kbd> under <Kbd>yd_module_flags</Kbd>. Changes are live but not synced to server.
            Page only accessible to <Kbd>super_admin</Kbd> and <Kbd>developer</Kbd> roles.
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Default export wrapped in error boundary ──────────────────────────────────
export default function ModuleExplorer() {
  return (
    <ModuleExplorerBoundary>
      <ModuleExplorerInner />
    </ModuleExplorerBoundary>
  );
}
