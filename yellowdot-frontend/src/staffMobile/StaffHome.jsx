/**
 * StaffHome.jsx — Staff Home: mobile-first shell, Parent Home's visual language
 * ─────────────────────────────────────────────────────────────────────
 * Step 1 of the Staff Home plan (2026-07-31): reproduce Parent Home's
 * overall mobile-first experience for Staff — mobile header, greeting/
 * staff-identity area, feed/card layout, bottom navigation (Home/Care/
 * Profile) — as one clean, common experience. No Teacher/Reception/
 * Accountant/Principal/Centre Owner variants, no new role permissions,
 * no "Staff App Controls" panel, no destination-module redesign. How
 * permissions populate this shell further is a deliberately separate,
 * later decision.
 *
 * Structurally parallel to modules/parent/components/ParentLayout.jsx
 * (fixed translucent top bar, scrollable centered content, floating
 * rounded bottom dock) but Staff-owned end to end and completely
 * separate: built from theme/staffMobile tokens only (a hand-duplicated
 * copy of Parent's theme, not an import), zero imports from
 * modules/parent/. Parent Home is not modified by this file in any way.
 *
 * Tabs are fixed (Home / Care / Profile) and switched via local state,
 * not routing — all three live under the single /staff-mobile route.
 * Permission-driven variation happens INSIDE each tab's content
 * (HomeFeed/CareFeed already resolve the signed-in user's capabilities
 * via the existing Widget/Task Engine hooks, reused as-is) — this shell
 * itself holds no role branching, same "no role branch in this file"
 * discipline Dashboard.jsx/Care.jsx already state.
 */
import { useState } from "react";
import { Home, CheckSquare, User } from "lucide-react";
import { colors, spacing, radius, shadows, typography, layout } from "../theme/staffMobile";
import { PLATFORM_NAME } from "../config/environment";
import { useAuth } from "../contexts/AuthContext";
import HomeFeed from "./HomeFeed";
import CareFeed from "./CareFeed";
import ProfileTab from "./ProfileTab";

// Care is the center, raised/emphasized tab — same treatment and position
// (middle of three) as Parent Home's "Daily Care" dock button. Matches
// semantically too: Care is each app's primary "go do something" hub.
const TABS = [
  { id: "home",    label: "Home",    icon: Home,        Content: HomeFeed },
  { id: "care",    label: "Care",    icon: CheckSquare, Content: CareFeed, center: true },
  { id: "profile", label: "Profile", icon: User,        Content: ProfileTab },
];

export default function StaffHome() {
  const [activeTab, setActiveTab] = useState("home");
  const { user } = useAuth();
  const firstName = (user?.name || "").split(" ")[0];
  const initial = (user?.name || "?").charAt(0).toUpperCase();

  const ActiveContent = TABS.find(t => t.id === activeTab)?.Content ?? HomeFeed;

  return (
    <div style={{ minHeight: "100vh", background: colors.surface.background, display: "flex", flexDirection: "column" }}>

      {/* ── Mobile header ───────────────────────────────────────────── */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        height: layout.topbarHeight,
        background: colors.surface.backgroundTranslucent,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: `1px solid ${colors.surface.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: `0 ${spacing.xl}px`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: radius.sm,
            background: colors.brand.gradient,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: typography.weight.extra, fontSize: typography.size.sm, color: colors.text.onYellow,
            boxShadow: shadows.primary,
          }}>{PLATFORM_NAME.charAt(0)}</div>
          <span style={{ fontWeight: typography.weight.bold, fontSize: typography.size.sm, color: colors.text.primary, letterSpacing: typography.tracking.tight }}>
            {PLATFORM_NAME}
          </span>
        </div>

        <button
          onClick={() => setActiveTab("profile")}
          style={{
            width: 32, height: 32, borderRadius: "50%",
            background: colors.brand.glowSoft,
            border: `1px solid ${colors.surface.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: typography.weight.bold, color: colors.yellow700,
            cursor: "pointer",
          }}
          aria-label={firstName ? `${firstName}'s profile` : "Profile"}
        >
          {initial}
        </button>
      </header>

      {/* ── Scrollable content ──────────────────────────────────────── */}
      <main style={{ flex: 1, marginTop: layout.topbarHeight, paddingBottom: 96, overflowY: "auto" }}>
        <div style={{ maxWidth: layout.contentMax, margin: "0 auto", padding: `0 0 ${spacing.md}px 0` }}>
          <ActiveContent />
        </div>
      </main>

      {/* ── Bottom navigation — floating dock ───────────────────────── */}
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
        {TABS.map(({ id, label, icon: Icon, center }) => {
          const active = activeTab === id;

          // ── Center "Care" — raised, emphasized primary tab ──
          if (center) {
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={{
                  flex: 1, position: "relative", border: "none", background: "none", cursor: "pointer",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "flex-end",
                  paddingBottom: 8,
                }}
              >
                <div style={{
                  position: "absolute", top: -24, left: "50%", transform: "translateX(-50%)",
                  width: 58, height: 58, borderRadius: radius.pill,
                  background: colors.brand.gradient,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: shadows.primary,
                  border: `3px solid ${colors.surface.card}`,
                }}>
                  <Icon size={24} strokeWidth={2.2} color={colors.text.onYellow} />
                </div>
                <span style={{
                  fontSize: 9.5, fontWeight: typography.weight.bold,
                  letterSpacing: typography.tracking.wide,
                  color: active ? colors.yellow700 : colors.yellow600,
                }}>{label}</span>
              </button>
            );
          }

          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 3,
                background: "none", border: "none", cursor: "pointer",
                color: active ? colors.yellow700 : colors.text.faint,
                position: "relative",
              }}
            >
              {active && (
                <div style={{
                  position: "absolute", top: "50%", left: "50%",
                  transform: "translate(-50%, -58%)",
                  width: 50, height: 34, borderRadius: 17,
                  background: colors.brand.glowSoft,
                  pointerEvents: "none",
                }} />
              )}
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8} style={{ position: "relative" }} />
              <span style={{
                fontSize: 9.5,
                fontWeight: active ? typography.weight.bold : typography.weight.medium,
                letterSpacing: typography.tracking.wide,
                position: "relative",
              }}>{label}</span>
              {active && (
                <div style={{
                  position: "absolute", bottom: 6,
                  width: 5, height: 5, borderRadius: radius.pill,
                  background: colors.brand.gradient,
                  boxShadow: shadows.primary,
                }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
