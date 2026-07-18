/**
 * ModuleCard — premium large navigation tile for the Quick Navigation
 * Dashboard. Follows the same RBAC pattern as ui/QuickActionCard
 * (can(routeKey) via useAuth) but sized and styled for a landing-page
 * grid: bigger icon, more whitespace, softer shadow, optional pin toggle.
 *
 * @prop {string}    id            module id (used for favourite/recent tracking)
 * @prop {Component} icon          lucide-react icon component (not an element)
 * @prop {string}    label
 * @prop {string}    description
 * @prop {string}    routeKey      permission key — card renders nothing if the
 *                                 current user lacks it (see useAuth().can())
 * @prop {boolean}   favourite     current pinned state
 * @prop {function}  onNavigate    (id, path) => void
 * @prop {function}  onToggleFavourite (id) => void
 * @prop {string}    path
 * @prop {boolean}   compact       smaller variant used in Recent/Favourite rows
 */
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { usePrefersReducedMotion } from "../../../components/ui/motion";

export default function ModuleCard({
  id,
  icon: Icon,
  label,
  description,
  routeKey,
  favourite = false,
  onNavigate,
  onToggleFavourite,
  path,
  compact = false,
}) {
  const { can } = useAuth();
  const reduced = usePrefersReducedMotion();

  const allowed = routeKey ? can(routeKey) : true;
  if (!allowed) return null;

  const hoverAnim = reduced ? {} : { y: -3, boxShadow: "var(--yd-elevation-large)" };

  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onNavigate(id, path);
    }
  }

  return (
    // A <button> can't legally contain the pin toggle's nested <button>, so
    // this outer tile is a div with manual button semantics (role/tabIndex/
    // keydown) instead of a real <button> element.
    <motion.div
      role="button"
      tabIndex={0}
      className={`qnd-card${compact ? " qnd-card--compact" : ""}`}
      onClick={() => onNavigate(id, path)}
      onKeyDown={handleKeyDown}
      whileHover={hoverAnim}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.14 }}
    >
      {onToggleFavourite && (
        <button
          type="button"
          className={`qnd-card-pin${favourite ? " qnd-card-pin--active" : ""}`}
          onClick={(e) => { e.stopPropagation(); onToggleFavourite(id); }}
          aria-label={favourite ? `Unpin ${label}` : `Pin ${label}`}
          aria-pressed={favourite}
        >
          <Star size={14} strokeWidth={2} fill={favourite ? "currentColor" : "none"} />
        </button>
      )}

      <span className="qnd-card-icon" aria-hidden="true">
        {Icon && <Icon size={compact ? 20 : 26} strokeWidth={1.75} />}
      </span>

      <span className="qnd-card-label">{label}</span>
      {!compact && description && <span className="qnd-card-desc">{description}</span>}
    </motion.div>
  );
}
