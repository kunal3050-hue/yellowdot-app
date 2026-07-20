/**
 * ModuleListItem — compact row presentation of a module, used when
 * Quick Navigation's ViewSwitcher is set to List. Same data, same
 * RBAC gate, same pin/navigate callbacks as ModuleCard — only the
 * layout differs (higher information density, one line per module).
 */
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";

export default function ModuleListItem({
  id,
  icon: Icon,
  label,
  description,
  routeKey,
  favourite = false,
  onNavigate,
  onToggleFavourite,
  path,
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

  return (
    <motion.div
      role="button"
      tabIndex={0}
      className="qnd-listitem"
      onClick={() => onNavigate(id, path)}
      onKeyDown={handleKeyDown}
      whileHover={{ x: 2 }}
      transition={{ duration: 0.12 }}
    >
      <span className="qnd-listitem-icon" aria-hidden="true">
        {Icon && <Icon size={17} strokeWidth={1.75} />}
      </span>
      <span className="qnd-listitem-text">
        <span className="qnd-listitem-label">{label}</span>
        <span className="qnd-listitem-desc">{description}</span>
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
