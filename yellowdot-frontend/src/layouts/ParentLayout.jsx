/**
 * ParentLayout.jsx — Premium mobile-first parent app shell
 * ──────────────────────────────────────────────────────────
 * Completely separate from the staff MainLayout.
 * Feels like a modern parenting app, not a school CRM.
 *
 * Structure:
 *   ┌────────────────────┐
 *   │  Top bar           │  48px — subtle, just logo + bell + avatar
 *   ├────────────────────┤
 *   │                    │
 *   │  Content           │  scrollable, warm ivory bg
 *   │                    │
 *   ├────────────────────┤
 *   │  Bottom tab bar    │  64px fixed — Home | Fees | Profile
 *   └────────────────────┘
 */

import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// ── Design tokens (all inline — no Tailwind dependency) ──────────────────────
const T = {
  bg:      "#fffdf7",
  surface: "#ffffff",
  border:  "#ece7d8",
  gold:    "#f0c930",
  text:    "#3d3325",
  text2:   "#8b7d65",
  text3:   "#b8a88e",
  radius:  20,
};

// ── Bottom tab definitions ────────────────────────────────────────────────────
const TABS = [
  { path: "/parent-home",   label: "Home",     icon: HomeIcon    },
  { path: "/parent-cctv",   label: "Camera",   icon: CameraIcon  },
  { path: "/fees",          label: "Fees",     icon: FeeIcon     },
  { path: "/profile",       label: "Profile",  icon: ProfileIcon },
];

export default function ParentLayout({ children }) {
  const { user } = useAuth();
  const { pathname } = useLocation();

  const initials = (user?.name || "P").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column" }}>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        height: 56,
        background: "rgba(255,253,247,0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center",
        padding: "0 20px",
        justifyContent: "space-between",
      }}>
        {/* Logo mark */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: "linear-gradient(135deg,#f9dc5a 0%,#f0c930 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 13, color: "#3d2f00",
            boxShadow: "0 2px 8px rgba(240,201,48,0.3)",
          }}>Y</div>
          <span style={{ fontWeight: 700, fontSize: 13, color: T.text, letterSpacing: "-0.2px" }}>
            Yellow Dot
          </span>
        </div>

        {/* Right: bell + avatar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button style={{
            width: 34, height: 34, borderRadius: 10, border: `1px solid ${T.border}`,
            background: T.surface, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: T.text2,
          }}>
            <BellIcon />
          </button>
          <Link to="/profile" style={{
            width: 34, height: 34, borderRadius: 10,
            background: "linear-gradient(135deg,#f9dc5a,#f0c930)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 11, color: "#3d2f00",
            textDecoration: "none",
          }}>
            {initials}
          </Link>
        </div>
      </header>

      {/* ── Scrollable content ───────────────────────────────────────────── */}
      <main style={{
        flex: 1,
        marginTop: 56,
        paddingBottom: 96,
        overflowY: "auto",
      }}>
        <div style={{
          maxWidth: 640,
          margin: "0 auto",
          padding: "0 0 12px 0",
        }}>
          {children}
        </div>
      </main>

      {/* ── Floating iOS dock ───────────────────────────────────────────── */}
      <div style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
        left: 16, right: 16, zIndex: 50,
        height: 62,
        background: "rgba(255,253,248,0.92)",
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
        borderRadius: 26,
        boxShadow: [
          "0 10px 44px rgba(140,110,40,0.18)",
          "0 2px 8px rgba(200,160,40,0.10)",
          "0 0 0 1px rgba(238,220,148,0.30)",
          "inset 0 1px 0 rgba(255,255,255,0.85)",
        ].join(","),
        display: "flex", alignItems: "stretch",
      }}>
        {TABS.map(({ path, label, icon: Icon }) => {
          const active = pathname === path || (path !== "/parent-home" && pathname.startsWith(path));
          return (
            <Link key={path} to={path} style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 3, textDecoration: "none",
              color: active ? "#a07810" : T.text3,
              transition: "color 0.18s",
              position: "relative",
            }}>
              {/* Active glow orb */}
              {active && (
                <div style={{
                  position: "absolute",
                  top: "50%", left: "50%",
                  transform: "translate(-50%, -58%)",
                  width: 50, height: 34,
                  borderRadius: 17,
                  background: "radial-gradient(ellipse, rgba(240,194,40,0.18) 0%, rgba(240,194,40,0.06) 70%, transparent 100%)",
                  pointerEvents: "none",
                }} />
              )}
              <Icon active={active} />
              <span style={{
                fontSize: 9.5,
                fontWeight: active ? 700 : 450,
                letterSpacing: "0.02em",
                position: "relative",
              }}>{label}</span>
              {/* Active dot */}
              {active && (
                <div style={{
                  position: "absolute", bottom: 6,
                  width: 5, height: 5, borderRadius: "50%",
                  background: "linear-gradient(135deg,#f9dc5a,#f0c228)",
                  boxShadow: "0 0 8px rgba(240,194,40,0.6)",
                }} />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────
const SZ = { width: 20, height: 20, fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" };

function HomeIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" {...SZ} strokeWidth={active ? "2.2" : "1.8"}>
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}
function CameraIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" {...SZ} strokeWidth={active ? "2.2" : "1.8"}>
      <path d="M2 7a2 2 0 012-2h2l1.5-2h7L17 5h2a2 2 0 012 2v11a2 2 0 01-2 2H4a2 2 0 01-2-2V7z" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  );
}
function FeeIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" {...SZ} strokeWidth={active ? "2.2" : "1.8"}>
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}
function ProfileIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" {...SZ} strokeWidth={active ? "2.2" : "1.8"}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}
