/**
 * ═══════════════════════════════════════════════════════════════════
 * YELLOW DOT CRM — CENTRALIZED THEME CONFIGURATION
 * ═══════════════════════════════════════════════════════════════════
 *
 * Single source of truth for all design values, used by:
 *   • CSS custom properties in tokens.css (visual layer)
 *   • React components that need JS-level values (inline styles, canvas, charts)
 *   • Any future theme switcher (dark mode, white-label)
 *
 * Import: import { theme } from "@/design-system/theme"
 * ═══════════════════════════════════════════════════════════════════
 */

// ── Brand Colors ───────────────────────────────────────────────────
export const colors = {
  // Brand yellows
  yellow:       "#F4C400",
  yellowDark:   "#D9AE00",
  yellowLight:  "#FFF4BF",
  yellowPale:   "#FFFDF7",
  yellowGlow:   "rgba(244,196,0,0.18)",
  yellowShadow: "rgba(244,196,0,0.35)",

  // Brand charcoal (replaces navy — no blue)
  navy:         "#1f1f1f",
  navy2:        "#2d2d2d",
  navy3:        "#3d3d3d",
  navyLight:    "#4d4d4d",
  navyGlow:     "rgba(234,179,8,0.12)",

  // Neutrals
  white:        "#FFFFFF",
  cream:        "#FFFDF7",
  soft:         "#F8F6EF",
  black:        "#111111",
  charcoal:     "#1E1E1E",

  // Surfaces
  surface:      "#FFFFFF",
  bg:           "#FFFDF7",
  bgPage:       "#F6F4EE",
  sidebarBg:    "#FFFBEA",
  sidebarHover: "#FFF4BF",

  // Borders
  border:       "#ECE7D8",
  borderLight:  "#F0EBD8",
  borderWarm:   "#E8DFC8",

  // Text — all warm-toned, no cool gray
  text:         "#2A231A",
  textSoft:     "#7a6e5e",
  textMuted:    "#a3957e",
  textWarm:     "#4A3F2A",

  // Semantic — Success (warm olive-gold, no green)
  success:       "#8b7a28",
  successSoft:   "#f8f4d8",
  successBorder: "#d4bc58",

  // Semantic — Danger
  danger:        "#DC2626",
  dangerSoft:    "#FEF2F2",
  dangerBorder:  "#FECACA",

  // Semantic — Warning
  warning:       "#D97706",
  warningSoft:   "#FFFBEB",
  warningBorder: "#FDE68A",

  // Semantic — Info (warm amber, no blue)
  info:          "#d97706",
  infoSoft:      "#fffbeb",
  infoBorder:    "#fde68a",
};

// ── Typography ─────────────────────────────────────────────────────
export const typography = {
  fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
  fontFamilyMono: "ui-monospace, 'Cascadia Code', 'Courier New', monospace",

  // Scale (px)
  sizeXs:   10,
  sizeSm:   12,
  sizeBase: 14,
  sizeMd:   15,
  sizeLg:   18,
  sizeXl:   22,
  size2xl:  28,
  size3xl:  36,
  size4xl:  46,

  // Weights
  regular: 400,
  medium:  500,
  semi:    600,
  bold:    700,
  extra:   800,
  black:   900,

  // Line heights
  tight:   1.1,
  snug:    1.3,
  normal:  1.5,
  relaxed: 1.65,

  // Letter spacing
  trackingTight:  "-0.03em",
  trackingSnug:   "-0.02em",
  trackingNormal: "0",
  trackingWide:   "0.04em",
  trackingWider:  "0.06em",
};

// ── Spacing (px) ───────────────────────────────────────────────────
export const space = {
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  5:  20,
  6:  24,
  8:  32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
};

// ── Border Radius (px) ─────────────────────────────────────────────
export const radius = {
  xs:   4,
  sm:   6,
  base: 10,
  md:   14,
  lg:   18,
  xl:   24,
  "2xl":32,
  full: 9999,
};

// ── Shadows ────────────────────────────────────────────────────────
export const shadows = {
  xs:     "0 1px 2px rgba(0,0,0,0.04)",
  sm:     "0 1px 3px rgba(244,196,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  base:   "0 4px 16px rgba(244,196,0,0.08), 0 2px 4px rgba(0,0,0,0.06)",
  md:     "0 8px 24px rgba(244,196,0,0.10), 0 4px 8px rgba(0,0,0,0.06)",
  lg:     "0 16px 48px rgba(244,196,0,0.12), 0 8px 16px rgba(0,0,0,0.07)",
  xl:     "0 24px 80px rgba(244,196,0,0.14), 0 12px 32px rgba(0,0,0,0.08)",
  yellow: "0 4px 16px rgba(244,196,0,0.40)",
  navy:   "0 4px 20px rgba(180,140,0,0.20)",
  card:   "0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(236,231,216,0.8)",
  inset:  "inset 0 1px 3px rgba(0,0,0,0.06)",
};

// ── Transitions ────────────────────────────────────────────────────
export const transitions = {
  ease:        "cubic-bezier(0.4, 0, 0.2, 1)",
  spring:      "cubic-bezier(0.22, 1, 0.36, 1)",
  bounce:      "cubic-bezier(0.34, 1.56, 0.64, 1)",
  durationFast:  "0.12s",
  duration:      "0.18s",
  durationSlow:  "0.28s",
};

// ── Status configs ─────────────────────────────────────────────────
// Used across invoices, students, attendance, users
export const statusConfig = {
  // Student / General status — all warm tones
  Active:    { label: "Active",    badge: "success", dot: "#b09830",     text: "#5a4d18", bg: "#f8f4d8", border: "#d4bc58" },
  Inactive:  { label: "Inactive",  badge: "neutral", dot: "#a3957e",     text: "#7a6e5e", bg: "#f5f0e2", border: "#e0d4b8" },
  Alumni:    { label: "Alumni",    badge: "warn",    dot: colors.warning, text: "#92400E", bg: colors.warningSoft, border: colors.warningBorder },

  // Invoice / Payment status — warm olive-gold for Paid
  Paid:      { label: "Paid",      badge: "success", dot: "#b09830",     text: "#5a4d18", bg: "#f8f4d8", border: "#d4bc58" },
  Pending:   { label: "Pending",   badge: "warn",    dot: "#F59E0B",     text: "#92400E", bg: "#FEF3C7", border: "#FDE68A" },
  Partial:   { label: "Partial",   badge: "warn",    dot: "#d97706",     text: "#92400E", bg: "#FEF3C7", border: "#FDE68A" },
  Overdue:   { label: "Overdue",   badge: "danger",  dot: "#c0402a",     text: "#7a2018", bg: "#FEE8E2", border: "#e0a898" },
  Cancelled: { label: "Cancelled", badge: "neutral", dot: "#a3957e",     text: "#7a6e5e", bg: "#f5f0e2", border: "#e0d4b8" },

  // Attendance — warm tones
  Present:  { label: "Present",  badge: "success", dot: "#b09830",     text: "#5a4d18", bg: "#f8f4d8", border: "#d4bc58" },
  Absent:   { label: "Absent",   badge: "danger",  dot: "#c0402a",     text: "#7a2018", bg: "#FEE8E2", border: "#e0a898" },
  Late:     { label: "Late",     badge: "warn",    dot: colors.warning, text: colors.warning, bg: colors.warningSoft, border: colors.warningBorder },
  Holiday:  { label: "Holiday",  badge: "neutral", dot: colors.info,    text: colors.info,    bg: colors.infoSoft,    border: colors.infoBorder    },

  // User roles — all warm brand tones
  developer:   { label: "Developer",   badge: "yellow",  bg: colors.yellowLight, border: "#d4bc30",           text: "#3a3010" },
  super_admin: { label: "Super Admin", badge: "danger",  bg: "#fee8e2",          border: "#e0a898",           text: "#7a2018" },
  admin:       { label: "Admin",       badge: "info",    bg: colors.infoSoft,    border: colors.infoBorder,   text: colors.info },
  center_admin:{ label: "Ctr Admin",   badge: "info",    bg: colors.infoSoft,    border: colors.infoBorder,   text: "#92400E" },
  teacher:     { label: "Teacher",     badge: "success", bg: "#f8f4d8",          border: "#d4bc58",           text: "#5a4d18" },
  accountant:  { label: "Accountant",  badge: "warn",    bg: colors.warningSoft, border: colors.warningBorder, text: colors.warning },
  reception:   { label: "Reception",   badge: "neutral", bg: "#f5f0e8",          border: "#e0d4b8",           text: "#6f624f" },
};

// ── Z-index scale ──────────────────────────────────────────────────
export const zIndex = {
  below:    -1,
  base:      0,
  raised:   10,
  sticky:   20,
  dropdown: 100,
  modal:    200,
  toast:    300,
  top:      400,
};

// ── Layout ─────────────────────────────────────────────────────────
export const layout = {
  sidebarWidth:     280,
  sidebarCollapsed:  64,
  topbarHeight:      60,
  contentMax:      1120,
  cardMax:          540,
  authCardMax:      460,
};

// ── Full theme export ──────────────────────────────────────────────
export const theme = {
  colors,
  typography,
  space,
  radius,
  shadows,
  transitions,
  statusConfig,
  zIndex,
  layout,
};

export default theme;
