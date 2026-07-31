/**
 * StaffMobileLayout.jsx — Staff mobile app shell
 * ─────────────────────────────────────────────────────────────────────
 * Staff mobile feed — Parent-style UX plan (2026-07-31).
 *
 * Structurally parallel to modules/parent/components/ParentLayout.jsx
 * (fixed translucent top bar, scrollable centered content, floating
 * rounded bottom dock) but Staff-owned end to end: built from
 * theme/staffMobile tokens only, zero imports from modules/parent/.
 *
 * Tabs are fixed (Home / Care / Profile) and switched via local state,
 * not routing — all three live under the single /staff-mobile route
 * (confirmed decision, see the plan). Permission-driven variation
 * happens INSIDE each tab's content (HomeFeed/CareFeed resolve the
 * signed-in user's capabilities via the existing Widget/Task Engine
 * hooks) — this shell itself holds no role branching, same "no role
 * branch in this file" discipline Dashboard.jsx/Care.jsx already state.
 */
import { useState } from "react";
import { Home, CheckSquare, User } from "lucide-react";
import { colors, spacing, radius, shadows, typography, layout } from "../theme/staffMobile";
import { PLATFORM_NAME } from "../config/environment";
import { useAuth } from "../contexts/AuthContext";
import HomeFeed from "./HomeFeed";
import CareFeed from "./CareFeed";
import ProfileTab from "./ProfileTab";

const TABS = [
  { id: "home",    label: "Home",    icon: Home,        Content: HomeFeed },
  { id: "care",    label: "Care",    icon: CheckSquare, Content: CareFeed },
  { id: "profile", label: "Profile", icon: User,        Content: ProfileTab },
];

export default function StaffMobileLayout() {
  const [activeTab, setActiveTab] = useState("home");
  const { user } = useAuth();
  const firstName = (user?.name || "").split(" ")[0];
  const initial = (user?.name || "?").charAt(0).toUpperCase();

  const ActiveContent = TABS.find(t => t.id === activeTab)?.Content ?? HomeFeed;

  return (
    <div style={{ minHeight: "100vh", background: colors.surface.background, display: "flex", flexDirection: "column" }}>

      {/* ── Top bar ─────────────────────────────────────────────────── */}
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

      {/* ── Floating dock ────────────────────────────────────────────── */}
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
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
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
