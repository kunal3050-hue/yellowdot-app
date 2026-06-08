/**
 * DailyCareLauncher.jsx — floating "Daily Care" button + bottom sheet menu.
 *
 * Tapping the FAB opens a bottom sheet listing the daily-care modules.
 * Attendance opens the live screen; the rest open Coming Soon placeholders.
 *
 * Future-ready: add Mood Tracker / Water Intake / Toilet Log / Medication Log
 * by appending to MENU_ITEMS (and a route in routes/parentRoutes.jsx).
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import FloatingActionButton from "./FloatingActionButton";
import BottomSheet from "./BottomSheet";
import { colors, spacing, radius, typography } from "../theme";

// To add a future module: add { emoji, label, to } here + its route.
const MENU_ITEMS = [
  { emoji: "📅", label: "Attendance",      to: "/parent-attendance" },
  { emoji: "😴", label: "Nap Tracker",     to: "/parent-nap" },
  { emoji: "🍽️", label: "Food Menu",       to: "/parent-food-menu" },
  { emoji: "🍎", label: "Consumption Log", to: "/parent-consumption" },
];

export default function DailyCareLauncher() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const go = to => { setOpen(false); navigate(to); };

  return (
    <>
      <FloatingActionButton icon="☀️" label="Daily Care" onClick={() => setOpen(true)} />

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Daily Care">
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          {MENU_ITEMS.map(item => (
            <button
              key={item.to}
              onClick={() => go(item.to)}
              style={{
                display: "flex", alignItems: "center", gap: spacing.md,
                padding: spacing.md,
                borderRadius: radius.md,
                background: colors.surface.raised,
                border: `1px solid ${colors.surface.border}`,
                cursor: "pointer", width: "100%", textAlign: "left",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <span style={{
                width: 40, height: 40, borderRadius: radius.md,
                background: colors.yellow100, border: `1px solid ${colors.yellow200}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, flexShrink: 0,
              }}>{item.emoji}</span>
              <span style={{ ...typography.title, color: colors.text.primary, flex: 1 }}>
                {item.label}
              </span>
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none"
                stroke={colors.text.faint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
