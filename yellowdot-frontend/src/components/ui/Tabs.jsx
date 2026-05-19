/**
 * Tabs — horizontal tab bar
 *
 * @prop {Array}    tabs        [{id, label, icon?, count?}]
 * @prop {string}   activeTab   id of the active tab
 * @prop {function} onChange    (id) => void
 * @prop {string}   variant     "underline" (default) | "pill"
 * @prop {string}   className
 */
export default function Tabs({
  tabs = [],
  activeTab,
  onChange,
  variant = "underline",
  className = "",
}) {
  const wrapCls = [
    "yd-tabs",
    variant === "pill" ? "yd-tabs-pill" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapCls} role="tablist">
      {tabs.map(tab => {
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            className={`yd-tab ${active ? "active" : ""}`}
            onClick={() => onChange?.(tab.id)}
          >
            {tab.icon && (
              <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                {tab.icon}
              </span>
            )}
            {tab.label}
            {tab.count != null && (
              <span className="yd-tab-count">{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
