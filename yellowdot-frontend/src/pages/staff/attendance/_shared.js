/**
 * _shared.js — Token + tiny atoms reused across Staff Attendance pages.
 */

export const T = {
  bg:          "#FFFDF7",
  surface:     "#FFFFFF",
  surfaceWarm: "#FDFAF5",
  border:      "rgba(0,0,0,0.08)",
  borderGold:  "rgba(244,196,0,0.35)",
  shadow:      "0 1px 4px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)",
  shadowMd:    "0 4px 20px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
  text:        "#2A2A2A",
  textMuted:   "#8C8880",
  textSoft:    "#6A6560",
  gold:        "#F4C400",
  goldMid:     "#B45309",
  goldLight:   "rgba(244,196,0,0.10)",
  green:       "#059669",
  red:         "#DC2626",
  redLight:    "rgba(220,38,38,0.09)",
};

export function pillStyle(color, bg, border) {
  return {
    display: "inline-block",
    padding: "3px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    background: bg,
    color,
    border: `1px solid ${border}`,
  };
}

export function fmtTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
}

export function fmtMins(mins) {
  if (!mins) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h)      return `${h}h`;
  return `${m}m`;
}
