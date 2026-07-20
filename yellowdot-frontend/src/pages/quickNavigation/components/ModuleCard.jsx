/**
 * ModuleCard — premium navigation tile for the Quick Navigation
 * Dashboard. Follows the same RBAC pattern as ui/QuickActionCard
 * (can(routeKey) via useAuth). Each category supplies a soft accent
 * color (icon chip background/color/border) so cards read as belonging
 * to a landmark group while scrolling, not a flat undifferentiated list.
 *
 * Draggable (HTML5 DnD) so it can be dropped onto Quick Access to pin —
 * the star button remains the accessible/keyboard-only way to do the
 * same thing, drag is a mouse-only progressive enhancement.
 *
 * @prop {string}    id            module id (used for favourite/recent tracking)
 * @prop {Component} icon          lucide-react icon component (not an element)
 * @prop {string}    label
 * @prop {string}    description
 * @prop {string}    routeKey      permission key — card renders nothing if the
 *                                 current user lacks it (see useAuth().can())
 * @prop {object}    accent        { bg, icon, border } — this card's category color
 * @prop {boolean}   favourite     current pinned state
 * @prop {function}  onNavigate    (id, path) => void
 * @prop {function}  onToggleFavourite (id) => void
 * @prop {string}    path
 * @prop {boolean}   compact       smaller variant used in Recent/Favourite rows
 * @prop {string}    highlightQuery  active search text to highlight within label
 */
import { motion } from "framer-motion";
import { Star, ArrowRight } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { usePrefersReducedMotion } from "../../../components/ui/motion";
import highlightText from "../highlightText";

export default function ModuleCard({
  id,
  icon: Icon,
  label,
  description,
  routeKey,
  accent,
  favourite = false,
  onNavigate,
  onToggleFavourite,
  path,
  compact = false,
  highlightQuery = "",
}) {
  const { can } = useAuth();
  const reduced = usePrefersReducedMotion();

  const allowed = routeKey ? can(routeKey) : true;
  if (!allowed) return null;

  const hoverAnim = reduced ? {} : { y: -3 };

  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onNavigate(id, path);
    }
  }

  function handleDragStart(e) {
    e.dataTransfer.setData("text/x-yd-module-id", id);
    e.dataTransfer.effectAllowed = "copy";
  }

  const iconStyle = accent ? { background: accent.bg, color: accent.icon } : undefined;

  return (
    // A <button> can't legally contain the pin toggle's nested <button>, so
    // this outer tile is a div with manual button semantics (role/tabIndex/
    // keydown) instead of a real <button> element.
    <motion.div
      role="button"
      tabIndex={0}
      draggable
      className={`qnd-card${compact ? " qnd-card--compact" : ""}`}
      style={accent ? { "--qnd-card-accent": accent.border } : undefined}
      onClick={() => onNavigate(id, path)}
      onKeyDown={handleKeyDown}
      onDragStart={handleDragStart}
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={hoverAnim}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.16 }}
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

      <span className="qnd-card-icon" style={iconStyle} aria-hidden="true">
        {Icon && <Icon size={compact ? 20 : 24} strokeWidth={1.75} />}
      </span>

      <span className="qnd-card-label">{highlightText(label, highlightQuery)}</span>
      {!compact && description && (
        <span className="qnd-card-desc">{highlightText(description, highlightQuery)}</span>
      )}

      {!compact && (
        <span className="qnd-card-arrow" aria-hidden="true">
          <ArrowRight size={15} strokeWidth={2} />
        </span>
      )}
    </motion.div>
  );
}
