/**
 * Topbar.jsx — Yellow Dot premium global topbar
 * ─────────────────────────────────────────────────────────────────────────
 * Sections (left → right):
 *   LEFT  : mobile hamburger · global search (⌘K command palette)
 *   RIGHT : dev badge · center switcher · divider · notifications · profile
 *
 * Architecture:
 *   - All colors from CSS tokens only — zero hardcoded hex
 *   - CSS classes from layout.css (.yd-tb-*) and animations.css
 *   - Command palette has full keyboard nav (↑↓ Enter Esc)
 *   - Every dropdown closes on outside-click via shared useClickOutside
 *   - Theme-ready: swap tokens.css variables for dark mode
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Search, Bell, ChevronDown as ChevronDownLucide, Menu, Check } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { ROLE_LABELS, isBypassRole } from "../config/permissions";

// ── Searchable nav catalogue ───────────────────────────────────────────────
// Every page the command palette can navigate to.
const SEARCH_ITEMS = [
  // Core
  { name: "Dashboard",         path: "/",                      icon: "🏠", group: "Core" },
  { name: "Students",          path: "/students",              icon: "🎓", group: "Core" },
  { name: "Attendance",        path: "/attendance",            icon: "📅", group: "Core" },
  // Finance
  { name: "Fees",              path: "/fees",                  icon: "💳", group: "Finance" },
  { name: "Invoices",          path: "/invoice",               icon: "📄", group: "Finance" },
  { name: "New Invoice",       path: "/invoice/new",           icon: "➕", group: "Finance" },
  { name: "Fee Templates",     path: "/invoice/templates",     icon: "📋", group: "Finance" },
  { name: "Analytics",         path: "/analytics",             icon: "📊", group: "Finance" },
  // Daily Ops
  { name: "Nap Tracker",       path: "/nap-tracker",           icon: "😴", group: "Daily Ops" },
  { name: "Food Menu",         path: "/food-menu",             icon: "🍽️",  group: "Daily Ops" },
  { name: "Food Consumption",  path: "/food-consumption",      icon: "🥣", group: "Daily Ops" },
  // Presence & Safety
  { name: "Attendance",        path: "/attendance",            icon: "📅", group: "Presence & Safety" },
  { name: "Parent Entry",      path: "/parent-checkin",        icon: "✅", group: "Presence & Safety" },
  { name: "Pickup",            path: "/pickup-authorization",  icon: "🚗", group: "Presence & Safety" },
  { name: "Pickup History",    path: "/pickup-history",        icon: "📋", group: "Presence & Safety" },
  { name: "Staff Checkout",    path: "/staff-checkout",        icon: "🚪", group: "Presence & Safety" },
  { name: "QR Management",     path: "/qr-management",         icon: "⬛", group: "Presence & Safety" },
  // Account
  { name: "My Profile",        path: "/profile",               icon: "👤", group: "Account" },
  { name: "Security Settings", path: "/settings/security",     icon: "🔒", group: "Account" },
];

// Items shown when search is empty — most-used pages
const PINNED_PATHS = ["/", "/students", "/invoice", "/attendance", "/fees", "/analytics"];
const PINNED = SEARCH_ITEMS.filter(i => PINNED_PATHS.includes(i.path));

// ── Shared hook: close on outside click ───────────────────────────────────
function useClickOutside(ref, handler) {
  useEffect(() => {
    function listener(e) {
      if (ref.current && !ref.current.contains(e.target)) handler();
    }
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, [ref, handler]);
}

// ── Format center ID → display name ───────────────────────────────────────
function formatCenter(id = "") {
  return id.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ══════════════════════════════════════════════════════════════════════════
// COMMAND PALETTE
// ══════════════════════════════════════════════════════════════════════════
function CommandPalette({ open, onClose }) {
  const navigate  = useNavigate();
  const inputRef  = useRef(null);
  const [query,     setQuery]     = useState("");
  const [activeIdx, setActiveIdx] = useState(0);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Filter or show pinned
  const flatItems = query.trim()
    ? SEARCH_ITEMS.filter(i =>
        i.name.toLowerCase().includes(query.toLowerCase()) ||
        i.group.toLowerCase().includes(query.toLowerCase())
      )
    : PINNED;

  // Group by category
  const grouped = flatItems.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  function go(path) {
    navigate(path);
    onClose();
  }

  function handleKey(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flatItems[activeIdx]) go(flatItems[activeIdx].path);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div className="yd-cmd-overlay" onClick={onClose}>
      <div
        className="yd-cmd-modal"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKey}
      >
        {/* ── Search input ────────────────────────────────────────── */}
        <div className="yd-cmd-input-wrap">
          <Search className="yd-cmd-search-icon" size={16} strokeWidth={2.5} />
          <input
            ref={inputRef}
            className="yd-cmd-input"
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(0); }}
            placeholder="Search pages and features…"
          />
          <kbd className="yd-cmd-esc">esc</kbd>
        </div>

        {/* ── Results ─────────────────────────────────────────────── */}
        <div className="yd-cmd-results">
          {flatItems.length === 0 ? (
            <div className="yd-cmd-empty">
              No results for <strong>"{query}"</strong>
            </div>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <div className="yd-cmd-group-label">
                  {!query.trim() && group === "Core" ? "Quick access" : group}
                </div>
                {items.map(item => {
                  const idx = flatItems.indexOf(item);
                  return (
                    <button
                      key={item.path}
                      className={`yd-cmd-item${idx === activeIdx ? " yd-cmd-item--active" : ""}`}
                      onClick={() => go(item.path)}
                      onMouseEnter={() => setActiveIdx(idx)}
                    >
                      <span className="yd-cmd-item-icon">{item.icon}</span>
                      <span className="yd-cmd-item-name">{item.name}</span>
                      <span className="yd-cmd-item-group">{item.group}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* ── Keyboard hints ──────────────────────────────────────── */}
        <div className="yd-cmd-footer">
          <span className="yd-cmd-footer-hint">
            <kbd className="yd-cmd-key">↑</kbd>
            <kbd className="yd-cmd-key">↓</kbd>
            navigate
          </span>
          <span className="yd-cmd-footer-hint">
            <kbd className="yd-cmd-key">↵</kbd>
            open
          </span>
          <span className="yd-cmd-footer-hint">
            <kbd className="yd-cmd-key">esc</kbd>
            close
          </span>
          <span style={{ marginLeft: "auto", opacity: 0.5 }}>
            {flatItems.length} result{flatItems.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// NOTIFICATION PANEL
// ══════════════════════════════════════════════════════════════════════════
function NotifPanel({ onClose }) {
  // Placeholder — real notifications wired when backend provides them
  const MOCK_NOTIFS = [];

  return (
    <div className="yd-tb-dropdown" style={{ width: 300, right: 0 }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 12px 8px",
        borderBottom: "1px solid var(--yd-border-light)",
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--yd-charcoal)" }}>
          Notifications
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "2px 7px",
          borderRadius: "var(--yd-radius-full)",
          background: "var(--yd-yellow-light)",
          color: "var(--yd-charcoal)",
          border: "1px solid var(--yd-yellow)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}>
          Soon
        </span>
      </div>

      {/* Empty state */}
      {MOCK_NOTIFS.length === 0 && (
        <div style={{
          padding: "32px 20px",
          textAlign: "center",
          color: "var(--yd-text-muted)",
        }}>
          <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.5 }}>🔔</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--yd-text-soft)", marginBottom: 4 }}>
            All caught up
          </div>
          <div style={{ fontSize: 11 }}>
            No new notifications
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        padding: "8px 12px",
        borderTop: "1px solid var(--yd-border-light)",
        display: "flex",
        justifyContent: "center",
      }}>
        <button style={{
          fontSize: 11, fontWeight: 600, color: "var(--yd-text-muted)",
          background: "none", border: "none", cursor: "pointer",
          fontFamily: "var(--yd-font)",
        }}>
          Notification preferences
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// CENTER SWITCHER
// ══════════════════════════════════════════════════════════════════════════
function CenterSwitcherBtn({ center, open, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        height: 30, padding: "0 9px",
        borderRadius: "var(--yd-radius-sm)",
        border: "1px solid var(--yd-border)",
        background: open ? "var(--yd-yellow-light)" : "var(--yd-soft)",
        cursor: "pointer",
        fontFamily: "var(--yd-font)",
        transition: "all var(--yd-duration-fast) var(--yd-ease)",
      }}
    >
      <span style={{ fontSize: 11 }}>📍</span>
      <span style={{
        fontSize: 11, fontWeight: 600,
        color: "var(--yd-text-warm)",
        maxWidth: 120, overflow: "hidden",
        textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {formatCenter(center)}
      </span>
      <ChevronDownLucide
        size={10}
        strokeWidth={2.5}
        style={{
          color: "var(--yd-text-muted)",
          transform: open ? "rotate(180deg)" : "none",
          transition: "transform 0.18s",
          flexShrink: 0,
        }}
      />
    </button>
  );
}

function CenterBadge({ center }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      height: 26, padding: "0 8px",
      borderRadius: "var(--yd-radius-sm)",
      background: "var(--yd-soft)",
      border: "1px solid var(--yd-border)",
    }}>
      <span style={{ fontSize: 10 }}>📍</span>
      <span style={{
        fontSize: 11, fontWeight: 600,
        color: "var(--yd-text-warm)",
      }}>
        {formatCenter(center)}
      </span>
    </div>
  );
}

function CenterDropdown({ centers, active, onSelect }) {
  return (
    <div className="yd-tb-dropdown" style={{ width: 220, right: 0 }}>
      <div style={{ padding: "8px 10px 6px" }}>
        <div style={{
          fontSize: 9, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.08em", color: "var(--yd-text-muted)",
          marginBottom: 6,
        }}>
          Switch center
        </div>
        {centers.map(c => {
          const id = typeof c === "string" ? c : c.id || c;
          const isActive = id === active;
          return (
            <button
              key={id}
              className="yd-tb-drop-item"
              onClick={() => onSelect(id)}
              style={{
                background: isActive ? "var(--yd-yellow-light)" : undefined,
                fontWeight: isActive ? 700 : 500,
              }}
            >
              <span style={{ fontSize: 13 }}>📍</span>
              <span style={{ flex: 1 }}>{formatCenter(id)}</span>
              {isActive && (
                <Check size={14} strokeWidth={2.5} style={{ color: "var(--yd-yellow-dark)", flexShrink: 0 }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// DEV BADGE
// ══════════════════════════════════════════════════════════════════════════
function DevBadge({ isSimulating, devRole }) {
  const label = isSimulating
    ? `DEV · ${ROLE_LABELS[devRole] || devRole}`
    : "DEV";

  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      height: 26, padding: "0 9px",
      borderRadius: "var(--yd-radius-sm)",
      background: isSimulating
        ? "linear-gradient(135deg, #1D4ED8, #2563EB)"
        : "var(--yd-charcoal)",
      color: isSimulating ? "#fff" : "var(--yd-yellow)",
      fontSize: 10, fontWeight: 800,
      letterSpacing: "0.05em",
      textTransform: "uppercase",
      userSelect: "none",
      flexShrink: 0,
      boxShadow: isSimulating
        ? "0 2px 8px rgba(37,99,235,0.30)"
        : "0 2px 6px rgba(0,0,0,0.20)",
    }}>
      <span style={{ fontSize: 11 }}>🔧</span>
      <span>{label}</span>
      {!isSimulating && (
        <span style={{
          fontSize: 8, fontWeight: 900, letterSpacing: "0.06em",
          background: "var(--yd-yellow)", color: "var(--yd-black)",
          borderRadius: 3, padding: "1px 4px",
        }}>
          FULL
        </span>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// AVATAR
// ══════════════════════════════════════════════════════════════════════════
function Avatar({ user, size = 28, radius = 7 }) {
  const [imgErr, setImgErr] = useState(false);

  const initials = (user?.name || "U")
    .split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();

  const base = {
    width: size, height: size, borderRadius: radius,
    objectFit: "cover", flexShrink: 0, display: "block",
  };

  if (user?.photoUrl && !imgErr) {
    return (
      <img
        src={user.photoUrl}
        alt={user?.name || "avatar"}
        style={base}
        onError={() => setImgErr(true)}
      />
    );
  }

  return (
    <div style={{
      ...base,
      background: "var(--yd-yellow)",
      color: "var(--yd-black)",
      fontSize: Math.round(size * 0.36),
      fontWeight: 800,
      display: "flex", alignItems: "center", justifyContent: "center",
      letterSpacing: "-0.02em",
    }}>
      {initials}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// ROLE BADGE (inside profile dropdown)
// ══════════════════════════════════════════════════════════════════════════
function RoleBadge({ role, devRole }) {
  const isSimulating = !!devRole;
  const label = ROLE_LABELS[devRole || role] || role || "User";

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 9, fontWeight: 800,
      padding: "2px 7px", borderRadius: "var(--yd-radius-full)",
      textTransform: "uppercase", letterSpacing: "0.06em",
      background: isSimulating ? "#EFF6FF" : "var(--yd-charcoal)",
      color: isSimulating ? "#1D4ED8" : "var(--yd-yellow)",
      border: isSimulating ? "1px solid #BFDBFE" : "none",
    }}>
      {isSimulating && <span style={{ fontSize: 9 }}>🔧</span>}
      {label}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// PROFILE DROPDOWN
// ══════════════════════════════════════════════════════════════════════════
function ProfileDropdown({ user, role, devRole, onClose, onLogout, navigate, hasMultiCenter }) {
  function go(path) {
    onClose();
    navigate(path);
  }

  return (
    <div className="yd-tb-dropdown" style={{ width: 240, right: 0 }}>
      {/* User header */}
      <div className="yd-tb-drop-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Avatar user={user} size={40} radius={10} />
          <div style={{ minWidth: 0 }}>
            <div className="yd-tb-drop-name" style={{ marginBottom: 2 }}>
              {user?.name || "User"}
            </div>
            <div className="yd-tb-drop-email">
              {user?.email || ""}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <RoleBadge role={role} devRole={devRole} />
          {user?.activeCenter && (
            <span style={{
              fontSize: 9, fontWeight: 600,
              padding: "2px 6px", borderRadius: "var(--yd-radius-full)",
              background: "var(--yd-yellow-light)",
              color: "var(--yd-text-warm)",
              border: "1px solid var(--yd-yellow)",
              textTransform: "uppercase", letterSpacing: "0.04em",
            }}>
              📍 {formatCenter(user.activeCenter)}
            </span>
          )}
        </div>
      </div>

      {/* Navigation links */}
      <div style={{ padding: "4px" }}>
        <DropdownBtn icon="👤" label="My Profile"        onClick={() => go("/profile")} />
        <DropdownBtn icon="🔒" label="Security Settings" onClick={() => go("/settings/security")} />
        {hasMultiCenter && (
          <DropdownBtn icon="📍" label="Switch Center" onClick={() => go("/select-center")} />
        )}
      </div>

      <div className="yd-tb-drop-sep" />

      {/* Sign out */}
      <div style={{ padding: "4px" }}>
        <DropdownBtn
          icon="🚪" label="Sign Out"
          onClick={() => { onClose(); onLogout(); }}
          danger
        />
      </div>
    </div>
  );
}

function DropdownBtn({ icon, label, onClick, badge, danger }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      className={`yd-tb-drop-item${danger ? " yd-tb-drop-item--danger" : ""}`}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ background: hover ? (danger ? "var(--yd-danger-soft)" : "var(--yd-soft)") : "transparent" }}
    >
      <span style={{ fontSize: 14, width: 20, textAlign: "center", flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span style={{
          fontSize: 9, fontWeight: 800, padding: "1px 6px",
          borderRadius: "var(--yd-radius-full)",
          background: "var(--yd-yellow-light)",
          color: "var(--yd-charcoal)",
          border: "1px solid var(--yd-yellow)",
          textTransform: "uppercase", letterSpacing: "0.04em",
        }}>
          {badge}
        </span>
      )}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// ICONS
// ══════════════════════════════════════════════════════════════════════════
function SearchIcon() {
  return <Search size={14} strokeWidth={2.5} />;
}

function BellIcon() {
  return <Bell size={16} strokeWidth={2} />;
}

function ChevronDown({ open }) {
  return (
    <ChevronDownLucide
      size={12}
      strokeWidth={2.5}
      className={`yd-tb-chevron${open ? " yd-tb-chevron--open" : ""}`}
    />
  );
}

function HamburgerIcon() {
  return <Menu size={18} strokeWidth={2} />;
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN TOPBAR
// ══════════════════════════════════════════════════════════════════════════
export default function Topbar({ onMenuToggle }) {
  const { user, role, devRole, logout, isDeveloper, setDevRole, selectCenter } = useAuth();
  const navigate = useNavigate();

  // Open/close state for each panel
  const [cmdOpen,     setCmdOpen]     = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen,   setNotifOpen]   = useState(false);
  const [centerOpen,  setCenterOpen]  = useState(false);

  // Refs for outside-click detection
  const profileRef = useRef(null);
  const notifRef   = useRef(null);
  const centerRef  = useRef(null);

  useClickOutside(profileRef, useCallback(() => setProfileOpen(false), []));
  useClickOutside(notifRef,   useCallback(() => setNotifOpen(false),   []));
  useClickOutside(centerRef,  useCallback(() => setCenterOpen(false),  []));

  // Global ⌘K / Ctrl+K shortcut
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(o => !o);
      }
      if (e.key === "Escape") {
        setProfileOpen(false);
        setNotifOpen(false);
        setCenterOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Derived values
  const firstName      = user?.name?.split(" ")[0] || "there";
  const isDevMode      = isBypassRole(user?.role);
  const isSimulating   = !!devRole;
  const centers        = user?.centers || [];
  const hasMultiCenter = centers.length > 1;

  // Handle center switch
  async function handleCenterSelect(centerId) {
    setCenterOpen(false);
    if (centerId === user?.activeCenter) return;
    try {
      await selectCenter(centerId);
    } catch {
      // If selectCenter fails, navigate to picker
      navigate("/select-center");
    }
  }

  return (
    <>
      {/* ── Topbar bar ──────────────────────────────────────────────── */}
      <header className="yd-tb">

        {/* ── LEFT: hamburger + search ──────────────────────────────── */}
        <div className="yd-tb-left">

          {/* Mobile menu toggle (shown via CSS on small screens) */}
          {onMenuToggle && (
            <button
              className="yd-tb-menu-btn"
              onClick={onMenuToggle}
              aria-label="Toggle sidebar"
            >
              <HamburgerIcon />
            </button>
          )}

          {/* Global search trigger */}
          <button
            className="yd-tb-search-btn"
            onClick={() => setCmdOpen(true)}
            aria-label="Search (⌘K)"
          >
            <SearchIcon />
            <span className="yd-tb-search-text">Search pages and features…</span>
            <kbd className="yd-tb-search-hint">⌘K</kbd>
          </button>
        </div>

        {/* ── RIGHT: badges, bell, profile ─────────────────────────── */}
        <div className="yd-tb-right">

          {/* Developer badge */}
          {isDevMode && (
            <div className="yd-tb-dev-badge">
              <DevBadge isSimulating={isSimulating} devRole={devRole} />
            </div>
          )}

          {/* Center switcher / badge */}
          {user?.activeCenter && (
            hasMultiCenter ? (
              <div ref={centerRef} className="yd-tb-center-wrap" style={{ position: "relative" }}>
                <CenterSwitcherBtn
                  center={user.activeCenter}
                  open={centerOpen}
                  onClick={() => { setCenterOpen(o => !o); setProfileOpen(false); setNotifOpen(false); }}
                />
                {centerOpen && (
                  <CenterDropdown
                    centers={centers}
                    active={user.activeCenter}
                    onSelect={handleCenterSelect}
                  />
                )}
              </div>
            ) : (
              <div className="yd-tb-center-badge">
                <CenterBadge center={user.activeCenter} />
              </div>
            )
          )}

          {/* Visual separator */}
          <div className="yd-tb-divider" />

          {/* Notification bell */}
          <div ref={notifRef} style={{ position: "relative" }}>
            <button
              className="yd-tb-icon-btn"
              onClick={() => { setNotifOpen(o => !o); setProfileOpen(false); setCenterOpen(false); }}
              aria-label="Notifications"
            >
              <BellIcon />
              {/* Unread indicator dot */}
              <span className="yd-tb-notif-dot" />
            </button>
            {notifOpen && (
              <NotifPanel onClose={() => setNotifOpen(false)} />
            )}
          </div>

          {/* Profile button + dropdown */}
          <div ref={profileRef} className="yd-tb-profile-wrap">
            <button
              className="yd-tb-profile-btn"
              onClick={() => { setProfileOpen(o => !o); setNotifOpen(false); setCenterOpen(false); }}
              aria-label="Profile menu"
            >
              <Avatar user={user} size={28} radius={7} />
              <span className="yd-tb-profile-name">{firstName}</span>
              <ChevronDown open={profileOpen} />
            </button>

            {profileOpen && (
              <ProfileDropdown
                user={user}
                role={role}
                devRole={devRole}
                onClose={() => setProfileOpen(false)}
                onLogout={logout}
                navigate={navigate}
                hasMultiCenter={hasMultiCenter}
              />
            )}
          </div>
        </div>
      </header>

      {/* ── Command palette portal ───────────────────────────────────── */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </>
  );
}
