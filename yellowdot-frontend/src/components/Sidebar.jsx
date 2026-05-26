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
import {
  ROLE_LABELS, ROLE_HIERARCHY,
  isBypassRole,
} from "../config/permissions";
import {
  SIDEBAR_GROUPS, PARENT_MENU,
  resolveInitialOpen, storeSectionState,
} from "../config/sidebarConfig";

// ══════════════════════════════════════════════════════════════════════════════
// ICON SYSTEM
// All icons: 16×16, stroke-based, strokeWidth 1.75, round caps/joins.
// Matches Lucide icon language for visual consistency.
// ══════════════════════════════════════════════════════════════════════════════

const IC = { size: 16, fill: "none", stroke: "currentColor", strokeWidth: "1.75", strokeLinecap: "round", strokeLinejoin: "round" };

const ICONS = {
  Home: () => (
    <svg viewBox="0 0 24 24" width={IC.size} height={IC.size} fill={IC.fill} stroke={IC.stroke} strokeWidth={IC.strokeWidth} strokeLinecap={IC.strokeLinecap} strokeLinejoin={IC.strokeLinejoin}>
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  ),
  Users: () => (
    <svg viewBox="0 0 24 24" width={IC.size} height={IC.size} fill={IC.fill} stroke={IC.stroke} strokeWidth={IC.strokeWidth} strokeLinecap={IC.strokeLinecap} strokeLinejoin={IC.strokeLinejoin}>
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
      <path d="M16 3.13a4 4 0 010 7.75" />
      <path d="M21 21v-2a4 4 0 00-3-3.85" />
    </svg>
  ),
  Calendar: () => (
    <svg viewBox="0 0 24 24" width={IC.size} height={IC.size} fill={IC.fill} stroke={IC.stroke} strokeWidth={IC.strokeWidth} strokeLinecap={IC.strokeLinecap} strokeLinejoin={IC.strokeLinejoin}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  CreditCard: () => (
    <svg viewBox="0 0 24 24" width={IC.size} height={IC.size} fill={IC.fill} stroke={IC.stroke} strokeWidth={IC.strokeWidth} strokeLinecap={IC.strokeLinecap} strokeLinejoin={IC.strokeLinejoin}>
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  FileText: () => (
    <svg viewBox="0 0 24 24" width={IC.size} height={IC.size} fill={IC.fill} stroke={IC.stroke} strokeWidth={IC.strokeWidth} strokeLinecap={IC.strokeLinecap} strokeLinejoin={IC.strokeLinejoin}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  BarChart2: () => (
    <svg viewBox="0 0 24 24" width={IC.size} height={IC.size} fill={IC.fill} stroke={IC.stroke} strokeWidth={IC.strokeWidth} strokeLinecap={IC.strokeLinecap} strokeLinejoin={IC.strokeLinejoin}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6"  y1="20" x2="6"  y2="14" />
    </svg>
  ),
  Moon: () => (
    <svg viewBox="0 0 24 24" width={IC.size} height={IC.size} fill={IC.fill} stroke={IC.stroke} strokeWidth={IC.strokeWidth} strokeLinecap={IC.strokeLinecap} strokeLinejoin={IC.strokeLinejoin}>
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  ),
  Utensils: () => (
    <svg viewBox="0 0 24 24" width={IC.size} height={IC.size} fill={IC.fill} stroke={IC.stroke} strokeWidth={IC.strokeWidth} strokeLinecap={IC.strokeLinecap} strokeLinejoin={IC.strokeLinejoin}>
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h1v5a2 2 0 004 0v-5h-2z" />
    </svg>
  ),
  ClipboardList: () => (
    <svg viewBox="0 0 24 24" width={IC.size} height={IC.size} fill={IC.fill} stroke={IC.stroke} strokeWidth={IC.strokeWidth} strokeLinecap={IC.strokeLinecap} strokeLinejoin={IC.strokeLinejoin}>
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  ),
  CheckSquare: () => (
    <svg viewBox="0 0 24 24" width={IC.size} height={IC.size} fill={IC.fill} stroke={IC.stroke} strokeWidth={IC.strokeWidth} strokeLinecap={IC.strokeLinecap} strokeLinejoin={IC.strokeLinejoin}>
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  ),
  Car: () => (
    <svg viewBox="0 0 24 24" width={IC.size} height={IC.size} fill={IC.fill} stroke={IC.stroke} strokeWidth={IC.strokeWidth} strokeLinecap={IC.strokeLinecap} strokeLinejoin={IC.strokeLinejoin}>
      <path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h1l2-3h10l2 3h1a2 2 0 012 2v6a2 2 0 01-2 2h-2" />
      <circle cx="7.5" cy="17" r="2.5" />
      <circle cx="16.5" cy="17" r="2.5" />
    </svg>
  ),
  History: () => (
    <svg viewBox="0 0 24 24" width={IC.size} height={IC.size} fill={IC.fill} stroke={IC.stroke} strokeWidth={IC.strokeWidth} strokeLinecap={IC.strokeLinecap} strokeLinejoin={IC.strokeLinejoin}>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
      <polyline points="12 7 12 12 16 14" />
    </svg>
  ),
  Video: () => (
    <svg viewBox="0 0 24 24" width={IC.size} height={IC.size} fill={IC.fill} stroke={IC.stroke} strokeWidth={IC.strokeWidth} strokeLinecap={IC.strokeLinecap} strokeLinejoin={IC.strokeLinejoin}>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ),
  Camera: () => (
    <svg viewBox="0 0 24 24" width={IC.size} height={IC.size} fill={IC.fill} stroke={IC.stroke} strokeWidth={IC.strokeWidth} strokeLinecap={IC.strokeLinecap} strokeLinejoin={IC.strokeLinejoin}>
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  Sliders: () => (
    <svg viewBox="0 0 24 24" width={IC.size} height={IC.size} fill={IC.fill} stroke={IC.stroke} strokeWidth={IC.strokeWidth} strokeLinecap={IC.strokeLinecap} strokeLinejoin={IC.strokeLinejoin}>
      <line x1="4"  y1="21" x2="4"  y2="14" />
      <line x1="4"  y1="10" x2="4"  y2="3"  />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8"  x2="12" y2="3"  />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3"  />
      <line x1="1"  y1="14" x2="7"  y2="14" />
      <line x1="9"  y1="8"  x2="15" y2="8"  />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  ),
  ChevronDown: () => (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  LogOut: () => (
    <svg viewBox="0 0 24 24" width={IC.size} height={IC.size} fill={IC.fill} stroke={IC.stroke} strokeWidth={IC.strokeWidth} strokeLinecap={IC.strokeLinecap} strokeLinejoin={IC.strokeLinejoin}>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  User: () => (
    <svg viewBox="0 0 24 24" width={IC.size} height={IC.size} fill={IC.fill} stroke={IC.stroke} strokeWidth={IC.strokeWidth} strokeLinecap={IC.strokeLinecap} strokeLinejoin={IC.strokeLinejoin}>
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  X: () => (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6"  y1="6" x2="18" y2="18" />
    </svg>
  ),
  Settings: () => (
    <svg viewBox="0 0 24 24" width={IC.size} height={IC.size} fill={IC.fill} stroke={IC.stroke} strokeWidth={IC.strokeWidth} strokeLinecap={IC.strokeLinecap} strokeLinejoin={IC.strokeLinejoin}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
  // Premium briefcase — staff / team management
  Briefcase: () => (
    <svg viewBox="0 0 24 24" width={IC.size} height={IC.size} fill={IC.fill} stroke={IC.stroke} strokeWidth={IC.strokeWidth} strokeLinecap={IC.strokeLinecap} strokeLinejoin={IC.strokeLinejoin}>
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
      <line x1="12" y1="12" x2="12" y2="12" />
      <path d="M2 12h20" />
    </svg>
  ),
  // Shield — roles & permissions
  Shield: () => (
    <svg viewBox="0 0 24 24" width={IC.size} height={IC.size} fill={IC.fill} stroke={IC.stroke} strokeWidth={IC.strokeWidth} strokeLinecap={IC.strokeLinecap} strokeLinejoin={IC.strokeLinejoin}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  // CalendarDays — holidays / school calendar
  CalendarDays: () => (
    <svg viewBox="0 0 24 24" width={IC.size} height={IC.size} fill={IC.fill} stroke={IC.stroke} strokeWidth={IC.strokeWidth} strokeLinecap={IC.strokeLinecap} strokeLinejoin={IC.strokeLinejoin}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" strokeWidth="2" />
    </svg>
  ),
  // CalendarOff kept for backward compat
  CalendarOff: () => (
    <svg viewBox="0 0 24 24" width={IC.size} height={IC.size} fill={IC.fill} stroke={IC.stroke} strokeWidth={IC.strokeWidth} strokeLinecap={IC.strokeLinecap} strokeLinejoin={IC.strokeLinejoin}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  ),
  // Bell — notices / circulars
  Bell: () => (
    <svg viewBox="0 0 24 24" width={IC.size} height={IC.size} fill={IC.fill} stroke={IC.stroke} strokeWidth={IC.strokeWidth} strokeLinecap={IC.strokeLinecap} strokeLinejoin={IC.strokeLinejoin}>
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  ),
  // Megaphone — announcements / live feed
  Megaphone: () => (
    <svg viewBox="0 0 24 24" width={IC.size} height={IC.size} fill={IC.fill} stroke={IC.stroke} strokeWidth={IC.strokeWidth} strokeLinecap={IC.strokeLinecap} strokeLinejoin={IC.strokeLinejoin}>
      <path d="M3 11l19-9-9 19-2-8-8-2z" />
    </svg>
  ),
  Grid: () => (
    <svg viewBox="0 0 24 24" width={IC.size} height={IC.size} fill={IC.fill} stroke={IC.stroke} strokeWidth={IC.strokeWidth} strokeLinecap={IC.strokeLinecap} strokeLinejoin={IC.strokeLinejoin}>
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),

  QrCode: () => (
    <svg viewBox="0 0 24 24" width={IC.size} height={IC.size} fill="none" stroke={IC.stroke} strokeWidth={IC.strokeWidth} strokeLinecap={IC.strokeLinecap} strokeLinejoin={IC.strokeLinejoin}>
      {/* top-left block */}
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="5" y="5" width="3" height="3" fill={IC.stroke} stroke="none" />
      {/* top-right block */}
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="16" y="5" width="3" height="3" fill={IC.stroke} stroke="none" />
      {/* bottom-left block */}
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="5" y="16" width="3" height="3" fill={IC.stroke} stroke="none" />
      {/* bottom-right data dots */}
      <line x1="14" y1="14" x2="14" y2="14.01" strokeWidth="2" />
      <line x1="18" y1="14" x2="18" y2="14.01" strokeWidth="2" />
      <line x1="21" y1="14" x2="21" y2="14.01" strokeWidth="2" />
      <line x1="14" y1="17" x2="14" y2="17.01" strokeWidth="2" />
      <line x1="17" y1="17" x2="17" y2="21" strokeWidth="2" />
      <line x1="21" y1="17" x2="21" y2="17.01" strokeWidth="2" />
      <line x1="14" y1="21" x2="14" y2="21.01" strokeWidth="2" />
      <line x1="21" y1="21" x2="21" y2="21.01" strokeWidth="2" />
    </svg>
  ),
};

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
  const regularGroups = SIDEBAR_GROUPS
    .filter(group => !group.devOnly)
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
          display: "flex", alignItems: "center", gap: 13,
          padding: "20px 20px 18px",
          borderBottom: "1px solid rgba(236,231,216,0.55)",
          flexShrink: 0, position: "relative", zIndex: 1,
          overflow: "hidden", whiteSpace: "nowrap",
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 14,
            background: "linear-gradient(145deg, #fde047 0%, #f59e0b 55%, #d97706 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 20, color: "#78350f", flexShrink: 0,
            boxShadow: [
              "0 4px 14px rgba(234,179,8,0.38)",
              "inset 0 1px 0 rgba(255,255,255,0.45)",
              "inset 0 -1px 0 rgba(0,0,0,0.10)",
            ].join(", "),
            letterSpacing: "-0.5px",
          }}>Y</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#1a1a1a", lineHeight: 1.1, letterSpacing: "-0.03em" }}>
              Yellow Dot
            </div>
            <div style={{ fontSize: 10, color: "#b0946a", marginTop: 3, fontWeight: 500, letterSpacing: "0.025em" }}>
              Preschool CRM
            </div>
          </div>
          {mobileOpen && (
            <button className="yd-sl-mobile-close" onClick={onMobileClose} aria-label="Close menu">
              <Icon name="X" />
            </button>
          )}
        </div>

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
