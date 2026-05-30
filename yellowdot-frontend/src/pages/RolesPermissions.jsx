/**
 * RolesPermissions.jsx — Enterprise RBAC · Premium Experience Layer
 * ──────────────────────────────────────────────────────────────────
 * Notion + Stripe + Linear feel for preschool SaaS
 *
 * Panels:
 *   LEFT  288px  — searchable role list (lock icons, staff category tags)
 *   RIGHT flex   — workspace: hero → tabs → split [matrix | capabilities]
 *
 * Premium features:
 *   • Human-language permission descriptions in every row
 *   • Risk-level dots (🟢 safe · 🟡 sensitive · 🔴 critical) on chips
 *   • Live Capabilities Panel: "can do / cannot do" in plain English
 *   • Proper Clone modal (no window.prompt)
 *   • Lock badges on system roles
 *   • Enhanced audit timeline
 *   • Beautiful empty state illustration
 *   • Micro-interactions: hover elevation, check-pop, save flash
 *   • Mobile responsive (< 768 px stack, < 1200 px hide caps panel)
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import roleService from "../services/roleService";
import { SIDEBAR_GROUPS } from "../config/sidebarConfig";
import {
  PERMISSION_CATEGORIES,
  ACTIONS,
  ROLE_COLOR_PRESETS,
  STAFF_CATEGORIES,
  ROLE_TEMPLATES,
  normalizePermissions,
  buildEmptyPermissions,
  isModuleFullyGranted,
  isCategoryFullyGranted,
  setAllModuleActions,
  setAllCategoryActions,
  applyPermissionDependencies,
  deriveRouteKeysFromPermissions,
  countGrantedPermissions,
  getRiskLevel,
  getPermDescription,
  deriveCapabilities,
} from "../config/rbacConfig";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  // Backgrounds — warm ivory, layered depth
  bg:          "#F8F7F2",
  bgDeep:      "#F3F2EC",
  surface:     "#FFFFFF",
  surfaceGlass:"rgba(255,255,255,0.82)",
  surfaceWarm: "#FDFAF5",

  // Borders — almost invisible, Stripe-like
  border:      "rgba(0,0,0,0.075)",
  borderSoft:  "rgba(0,0,0,0.042)",
  borderGold:  "rgba(245,158,11,0.30)",

  // Shadows — layered depth
  shadowXs:    "0 1px 2px rgba(0,0,0,0.05)",
  shadowSm:    "0 1px 4px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)",
  shadowMd:    "0 4px 20px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
  shadowLg:    "0 24px 64px rgba(0,0,0,0.11), 0 4px 16px rgba(0,0,0,0.06)",
  shadowGold:  "0 0 0 3px rgba(245,158,11,0.16)",

  // Typography — stronger hierarchy
  textHead:    "#0f0f0f",
  textBody:    "#2d2d2d",
  textMuted:   "#8c8880",
  textSoft:    "#6a6560",
  textFaint:   "#b0aba5",

  // Gold — premium warmth
  gold:        "#f59e0b",
  goldDark:    "#78350f",
  goldMid:     "#b45309",
  goldWarm:    "#d97706",
  goldLight:   "rgba(245,158,11,0.09)",
  goldGrad:    "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",

  // Semantic
  green:       "#059669",
  greenLight:  "rgba(5,150,105,0.10)",
  red:         "#dc2626",
  amber:       "#d97706",
};

// ─── Injected global CSS ──────────────────────────────────────────────────────
const PAGE_CSS = `
  /* ── Permission toggles — Apple-quality segmented control ── */
  .yd-seg {
    padding: 4px 11px; font-size: 10.5px; font-weight: 500;
    border: 1px solid rgba(0,0,0,0.09);
    background: transparent;
    color: #aaa7a2;
    cursor: pointer; user-select: none; white-space: nowrap;
    transition: background 120ms cubic-bezier(0.4,0,0.2,1),
                color 120ms cubic-bezier(0.4,0,0.2,1),
                border-color 120ms cubic-bezier(0.4,0,0.2,1),
                box-shadow 120ms cubic-bezier(0.4,0,0.2,1);
    position: relative; line-height: 1.35;
  }
  .yd-seg:hover {
    background: rgba(245,158,11,0.06);
    color: #6b6058;
    border-color: rgba(245,158,11,0.22);
  }
  .yd-seg--on {
    background: rgba(245,158,11,0.11) !important;
    border-color: rgba(245,158,11,0.32) !important;
    color: #b45309 !important;
    font-weight: 600;
    z-index: 1;
    box-shadow: inset 0 1px 2px rgba(245,158,11,0.08);
  }
  .yd-seg--disabled { opacity: 0.28; cursor: not-allowed; pointer-events: none; }

  /* ── Role dropdown items ── */
  .yd-role-dropdown-item {
    transition: background 100ms cubic-bezier(0.4,0,0.2,1);
  }
  .yd-role-dropdown-item:hover {
    background: rgba(245,158,11,0.06) !important;
  }

  /* ── Category headers ── */
  .yd-cat-header {
    transition: color 140ms ease;
  }

  /* ── Module rows: premium hover ── */
  .yd-module-row {
    transition: background 100ms ease;
    border-radius: 8px;
    margin: 0 -8px;
    padding-left: 8px !important;
    padding-right: 8px !important;
  }
  .yd-module-row:hover { background: rgba(245,158,11,0.04); }

  /* ── Ghost workspace buttons ── */
  .yd-action-btn {
    transition: background 120ms ease, color 120ms ease;
  }
  .yd-action-btn:hover {
    background: rgba(0,0,0,0.05) !important;
    color: #2d2d2d !important;
  }

  /* ── Animations — spring physics ── */
  @keyframes yd-slide-in-right {
    from { transform: translateX(24px); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }
  @keyframes yd-fade-up {
    from { transform: translateY(8px) scale(0.98); opacity: 0; }
    to   { transform: translateY(0)   scale(1);    opacity: 1; }
  }
  @keyframes yd-rise-in {
    from { transform: translateX(-50%) translateY(12px) scale(0.96); opacity: 0; }
    to   { transform: translateX(-50%) translateY(0)    scale(1);    opacity: 1; }
  }
  @keyframes yd-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes yd-spin {
    to { transform: rotate(360deg); }
  }
  @keyframes yd-shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
`;

// ─── Toast ────────────────────────────────────────────────────────────────────
function useToast() {
  const [list, setList] = useState([]);
  const show = useCallback((msg, type = "ok") => {
    const id = Date.now() + Math.random();
    setList(p => [...p, { id, msg, type }]);
    setTimeout(() => setList(p => p.filter(t => t.id !== id)), 3800);
  }, []);
  return { list, show };
}
function ToastLayer({ list }) {
  if (!list.length) return null;
  return (
    <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
      {list.map(t => (
        <div key={t.id} style={{
          padding: "12px 18px", borderRadius: 14,
          background: t.type === "err" ? "#fff5f5" : "#f0fdf4",
          color:      t.type === "err" ? "#b91c1c"  : "#166534",
          border:     `1px solid ${t.type === "err" ? "#fecaca" : "#bbf7d0"}`,
          boxShadow:  "0 6px 24px rgba(0,0,0,0.10)",
          fontSize: 13, fontWeight: 600,
          animation: "yd-fade-up 200ms ease",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 15 }}>{t.type === "err" ? "✕" : "✓"}</span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ─── Icon primitives ──────────────────────────────────────────────────────────
const Svg = ({ d, size = 16, stroke = T.textMuted, fill = "none", sw = 1.8, style, children }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={fill} stroke={stroke}
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {d ? (typeof d === "string" ? <path d={d} /> : d) : children}
  </svg>
);
const ChevronDown = ({ open, size = 14 }) => (
  <Svg size={size} d={<polyline points="6 9 12 15 18 9" />}
    style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 220ms cubic-bezier(0.4,0,0.2,1)" }} />
);
const XBtn = ({ onClick, size = 28 }) => (
  <button onClick={onClick} style={{
    width: size, height: size, borderRadius: Math.round(size * 0.30),
    border: `1px solid ${T.border}`, background: T.surface, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    transition: "background 120ms",
  }}>
    <Svg size={13} d="M18 6 6 18M6 6l12 12" sw={2} />
  </button>
);
const LockIcon = ({ size = 12, color = T.textMuted }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color}
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);
const PlusIcon = ({ size = 14 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth={2.5} fill="none">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

// ─── Segmented permission toggle ─────────────────────────────────────────────
function ActionSegment({ actionId, moduleId, idx, total, checked, onChange, disabled }) {
  const label = ACTIONS[actionId]?.label || actionId;
  const isFirst = idx === 0;
  const isLast  = idx === total - 1;
  const bRadius = total === 1
    ? "7px"
    : isFirst ? "7px 0 0 7px" : isLast ? "0 7px 7px 0" : "0";

  return (
    <button
      className={["yd-seg", checked ? "yd-seg--on" : "", disabled ? "yd-seg--disabled" : ""].filter(Boolean).join(" ")}
      onClick={() => !disabled && onChange(!checked)}
      title={getPermDescription(moduleId, actionId) || label}
      style={{
        borderRadius: bRadius,
        marginLeft: isFirst ? 0 : -1,
      }}
    >
      {label}
    </button>
  );
}

// ─── Role avatar ──────────────────────────────────────────────────────────────
function RoleAvatar({ name = "?", color = "#6366f1", size = 42, locked }) {
  const r = Math.round(size * 0.28);
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: r,
        background: color,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontWeight: 800, fontSize: Math.round(size * 0.38),
        letterSpacing: "-0.5px",
        boxShadow: `0 3px 12px ${color}44`,
      }}>
        {name.charAt(0).toUpperCase()}
      </div>
      {locked && (
        <div style={{
          position: "absolute", bottom: -3, right: -3,
          width: 16, height: 16, borderRadius: 6,
          background: T.surface, border: `1.5px solid ${T.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
        }}>
          <LockIcon size={9} color={T.textMuted} />
        </div>
      )}
    </div>
  );
}

// ─── (ActionChip retired — using ActionSegment) ──────────────────────────────

// ─── Module row ───────────────────────────────────────────────────────────────
function ModuleRow({ module, permissions, onChange, readOnly, visible, isLast }) {
  if (!visible) return null;
  const modPerms = permissions[module.id] || {};
  const allOn    = isModuleFullyGranted(permissions, module.id, module.actions);
  const desc     = getPermDescription(module.id, "view");

  const handleToggle = (actionId, val) =>
    onChange(applyPermissionDependencies(permissions, module.id, actionId, val, module.actions));

  const handleSelectAll = () =>
    onChange(allOn
      ? setAllModuleActions(permissions, module.id, module.actions, false)
      : setAllModuleActions(permissions, module.id, module.actions, true));

  return (
    <div
      className="yd-module-row"
      style={{
        display: "flex", alignItems: "center",
        padding: "14px 0",
        borderBottom: isLast ? "none" : `1px solid rgba(225,218,205,0.28)`,
      }}
    >
      {/* Label + description */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 450, color: T.textBody, letterSpacing: "-0.01em" }}>
          {module.label}
        </span>
        {desc && (
          <span style={{ fontSize: 11, color: T.textMuted, display: "block", marginTop: 2, lineHeight: 1.45 }}>
            {desc}
          </span>
        )}
      </div>

      {/* Segmented toggles */}
      <div style={{ display: "flex", flexShrink: 0 }}>
        {module.actions.map((a, i) => (
          <ActionSegment
            key={a}
            actionId={a}
            moduleId={module.id}
            idx={i}
            total={module.actions.length}
            checked={!!modPerms[a]}
            onChange={val => handleToggle(a, val)}
            disabled={readOnly}
          />
        ))}
      </div>

      {/* All / None ghost button */}
      {!readOnly && (
        <button onClick={handleSelectAll} style={{
          fontSize: 10, color: T.textMuted, background: "none",
          border: "none", cursor: "pointer",
          padding: "2px 0 2px 14px", whiteSpace: "nowrap", opacity: 0.55,
          fontWeight: 500,
        }}>
          {allOn ? "—" : "All"}
        </button>
      )}
    </div>
  );
}

// ─── Category section (borderless, Notion-style) ─────────────────────────────
function CategoryCard({ category, permissions, onChange, readOnly, searchQuery, isFirst }) {
  const [open, setOpen] = useState(true);

  const allOn = isCategoryFullyGranted(permissions, category);
  const { granted, total } = useMemo(() => {
    let g = 0, t = 0;
    for (const mod of category.modules) {
      for (const a of mod.actions) { t++; if (permissions?.[mod.id]?.[a]) g++; }
    }
    return { granted: g, total: t };
  }, [category, permissions]);

  const filteredModules = useMemo(() => {
    if (!searchQuery) return category.modules.map(m => ({ ...m, visible: true }));
    const q = searchQuery.toLowerCase();
    return category.modules.map(m => ({
      ...m,
      visible: m.label.toLowerCase().includes(q) ||
               m.id.toLowerCase().includes(q) ||
               m.actions.some(a => (ACTIONS[a]?.label || a).toLowerCase().includes(q)) ||
               m.actions.some(a => (getPermDescription(m.id, a) || "").toLowerCase().includes(q)),
    }));
  }, [category, searchQuery]);

  if (!filteredModules.some(m => m.visible)) return null;

  const visibleMods = filteredModules.filter(m => m.visible);
  const pct = total > 0 ? Math.round((granted / total) * 100) : 0;

  return (
    <div style={{ marginTop: isFirst ? 0 : 36 }}>
      {/* Section header — borderless, typographic */}
      <button
        className="yd-cat-header"
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          paddingBottom: 12, border: "none", cursor: "pointer", background: "transparent",
          borderBottom: `1px solid ${T.borderSoft}`,
        }}
      >
        <span style={{ fontSize: 11, opacity: 0.7, flexShrink: 0, lineHeight: 1 }}>{category.icon}</span>
        <span style={{
          fontSize: 10.5, fontWeight: 700, letterSpacing: "0.09em",
          textTransform: "uppercase", color: T.textMuted, flex: 1, textAlign: "left",
        }}>
          {category.label}
        </span>

        {/* Slim progress bar */}
        <div style={{ width: 28, height: 2.5, borderRadius: 2, background: "rgba(225,218,205,0.35)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%",
            background: pct === 100 ? T.green : pct > 0 ? "rgba(245,158,11,0.6)" : "transparent",
            transition: "width 280ms ease" }} />
        </div>

        {/* Grant all / Clear — ghost */}
        {!readOnly && (
          <span
            onClick={e => { e.stopPropagation(); onChange(setAllCategoryActions(permissions, category, !allOn)); }}
            style={{
              fontSize: 10, fontWeight: 500, padding: "1px 7px",
              color: allOn ? T.goldMid : T.textMuted,
              border: "none", background: "none", whiteSpace: "nowrap",
              opacity: 0.7,
            }}
          >
            {allOn ? "Clear" : "All"}
          </span>
        )}
        <ChevronDown open={open} size={11} />
      </button>

      {/* Module rows — inside section, no border box */}
      {open && (
        <div style={{ animation: "yd-fade-in 140ms ease", paddingTop: 2 }}>
          {visibleMods.map((mod, i) => (
            <ModuleRow
              key={mod.id}
              module={mod}
              permissions={permissions}
              onChange={onChange}
              readOnly={readOnly}
              visible={mod.visible}
              isLast={i === visibleMods.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Permission matrix ────────────────────────────────────────────────────────
function PermissionMatrix({ permissions, onChange, readOnly }) {
  const [search, setSearch] = useState("");

  return (
    <div>
      {/* Ghost search — no box, just an underline field */}
      <div style={{ position: "relative", marginBottom: 32 }}>
        <Svg size={13} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
          style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", opacity: 0.4 }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter permissions…"
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "8px 12px 8px 24px",
            border: "none", borderBottom: `1.5px solid ${T.borderSoft}`,
            background: "transparent", fontSize: 13, fontFamily: "inherit",
            outline: "none", color: T.textBody,
            transition: "border-color 140ms",
          }}
          onFocus={e => (e.target.style.borderBottomColor = T.gold)}
          onBlur={e  => (e.target.style.borderBottomColor = T.borderSoft)}
        />
      </div>

      {/* Sections — each separated by whitespace, no outer box */}
      <div>
        {PERMISSION_CATEGORIES.map((cat, idx) => (
          <CategoryCard
            key={cat.id}
            category={cat}
            permissions={permissions}
            onChange={onChange}
            readOnly={readOnly}
            searchQuery={search}
            isFirst={idx === 0}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Role inspector sidebar (right panel, 220 px) ────────────────────────────
function RoleInspector({ role, permissions, onPreview }) {
  const routeKeys = useMemo(
    () => new Set(deriveRouteKeysFromPermissions(permissions)),
    [permissions]
  );
  const { cannot }          = useMemo(() => deriveCapabilities(permissions), [permissions]);
  const { granted, total }  = useMemo(() => countGrantedPermissions(permissions), [permissions]);
  const pageCount           = useMemo(
    () => [...routeKeys].filter(r => r !== "profile").length,
    [routeKeys]
  );

  const stats = [
    { label: "Pages",        value: pageCount,            color: T.goldWarm },
    { label: "Permissions",  value: `${granted} / ${total}`, color: T.green },
    ...(cannot.length > 0
      ? [{ label: "Restricted", value: cannot.length, color: T.amber }]
      : []),
  ];

  return (
    <div style={{
      width: 220, flexShrink: 0,
      borderLeft: `1px solid ${T.borderSoft}`,
      display: "flex", flexDirection: "column",
      background: "linear-gradient(180deg, rgba(252,251,247,0.96) 0%, rgba(248,247,242,0.82) 100%)",
      overflowY: "auto",
    }}>

      {/* ── Role identity ── */}
      <div style={{ padding: "16px 16px 14px", borderBottom: `1px solid ${T.borderSoft}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9, flexShrink: 0,
            background: role.color || "#6366f1",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 13, fontWeight: 800,
            boxShadow: `0 2px 8px ${(role.color || "#6366f1")}44`,
          }}>
            {role.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 12.5, fontWeight: 700, color: T.textHead, letterSpacing: "-0.012em",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {role.name}
            </div>
            <div style={{ fontSize: 10, color: T.textFaint, marginTop: 1 }}>
              {role.isSystem ? "System role" : "Custom role"}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.borderSoft}`, display: "flex", flexDirection: "column", gap: 8 }}>
        {stats.map(s => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: T.textMuted }}>{s.label}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: s.color, letterSpacing: "-0.01em" }}>
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {/* ── Sidebar mini-preview ── */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
        <div style={{
          padding: "10px 16px 4px",
          fontSize: 9.5, fontWeight: 700, letterSpacing: "0.09em",
          textTransform: "uppercase", color: T.textFaint,
        }}>
          Sidebar access
        </div>

        {SIDEBAR_GROUPS.map(group => {
          if (group.devOnly) return null;
          const items = group.items.filter(item => item.path);
          if (!items.length) return null;
          return (
            <div key={group.id} style={{ marginBottom: 2 }}>
              <div style={{
                padding: "5px 16px 2px",
                fontSize: 9, fontWeight: 700, letterSpacing: "0.10em",
                textTransform: "uppercase", color: T.textFaint,
              }}>
                {group.label}
              </div>
              {items.map(item => {
                const canAccess = !item.routeKey || routeKeys.has(item.routeKey);
                return (
                  <div key={item.id} style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "3.5px 16px",
                    opacity: canAccess ? 1 : 0.28,
                  }}>
                    <span style={{
                      width: 4, height: 4, borderRadius: "50%", flexShrink: 0,
                      background: canAccess ? T.gold : T.textFaint,
                    }} />
                    <span style={{
                      fontSize: 11.5, lineHeight: 1.3,
                      color: canAccess ? T.textBody : T.textMuted,
                      fontWeight: canAccess ? 500 : 400,
                    }}>
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── Full preview button ── */}
      <div style={{ padding: "12px 16px", borderTop: `1px solid ${T.borderSoft}`, flexShrink: 0 }}>
        <button
          onClick={onPreview}
          style={{
            width: "100%", padding: "7px 12px", borderRadius: 8,
            border: `1px solid ${T.borderSoft}`, background: "transparent",
            fontSize: 11.5, fontWeight: 500, color: T.textMuted, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            transition: "background 120ms, border-color 120ms, color 120ms",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "rgba(245,158,11,0.05)";
            e.currentTarget.style.borderColor = T.borderGold;
            e.currentTarget.style.color = T.goldMid;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = T.borderSoft;
            e.currentTarget.style.color = T.textMuted;
          }}
        >
          Full preview
          <Svg size={11} stroke="currentColor" sw={1.5} d={<polyline points="9 18 15 12 9 6" />} />
        </button>
      </div>
    </div>
  );
}


// ─── Color picker ─────────────────────────────────────────────────────────────
function ColorPicker({ value, onChange, disabled }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7, opacity: disabled ? 0.4 : 1, pointerEvents: disabled ? "none" : "auto" }}>
      {ROLE_COLOR_PRESETS.map(p => (
        <button key={p.hex} onClick={() => onChange(p.hex)} title={p.label} style={{
          width: 20, height: 20, borderRadius: 6, background: p.hex,
          border: "none", cursor: "pointer",
          outline: value === p.hex ? `3px solid ${p.hex}` : "3px solid transparent",
          outlineOffset: 2,
          transform: value === p.hex ? "scale(1.2)" : "scale(1)",
          transition: "transform 140ms, outline 140ms",
        }} />
      ))}
    </div>
  );
}

// ─── Inline name editor ───────────────────────────────────────────────────────
function NameEditor({ name, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(name);
  const ref = useRef();

  useEffect(() => { setVal(name); }, [name]);
  useEffect(() => { if (editing) setTimeout(() => ref.current?.select(), 30); }, [editing]);

  const commit = () => {
    setEditing(false);
    if (val.trim() && val.trim() !== name) onSave(val.trim());
    else setVal(name);
  };

  if (editing) {
    return (
      <input
        ref={ref}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") ref.current?.blur(); if (e.key === "Escape") { setVal(name); setEditing(false); } }}
        style={{
          fontSize: 14, fontWeight: 700, color: T.textBody, fontFamily: "inherit",
          border: "none", borderBottom: `2px solid ${T.gold}`,
          background: "transparent", outline: "none", width: "100%", padding: "0 0 2px",
        }}
      />
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
      onClick={() => setEditing(true)}>
      <span style={{ fontSize: 14, fontWeight: 700, color: T.textBody }}>{name}</span>
      <Svg size={12} d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={T.textMuted} />
    </div>
  );
}

// ─── Audit tab ────────────────────────────────────────────────────────────────
function AuditTab({ roleId }) {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roleId) return;
    setLoading(true);
    roleService.getAuditLogs(roleId)
      .then(r => setLogs(r.logs || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [roleId]);

  if (loading) return (
    <div style={{ textAlign: "center", padding: "48px 0" }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid #fde68a",
        borderTopColor: T.gold, animation: "yd-spin 0.8s linear infinite", margin: "0 auto" }} />
    </div>
  );

  if (!logs.length) return (
    <div style={{ textAlign: "center", padding: "64px 20px" }}>
      <div style={{ fontSize: 40, marginBottom: 14 }}>📋</div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: T.textBody, margin: "0 0 8px" }}>
        No activity yet
      </h3>
      <p style={{ color: T.textMuted, fontSize: 13, maxWidth: 260, margin: "0 auto" }}>
        Changes to this role will be recorded here.
      </p>
    </div>
  );

  const ACTION_META = {
    ROLE_UPDATED:        { icon: "✏️", label: "Role metadata updated", color: T.gold },
    PERMISSIONS_UPDATED: { icon: "🔑", label: "Permissions changed",    color: "#8b5cf6" },
    ROLE_DELETED:        { icon: "🗑️", label: "Role deleted",           color: T.red },
    ROLE_CREATED:        { icon: "✨", label: "Role created",           color: T.green },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, position: "relative" }}>
      {/* Timeline line */}
      <div style={{ position: "absolute", left: 27, top: 24, bottom: 24,
        width: 1, background: T.borderSoft, zIndex: 0 }} />

      {logs.map((log, i) => {
        const meta = ACTION_META[log.action] || { icon: "📝", label: log.action, color: T.textMuted };
        const ts   = log.timestamp ? new Date(log.timestamp) : null;
        const isToday = ts && ts.toDateString() === new Date().toDateString();
        return (
          <div key={i} style={{ display: "flex", gap: 14, marginBottom: 14, position: "relative", zIndex: 1 }}>
            {/* Icon bubble */}
            <div style={{
              width: 36, height: 36, borderRadius: 11, background: T.surface,
              border: `1px solid ${T.borderSoft}`, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 15, flexShrink: 0,
              boxShadow: T.shadowXs,
            }}>
              {meta.icon}
            </div>
            {/* Content */}
            <div style={{ flex: 1, paddingTop: 6 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.textBody }}>
                {meta.label}
              </p>
              <p style={{ margin: "3px 0 0", fontSize: 11, color: T.textMuted }}>
                <span style={{ fontWeight: 600, color: T.textSoft }}>{log.actorId || "System"}</span>
                {" · "}
                {ts ? (
                  isToday
                    ? `Today at ${ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                    : ts.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })
                ) : "—"}
              </p>
              {log.changes?.length > 0 && (
                <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {log.changes.map(c => (
                    <span key={c} style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 5,
                      background: `${meta.color}14`, color: meta.color, border: `1px solid ${meta.color}28` }}>
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Advanced tab ─────────────────────────────────────────────────────────────
function AdvancedTab({ role, onUpdate, permissions }) {
  const HOME_ROUTES = [
    { value: "/",                     label: "Dashboard" },
    { value: "/attendance",           label: "Attendance" },
    { value: "/invoice",              label: "Invoices" },
    { value: "/parent-checkin",       label: "Parent Check-In" },
    { value: "/students",             label: "Students" },
    { value: "/pickup-authorization", label: "Pickup Authorization" },
  ];

  const AdvCard = ({ title, children, icon }) => (
    <div style={{
      borderRadius: 16, border: `1px solid ${T.borderSoft}`, background: T.surface,
      overflow: "hidden", boxShadow: T.shadowSm,
    }}>
      <div style={{
        padding: "11px 18px", borderBottom: `1px solid ${T.borderSoft}`,
        display: "flex", alignItems: "center", gap: 8,
        background: "linear-gradient(180deg, rgba(252,251,247,1) 0%, rgba(252,251,247,0.60) 100%)",
      }}>
        <span style={{ fontSize: 15 }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.08em", color: T.textMuted }}>{title}</span>
      </div>
      <div style={{ padding: "18px" }}>{children}</div>
    </div>
  );

  const SoonBadge = () => (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
      background: "rgba(251,191,36,0.12)", color: T.goldMid, border: `1px solid rgba(251,191,36,0.25)`,
      marginLeft: 8 }}>Coming soon</span>
  );

  const categoryMeta = STAFF_CATEGORIES.find(c => c.id === role.staffCategory);
  const { granted, total } = countGrantedPermissions(permissions || role.permissions || {});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Role Identity */}
      <AdvCard title="Role Identity" icon="🏷️">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Name */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.textMuted,
              textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              Role name
            </label>
            {role.isSystem ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: T.textBody }}>{role.name}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
                  background: "rgba(139,134,128,0.10)", color: T.textMuted,
                  textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  <LockIcon size={8} color={T.textMuted} /> System — read only
                </span>
              </div>
            ) : (
              <NameEditor name={role.name} onSave={name => onUpdate({ name })} />
            )}
          </div>

          {/* Color */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.textMuted,
              textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              Role colour
            </label>
            <ColorPicker
              value={role.color || "#6366f1"}
              onChange={hex => onUpdate({ color: hex })}
              disabled={role.isSystem}
            />
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 20, paddingTop: 8, borderTop: `1px solid ${T.borderSoft}` }}>
            {categoryMeta && (
              <div>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Type</p>
                <p style={{ margin: "3px 0 0", fontSize: 12, fontWeight: 600, color: categoryMeta.color }}>{categoryMeta.label}</p>
              </div>
            )}
            <div>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Staff assigned</p>
              <p style={{ margin: "3px 0 0", fontSize: 12, fontWeight: 600, color: T.textBody }}>{role.usersCount || 0}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Permissions</p>
              <p style={{ margin: "3px 0 0", fontSize: 12, fontWeight: 600, color: T.textBody }}>{granted} / {total}</p>
            </div>
            {role.updatedAt && (
              <div>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Last updated</p>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: T.textBody }}>
                  {new Date(role.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
            )}
          </div>
        </div>
      </AdvCard>

      <AdvCard title="Default Landing Page" icon="🏠">
        <p style={{ fontSize: 12, color: T.textMuted, margin: "0 0 12px" }}>
          Where staff land immediately after signing in.
        </p>
        <select
          value={role.homeRoute || "/"}
          onChange={e => onUpdate({ homeRoute: e.target.value })}
          style={{ padding: "9px 14px", borderRadius: 10, border: `1.5px solid ${T.border}`,
            fontSize: 13, fontFamily: "inherit", outline: "none", background: T.surface,
            color: T.textBody, maxWidth: 280, width: "100%" }}
        >
          {HOME_ROUTES.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </AdvCard>

      <AdvCard title={<span>Center Access <SoonBadge /></span>} icon="🏫">
        <p style={{ fontSize: 12, color: T.textMuted, margin: "0 0 12px" }}>
          Restrict this role to specific school centers.
        </p>
        {[{ id: "all", label: "All centers (default)" }, { id: "specific", label: "Specific centers only" }].map(o => (
          <label key={o.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", cursor: "pointer" }}>
            <input type="radio" name="centerAccess" checked={o.id === "all"} readOnly style={{ accentColor: T.gold }} />
            <span style={{ fontSize: 13, color: T.textBody }}>{o.label}</span>
          </label>
        ))}
      </AdvCard>

      <AdvCard title={<span>Class Access <SoonBadge /></span>} icon="📚">
        <p style={{ fontSize: 12, color: T.textMuted, margin: "0 0 12px" }}>
          Limit which classes this role can manage.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {["Playgroup", "Nursery", "Junior K.G.", "Senior K.G.", "Daycare"].map(cls => (
            <span key={cls} style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 8,
              background: "rgba(251,191,36,0.08)", color: T.goldMid,
              border: `1.5px solid rgba(251,191,36,0.25)` }}>
              ✓ {cls}
            </span>
          ))}
        </div>
        <p style={{ fontSize: 11, color: T.textMuted, margin: "10px 0 0" }}>
          All classes are accessible by default. Class-level restriction coming soon.
        </p>
      </AdvCard>

      <AdvCard title="Financial Controls" icon="💰">
        <p style={{ fontSize: 12, color: T.textMuted, margin: "0 0 14px" }}>
          Fine-grained financial action controls for this role.
        </p>
        {[
          { id: "collect",  label: "Collect fee payments",      default: true  },
          { id: "delete",   label: "Delete payment records",    default: false },
          { id: "refund",   label: "Issue refunds",             default: false },
          { id: "discount", label: "Approve fee discounts",     default: false },
          { id: "editpaid", label: "Edit already-paid invoices",default: false },
        ].map(ctrl => (
          <label key={ctrl.id} style={{ display: "flex", alignItems: "center", gap: 10,
            padding: "8px 0", borderBottom: `1px solid ${T.borderSoft}`, cursor: "pointer" }}>
            <input type="checkbox" defaultChecked={ctrl.default} style={{ accentColor: T.gold, width: 15, height: 15 }} />
            <span style={{ fontSize: 13, color: T.textBody }}>{ctrl.label}</span>
          </label>
        ))}
        <p style={{ fontSize: 11, color: T.textMuted, margin: "10px 0 0" }}>
          Server-side enforcement coming in the next update.
        </p>
      </AdvCard>

      {!role.isSystem && (
        <div style={{ borderRadius: 14, border: "1px solid #fecaca", background: "#fff5f5", padding: 18 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: "#b91c1c", margin: "0 0 6px",
            textTransform: "uppercase", letterSpacing: "0.07em" }}>⚠ Danger Zone</p>
          <p style={{ fontSize: 13, color: "#dc2626", margin: "0 0 14px", lineHeight: 1.5 }}>
            Deleting a role is permanent. All staff must be reassigned first.
          </p>
          <button
            onClick={() => onUpdate({ _delete: true })}
            style={{ padding: "8px 20px", borderRadius: 9, border: "1.5px solid #fca5a5",
              background: "#fff", color: "#dc2626", fontSize: 13, fontWeight: 700, cursor: "pointer",
              transition: "background 140ms" }}
          >
            Delete this role
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sidebar preview modal ────────────────────────────────────────────────────
function SidebarPreviewModal({ role, onClose }) {
  const routeKeys = useMemo(
    () => new Set(deriveRouteKeysFromPermissions(role.permissions || {})),
    [role.permissions]
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.30)", backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "relative", zIndex: 1, width: 320,
        background: T.surfaceGlass,
        backdropFilter: "blur(24px) saturate(1.5)",
        WebkitBackdropFilter: "blur(24px) saturate(1.5)",
        borderRadius: 22,
        border: `1px solid rgba(255,255,255,0.72)`,
        boxShadow: T.shadowLg,
        animation: "yd-fade-up 240ms cubic-bezier(0.16,1,0.3,1)",
        overflow: "hidden", maxHeight: "88vh",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{
          padding: "16px 20px", borderBottom: `1px solid ${T.borderSoft}`,
          background: "linear-gradient(180deg, rgba(252,251,247,0.98) 0%, rgba(252,251,247,0.60) 100%)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase", color: T.textMuted }}>Sidebar Preview</p>
            <p style={{ margin: "3px 0 0", fontSize: 15, fontWeight: 800, color: T.textHead }}>
              {role.name}
            </p>
          </div>
          <XBtn onClick={onClose} />
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "12px 0" }}>
          {SIDEBAR_GROUPS.map(group => {
            if (group.devOnly) return null;
            const accessible = group.items.filter(item => !item.routeKey || routeKeys.has(item.routeKey));
            return (
              <div key={group.id} style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em",
                  textTransform: "uppercase", color: "#c0a86a",
                  padding: "0 18px 5px", margin: 0 }}>
                  {group.label}
                </p>
                {group.items.map(item => {
                  if (!item.path) return null;
                  const canAccess = !item.routeKey || routeKeys.has(item.routeKey);
                  return (
                    <div key={item.id} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "7px 18px",
                      opacity: canAccess ? 1 : 0.32,
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                        background: canAccess ? T.gold : T.border }} />
                      <span style={{ fontSize: 13, fontWeight: canAccess ? 600 : 400,
                        color: canAccess ? T.textBody : T.textMuted }}>
                        {item.label}
                      </span>
                      {!canAccess && (
                        <span style={{ marginLeft: "auto", fontSize: 10, color: T.textMuted }}>
                          No access
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div style={{ padding: "12px 20px", borderTop: `1px solid ${T.borderSoft}`,
          fontSize: 11, color: T.textFaint, textAlign: "center",
          background: "rgba(250,249,246,0.50)" }}>
          Based on current settings · {routeKeys.size - 1} pages accessible
        </div>
      </div>
    </div>
  );
}

// ─── Clone modal ──────────────────────────────────────────────────────────────
function CloneModal({ role, onClose, onCreate, toast }) {
  const [name, setName]     = useState(`${role.name} (copy)`);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef();

  useEffect(() => { setTimeout(() => { inputRef.current?.select(); }, 60); }, []);

  const handleClone = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const { role: cloned } = await roleService.create({
        name:          name.trim(),
        description:   `Cloned from ${role.name}`,
        color:         role.color,
        permissions:   role.permissions || {},
        staffCategory: role.staffCategory,
      });
      onCreate({ _cloned: cloned });
      toast.show(`"${cloned.name}" created.`);
      onClose();
    } catch (err) {
      toast.show(err?.response?.data?.error || "Failed to duplicate role.", "err");
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.28)", backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "relative", zIndex: 1, width: 380,
        background: T.surfaceGlass,
        backdropFilter: "blur(24px) saturate(1.5)",
        WebkitBackdropFilter: "blur(24px) saturate(1.5)",
        borderRadius: 22,
        border: `1px solid rgba(255,255,255,0.72)`,
        padding: "24px 26px",
        boxShadow: T.shadowLg,
        animation: "yd-fade-up 200ms cubic-bezier(0.16,1,0.3,1)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <RoleAvatar name={role.name} color={role.color || "#6366f1"} size={44} locked={role.isSystem} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.textHead }}>Duplicate Role</p>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: T.textMuted }}>
              Cloning all permissions from "{role.name}"
            </p>
          </div>
          <XBtn onClick={onClose} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.textBody, marginBottom: 7 }}>
            New role name <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <input
            ref={inputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !saving && handleClone()}
            style={{
              width: "100%", boxSizing: "border-box", padding: "10px 13px",
              borderRadius: 10, border: `1.5px solid ${T.border}`,
              fontSize: 13, fontFamily: "inherit", outline: "none",
              background: T.surface, color: T.textBody,
              transition: "border-color 140ms",
            }}
            onFocus={e => (e.target.style.borderColor = T.gold)}
            onBlur={e  => (e.target.style.borderColor = T.border)}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "10px 0", borderRadius: 10,
            border: `1.5px solid ${T.border}`, background: T.surface,
            fontSize: 13, fontWeight: 600, color: T.textSoft, cursor: "pointer",
          }}>
            Cancel
          </button>
          <button onClick={handleClone} disabled={saving || !name.trim()} style={{
            flex: 2, padding: "10px 0", borderRadius: 10, border: "none",
            background: saving || !name.trim()
              ? "#fde68a"
              : "linear-gradient(135deg,#fbbf24,#f59e0b)",
            fontSize: 13, fontWeight: 700, color: "#78350f",
            cursor: saving || !name.trim() ? "not-allowed" : "pointer",
            boxShadow: !saving && name.trim() ? "0 2px 8px rgba(234,179,8,0.28)" : "none",
          }}>
            {saving ? "Creating…" : "⎘  Duplicate Role"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Action button ────────────────────────────────────────────────────────────
function ActionBtn({ label, icon, onClick, danger }) {
  return (
    <button onClick={onClick} className="yd-action-btn" style={{
      display: "flex", alignItems: "center", gap: 5,
      padding: "6px 13px", borderRadius: 9, border: `1.5px solid ${danger ? "#fca5a5" : T.border}`,
      background: danger ? "#fff5f5" : T.surface,
      fontSize: 12, fontWeight: 600, color: danger ? "#dc2626" : T.textSoft,
      cursor: "pointer", whiteSpace: "nowrap",
    }}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      {label}
    </button>
  );
}

// ─── Role workspace (right panel) ─────────────────────────────────────────────
function RoleWorkspace({ role, roles, onRoleChange, toast }) {
  const [tab, setTab]                 = useState("permissions");
  const [permissions, setPermissions] = useState(() => normalizePermissions(role.permissions));
  const [saving, setSaving]           = useState(false);
  const [savedFlash, setSavedFlash]   = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showClone, setShowClone]     = useState(false);

  // Reset when role changes
  useEffect(() => {
    setPermissions(normalizePermissions(role.permissions));
    setTab("permissions");
  }, [role.roleId]);

  const isDirty = useMemo(() => {
    const orig = normalizePermissions(role.permissions);
    return JSON.stringify(permissions) !== JSON.stringify(orig);
  }, [permissions, role.permissions]);

  const saveAll = async () => {
    setSaving(true);
    try {
      await roleService.updatePermissions(role.roleId, permissions);
      onRoleChange({ ...role, permissions });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1400);
      toast.show("Role saved successfully.");
    } catch (err) {
      toast.show(err?.response?.data?.error || "Failed to save role.", "err");
    } finally {
      setSaving(false);
    }
  };

  const handleMetaUpdate = async updates => {
    if (updates._delete) {
      if (!window.confirm(`Delete "${role.name}"? This cannot be undone.`)) return;
      try {
        await roleService.remove(role.roleId);
        onRoleChange(null);
        toast.show(`"${role.name}" deleted.`);
      } catch (err) {
        toast.show(err?.response?.data?.error || "Cannot delete role.", "err");
      }
      return;
    }
    try {
      await roleService.update(role.roleId, updates);
      onRoleChange({ ...role, ...updates });
    } catch {
      toast.show("Failed to update role.", "err");
    }
  };

  const handleArchive = async () => {
    if (!window.confirm(`Archive "${role.name}"? It will be hidden from role selection.`)) return;
    await handleMetaUpdate({ isActive: false });
    toast.show(`"${role.name}" archived.`);
  };

  const TABS = [
    { id: "permissions", label: "Permissions" },
    { id: "advanced",    label: "Advanced" },
    { id: "audit",       label: "Activity" },
  ];

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, height: "100%" }}>

        {/* ── Tab bar + ghost actions ───────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: `1px solid ${T.borderSoft}`,
          padding: "0 24px 0 40px",
          background: "linear-gradient(180deg, #ffffff 0%, rgba(252,251,247,0.60) 100%)",
          flexShrink: 0,
        }}>
          {/* Tabs */}
          <div style={{ display: "flex" }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: "11px 14px", border: "none", background: "none", cursor: "pointer",
                fontSize: 13, fontWeight: tab === t.id ? 580 : 400,
                color: tab === t.id ? T.textHead : T.textMuted,
                borderBottom: `2px solid ${tab === t.id ? T.gold : "transparent"}`,
                transition: "color 140ms ease, border-color 140ms ease",
                letterSpacing: "-0.012em",
              }}>
                {t.label}
              </button>
            ))}
          </div>
          {/* Ghost actions */}
          <div style={{ display: "flex", gap: 2 }}>
            {[
              { label: "Preview", onClick: () => setShowPreview(true) },
              { label: "Duplicate", onClick: () => setShowClone(true) },
              ...(!role.isSystem && role.isActive ? [{ label: "Archive", onClick: handleArchive }] : []),
            ].map(btn => (
              <button key={btn.label} onClick={btn.onClick} className="yd-action-btn" style={{
                padding: "5px 10px", border: "none", background: "transparent",
                fontSize: 11.5, fontWeight: 450, color: T.textMuted, cursor: "pointer",
                borderRadius: 7, letterSpacing: "-0.01em",
              }}>
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab content ───────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {tab === "permissions" && (
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              {/* Left — scrollable permission matrix */}
              <div style={{ flex: 1, overflow: "auto", padding: "28px 32px 120px 40px", minWidth: 0 }}>
                <PermissionMatrix
                  permissions={permissions}
                  onChange={setPermissions}
                  readOnly={false}
                />
              </div>

              {/* Right — compact role inspector */}
              <RoleInspector
                role={role}
                permissions={permissions}
                onPreview={() => setShowPreview(true)}
              />
            </div>
          )}

          {tab === "advanced" && (
            <div style={{ flex: 1, overflow: "auto", padding: "28px 0 60px" }}>
              <div style={{ maxWidth: 700, margin: "0 auto", padding: "0 40px" }}>
                <AdvancedTab role={role} onUpdate={handleMetaUpdate} permissions={permissions} />
              </div>
            </div>
          )}

          {tab === "audit" && (
            <div style={{ flex: 1, overflow: "auto", padding: "28px 0 60px" }}>
              <div style={{ maxWidth: 660, margin: "0 auto", padding: "0 40px" }}>
                <AuditTab roleId={role.roleId} />
              </div>
            </div>
          )}
        </div>

        {/* ── Floating save island — fixed, centered, glass ─────────────── */}
        {isDirty && tab === "permissions" && (
          <div style={{
            position: "fixed", bottom: 28, left: "50%",
            transform: "translateX(-50%)",
            zIndex: 500,
            background: "rgba(255,255,255,0.88)",
            backdropFilter: "blur(20px) saturate(1.4)",
            WebkitBackdropFilter: "blur(20px) saturate(1.4)",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.62)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.11), 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
            padding: "10px 14px",
            display: "flex", alignItems: "center", gap: 10,
            animation: "yd-rise-in 220ms cubic-bezier(0.16,1,0.3,1)",
            whiteSpace: "nowrap",
          }}>
            {/* Gold pulse dot */}
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: T.gold,
              boxShadow: `0 0 0 2px rgba(245,158,11,0.22)`,
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 12, color: T.textSoft, fontWeight: 500 }}>
              Unsaved changes
            </span>
            {/* Divider */}
            <span style={{ width: 1, height: 16, background: T.borderSoft, flexShrink: 0 }} />
            <button
              onClick={() => setPermissions(normalizePermissions(role.permissions))}
              style={{
                padding: "5px 13px", borderRadius: 8,
                border: `1px solid ${T.borderSoft}`,
                background: "transparent",
                fontSize: 12, fontWeight: 500, color: T.textMuted, cursor: "pointer",
                transition: "border-color 100ms, color 100ms, background 100ms",
              }}
              onMouseEnter={e => { e.currentTarget.style.color = T.textBody; e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = "rgba(0,0,0,0.03)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = T.textMuted; e.currentTarget.style.borderColor = T.borderSoft; e.currentTarget.style.background = "transparent"; }}
            >
              Discard
            </button>
            <button
              onClick={saveAll}
              disabled={saving}
              style={{
                padding: "6px 18px", borderRadius: 9, border: "none",
                background: savedFlash
                  ? "linear-gradient(135deg,#34d399,#059669)"
                  : T.goldGrad,
                fontSize: 12, fontWeight: 650,
                color: savedFlash ? "#fff" : T.goldDark,
                cursor: saving ? "wait" : "pointer",
                boxShadow: savedFlash
                  ? "0 2px 10px rgba(5,150,105,0.30)"
                  : "0 2px 10px rgba(245,158,11,0.28), 0 1px 3px rgba(0,0,0,0.10)",
                transition: "background 300ms cubic-bezier(0.16,1,0.3,1), box-shadow 200ms, transform 80ms",
                letterSpacing: "-0.01em",
              }}
              onMouseEnter={e => { if (!saving) e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
            >
              {saving ? "Saving…" : savedFlash ? "✓ Saved" : "Save changes"}
            </button>
          </div>
        )}
      </div>

      {showPreview && (
        <SidebarPreviewModal
          role={{ ...role, permissions }}
          onClose={() => setShowPreview(false)}
        />
      )}
      {showClone && (
        <CloneModal
          role={{ ...role, permissions }}
          onClose={() => setShowClone(false)}
          onCreate={onRoleChange}
          toast={toast}
        />
      )}
    </>
  );
}

// ─── New Role slide-in panel ───────────────────────────────────────────────────
function NewRolePanel({ roles, onClose, onCreate }) {
  const [step, setStep]     = useState(0);
  const [form, setForm]     = useState({
    name: "", description: "", color: "#6366f1",
    cloneFrom: "", staffCategory: "", homeRoute: "/",
    _templatePerms: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const nameRef = useRef();

  useEffect(() => { if (step === 1) setTimeout(() => nameRef.current?.focus(), 60); }, [step]);

  const applyTemplate = t => {
    setForm(f => ({
      ...f,
      name:           t.label,
      description:    t.description,
      color:          t.color,
      staffCategory:  t.category,
      homeRoute:      t.homeRoute,
      _templatePerms: t.permissions,
    }));
    setStep(1);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) { setError("Role name is required."); return; }
    setSaving(true);
    setError("");
    try {
      let permissions = buildEmptyPermissions();
      if (form._templatePerms) {
        permissions = normalizePermissions(form._templatePerms);
      } else if (form.cloneFrom) {
        const src = roles.find(r => r.roleId === form.cloneFrom);
        if (src?.permissions) permissions = normalizePermissions(src.permissions);
      }
      const { role } = await roleService.create({
        name:          form.name.trim(),
        description:   form.description.trim(),
        color:         form.color,
        homeRoute:     form.homeRoute,
        staffCategory: form.staffCategory,
        permissions,
      });
      onCreate(role);
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to create role.");
      setSaving(false);
    }
  };

  const inputStyle = {
    width: "100%", boxSizing: "border-box", padding: "9px 13px",
    borderRadius: 10, border: `1.5px solid ${T.border}`,
    fontSize: 13, fontFamily: "inherit", outline: "none",
    background: T.surface, color: T.textBody,
    transition: "border-color 140ms",
  };

  const Field = ({ label, children, required, mt = 0 }) => (
    <div style={{ marginTop: mt }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.textBody, marginBottom: 7 }}>
        {label}{required && <span style={{ color: "#ef4444" }}> *</span>}
      </label>
      {children}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 600, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.22)", backdropFilter: "blur(2px)" }} />
      <div style={{
        position: "relative", zIndex: 1, width: 440, height: "100%",
        background: T.surface,
        boxShadow: "-12px 0 60px rgba(0,0,0,0.14), -2px 0 8px rgba(0,0,0,0.06)",
        display: "flex", flexDirection: "column",
        animation: "yd-slide-in-right 280ms cubic-bezier(0.16,1,0.3,1)",
        borderLeft: `1px solid rgba(255,255,255,0.50)`,
      }}>
        {/* Header */}
        <div style={{
          padding: "22px 26px 18px",
          borderBottom: `1px solid ${T.borderSoft}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "linear-gradient(180deg, rgba(252,251,247,1) 0%, rgba(255,255,255,0.70) 100%)",
        }}>
          <div>
            {step === 1 && (
              <button onClick={() => setStep(0)} style={{
                fontSize: 12, fontWeight: 600, color: T.textMuted, background: "none",
                border: "none", cursor: "pointer", padding: 0, marginBottom: 6,
                display: "flex", alignItems: "center", gap: 4,
              }}>
                <Svg size={12} d={<polyline points="15 18 9 12 15 6" />} sw={2} /> Back
              </button>
            )}
            <h2 style={{ fontSize: 17, fontWeight: 800, color: T.textHead, margin: 0 }}>
              {step === 0 ? "New Role" : "Role Details"}
            </h2>
            <p style={{ fontSize: 12, color: T.textMuted, margin: "4px 0 0" }}>
              {step === 0 ? "Choose a starting point" : "Fill in the details below"}
            </p>
          </div>
          <XBtn onClick={onClose} />
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "20px 26px" }}>
          {step === 0 ? (
            <>
              {/* Blank start */}
              <button onClick={() => setStep(1)} style={{
                width: "100%", padding: "16px", borderRadius: 14, marginBottom: 20,
                border: `2px dashed rgba(251,191,36,0.40)`,
                background: "rgba(254,243,199,0.25)", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 14, textAlign: "left",
                transition: "background 140ms",
              }}>
                <span style={{ fontSize: 26 }}>✨</span>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.textHead }}>Start blank</p>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: T.textMuted }}>
                    Configure all permissions from scratch
                  </p>
                </div>
              </button>

              <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em",
                textTransform: "uppercase", color: T.textMuted, marginBottom: 10 }}>
                Role Templates
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {ROLE_TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => applyTemplate(t)} style={{
                    width: "100%", padding: "12px 14px", borderRadius: 12,
                    border: `1.5px solid ${T.border}`,
                    background: T.surface, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 12, textAlign: "left",
                    transition: "border-color 140ms, background 140ms, transform 80ms",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(251,191,36,0.50)"; e.currentTarget.style.background = "rgba(254,243,199,0.15)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.surface; }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: t.color,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20, flexShrink: 0, boxShadow: `0 2px 8px ${t.color}44` }}>
                      {t.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.textHead }}>{t.label}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: T.textMuted,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.description}
                      </p>
                    </div>
                    <Svg size={14} d={<polyline points="9 18 15 12 9 6" />} sw={2} />
                  </button>
                ))}
              </div>

              {roles.length > 0 && (
                <>
                  <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em",
                    textTransform: "uppercase", color: T.textMuted, margin: "20px 0 10px" }}>
                    Clone Existing Role
                  </p>
                  <select
                    onChange={e => {
                      if (!e.target.value) return;
                      setForm(f => ({ ...f, cloneFrom: e.target.value }));
                      setStep(1);
                    }}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10,
                      border: `1.5px solid ${T.border}`, fontSize: 13, fontFamily: "inherit",
                      outline: "none", background: T.surface, color: T.textBody }}
                    defaultValue=""
                  >
                    <option value="">Select a role to clone…</option>
                    {roles.map(r => <option key={r.roleId} value={r.roleId}>{r.name}</option>)}
                  </select>
                </>
              )}
            </>
          ) : (
            <>
              {form._templatePerms && (
                <div style={{ padding: "11px 14px", borderRadius: 12,
                  background: "rgba(251,191,36,0.08)", border: `1px solid rgba(251,191,36,0.25)`,
                  marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>
                    {ROLE_TEMPLATES.find(t => t.label === form.name)?.emoji || "✨"}
                  </span>
                  <div>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: T.goldMid }}>
                      {form.name} template applied
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: T.goldMid }}>
                      Permissions pre-configured — you can adjust after creating
                    </p>
                  </div>
                </div>
              )}

              <Field label="Role Name" required>
                <input
                  ref={nameRef}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Transport Manager"
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = T.gold)}
                  onBlur={e  => (e.target.style.borderColor = T.border)}
                />
              </Field>

              <Field label="Description" mt={16}>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What does this role do? Who uses it?"
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical" }}
                  onFocus={e => (e.target.style.borderColor = T.gold)}
                  onBlur={e  => (e.target.style.borderColor = T.border)}
                />
              </Field>

              <Field label="Staff Category" mt={16}>
                <select
                  value={form.staffCategory}
                  onChange={e => setForm(f => ({ ...f, staffCategory: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">No category</option>
                  {STAFF_CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Role Colour" mt={16}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: form.color,
                    flexShrink: 0, boxShadow: `0 2px 8px ${form.color}44` }} />
                  <span style={{ fontSize: 12, fontFamily: "monospace", color: T.textBody }}>{form.color}</span>
                </div>
                <ColorPicker value={form.color} onChange={hex => setForm(f => ({ ...f, color: hex }))} />
              </Field>

              {error && (
                <div style={{ padding: "10px 14px", borderRadius: 10, background: "#fef2f2",
                  border: "1px solid #fecaca", color: "#b91c1c", fontSize: 13, marginTop: 18 }}>
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 26px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "10px 0", borderRadius: 10, border: `1.5px solid ${T.border}`,
            background: T.surface, fontSize: 13, fontWeight: 600, color: T.textSoft, cursor: "pointer",
          }}>
            Cancel
          </button>
          {step === 1 && (
            <button
              onClick={handleCreate}
              disabled={saving || !form.name.trim()}
              style={{
                flex: 2, padding: "10px 0", borderRadius: 10, border: "none",
                background: saving || !form.name.trim()
                  ? "#fde68a"
                  : "linear-gradient(135deg,#fbbf24,#f59e0b)",
                fontSize: 13, fontWeight: 700, color: "#78350f",
                cursor: saving || !form.name.trim() ? "not-allowed" : "pointer",
                boxShadow: "0 2px 8px rgba(234,179,8,0.24)",
              }}
            >
              {saving ? "Creating…" : "Create Role →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Role dropdown item ───────────────────────────────────────────────────────
function RoleDropdownItem({ role, isSelected, onClick }) {
  const cat = role.staffCategory ? STAFF_CATEGORIES.find(c => c.id === role.staffCategory) : null;
  return (
    <button
      onClick={onClick}
      className="yd-role-dropdown-item"
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 10,
        padding: "7px 10px", borderRadius: 9, border: "none", cursor: "pointer",
        background: isSelected ? "rgba(251,191,36,0.10)" : "transparent",
        textAlign: "left",
      }}
    >
      {/* Color dot */}
      <div style={{
        width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
        background: role.color || "#6366f1",
        boxShadow: `0 0 0 1.5px ${(role.color || "#6366f1")}40`,
      }} />

      {/* Name + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: isSelected ? 700 : 500,
          color: isSelected ? T.textHead : T.textBody,
          display: "flex", alignItems: "center", gap: 5,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {role.name}
          {role.isSystem && <LockIcon size={9} color={T.textMuted} />}
          {!role.isActive && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4,
              background: "#f1f5f9", color: T.textMuted, textTransform: "uppercase" }}>
              Archived
            </span>
          )}
        </div>
        {(role.usersCount > 0 || cat) && (
          <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1.5 }}>
            {role.usersCount > 0 && `${role.usersCount} staff`}
            {role.usersCount > 0 && cat && " · "}
            {cat && <span style={{ color: cat.color }}>{cat.label}</span>}
          </div>
        )}
      </div>

      {isSelected && (
        <Svg size={12} d="M20 6 9 17l-5-5" stroke={T.goldMid} sw={2.5} style={{ flexShrink: 0 }} />
      )}
    </button>
  );
}

// ─── Role dropdown selector ────────────────────────────────────────────────────
function RoleDropdown({ roles, selected, onSelect, onNew }) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState("");
  const wrapRef    = useRef();
  const searchRef  = useRef();

  // Close on outside click / ESC
  useEffect(() => {
    if (!open) return;
    function onMouse(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) { setOpen(false); setSearch(""); }
    }
    function onKey(e) {
      if (e.key === "Escape") { setOpen(false); setSearch(""); }
    }
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown",   onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown",   onKey);
    };
  }, [open]);

  // Auto-focus search on open
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 40);
  }, [open]);

  const filtered = useMemo(() => {
    if (!search) return roles;
    const q = search.toLowerCase();
    return roles.filter(r => r.name.toLowerCase().includes(q) || (r.description || "").toLowerCase().includes(q));
  }, [roles, search]);

  const systemRoles = filtered.filter(r =>  r.isSystem);
  const customRoles = filtered.filter(r => !r.isSystem);

  const handleSelect = (roleId) => {
    onSelect(roleId);
    setOpen(false);
    setSearch("");
  };

  const sectionLabel = (text) => (
    <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase",
      color: T.textMuted, padding: "8px 10px 4px" }}>
      {text}
    </div>
  );

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>

      {/* ── Trigger button ── */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 9,
          padding: "7px 11px 7px 9px", borderRadius: 10,
          border: `1px solid ${open ? T.borderGold : T.border}`,
          background: open ? "rgba(245,158,11,0.04)" : T.surface,
          cursor: "pointer", minWidth: 195, maxWidth: 275,
          boxShadow: open
            ? `${T.shadowGold}, ${T.shadowSm}`
            : T.shadowSm,
          transition: "border-color 160ms ease, box-shadow 160ms ease, background 160ms ease",
        }}
      >
        {selected ? (
          <>
            {/* Compact avatar */}
            <div style={{
              width: 26, height: 26, borderRadius: 8, flexShrink: 0,
              background: selected.color || "#6366f1",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 800, fontSize: 12,
              boxShadow: `0 2px 6px ${(selected.color || "#6366f1")}44`,
            }}>
              {selected.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.textHead,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {selected.name}
              </div>
              {selected.usersCount > 0 && (
                <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>
                  {selected.usersCount} staff assigned
                </div>
              )}
            </div>
            {selected.isSystem && (
              <LockIcon size={10} color={T.textMuted} />
            )}
          </>
        ) : (
          <span style={{ fontSize: 13, color: T.textMuted, flex: 1, textAlign: "left" }}>
            Select a role…
          </span>
        )}
        <ChevronDown open={open} size={13} />
      </button>

      {/* ── Floating dropdown — glassmorphism ── */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 400,
          width: 300,
          background: T.surfaceGlass,
          backdropFilter: "blur(24px) saturate(1.6)",
          WebkitBackdropFilter: "blur(24px) saturate(1.6)",
          borderRadius: 16,
          border: `1px solid rgba(255,255,255,0.70)`,
          boxShadow: T.shadowLg,
          animation: "yd-fade-up 180ms cubic-bezier(0.16,1,0.3,1)",
          overflow: "hidden",
        }}>
          {/* Search */}
          <div style={{ padding: "10px 10px 6px", borderBottom: `1px solid ${T.borderSoft}` }}>
            <div style={{ position: "relative" }}>
              <Svg size={12} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search roles…"
                style={{
                  width: "100%", boxSizing: "border-box", padding: "7px 10px 7px 28px",
                  borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg,
                  fontSize: 12, fontFamily: "inherit", outline: "none", color: T.textBody,
                  transition: "border-color 120ms",
                }}
                onFocus={e => (e.target.style.borderColor = T.gold)}
                onBlur={e  => (e.target.style.borderColor = T.border)}
              />
            </div>
          </div>

          {/* Role groups */}
          <div style={{ maxHeight: 340, overflow: "auto", padding: "6px 8px" }}>
            {filtered.length === 0 && (
              <p style={{ fontSize: 12, color: T.textMuted, textAlign: "center", padding: "24px 0" }}>
                No roles match "{search}"
              </p>
            )}
            {systemRoles.length > 0 && (
              <>
                {sectionLabel("System Roles")}
                {systemRoles.map(role => (
                  <RoleDropdownItem
                    key={role.roleId}
                    role={role}
                    isSelected={role.roleId === selected?.roleId}
                    onClick={() => handleSelect(role.roleId)}
                  />
                ))}
              </>
            )}
            {customRoles.length > 0 && (
              <>
                {sectionLabel("Custom Roles")}
                {customRoles.map(role => (
                  <RoleDropdownItem
                    key={role.roleId}
                    role={role}
                    isSelected={role.roleId === selected?.roleId}
                    onClick={() => handleSelect(role.roleId)}
                  />
                ))}
              </>
            )}
          </div>

          {/* Create new role inline action */}
          <div style={{ padding: "6px 10px 10px", borderTop: `1px solid ${T.borderSoft}` }}>
            <button
              onClick={() => { setOpen(false); setSearch(""); onNew(); }}
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 10,
                border: `1.5px dashed rgba(251,191,36,0.45)`,
                background: "rgba(254,243,199,0.22)",
                color: T.goldMid, fontSize: 12, fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                transition: "background 120ms, border-color 120ms",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(254,243,199,0.45)"; e.currentTarget.style.borderColor = "rgba(251,191,36,0.65)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(254,243,199,0.22)"; e.currentTarget.style.borderColor = "rgba(251,191,36,0.45)"; }}
            >
              <PlusIcon size={12} />
              Create new role
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Empty state illustration ─────────────────────────────────────────────────
function EmptyState({ onNew }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <div style={{ textAlign: "center", maxWidth: 360 }}>
        {/* SVG illustration */}
        <svg width="120" height="96" viewBox="0 0 120 96" fill="none" style={{ marginBottom: 24 }}>
          <rect x="12" y="24" width="96" height="60" rx="12" fill="#fef9e7" stroke="#fde68a" strokeWidth="2"/>
          <rect x="24" y="36" width="40" height="5" rx="2.5" fill="#fde68a"/>
          <rect x="24" y="47" width="28" height="5" rx="2.5" fill="#fde68a" opacity="0.6"/>
          <rect x="24" y="58" width="34" height="5" rx="2.5" fill="#fde68a" opacity="0.4"/>
          <circle cx="86" cy="48" r="14" fill="#f59e0b" opacity="0.15"/>
          <path d="M80 48h12M86 42v12" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx="24" cy="14" r="8" fill="#fef3c7" stroke="#fde68a" strokeWidth="1.5"/>
          <path d="M21 14h6M24 11v6" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="96" cy="20" r="6" fill="#fef3c7" stroke="#fde68a" strokeWidth="1.5"/>
          <path d="M93 20h6M96 17v6" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: T.textHead, margin: "0 0 10px", letterSpacing: "-0.02em" }}>
          No roles yet
        </h3>
        <p style={{ fontSize: 14, color: T.textMuted, margin: "0 0 24px", lineHeight: 1.6 }}>
          Roles control exactly what each person can see and do. Start with a template or build from scratch.
        </p>
        <button onClick={onNew} style={{
          padding: "11px 28px", borderRadius: 12, border: "none",
          background: "linear-gradient(135deg,#fbbf24,#f59e0b)",
          color: "#78350f", fontWeight: 700, cursor: "pointer",
          fontSize: 14, boxShadow: "0 3px 14px rgba(234,179,8,0.32)",
          transition: "box-shadow 140ms, transform 80ms",
        }}>
          Create your first role →
        </button>
      </div>
    </div>
  );
}

// ─── Select-a-role placeholder ────────────────────────────────────────────────
function SelectRolePlaceholder() {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 14 }}>🛡️</div>
        <p style={{ fontSize: 14, color: T.textMuted }}>Select a role to manage its permissions</p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function RolesPermissions() {
  const [roles, setRoles]           = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [showNew, setShowNew]       = useState(false);
  const toast = useToast();

  useEffect(() => {
    roleService.getAll()
      .then(r => {
        const list = r.roles || [];
        setRoles(list);
        if (list.length) setSelectedId(list[0].roleId);
      })
      .catch(() => toast.show("Failed to load roles.", "err"))
      .finally(() => setLoading(false));
  }, []);

  const selected = useMemo(
    () => roles.find(r => r.roleId === selectedId) || null,
    [roles, selectedId]
  );

  const handleRoleChange = useCallback(updated => {
    if (!updated) {
      setRoles(prev => {
        const next = prev.filter(r => r.roleId !== selectedId);
        setSelectedId(next[0]?.roleId || null);
        return next;
      });
      return;
    }
    if (updated._cloned) {
      setRoles(prev => [...prev, updated._cloned]);
      setSelectedId(updated._cloned.roleId);
      return;
    }
    setRoles(prev => prev.map(r => r.roleId === updated.roleId ? { ...r, ...updated } : r));
  }, [selectedId]);

  const handleCreated = useCallback(role => {
    setRoles(prev => [...prev, role]);
    setSelectedId(role.roleId);
    setShowNew(false);
    toast.show(`"${role.name}" created.`);
  }, []);

  const handleSelect = useCallback(id => {
    setSelectedId(id);
  }, []);

  return (
    <>
      <style>{PAGE_CSS}</style>

      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: T.bg, position: "relative" }}>

        {/* Page header */}
        <div style={{
          padding: "15px 40px",
          borderBottom: `1px solid ${T.borderSoft}`,
          background: "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(252,251,247,0.80) 100%)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0, gap: 16,
        }}>
          {/* Title */}
          <div style={{ flexShrink: 0 }}>
            <h1 style={{
              fontSize: 17, fontWeight: 600, color: T.textHead, margin: 0,
              letterSpacing: "-0.025em", lineHeight: 1.2,
            }}>
              Roles & Permissions
            </h1>
          </div>

          {/* Role switcher dropdown — grows to fill space between title and button */}
          {!loading && roles.length > 0 && (
            <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
              <RoleDropdown
                roles={roles}
                selected={selected}
                onSelect={handleSelect}
                onNew={() => setShowNew(true)}
              />
            </div>
          )}

          {/* New Role button */}
          <button
            onClick={() => setShowNew(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 10, border: "none",
              background: T.goldGrad,
              color: T.goldDark, fontSize: 12.5, fontWeight: 650, cursor: "pointer",
              boxShadow: `0 1px 3px rgba(0,0,0,0.12), 0 2px 10px rgba(245,158,11,0.26)`,
              flexShrink: 0, letterSpacing: "-0.01em",
              transition: "box-shadow 160ms ease, transform 100ms ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 2px 6px rgba(0,0,0,0.14), 0 4px 18px rgba(245,158,11,0.36)`; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 1px 3px rgba(0,0,0,0.12), 0 2px 10px rgba(245,158,11,0.26)`; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            <PlusIcon size={12} />
            New Role
          </button>
        </div>

        {/* Body — full width, no left panel */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {loading ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", margin: "0 auto 16px",
                  border: "3px solid #fde68a", borderTopColor: T.gold,
                  animation: "yd-spin 0.8s linear infinite" }} />
                <p style={{ color: T.textMuted, fontSize: 13 }}>Loading roles…</p>
              </div>
            </div>
          ) : roles.length === 0 ? (
            <EmptyState onNew={() => setShowNew(true)} />
          ) : selected ? (
            <RoleWorkspace
              key={selected.roleId}
              role={selected}
              roles={roles}
              onRoleChange={handleRoleChange}
              toast={toast}
            />
          ) : (
            <SelectRolePlaceholder />
          )}
        </div>
      </div>

      {showNew && (
        <NewRolePanel
          roles={roles}
          onClose={() => setShowNew(false)}
          onCreate={handleCreated}
        />
      )}

      <ToastLayer list={toast.list} />
    </>
  );
}
