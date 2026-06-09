/**
 * DevRoleSwitch.jsx — DEV-only floating view switcher
 * ──────────────────────────────────────────────────────
 * Renders ONLY when import.meta.env.DEV === true.
 * Never compiled into production builds.
 *
 * Shows a small pill in the top-right corner of the screen
 * with two buttons: "Staff View" → "/" and "Parent View" → "/parent-home"
 *
 * Position: fixed, top-right, above all other content (z-index: 9999).
 */

import { useLocation, Link } from "react-router-dom";

const PARENT_PATHS = ["/parent-home", "/parent-attendance", "/parent-daily-care",
  "/parent-profile", "/parent-child", "/parent-notifications",
  "/parent-memories", "/parent-fees", "/parent-food-menu",
  "/parent-consumption", "/parent-nap", "/parent-holidays"];

export default function DevRoleSwitch() {
  // Compiled away in production — tree-shaken by Vite
  if (!import.meta.env.DEV) return null;

  return <FloatingPill />;
}

function FloatingPill() {
  const { pathname } = useLocation();
  const isParentView = PARENT_PATHS.some(p => pathname.startsWith(p));

  return (
    <div style={{
      position: "fixed",
      top: 12,
      right: 12,
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      gap: 0,
      background: "rgba(30,24,15,0.88)",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      borderRadius: 40,
      padding: "3px",
      boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
      border: "1px solid rgba(255,255,255,0.08)",
      userSelect: "none",
    }}>
      {/* Label */}
      <span style={{
        fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.4)",
        letterSpacing: "0.08em", textTransform: "uppercase",
        padding: "0 10px 0 8px",
      }}>
        DEV
      </span>

      {/* Staff button */}
      <Link to="/" style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "5px 12px", borderRadius: 36,
        fontSize: 11, fontWeight: 700, textDecoration: "none",
        transition: "all 0.15s",
        background: !isParentView ? "rgba(249,220,90,0.22)" : "transparent",
        color: !isParentView ? "#f9dc5a" : "rgba(255,255,255,0.45)",
        border: !isParentView ? "1px solid rgba(249,220,90,0.35)" : "1px solid transparent",
      }}>
        <StaffIcon active={!isParentView} />
        Staff
      </Link>

      {/* Parent button */}
      <Link to="/parent-home" style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "5px 12px", borderRadius: 36,
        fontSize: 11, fontWeight: 700, textDecoration: "none",
        transition: "all 0.15s",
        background: isParentView ? "rgba(249,220,90,0.22)" : "transparent",
        color: isParentView ? "#f9dc5a" : "rgba(255,255,255,0.45)",
        border: isParentView ? "1px solid rgba(249,220,90,0.35)" : "1px solid transparent",
      }}>
        <ParentIcon active={isParentView} />
        Parent
      </Link>
    </div>
  );
}

const IC = {
  width: 12, height: 12, fill: "none",
  stroke: "currentColor", strokeWidth: "2",
  strokeLinecap: "round", strokeLinejoin: "round",
};

function StaffIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" {...IC}>
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

function ParentIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" {...IC}>
      <circle cx="12" cy="7" r="4" />
      <path d="M5.5 21c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
    </svg>
  );
}
