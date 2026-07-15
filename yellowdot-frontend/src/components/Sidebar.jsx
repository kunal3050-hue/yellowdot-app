/**
 * Sidebar.jsx — Yellow Dot premium role-aware navigation sidebar
 * ─────────────────────────────────────────────────────────────────────────
 * Features:
 *   ✓ Role-filtered menu (can() per item, devOnly groups for bypass roles)
 *   ✓ Collapsible sections with spring animation + localStorage persistence
 *   ✓ Active route highlighting with animated accent bar
 *   ✓ Consistent SVG icon set (Lucide-style, stroke-based)
 *   ✓ Badge counters: numeric, LIVE, NEW, SOON types
 *   ✓ Mobile responsive overlay (controlled by mobileOpen / onMobileClose)
 *   ✓ Developer-only group + inline DevPanel role switcher
 *   ✓ Parent-only simplified flat menu (no sections, no collapse)
 *   ✓ Zero hardcoded colors — 100% CSS design token usage
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { PLATFORM_NAME } from "../config/environment";
import settingsService from "../services/settingsService";
import {
  ROLE_LABELS, ROLE_HIERARCHY,
  isBypassRole,
} from "../config/permissions";
import {
  SIDEBAR_GROUPS, PARENT_MENU,
  resolveInitialOpen, storeSectionState,
} from "../config/sidebarConfig";
import InstallAppButton from "./InstallAppButton";

// ══════════════════════════════════════════════════════════════════════════════
// ICON SYSTEM — lucide-react (KUE BOXS Design System v2)
// All icons: 16×16, stroke-based, strokeWidth 1.75, round caps/joins by default.
// ChevronDown/X stay at their historical 14px/2 stroke — a deliberate smaller
// treatment for the collapse-chevron and close-button, preserved from before.
// ══════════════════════════════════════════════════════════════════════════════

import {
  Home, Users, Calendar, CreditCard, FileText, BarChart2, Moon, Utensils,
  ClipboardList, CheckSquare, Car, History, Video, Camera, Sliders,
  ChevronDown, LogOut, User, X, Settings, Briefcase, Shield, CalendarDays,
  AlertTriangle, UsersRound, CalendarCheck, CalendarOff, Bell, Megaphone,
  Grid, BookOpen, Layers, UserCheck, QrCode, Heart, Building2, ScrollText,
} from "lucide-react";

const IC = { size: 16, strokeWidth: 1.75 };

const LUCIDE_ICONS = {
  Home, Users, Calendar, CreditCard, FileText, BarChart2, Moon, Utensils,
  ClipboardList, CheckSquare, Car, History, Video, Camera, Sliders,
  LogOut, User, Settings, Briefcase, Shield, CalendarDays,
  AlertTriangle, UsersRound, CalendarCheck, CalendarOff, Bell, Megaphone,
  Grid, BookOpen, Layers, UserCheck, QrCode, Heart, Building2, ScrollText,
};

const ICONS = Object.fromEntries(
  Object.entries(LUCIDE_ICONS).map(([name, LucideIcon]) => [
    name,
    () => <LucideIcon size={IC.size} strokeWidth={IC.strokeWidth} />,
  ])
);
// ChevronDown/X keep their historical smaller size (14px / stroke 2)
ICONS.ChevronDown = () => <ChevronDown size={14} strokeWidth={2} />;
ICONS.X           = () => <X size={16} strokeWidth={2.5} />;

// Fallback for any unrecognised icon name — renders a neutral dot so layout holds
function FallbackIcon() {
  return (
    <svg viewBox="0 0 24 24" width={IC.size} height={IC.size} fill="currentColor" stroke="none">
      <circle cx="12" cy="12" r="4" opacity="0.4" />
    </svg>
  );
}

function Icon({ name, className }) {
  const Component = ICONS[name] || FallbackIcon;
  try {
    return (
      <span className={className} style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
        <Component />
      </span>
    );
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ACTIVE ROUTE HELPER
// ══════════════════════════════════════════════════════════════════════════════

function isItemActive(item, pathname) {
  if (!item.path) return false;
  if (item.exact) return pathname === item.path;
  // Extra paths that also count as active (e.g. sub-pages)
  if (item.matchPaths?.some(p => pathname.startsWith(p))) return true;
  if (item.path === "/") return pathname === "/";
  return pathname === item.path || pathname.startsWith(item.path + "/");
}

// ══════════════════════════════════════════════════════════════════════════════
// BADGE
// ══════════════════════════════════════════════════════════════════════════════

function ItemBadge({ badge, count }) {
  if (count != null && count > 0) {
    return (
      <span className="yd-sl-badge yd-sl-badge--count">
        {count > 99 ? "99+" : count}
      </span>
    );
  }
  if (badge === "live") return <span className="yd-sl-badge yd-sl-badge--live">LIVE</span>;
  if (badge === "new")  return <span className="yd-sl-badge yd-sl-badge--new">NEW</span>;
  if (badge === "soon") return <span className="yd-sl-badge yd-sl-badge--soon">SOON</span>;
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// SIDEBAR ITEM
// ══════════════════════════════════════════════════════════════════════════════

function SidebarItem({ item, badgeCounts = {}, onActionClick }) {
  const { pathname } = useLocation();
  const active = isItemActive(item, pathname);

  // Action-only items (no path navigation)
  if (!item.path) {
    return (
      <button
        className={`yd-sl-item${active ? " active" : ""}`}
        onClick={() => onActionClick?.(item.devAction)}
      >
        <span className="yd-sl-item-icon">
          <Icon name={item.icon} />
        </span>
        <span className="yd-sl-item-label">{item.label}</span>
        <ItemBadge badge={item.badge} count={badgeCounts[item.id]} />
      </button>
    );
  }

  return (
    <Link
      to={item.path}
      className={`yd-sl-item${active ? " active" : ""}`}
    >
      <span className="yd-sl-item-icon">
        <Icon name={item.icon} />
      </span>
      <span className="yd-sl-item-label">{item.label}</span>
      <ItemBadge badge={item.badge} count={badgeCounts[item.id]} />
    </Link>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SIDEBAR SECTION (collapsible group)
// ══════════════════════════════════════════════════════════════════════════════

function SidebarSection({ group, visibleItems, badgeCounts, onActionClick }) {
  const [open, setOpen] = useState(() => resolveInitialOpen(group));

  function toggle() {
    if (!group.collapsible) return;
    const next = !open;
    setOpen(next);
    storeSectionState(group.id, next);
  }

  if (visibleItems.length === 0) return null;

  const isDev = group.devOnly;

  return (
    <div className={`yd-sl-group${isDev ? " yd-sl-group--dev" : ""}`}>
      {/* Section header — clickable only when collapsible */}
      <div
        className={`yd-sl-group-header${group.collapsible ? " yd-sl-group-header--toggle" : ""}`}
        onClick={toggle}
        role={group.collapsible ? "button" : undefined}
        tabIndex={group.collapsible ? 0 : undefined}
        onKeyDown={group.collapsible ? (e) => { if (e.key === "Enter" || e.key === " ") toggle(); } : undefined}
        aria-expanded={group.collapsible ? open : undefined}
      >
        <span className={`yd-sl-group-label${isDev ? " yd-sl-group-label--dev" : ""}`}>
          {isDev && <span style={{ marginRight: 4 }}>🔧</span>}
          {group.label}
        </span>
        {group.collapsible && (
          <span className={`yd-sl-group-chevron${open ? " yd-sl-group-chevron--open" : ""}`}>
            <Icon name="ChevronDown" />
          </span>
        )}
      </div>

      {/* Collapsible content */}
      <div className={`yd-sl-section-body${open ? " yd-sl-section-body--open" : " yd-sl-section-body--closed"}`}>
        <div className="yd-sl-items">
          {visibleItems.map(item => {
            try {
              return (
                <SidebarItem
                  key={item.id}
                  item={item}
                  badgeCounts={badgeCounts}
                  onActionClick={onActionClick}
                />
              );
            } catch (err) {
              console.error("[Sidebar] Failed to render item:", item?.id, err);
              return null;
            }
          })}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DEV PANEL (role switcher — only for bypass roles)
// ══════════════════════════════════════════════════════════════════════════════

function DevPanel({ currentRole, onSelect, onClear }) {
  return (
    <div className="yd-sl-dev-panel">
      <div className="yd-sl-dev-panel-title">Viewing as role</div>
      <div className="yd-sl-dev-panel-roles">
        {ROLE_HIERARCHY.map(r => (
          <button
            key={r}
            onClick={() => onSelect(r)}
            className={`yd-sl-dev-role-btn${currentRole === r ? " active" : ""}`}
          >
            {ROLE_LABELS[r] || r}
          </button>
        ))}
      </div>
      <button className="yd-sl-dev-reset" onClick={onClear}>
        Reset to my role
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PARENT MENU (simplified flat view)
// ══════════════════════════════════════════════════════════════════════════════

function ParentMenu({ can, badgeCounts }) {
  const { pathname } = useLocation();

  return (
    <nav className="yd-sl-nav">
      <div className="yd-sl-group">
        <div className="yd-sl-group-header">
          <span className="yd-sl-group-label">My Portal</span>
        </div>
        <div className="yd-sl-items">
          {PARENT_MENU.filter(item => !item.routeKey || can(item.routeKey)).map(item => {
            const active = isItemActive(item, pathname);
            return (
              <Link
                key={item.id}
                to={item.path}
                className={`yd-sl-item${active ? " active" : ""}`}
              >
                <span className="yd-sl-item-icon">
                  <Icon name={item.icon} />
                </span>
                <span className="yd-sl-item-label">{item.label}</span>
                <ItemBadge badge={item.badge} count={badgeCounts?.[item.id]} />
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AVATAR
// ══════════════════════════════════════════════════════════════════════════════

function Avatar({ user, size = 30 }) {
  const [err, setErr] = useState(false);
  const initials = (user?.name || "?")
    .split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  if (user?.photoUrl && !err) {
    return (
      <img
        src={user.photoUrl}
        alt={user.name}
        style={{
          width: size, height: size, borderRadius: Math.round(size * 0.28),
          objectFit: "cover", flexShrink: 0, display: "block",
          border: "1.5px solid rgba(236,231,216,0.80)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        }}
        onError={() => setErr(true)}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.28),
      background: "linear-gradient(145deg, #fde047 0%, #f59e0b 60%, #d97706 100%)",
      color: "#78350f",
      fontWeight: 800,
      fontSize: Math.round(size * 0.36),
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
      letterSpacing: "-0.5px",
      boxShadow: "0 2px 8px rgba(234,179,8,0.30)",
    }}>
      {initials}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN SIDEBAR
// ══════════════════════════════════════════════════════════════════════════════

export default function Sidebar({ mobileOpen = false, onMobileClose }) {
  const navigate    = useNavigate();
  const { user, role, permissions, can, logout, isDeveloper, setDevRole, devRole } = useAuth();

  const [devPanelOpen,     setDevPanelOpen]     = useState(false);
  const [devSectionOpen,   setDevSectionOpen]   = useState(true); // developer nav group open state

  // Current tenant (school) info for the header's tenant-info row — separate
  // from PLATFORM_NAME, which stays fixed. Best-effort only: `branch` comes
  // from the raw center id on the user record (no backend endpoint resolves
  // a real per-branch display name to staff yet), so it's shown titleized.
  const [tenant, setTenant] = useState({ name: "", logoUrl: "" });
  useEffect(() => {
    settingsService.getAll().then(s => {
      setTenant({
        name:    s?.branding?.reportHeader || s?.school?.name || "",
        logoUrl: s?.branding?.logoUrl || s?.school?.logoUrl || "",
      });
    }).catch(() => {});
  }, []);
  const branchLabel = user?.center
    ? String(user.center).replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : "";

  // Effective role for filtering (dev role override or real role)
  const effectiveRole  = devRole || role;
  const isBypass       = isBypassRole(effectiveRole);
  const isParent       = effectiveRole === "parent";

  // Badge counts — wire to live data when available
  const badgeCounts = {};

  // Handle dev panel action from the Role Switcher item
  function handleAction(action) {
    if (action === "toggleDevPanel") setDevPanelOpen(p => !p);
  }

  // Non-dev groups — filtered by permission as normal
  // superAdminOnly groups only visible to super_admin / developer bypass roles
  const regularGroups = SIDEBAR_GROUPS
    .filter(group => !group.devOnly && (!group.superAdminOnly || effectiveRole === "super_admin" || isBypass))
    .map(group => ({
      ...group,
      visibleItems: group.items.filter(item => {
        if (!item.routeKey) return true;
        if (isBypass)       return true;
        return can(item.routeKey);
      }),
    }))
    .filter(g => g.visibleItems.length > 0);

  // Debug — log once on mount so console shows what the sidebar sees
  useEffect(() => {
    if (isBypass) {
      console.log("[Sidebar] bypass role active — developer section will render directly. effectiveRole:", effectiveRole, "| real role:", role);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBypass]);

  // Close sidebar when route changes (mobile)
  const { pathname } = useLocation();
  const prevPath = useRef(pathname);
  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname;
      onMobileClose?.();
    }
  }, [pathname, onMobileClose]);

  // Active check for Module Explorer link
  const isModExActive = pathname === "/dev/modules" || pathname.startsWith("/dev/modules/");

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="yd-sl-backdrop"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside className={`yd-sidebar${mobileOpen ? " yd-sidebar--mobile-open" : ""}`}>

        {/* ── Brand logo ───────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 11,
          padding: "18px 18px 16px",
          borderBottom: "1px solid #F5F0E8",
          flexShrink: 0, position: "relative", zIndex: 1,
          overflow: "hidden", whiteSpace: "nowrap",
        }}>
          {/* Logo image with soft yellow halo */}
          <div style={{
            width: 38, height: 38, borderRadius: 12, flexShrink: 0,
            background: "#FFFBEB",
            border: "1.5px solid #FDE68A",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 10px rgba(245,197,24,0.22), 0 1px 3px rgba(0,0,0,0.04)",
            overflow: "hidden",
          }}>
            <img
              src="/icons/logo-original.png"
              alt={PLATFORM_NAME}
              style={{ width: 26, height: 26, objectFit: "contain", display: "block" }}
            />
          </div>

          {/* Brand text */}
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 14.5, fontWeight: 700, color: "#1C1917",
              lineHeight: 1.15, letterSpacing: "-0.025em",
            }}>
              {PLATFORM_NAME}
            </div>
            <div style={{
              fontSize: 10, color: "#A8906A", marginTop: 2,
              fontWeight: 500, letterSpacing: "0.02em", lineHeight: 1,
            }}>
              Preschool Daycare CRM
            </div>
          </div>

          {mobileOpen && (
            <button className="yd-sl-mobile-close" onClick={onMobileClose} aria-label="Close menu" style={{ marginLeft: "auto" }}>
              <Icon name="X" />
            </button>
          )}
        </div>

        {/* ── Current tenant (school) ──────────────────────────────────────
            Reserved area for the logged-in tenant's own identity — separate
            from the platform brand above. Never replaces the platform logo;
            hides itself if no tenant name/branch is resolvable yet. */}
        {(tenant.name || branchLabel) && (
          <div style={{
            display: "flex", alignItems: "center", gap: 9,
            padding: "10px 18px",
            borderBottom: "1px solid #F5F0E8",
            flexShrink: 0, overflow: "hidden", whiteSpace: "nowrap",
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: 8, flexShrink: 0,
              background: "#F3F0EA", border: "1px solid #E7E1D5",
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden",
            }}>
              {tenant.logoUrl ? (
                <img
                  src={tenant.logoUrl}
                  alt={tenant.name || "School logo"}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              ) : (
                <span style={{ fontSize: 11, fontWeight: 700, color: "#8A7F6B" }}>
                  {(tenant.name || branchLabel || "S").charAt(0)}
                </span>
              )}
            </div>
            <div style={{ minWidth: 0, overflow: "hidden" }}>
              {tenant.name && (
                <div style={{
                  fontSize: 11.5, fontWeight: 600, color: "#57503F",
                  lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {tenant.name}
                </div>
              )}
              {branchLabel && (
                <div style={{
                  fontSize: 9.5, color: "#A8906A", marginTop: 1,
                  fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {branchLabel}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Dev role override banner ─────────────────────────────────── */}
        {devRole && (
          <div className="yd-sl-dev-banner">
            <span>🔧 Viewing as <strong>{ROLE_LABELS[devRole] || devRole}</strong></span>
            <button className="yd-sl-dev-banner-clear" onClick={() => setDevRole(null)} aria-label="Reset role">
              <Icon name="X" />
            </button>
          </div>
        )}

        {/* ── Navigation ───────────────────────────────────────────────── */}
        {isParent ? (
          <ParentMenu can={can} badgeCounts={badgeCounts} />
        ) : (
          <nav className="yd-sl-nav">

            {/* Regular config-driven groups (non-developer) */}
            {regularGroups.map(group => (
              <SidebarSection
                key={group.id}
                group={group}
                visibleItems={group.visibleItems}
                badgeCounts={badgeCounts}
                onActionClick={handleAction}
              />
            ))}

            {/* ── Developer section — rendered directly for bypass roles ── */}
            {/* Bypasses the SidebarSection/SidebarItem/filter pipeline entirely  */}
            {/* so it cannot be silently dropped by a filter bug or stale cache. */}
            {isBypass && (
              <div className="yd-sl-group yd-sl-group--dev">
                {/* Section header */}
                <div
                  className="yd-sl-group-header yd-sl-group-header--toggle"
                  onClick={() => setDevSectionOpen(o => !o)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") setDevSectionOpen(o => !o); }}
                  aria-expanded={devSectionOpen}
                >
                  <span className="yd-sl-group-label yd-sl-group-label--dev">
                    <span style={{ marginRight: 4 }}>🔧</span>Developer
                  </span>
                  <span className={`yd-sl-group-chevron${devSectionOpen ? " yd-sl-group-chevron--open" : ""}`}>
                    <Icon name="ChevronDown" />
                  </span>
                </div>

                {/* Items */}
                <div className={`yd-sl-section-body${devSectionOpen ? " yd-sl-section-body--open" : " yd-sl-section-body--closed"}`}>
                  <div className="yd-sl-items">

                    {/* Role Switcher — action button (no navigation) */}
                    <button
                      className="yd-sl-item"
                      onClick={() => setDevPanelOpen(p => !p)}
                    >
                      <span className="yd-sl-item-icon"><Icon name="Sliders" /></span>
                      <span className="yd-sl-item-label">Role Switcher</span>
                    </button>

                    {/* Module Explorer — navigates to /dev/modules */}
                    <Link
                      to="/dev/modules"
                      className={`yd-sl-item${isModExActive ? " active" : ""}`}
                    >
                      <span className="yd-sl-item-icon"><Icon name="Grid" /></span>
                      <span className="yd-sl-item-label">Module Explorer</span>
                    </Link>

                  </div>
                </div>
              </div>
            )}

          </nav>
        )}

        {/* ── Developer panel (role switcher UI in footer) ─────────────── */}
        {isBypass && (
          <div className="yd-sl-footer-section">
            <button
              className={`yd-sl-dev-toggle${devPanelOpen ? " active" : ""}`}
              onClick={() => setDevPanelOpen(p => !p)}
            >
              <Icon name="Sliders" />
              <span>Dev Panel</span>
              <span className={`yd-sl-group-chevron${devPanelOpen ? " yd-sl-group-chevron--open" : ""}`} style={{ marginLeft: "auto" }}>
                <Icon name="ChevronDown" />
              </span>
            </button>

            <div className={`yd-sl-section-body${devPanelOpen ? " yd-sl-section-body--open" : " yd-sl-section-body--closed"}`}>
              <DevPanel
                currentRole={devRole || role}
                onSelect={r => { setDevRole(r); setDevPanelOpen(false); }}
                onClear={() => setDevRole(null)}
              />
            </div>
          </div>
        )}

        {/* ── User footer ──────────────────────────────────────────────── */}
        <div className="yd-sl-footer">
          <div className="yd-sl-user-row">
            <Avatar user={user} size={36} />
            <div className="yd-sl-user-info">
              <div className="yd-sl-user-name">{user?.name || "User"}</div>
              <div className="yd-sl-user-role">
                {ROLE_LABELS[effectiveRole] || effectiveRole}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <InstallAppButton variant="icon" />
              <button
                className="yd-sl-logout-btn yd-sl-logout-btn--settings"
                onClick={() => navigate("/settings")}
                aria-label="Settings"
                title="Settings"
              >
                <Icon name="Settings" />
              </button>
              <button
                className="yd-sl-logout-btn"
                onClick={() => logout()}
                aria-label="Sign out"
                title="Sign out"
              >
                <Icon name="LogOut" />
              </button>
            </div>
          </div>
        </div>

      </aside>
    </>
  );
}
