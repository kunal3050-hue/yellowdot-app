/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ── Yellow Dot Brand Tokens (Final) ───────────────────────────
      colors: {
        yd: {
          // Brand yellows — warm golden palette
          yellow:          "#F4C400",
          "yellow-dark":   "#D9AE00",
          "yellow-hover":  "#D9AE00",
          "yellow-light":  "#FFF4BF",
          "yellow-soft":   "#FFF4BF",
          "yellow-pale":   "#FFFDF7",

          // Charcoal / text — warm darks, NOT cold navy
          charcoal:        "#1E1E1E",
          black:           "#111111",

          // Primary dark — warm charcoal, NOT navy/blue
          navy:            "#1f1f1f",
          "navy-2":        "#2d2d2d",

          // Backgrounds — warm cream, NOT cold grey-blue
          bg:              "#FFFDF7",
          cream:           "#FFFDF7",
          soft:            "#F8F6EF",
          surface:         "#FFFFFF",

          // Borders — warm tan, NOT cold grey
          border:          "#ECE7D8",
          "border-light":  "#F0EBD8",
          "border-warm":   "#E8DFC8",

          // Text hierarchy — warm, NOT cold navy
          text:            "#2A2A2A",
          "text-2":        "#6B7280",
          "text-3":        "#9CA3AF",
          "text-warm":     "#4A3F2A",

          // Semantic: danger
          danger:          "#DC2626",
          "danger-soft":   "#FEF2F2",
          "danger-border": "#FECACA",

          // Semantic: success
          success:         "#16A34A",
          "success-soft":  "#F0FDF4",
          "success-border":"#BBF7D0",

          // Semantic: warning / pending
          warn:            "#D97706",
          "warn-soft":     "#FFFBEB",
          "warn-border":   "#FDE68A",

          // Semantic: info / partial — warm amber, no blue
          info:            "#d97706",
          "info-soft":     "#fffbeb",
          "info-border":   "#fde68a",

          // Sidebar specific
          "sidebar-bg":    "#FFFBEA",
          "sidebar-hover": "#FFF4BF",
          "sidebar-active":"#F4C400",
        },
      },

      // ── Typography — Plus Jakarta Sans ────────────────────────────
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px" }],
      },

      // ── Border radius ─────────────────────────────────────────────
      borderRadius: {
        "yd-sm": "6px",
        yd:      "10px",
        "yd-md": "14px",
        "yd-lg": "18px",
        "yd-xl": "24px",
      },

      // ── Shadows — warm yellow-tinted ──────────────────────────────
      boxShadow: {
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
