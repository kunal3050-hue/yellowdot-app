/**
 * Timeline — canonical KUE BOXS Design System timeline component
 * ═══════════════════════════════════════════════════════════════════════
 * Use for: Student Journey, Attendance History, Pickup History, Incident
 * Timeline, Medical Timeline, Parent Communication, Audit Logs, generic
 * Activity History.
 *
 * @prop {Array}   items       [{ id, type, title, description?, timestamp,
 *                               avatar?: {name, photoUrl}, attachments?: [{name,url}],
 *                               expandable?, details?, badge? }]
 * @prop {boolean} loading     shows skeleton entries
 * @prop {boolean} hasMore     enables the infinite-scroll sentinel
 * @prop {function} onLoadMore () => void, called once when scrolled into view
 * @prop {boolean} groupByDate group entries into Today/Yesterday/This Week/Older (default: true)
 * @prop {object}  eventTypeConfig  override/extend the default icon+color per `type`
 * @prop {object}  empty       EmptyState prop overrides
 * @prop {string}  className
 */
import groupByDateFn from "../groupByDate";
import useInfiniteScroll from "../useInfiniteScroll";
import TimelineItem from "./TimelineItem";
import EmptyState from "../EmptyState";
import Skeleton from "../Skeleton";

export default function Timeline({
  items = [],
  loading = false,
  hasMore = false,
  onLoadMore,
  groupByDate: shouldGroup = true,
  eventTypeConfig,
  empty,
  className = "",
}) {
  const sentinelRef = useInfiniteScroll({ hasMore, loading, onLoadMore });

  if (!loading && items.length === 0) {
    return (
      <EmptyState
        icon={empty?.icon}
        title={empty?.title || "No activity yet"}
        description={empty?.description || "Events will appear here as they happen."}
        action={empty?.action}
      />
    );
  }

  const groups = shouldGroup ? groupByDateFn(items) : [{ label: null, items }];

  return (
    <div className={`yd-tl-root ${className}`}>
      {groups.map(group => (
        <div key={group.label || "all"} className="yd-tl-group">
          {group.label && <div className="yd-tl-group-label">{group.label}</div>}
          <ul className="yd-tl-list">
            {group.items.map((item, i) => (
              <TimelineItem
                key={item.id}
                item={item}
                eventTypeConfig={eventTypeConfig}
                isLast={i === group.items.length - 1}
              />
            ))}
          </ul>
        </div>
      ))}

      {loading && (
        <ul className="yd-tl-list">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="yd-tl-item">
              <div className="yd-tl-rail">
                <Skeleton circle height={28} />
                {i < 2 && <span className="yd-tl-line" />}
              </div>
              <div className="yd-tl-content" style={{ paddingTop: 2 }}>
                <Skeleton height={12} width="60%" />
                <div style={{ marginTop: 6 }}><Skeleton height={10} width="35%" /></div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {hasMore && <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />}
    </div>
  );
}
