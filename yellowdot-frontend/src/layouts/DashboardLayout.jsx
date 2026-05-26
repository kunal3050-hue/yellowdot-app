import { useState, useEffect, useRef, useCallback } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { ToastProvider } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";

/* ── SVG Icons ──────────────────────────────────────────────────────── */

const I = ({ d, size = 16, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
    strokeLinejoin="round" {...p}>{d}</svg>
);

const HomeIcon        = () => <I d={<><path d="M2 6.5L8 2l6 4.5V14a1 1 0 01-1 1H3a1 1 0 01-1-1V6.5z"/><path d="M6 15V9h4v6"/></>} />;
const UsersIcon       = () => <I d={<><circle cx="6" cy="5" r="2.5"/><path d="M1 14c0-3 2-4.5 5-4.5s5 1.5 5 4.5"/><path d="M11 7.5c1.5 0 3 .8 3 3.5"/><path d="M12.5 3a2 2 0 010 4"/></>} />;
const CalendarIcon    = () => <I d={<><rect x="1.5" y="2.5" width="13" height="12" rx="2"/><path d="M5 1v3M11 1v3M1.5 7h13"/></>} />;
const CreditCardIcon  = () => <I d={<><rect x="1" y="3.5" width="14" height="10" rx="2"/><path d="M1 7h14M4.5 11h3"/></>} />;
const DocumentIcon    = () => <I d={<><path d="M9 1H3a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1V6L9 1z"/><path d="M9 1v5h5M5 9h6M5 12h4"/></>} />;
const BarChartIcon    = () => <I d={<><path d="M2 14V9M6 14V5M10 14V8M14 14V2"/><path d="M1 14h14"/></>} />;
const MoonIcon        = () => <I d={<><path d="M13 9A6 6 0 117 2.1 4.5 4.5 0 0013 9z"/></>} />;
const UtensilsIcon    = () => <I d={<><path d="M4 1v5a2 2 0 004 0V1M6 6v9M11 1v14M13 1v4a2 2 0 01-4 0V1"/></>} />;
const ClipboardIcon   = () => <I d={<><path d="M10.5 2H12a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1h1.5"/><rect x="5.5" y="1" width="5" height="2.5" rx="1"/><path d="M5.5 8h5M5.5 11h3"/></>} />;
const UserCheckIcon   = () => <I d={<><circle cx="6" cy="5" r="3"/><path d="M1 14c0-3 2-4.5 5-4.5"/><path d="M10 11l2 2 3-3"/></>} />;
const CarIcon         = () => <I d={<><path d="M3 10l1.5-4.5A1 1 0 015.4 5h5.2a1 1 0 01.9.5L13 10"/><rect x="1" y="10" width="14" height="4" rx="1"/><circle cx="4" cy="14" r="1"/><circle cx="12" cy="14" r="1"/></>} />;
const HistoryIcon     = () => <I d={<><path d="M1 8a7 7 0 107 7"/><path d="M1 4v4h4"/><path d="M8 5v3.5l2.5 1.5"/></>} />;
const VideoIcon       = () => <I d={<><rect x="1" y="4" width="10" height="8" rx="1.5"/><path d="M11 7l4-2v6l-4-2V7z"/></>} />;
const CameraIcon      = () => <I d={<><path d="M14 12a1 1 0 01-1 1H3a1 1 0 01-1-1V6a1 1 0 011-1h2l1.5-2h3L11 5h2a1 1 0 011 1v6z"/><circle cx="8" cy="8.5" r="2"/></>} />;
const DoorIcon        = () => <I d={<><rect x="3" y="1" width="10" height="14" rx="1"/><circle cx="10" cy="8" r="1"/><path d="M3 8h4"/></>} />;
const SearchIcon      = () => <I d={<><circle cx="7" cy="7" r="4.5"/><path d="M11 11l3 3"/></>} />;
const BellIcon        = () => <I d={<><path d="M8 1.5a5 5 0 015 5v3l1.5 2H1.5L3 9.5v-3a5 5 0 015-5z"/><path d="M6 13.5a2 2 0 004 0"/></>} />;
const ChevronDownIcon = () => <I d={<><path d="M4 6l4 4 4-4"/></>} />;
const MenuIcon        = () => <I d={<><path d="M2 4h12M2 8h12M2 12h12"/></>} />;
const CollapseIcon    = () => <I d={<><path d="M10 4L6 8l4 4"/></>} />;
const ExpandIcon      = () => <I d={<><path d="M6 4l4 4-4 4"/></>} />;
const MigrateIcon     = () => <I d={<><path d="M2 8h8M7 5l3 3-3 3"/><circle cx="13" cy="8" r="2"/></>} />;
const ProfileIcon     = () => <I d={<><circle cx="8" cy="5.5" r="3"/><path d="M2 14c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/></>} />;
const SettingsIcon    = () => <I d={<><circle cx="8" cy="8" r="2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M3.1 12.9l1.4-1.4M11.5 4.5l1.4-1.4"/></>} />;
const LogOutIcon      = () => <I d={<><path d="M10 3h3a1 1 0 011 1v8a1 1 0 01-1 1h-3M7 11l3-3-3-3M10 8H2"/></>} />;

/* ── Navigation config ─────────────────────────────────────────────── */

const NAV_GROUPS = [
  {
    label: "Core",
    items: [
      { name: "Dashboard",   path: "/",           icon: HomeIcon,       end: true },
      { name: "Students",    path: "/students",   icon: UsersIcon },
      { name: "Attendance",  path: "/attendance", icon: CalendarIcon },
    ],
  },
  {
    label: "Finance",
    items: [
      { name: "Fees",      path: "/fees",       icon: CreditCardIcon },
      { name: "Invoices",  path: "/invoice",    icon: DocumentIcon },
      { name: "Analytics", path: "/analytics",  icon: BarChartIcon },
    ],
  },
  {
    label: "Daily Ops",
    items: [
      { name: "Nap Tracker",       path: "/nap-tracker",          icon: MoonIcon },
      { name: "Food Menu",         path: "/food-menu",            icon: UtensilsIcon },
      { name: "Food Consumption",  path: "/food-consumption",     icon: ClipboardIcon },
      { name: "Pickup Migration",  path: "/pickup-migration",     icon: MigrateIcon },
    ],
  },
  {
    label: "Presence & Safety",
    items: [
      { name: "Attendance",        path: "/attendance",           icon: UserCheckIcon },
      { name: "Parent Entry",      path: "/parent-checkin",       icon: UserCheckIcon },
      { name: "Pickup",            path: "/pickup-authorization", icon: CarIcon },
      { name: "Pickup History",    path: "/pickup-history",       icon: HistoryIcon },
      { name: "Staff Checkout",    path: "/staff-checkout",       icon: DoorIcon   },
    ],
  },
  {
    label: "Security",
    items: [
      { name: "Live CCTV",      path: "/live-cctv",       icon: VideoIcon  },
      { name: "CCTV Settings",  path: "/cctv-settings",   icon: CameraIcon },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap(g => g.items.map(i => ({ ...i, group: g.label })));

/* ── Hooks ─────────────────────────────────────────────────────────── */

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = e => setMatches(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

function useSidebar() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("yd_sidebar_collapsed") === "true"
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapse = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("yd_sidebar_collapsed", String(next));
      return next;
    });
  }, []);

  return { collapsed, toggleCollapse, mobileOpen, setMobileOpen };
}

/* ── Sidebar ────────────────────────────────────────────────────────── */

function Sidebar({ collapsed, mobileOpen, isMobile, onClose, onToggleCollapse }) {
  const { user } = useAuth();

  const cls = [
    "yd-sl",
    collapsed && !isMobile ? "yd-sl--collapsed" : "",
    isMobile && mobileOpen ? "yd-sl--mobile-open" : "",
  ].filter(Boolean).join(" ");

  const displayName = user?.name || user?.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <aside className={cls}>
      {/* Logo */}
      <div className="yd-sl-logo">
        <div className="yd-sl-logo-mark">Y</div>
        <div className="yd-sl-logo-text">
          <div className="yd-sl-logo-name">Yellow Dot</div>
          <div className="yd-sl-logo-sub">Preschool CRM</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="yd-sl-nav">
        {NAV_GROUPS.map(group => (
          <div key={group.label} className="yd-sl-group">
            <div className="yd-sl-group-label">{group.label}</div>
            <div className="yd-sl-items">
              {group.items.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  className={({ isActive }) =>
                    "yd-sl-item" + (isActive ? " active" : "")
                  }
                  onClick={isMobile ? onClose : undefined}
                  title={collapsed && !isMobile ? item.name : undefined}
                >
                  <span className="yd-sl-item-icon">
                    <item.icon />
                  </span>
                  <span className="yd-sl-item-label">{item.name}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="yd-sl-footer">
        <NavLink
          to="/profile"
          className="yd-sl-profile"
          onClick={isMobile ? onClose : undefined}
          title={collapsed && !isMobile ? displayName : undefined}
        >
          <MiniAvatar initials={initials} />
          <div className="yd-sl-profile-info">
            <div className="yd-sl-profile-name">{displayName}</div>
            <div className="yd-sl-profile-role">Staff</div>
          </div>
        </NavLink>

        <button
          className="yd-sl-collapse-btn"
          onClick={onToggleCollapse}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ExpandIcon /> : <CollapseIcon />}
        </button>
      </div>
    </aside>
  );
}

/* ── MiniAvatar ─────────────────────────────────────────────────────── */

function MiniAvatar({ initials, size = 28 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 7,
        background: "var(--yd-yellow)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        fontWeight: 800,
        color: "var(--yd-black)",
        flexShrink: 0,
        letterSpacing: "-0.3px",
      }}
    >
      {initials}
    </div>
  );
}

/* ── Topbar ─────────────────────────────────────────────────────────── */

function Topbar({ onMenuOpen, onSearch }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef(null);

  const displayName = user?.name || user?.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!dropOpen) return;
    function handler(e) {
      if (!dropRef.current?.contains(e.target)) setDropOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropOpen]);

  return (
    <header className="yd-tb">
      <div className="yd-tb-left">
        <button
          className="yd-tb-menu-btn"
          onClick={onMenuOpen}
          aria-label="Open menu"
        >
          <MenuIcon />
        </button>

        <button className="yd-tb-search-btn" onClick={onSearch}>
          <SearchIcon size={14} />
          <span className="yd-tb-search-text">Search or jump to…</span>
          <span className="yd-tb-search-hint">⌘K</span>
        </button>
      </div>

      <div className="yd-tb-right">
        <button
          className="yd-tb-icon-btn"
          aria-label="Notifications"
          title="Notifications"
        >
          <BellIcon />
          <span className="yd-tb-notif-dot" />
        </button>

        <div className="yd-tb-divider" />

        <div className="yd-tb-profile-wrap" ref={dropRef}>
          <button
            className="yd-tb-profile-btn"
            onClick={() => setDropOpen(o => !o)}
          >
            <MiniAvatar initials={initials} size={26} />
            <span className="yd-tb-profile-name">{displayName}</span>
            <span className={`yd-tb-chevron${dropOpen ? " yd-tb-chevron--open" : ""}`}>
              <ChevronDownIcon />
            </span>
          </button>

          {dropOpen && (
            <div className="yd-tb-dropdown">
              <div className="yd-tb-drop-header">
                <div className="yd-tb-drop-name">{displayName}</div>
                {user?.email && (
                  <div className="yd-tb-drop-email">{user.email}</div>
                )}
              </div>

              <button
                className="yd-tb-drop-item"
                onClick={() => { setDropOpen(false); navigate("/profile"); }}
              >
                <ProfileIcon /> My Profile
              </button>
              <button
                className="yd-tb-drop-item"
                onClick={() => { setDropOpen(false); navigate("/settings/security"); }}
              >
                <SettingsIcon /> Security Settings
              </button>

              <div className="yd-tb-drop-sep" />

              <button
                className="yd-tb-drop-item yd-tb-drop-item--danger"
                onClick={() => logout()}
              >
                <LogOutIcon /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/* ── Search / Command palette ──────────────────────────────────────── */

function SearchModal({ onClose }) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const filtered = query.trim()
    ? ALL_ITEMS.filter(i =>
        i.name.toLowerCase().includes(query.toLowerCase()) ||
        i.group.toLowerCase().includes(query.toLowerCase())
      )
    : ALL_ITEMS;

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setCursor(0); }, [query]);

  function go(item) {
    navigate(item.path);
    onClose();
  }

  function handleKey(e) {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor(c => Math.min(c + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor(c => Math.max(c - 1, 0));
    } else if (e.key === "Enter" && filtered[cursor]) {
      go(filtered[cursor]);
    }
  }

  const showGroups = !query.trim();

  return (
    <div className="yd-cmd-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="yd-cmd-modal" role="dialog" aria-label="Search">
        <div className="yd-cmd-input-wrap">
          <span className="yd-cmd-search-icon"><SearchIcon size={16} /></span>
          <input
            ref={inputRef}
            className="yd-cmd-input"
            placeholder="Search pages…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
          />
          <span className="yd-cmd-esc">esc</span>
        </div>

        <div className="yd-cmd-results">
          {filtered.length === 0 ? (
            <div className="yd-cmd-empty">No pages match "{query}"</div>
          ) : showGroups ? (
            NAV_GROUPS.map(group => {
              const items = filtered.filter(i => i.group === group.label);
              if (!items.length) return null;
              return (
                <div key={group.label}>
                  <div className="yd-cmd-group-label">{group.label}</div>
                  {items.map((item, _) => {
                    const idx = filtered.indexOf(item);
                    return (
                      <CmdItem
                        key={item.path}
                        item={item}
                        active={idx === cursor}
                        onClick={() => go(item)}
                        onHover={() => setCursor(idx)}
                      />
                    );
                  })}
                </div>
              );
            })
          ) : (
            filtered.map((item, idx) => (
              <CmdItem
                key={item.path}
                item={item}
                active={idx === cursor}
                showGroup
                onClick={() => go(item)}
                onHover={() => setCursor(idx)}
              />
            ))
          )}
        </div>

        <div className="yd-cmd-footer">
          <span className="yd-cmd-footer-hint">
            <span className="yd-cmd-key">↑</span>
            <span className="yd-cmd-key">↓</span>
            navigate
          </span>
          <span className="yd-cmd-footer-hint">
            <span className="yd-cmd-key">↵</span>
            select
          </span>
          <span className="yd-cmd-footer-hint">
            <span className="yd-cmd-key">esc</span>
            close
          </span>
        </div>
      </div>
    </div>
  );
}

function CmdItem({ item, active, showGroup, onClick, onHover }) {
  const ref = useRef(null);
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <div
      ref={ref}
      className={`yd-cmd-item${active ? " yd-cmd-item--active" : ""}`}
      onClick={onClick}
      onMouseEnter={onHover}
    >
      <span className="yd-cmd-item-icon"><item.icon /></span>
      <span className="yd-cmd-item-name">{item.name}</span>
      {showGroup && (
        <span className="yd-cmd-item-group">{item.group}</span>
      )}
    </div>
  );
}

/* ── DashboardLayout ───────────────────────────────────────────────── */

export default function DashboardLayout({ children }) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { collapsed, toggleCollapse, mobileOpen, setMobileOpen } = useSidebar();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function handler(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <ToastProvider>
      <div className="yd-layout">
        {isMobile && mobileOpen && (
          <div
            className="yd-sl-backdrop"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <Sidebar
          collapsed={isMobile ? false : collapsed}
          mobileOpen={mobileOpen}
          isMobile={isMobile}
          onClose={() => setMobileOpen(false)}
          onToggleCollapse={toggleCollapse}
        />

        <div className="yd-layout-body">
          <Topbar
            onMenuOpen={() => setMobileOpen(true)}
            onSearch={() => setSearchOpen(true)}
          />
          <main className="yd-layout-content">
            {children}
          </main>
        </div>
      </div>

      {searchOpen &&
        createPortal(
          <SearchModal onClose={() => setSearchOpen(false)} />,
          document.body
        )}
    </ToastProvider>
  );
}
