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
 *   │  Bottom tab bar    │  64px fixed — Home | Attendance | Fees | Profile
 *   └────────────────────┘
 *
 * V1 dock: Home · Attendance · Fees · Profile. No CCTV / Camera, no check-in.
 */

import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import { colors, spacing, radius, shadows, typography, layout } from "../theme";
import { useUnreadCount } from "../hooks/useNotifications";
import usePushNotifications from "../hooks/usePushNotifications";

// ── Design tokens — sourced from the centralized Parent Module theme ──────────
// No hardcoded colours: everything maps to theme variables so the app reads as
// Yellow Dot the moment it opens.
const T = {
  bg:      colors.surface.background,
  surface: colors.surface.card,
  border:  colors.surface.border,
  gold:    colors.yellow500,
  text:    colors.text.primary,
  text2:   colors.text.secondary,
  text3:   colors.text.faint,
  radius:  radius.card,
};

// ── Bottom tab definitions (V1) ───────────────────────────────────────────────
// 3 primary tabs. Daily Care is the central, emphasized hub (raised button).
const TABS = [
  { path: "/parent-home",       label: "Home",       icon: HomeIcon                  },
  { path: "/parent-daily-care", label: "Daily Care", icon: null,        center: true },
  { path: "/parent-profile",    label: "Profile",    icon: ProfileIcon               },
];

export default function ParentLayout({ children }) {
  const { user }    = useAuth();
  const { pathname } = useLocation();
  const { count: unreadCount } = useUnreadCount();

  // Register FCM push notification token once on session start.
  // The hook is fully safe: exits early if the browser doesn't support push,
  // if permission is denied, or if the VAPID key is not configured.
  usePushNotifications();

  const initials = (user?.name || "P").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column" }}>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        height: layout.topbarHeight,
        background: colors.surface.backgroundTranslucent,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center",
        padding: `0 ${spacing.xl}px`,
        justifyContent: "space-between",
      }}>
        {/* Logo mark */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: radius.sm,
            background: colors.brand.gradient,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: typography.weight.extra, fontSize: typography.size.sm, color: colors.text.onYellow,
            boxShadow: shadows.primary,
          }}>Y</div>
          <span style={{ fontWeight: typography.weight.bold, fontSize: typography.size.sm, color: T.text, letterSpacing: typography.tracking.tight }}>
            Yellow Dot
          </span>
        </div>

        {/* Right: notification bell + avatar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Bell icon with unread badge */}
          <Link to="/parent-notifications" style={{
            position: "relative",
            width: 34, height: 34, borderRadius: radius.sm,
            background: colors.surface.raised,
            border: `1px solid ${colors.surface.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            textDecoration: "none",
          }}>
            <BellIcon hasUnread={unreadCount > 0} />
            {unreadCount > 0 && (
              <span style={{
                position: "absolute", top: -5, right: -5,
                minWidth: 16, height: 16,
                background: colors.danger,
                color: colors.white,
                fontSize: 9,
                fontWeight: typography.weight.bold,
                borderRadius: radius.pill,
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "0 4px",
                border: `2px solid ${colors.surface.background}`,
                lineHeight: 1,
              }}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>

          <Link to="/parent-profile" style={{
            width: 34, height: 34, borderRadius: radius.sm,
            background: colors.brand.gradient,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: typography.weight.extra, fontSize: typography.size.xs, color: colors.text.onYellow,
            textDecoration: "none",
          }}>
            {initials}
          </Link>
        </div>
      </header>

      {/* ── Scrollable content ───────────────────────────────────────────── */}
      <main style={{
        flex: 1,
        marginTop: layout.topbarHeight,
        paddingBottom: 96,
        overflowY: "auto",
      }}>
        <div style={{
          maxWidth: layout.contentMax,
          margin: "0 auto",
          padding: `0 0 ${spacing.md}px 0`,
        }}>
          {children}
        </div>
      </main>

      {/* ── Floating iOS dock ───────────────────────────────────────────── */}
      <div style={{
        position: "fixed",
        bottom: `calc(${layout.safeBottom} + ${spacing.md}px)`,
        left: spacing.lg, right: spacing.lg, zIndex: 50,
        height: layout.dockHeight,
        background: colors.surface.backgroundTranslucent,
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
        borderRadius: radius["2xl"],
        boxShadow: shadows.lg,
        display: "flex", alignItems: "stretch",
      }}>
        {TABS.map(({ path, label, icon: Icon, center }) => {
          const active = pathname === path || (path !== "/parent-home" && pathname.startsWith(path));

          // ── Center "Daily Care" — raised, emphasized primary tab ──
          if (center) {
            return (
              <Link key={path} to={path} style={{
                flex: 1, position: "relative", textDecoration: "none",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "flex-end",
                paddingBottom: 8,
              }}>
                <div style={{
                  position: "absolute", top: -24, left: "50%", transform: "translateX(-50%)",
                  width: 58, height: 58, borderRadius: radius.pill,
                  background: colors.brand.gradient,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 28,
                  boxShadow: shadows.primary,
                  border: `3px solid ${colors.surface.card}`,
                }}>☀️</div>
                <span style={{
                  fontSize: 9.5, fontWeight: typography.weight.bold,
                  letterSpacing: typography.tracking.wide,
                  color: active ? colors.yellow700 : colors.yellow600,
                }}>{label}</span>
              </Link>
            );
          }

          return (
            <Link key={path} to={path} style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 3, textDecoration: "none",
              color: active ? colors.yellow700 : T.text3,
              transition: "color 0.18s",
              position: "relative",
              minHeight: 0,
            }}>
              {/* Active glow orb */}
              {active && (
                <div style={{
                  position: "absolute",
                  top: "50%", left: "50%",
                  transform: "translate(-50%, -58%)",
                  width: 50, height: 34,
                  borderRadius: 17,
                  background: colors.brand.glowSoft,
                  pointerEvents: "none",
                }} />
              )}
              <Icon active={active} />
              <span style={{
                fontSize: 9.5,
                fontWeight: active ? typography.weight.bold : typography.weight.medium,
                letterSpacing: typography.tracking.wide,
                position: "relative",
              }}>{label}</span>
              {/* Active dot */}
              {active && (
                <div style={{
                  position: "absolute", bottom: 6,
                  width: 5, height: 5, borderRadius: radius.pill,
                  background: colors.brand.gradient,
                  boxShadow: shadows.primary,
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

function BellIcon({ hasUnread }) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none"
      stroke={hasUnread ? colors.yellow600 : colors.gray500}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function HomeIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" {...SZ} strokeWidth={active ? "2.2" : "1.8"}>
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
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
