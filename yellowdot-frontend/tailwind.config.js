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
          // ── Brand yellows ─────────────────────────────────────────
          yellow:          "#F4C400",
          "yellow-dark":   "#D9AE00",
          "yellow-hover":  "#D9AE00",
          "yellow-light":  "#FFF9E0",
          "yellow-soft":   "#FFF9E0",
          "yellow-pale":   "#FFFDF0",

          // ── Text ──────────────────────────────────────────────────
          charcoal:        "#0F172A",
          black:           "#0A0A0A",
          navy:            "#0F172A",
          "navy-2":        "#1E293B",
          text:            "#0F172A",
          "text-2":        "#64748B",
          "text-3":        "#94A3B8",
          "text-warm":     "#1E293B",

          // ── Surfaces — pure white ──────────────────────────────────
          bg:              "#FFFFFF",
          cream:           "#FFFFFF",
          soft:            "#F8F8F8",
          surface:         "#FFFFFF",

          // ── Borders — cool neutral ─────────────────────────────────
          border:          "#E8E8E8",
          "border-light":  "#F1F1F1",
          "border-warm":   "#E4E4E7",

          // ── Semantic: danger ───────────────────────────────────────
          danger:          "#DC2626",
          "danger-soft":   "#FEF2F2",
          "danger-border": "#FECACA",

          // ── Semantic: success ──────────────────────────────────────
          success:         "#16A34A",
          "success-soft":  "#F0FDF4",
          "success-border":"#BBF7D0",

          // ── Semantic: warning ──────────────────────────────────────
          warn:            "#D97706",
          "warn-soft":     "#FFFBEB",
          "warn-border":   "#FDE68A",

          // ── Semantic: info ─────────────────────────────────────────
          info:            "#2563EB",
          "info-soft":     "#EFF6FF",
          "info-border":   "#BFDBFE",

          // ── Sidebar ───────────────────────────────────────────────
          "sidebar-bg":    "#FFFFFF",
          "sidebar-hover": "#F4F4F5",
          "sidebar-active":"#0F172A",
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
