/**
 * BottomSheet.jsx — reusable modal sheet that slides up from the bottom.
 * Mobile-first, theme-driven, smooth open/close. No hardcoded colours.
 *
 *   <BottomSheet open={open} onClose={() => setOpen(false)} title="Daily Care">
 *     ...content...
 *   </BottomSheet>
 *
 * Always mounted; visibility/transform are toggled via `open` so the close
 * animation plays. Pointer events are disabled while closed.
 */

import { useEffect } from "react";
import { colors, spacing, radius, shadows, typography, layout } from "../theme";

export default function BottomSheet({ open, onClose, title, children }) {
  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      aria-hidden={!open}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        background: open ? colors.surface.scrim : "transparent",
        transition: "background 0.28s ease",
        pointerEvents: open ? "auto" : "none",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: layout.contentMax,
          background: colors.surface.card,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          boxShadow: shadows.lg,
          padding: spacing.lg,
          paddingBottom: `calc(${layout.safeBottom} + ${spacing.xl}px)`,
          transform: open ? "translateY(0)" : "translateY(110%)",
          transition: "transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {/* Grab handle */}
        <div style={{
          width: 40, height: 4, borderRadius: radius.pill,
          background: colors.surface.borderStrong, margin: `0 auto ${spacing.md}px`,
        }} />
        {title && (
          <h2 style={{ ...typography.h2, color: colors.text.primary, margin: `0 0 ${spacing.md}px` }}>
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}
