/** @type {import('tailwindcss').Config} */
// ─────────────────────────────────────────────────────────────────────────
// KUE BOXS Design System v2 — every value below reads from src/styles/
// tokens.css's CSS custom properties rather than duplicating literals, so
// there is exactly one source of truth for color/radius/shadow. Update a
// value in tokens.css and both plain CSS (var(--yd-*)) and Tailwind
// utilities (bg-yd-yellow, rounded-card, shadow-medium, etc.) pick it up.
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        yd: {
          // ── Brand yellows ─────────────────────────────────────────
          yellow:          "var(--yd-yellow)",
          "yellow-dark":   "var(--yd-yellow-dark)",
          "yellow-hover":  "var(--yd-yellow-dark)",
          "yellow-light":  "var(--yd-yellow-light)",
          "yellow-soft":   "var(--yd-yellow-light)",
          "yellow-pale":   "var(--yd-yellow-pale)",

          // ── Text ──────────────────────────────────────────────────
          charcoal:        "var(--yd-charcoal)",
          black:           "var(--yd-black)",
          navy:            "var(--yd-navy)",
          "navy-2":        "var(--yd-navy-2)",
          text:            "var(--yd-text)",
          "text-2":        "var(--yd-text-soft)",
          "text-3":        "var(--yd-text-muted)",
          "text-warm":     "var(--yd-text-warm)",

          // ── Surfaces ────────────────────────────────────────────────
          bg:              "var(--yd-bg)",
          cream:           "var(--yd-cream)",
          soft:            "var(--yd-soft)",
          surface:         "var(--yd-surface)",

          // ── Borders — cool neutral ─────────────────────────────────
          border:          "var(--yd-border)",
          "border-light":  "var(--yd-border-light)",
          "border-warm":   "var(--yd-border-warm)",

          // ── Semantic: danger ───────────────────────────────────────
          danger:          "var(--yd-danger)",
          "danger-soft":   "var(--yd-danger-soft)",
          "danger-border": "var(--yd-danger-border)",

          // ── Semantic: success ──────────────────────────────────────
          success:         "var(--yd-success)",
          "success-soft":  "var(--yd-success-soft)",
          "success-border":"var(--yd-success-border)",

          // ── Semantic: warning ──────────────────────────────────────
          warn:            "var(--yd-warning)",
          "warn-soft":     "var(--yd-warning-soft)",
          "warn-border":   "var(--yd-warning-border)",

          // ── Semantic: info ─────────────────────────────────────────
          info:            "var(--yd-info)",
          "info-soft":     "var(--yd-info-soft)",
          "info-border":   "var(--yd-info-border)",

          // ── Sidebar ───────────────────────────────────────────────
          "sidebar-bg":    "var(--yd-sidebar-bg)",
          "sidebar-hover": "var(--yd-sidebar-hover)",
          "sidebar-active":"var(--yd-sidebar-active)",
        },
      },

      // ── Typography — Plus Jakarta Sans (kept; see Design System v2 log:
      //    no compelling usability benefit found to switch to Manrope/Inter) ──
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px" }],
      },

      // ── Border radius — semantic, per-element (Design System v2) ─────
      // Generic yd-sm/yd/yd-md/yd-lg/yd-xl kept for anything already using
      // them; card/button/input/dialog are the new named element radii.
      borderRadius: {
        "yd-sm": "var(--yd-radius-sm)",
        yd:      "var(--yd-radius)",
        "yd-md": "var(--yd-radius-md)",
        "yd-lg": "var(--yd-radius-lg)",
        "yd-xl": "var(--yd-radius-xl)",
        card:    "var(--yd-radius-card)",
        button:  "var(--yd-radius-button)",
        input:   "var(--yd-radius-input)",
        dialog:  "var(--yd-radius-dialog)",
      },

      // ── Shadows — four canonical elevation levels (Design System v2) ──
      // shadow-none / shadow-small / shadow-medium / shadow-large are the
      // only levels new code should reach for. yd-md/yd-lg/yd-yellow/etc.
      // are kept for anything already using the old warm-tinted scale.
      boxShadow: {
        none:        "var(--yd-elevation-none)",
        small:       "var(--yd-elevation-small)",
        medium:      "var(--yd-elevation-medium)",
        large:       "var(--yd-elevation-large)",
        yd:          "0 1px 3px rgba(244,196,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "yd-md":     "0 4px 16px rgba(244,196,0,0.08), 0 2px 4px rgba(0,0,0,0.06)",
        "yd-lg":     "0 8px 32px rgba(244,196,0,0.10), 0 4px 8px rgba(0,0,0,0.06)",
        "yd-yellow": "0 4px 16px rgba(244,196,0,0.35)",
        "yd-warm":   "0 4px 16px rgba(244,196,0,0.12)",
        "yd-card":   "0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(236,231,216,0.8)",
      },

      // ── Animations ────────────────────────────────────────────────
      keyframes: {
        toastIn:    { from: { transform: "translateY(16px)", opacity: "0" }, to: { transform: "translateY(0)", opacity: "1" } },
        toastOut:   { from: { transform: "translateY(0)", opacity: "1"   }, to: { transform: "translateY(16px)", opacity: "0" } },
        fadeUp:     { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        timerPulse: { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.4" } },
        shimmer:    { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(100%)" } },
        scanLine:   { "0%": { top: "0%", opacity: "1" }, "50%": { top: "100%", opacity: "0.8" }, "100%": { top: "0%", opacity: "1" } },
        slideIn:    { from: { transform: "translateX(100%)", opacity: "0" }, to: { transform: "translateX(0)", opacity: "1" } },
      },
      animation: {
        "toast-in":    "toastIn    0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "toast-out":   "toastOut   0.2s  ease-in both",
        "fade-up":     "fadeUp     0.3s  ease-out both",
        "timer-pulse": "timerPulse 2s    ease-in-out infinite",
        "shimmer":     "shimmer    0.7s  ease-in-out",
        "scan-line":   "scanLine   2s    ease-in-out infinite",
        "slide-in":    "slideIn    0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94) both",
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        ".scrollbar-none": {
          "-ms-overflow-style": "none",
          "scrollbar-width":    "none",
          "&::-webkit-scrollbar": { display: "none" },
        },
        ".scrollbar-thin": {
          "scrollbar-width": "thin",
          "scrollbar-color": "#ECE7D8 transparent",
        },
      });
    },
  ],
};
