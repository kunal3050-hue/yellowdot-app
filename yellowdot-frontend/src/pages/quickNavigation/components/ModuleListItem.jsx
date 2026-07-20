/**
 * ModuleListItem — compact row presentation of a module, used when
 * Quick Navigation's ViewSwitcher is set to List. Same data, same
 * RBAC gate, same pin/navigate/drag callbacks as ModuleCard — only the
 * layout differs (higher information density, one line per module).
 */
import { motion } from "framer-motion";
import { Star, ArrowRight } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import highlightText from "../highlightText";

export default function ModuleListItem({
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
  highlightQuery = "",
}) {
  const { can } = useAuth();
  const allowed = routeKey ? can(routeKey) : true;
  if (!allowed) return null;

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
    <motion.div
      role="button"
      tabIndex={0}
      draggable
      className="qnd-listitem"
      onClick={() => onNavigate(id, path)}
      onKeyDown={handleKeyDown}
      onDragStart={handleDragStart}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      whileHover={{ x: 2 }}
      transition={{ duration: 0.14 }}
    >
      <span className="qnd-listitem-icon" style={iconStyle} aria-hidden="true">
        {Icon && <Icon size={17} strokeWidth={1.75} />}
      </span>
      <span className="qnd-listitem-text">
        <span className="qnd-listitem-label">{highlightText(label, highlightQuery)}</span>
        <span className="qnd-listitem-desc">{highlightText(description, highlightQuery)}</span>
      </span>
      <span className="qnd-listitem-arrow" aria-hidden="true">
        <ArrowRight size={15} strokeWidth={2} />
      </span>
      {onToggleFavourite && (
        <button
          type="button"
          className={`qnd-listitem-pin${favourite ? " qnd-listitem-pin--active" : ""}`}
          onClick={(e) => { e.stopPropagation(); onToggleFavourite(id); }}
          aria-label={favourite ? `Unpin ${label}` : `Pin ${label}`}
          aria-pressed={favourite}
        >
          <Star size={14} strokeWidth={2} fill={favourite ? "currentColor" : "none"} />
        </button>
      )}
    </motion.div>
  );
}
