/**
 * ActivityFeed — canonical KUE BOXS Design System activity/notification feed
 * ═══════════════════════════════════════════════════════════════════════
 * The standard activity component throughout the application (notification
 * center, dashboard "recent activity", audit/approval queues, etc).
 *
 * @prop {Array}   items        [{ id, unread?, avatar?: {name,photoUrl}, category?,
 *                                 title, body?, timestamp, attachments?: [{name,url}],
 *                                 actions?: [{label,onClick,variant?}] }]
 * @prop {boolean} loading      shows skeleton entries
 * @prop {boolean} hasMore      enables the infinite-scroll sentinel
 * @prop {function} onLoadMore  () => void, called once when scrolled into view
 * @prop {Array}   categories   [{key,label,color,bg}] — drives filter chips + badge styling
 * @prop {function} onMarkAsRead     (id) => void
 * @prop {function} onMarkAllAsRead  () => void
 * @prop {boolean} searchable   show the search input (default: true)
 * @prop {boolean} filterable   show the category filter chips (default: true)
 * @prop {object}  empty        EmptyState prop overrides
 * @prop {string}  className
 */
import { useMemo, useState } from "react";
import { Search, CheckCheck } from "lucide-react";
import useInfiniteScroll from "../useInfiniteScroll";
import ActivityFeedItem from "./ActivityFeedItem";
import EmptyState from "../EmptyState";
import Skeleton from "../Skeleton";
import Button from "../Button";

function buildCategoryConfig(categories) {
  if (!categories) return {};
  const config = {};
  for (const c of categories) {
    config[c.key] = { label: c.label, color: c.color || "var(--yd-info)", bg: c.bg || "var(--yd-info-soft)" };
  }
  return config;
}

export default function ActivityFeed({
  items = [],
  loading = false,
  hasMore = false,
  onLoadMore,
  categories,
  onMarkAsRead,
  onMarkAllAsRead,
  searchable = true,
  filterable = true,
  empty,
  className = "",
}) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(null);

  const categoryConfig = useMemo(() => buildCategoryConfig(categories), [categories]);
  const sentinelRef = useInfiniteScroll({ hasMore, loading, onLoadMore });

  const unreadCount = items.filter(i => i.unread).length;

  const filtered = useMemo(() => {
    let result = items;
    if (activeCategory) result = result.filter(i => i.category === activeCategory);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter(i =>
        i.title?.toLowerCase().includes(q) || i.body?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [items, activeCategory, query]);

  const showToolbar = searchable || filterable || onMarkAllAsRead;

  return (
    <div className={`yd-af-root ${className}`}>
      {showToolbar && (
        <div className="yd-af-toolbar">
          {searchable && (
            <div className="yd-af-search">
              <Search size={14} strokeWidth={2} />
              <input
                type="text"
                placeholder="Search activity..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                aria-label="Search activity"
              />
            </div>
          )}

          {filterable && categories?.length > 0 && (
            <div className="yd-af-chips" role="tablist" aria-label="Filter by category">
              <button
                className={`yd-af-chip${activeCategory === null ? " yd-af-chip--active" : ""}`}
                onClick={() => setActiveCategory(null)}
              >
                All
              </button>
              {categories.map(c => (
                <button
                  key={c.key}
                  className={`yd-af-chip${activeCategory === c.key ? " yd-af-chip--active" : ""}`}
                  onClick={() => setActiveCategory(prev => prev === c.key ? null : c.key)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {onMarkAllAsRead && (
            <Button size="xs" variant="outline" leftIcon={<CheckCheck size={13} strokeWidth={2} />}
              onClick={onMarkAllAsRead} disabled={unreadCount === 0} className="yd-af-mark-all">
              Mark all read{unreadCount > 0 ? ` (${unreadCount})` : ""}
            </Button>
          )}
        </div>
      )}

      {!loading && filtered.length === 0 ? (
        <EmptyState
          icon={empty?.icon}
          variant={query || activeCategory ? "filtered" : "default"}
          title={empty?.title || (query || activeCategory ? "No matching activity" : "No activity yet")}
          description={empty?.description || "You're all caught up."}
          action={empty?.action}
        />
      ) : (
        <ul className="yd-af-list">
          {filtered.map(item => (
            <ActivityFeedItem
              key={item.id}
              item={item}
              categoryConfig={categoryConfig}
              onMarkAsRead={onMarkAsRead}
            />
          ))}
        </ul>
      )}

      {loading && (
        <ul className="yd-af-list">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="yd-af-item">
              <Skeleton circle height={32} />
              <div className="yd-af-body" style={{ paddingTop: 2 }}>
                <Skeleton height={12} width="50%" />
                <div style={{ marginTop: 6 }}><Skeleton height={10} width="80%" /></div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {hasMore && <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />}
    </div>
  );
}
