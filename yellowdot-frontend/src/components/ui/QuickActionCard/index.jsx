/**
 * QuickActionCard — canonical KUE BOXS Design System dashboard action tile
 * ═══════════════════════════════════════════════════════════════════════
 * Use for: Take Attendance, Add Student, Send Notice, Generate Invoice,
 * Mark Meal, Emergency Pickup, Approve Leave, and similar one-tap actions.
 *
 * @prop {ReactNode} icon         lucide-react icon element, e.g. <UserPlus size={20}/>
 * @prop {string}    title
 * @prop {string}    description
 * @prop {string}    badge          small label chip, e.g. "New"
 * @prop {number}    count          notification/pending count, e.g. unread approvals
 * @prop {string}    shortcut       keyboard shortcut hint, e.g. "⌘N"
 * @prop {object}    permission     { routeKey } or { moduleId, action } — checked via useAuth();
 *                                  card renders nothing if the current user lacks permission
 * @prop {boolean}   disabled
 * @prop {function}  onClick
 * @prop {string}    className
 */
import { motion } from "framer-motion";
import { useAuth } from "../../../contexts/AuthContext";
import { usePrefersReducedMotion } from "../motion";

export default function QuickActionCard({
  icon,
  title,
  description,
  badge,
  count,
  shortcut,
  permission,
  disabled = false,
  onClick,
  className = "",
}) {
  const { can, canDo } = useAuth();
  const reduced = usePrefersReducedMotion();

  if (permission) {
    const allowed = permission.routeKey
      ? can(permission.routeKey)
      : permission.moduleId
      ? canDo(permission.moduleId, permission.action)
      : true;
    if (!allowed) return null;
  }

  const hoverAnim = reduced ? {} : { y: -2, boxShadow: "var(--yd-elevation-large)" };

  return (
    <motion.button
      type="button"
      className={`yd-qac ${disabled ? "yd-qac--disabled" : ""} ${className}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : hoverAnim}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.12 }}
    >
      {typeof count === "number" && count > 0 && (
        <span className="yd-qac-count">{count > 99 ? "99+" : count}</span>
      )}

      <div className="yd-qac-top">
        {icon && <span className="yd-qac-icon">{icon}</span>}
        {badge && <span className="yd-qac-badge">{badge}</span>}
      </div>

      <div className="yd-qac-title">{title}</div>
      {description && <div className="yd-qac-desc">{description}</div>}

      {shortcut && <span className="yd-qac-shortcut">{shortcut}</span>}
    </motion.button>
  );
}
