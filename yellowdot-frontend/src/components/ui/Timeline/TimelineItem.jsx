/**
 * TimelineItem.jsx — a single Timeline entry
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Paperclip } from "lucide-react";
import Avatar from "../Avatar";
import { resolveEventType } from "./eventTypes";
import { accordionVariants, usePrefersReducedMotion, withReducedMotion } from "../motion";

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function TimelineItem({ item, eventTypeConfig, isLast }) {
  const [expanded, setExpanded] = useState(false);
  const reduced = usePrefersReducedMotion();
  const { icon: Icon, color, bg } = resolveEventType(item.type, eventTypeConfig);
  const canExpand = item.expandable && item.details;

  return (
    <li className="yd-tl-item">
      <div className="yd-tl-rail">
        <span className="yd-tl-dot" style={{ background: bg, color }}>
          <Icon size={14} strokeWidth={2} />
        </span>
        {!isLast && <span className="yd-tl-line" />}
      </div>

      <div className="yd-tl-content">
        <div
          className={`yd-tl-header${canExpand ? " yd-tl-header--clickable" : ""}`}
          onClick={canExpand ? () => setExpanded(e => !e) : undefined}
          role={canExpand ? "button" : undefined}
          tabIndex={canExpand ? 0 : undefined}
          aria-expanded={canExpand ? expanded : undefined}
          onKeyDown={canExpand ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(x => !x); } } : undefined}
        >
          {item.avatar && (
            <Avatar name={item.avatar.name} photoUrl={item.avatar.photoUrl} size={24} shape="circle" />
          )}
          <div className="yd-tl-header-text">
            <span className="yd-tl-title">{item.title}</span>
            {item.description && <span className="yd-tl-desc">{item.description}</span>}
          </div>
          <span className="yd-tl-time">{formatTime(item.timestamp)}</span>
          {canExpand && (
            <ChevronDown
              size={14}
              strokeWidth={2}
              className="yd-tl-chevron"
              style={{ transform: expanded ? "rotate(180deg)" : "none" }}
            />
          )}
        </div>

        {item.attachments?.length > 0 && (
          <div className="yd-tl-attachments">
            {item.attachments.map((att, i) => (
              <a key={i} href={att.url} target="_blank" rel="noreferrer" className="yd-tl-attachment">
                <Paperclip size={12} strokeWidth={2} />
                {att.name}
              </a>
            ))}
          </div>
        )}

        <AnimatePresence initial={false}>
          {canExpand && expanded && (
            <motion.div
              key="details"
              variants={withReducedMotion(accordionVariants, reduced)}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              style={{ overflow: "hidden" }}
            >
              <div className="yd-tl-details">{item.details}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </li>
  );
}
