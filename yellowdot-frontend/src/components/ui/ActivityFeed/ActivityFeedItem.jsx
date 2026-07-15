/**
 * ActivityFeedItem.jsx — a single ActivityFeed entry
 */
import { Paperclip } from "lucide-react";
import Avatar from "../Avatar";
import Button from "../Button";

function formatRelativeTime(timestamp) {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

/** Renders @Mentions inside plain text as highlighted spans. */
function renderWithMentions(text) {
  if (!text) return text;
  const parts = text.split(/(@[\w.]+)/g);
  return parts.map((part, i) =>
    part.startsWith("@")
      ? <span key={i} className="yd-af-mention">{part}</span>
      : part
  );
}

export default function ActivityFeedItem({ item, categoryConfig, onMarkAsRead }) {
  const category = categoryConfig?.[item.category];

  function handleClick() {
    if (item.unread) onMarkAsRead?.(item.id);
  }

  return (
    <li
      className={`yd-af-item${item.unread ? " yd-af-item--unread" : ""}`}
      onClick={handleClick}
    >
      {item.unread && <span className="yd-af-unread-dot" aria-label="Unread" />}
      <Avatar name={item.avatar?.name || "?"} photoUrl={item.avatar?.photoUrl} size={32} shape="circle" />

      <div className="yd-af-body">
        <div className="yd-af-top">
          <span className="yd-af-title">{item.title}</span>
          {category && (
            <span className="yd-af-category" style={{ color: category.color, background: category.bg }}>
              {category.label}
            </span>
          )}
          <span className="yd-af-time">{formatRelativeTime(item.timestamp)}</span>
        </div>

        {item.body && <div className="yd-af-text">{renderWithMentions(item.body)}</div>}

        {item.attachments?.length > 0 && (
          <div className="yd-af-attachments">
            {item.attachments.map((att, i) => (
              <a key={i} href={att.url} target="_blank" rel="noreferrer" className="yd-af-attachment">
                <Paperclip size={11} strokeWidth={2} />
                {att.name}
              </a>
            ))}
          </div>
        )}

        {item.actions?.length > 0 && (
          <div className="yd-af-actions" onClick={e => e.stopPropagation()}>
            {item.actions.map((action, i) => (
              <Button key={i} size="xs" variant={action.variant || "outline"} onClick={action.onClick}>
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
