/**
 * CareHygiene.jsx — Parent Module · Daily Care · Care & Hygiene (read-only)
 * ────────────────────────────────────────────────────────────────────────────
 * Shows a child's care events for a given day (all 7 types).
 * Reads from GET /api/parent/care (ownership-scoped). Theme tokens only.
 */

import { useEffect, useMemo, useState } from "react";
import useParentProfile from "../hooks/useParentProfile";
import useCareLog from "../hooks/useCareLog";
import { colors, spacing, radius, shadows, typography } from "../theme";

const todayISO = () => new Date().toISOString().slice(0, 10);

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

// Per-type accent colours using the design-system palette
const TYPE_ACCENT = {
  Urine:          { bg: "#FEF9C3", border: "#FDE047", text: "#713F12",  emoji: "🟡" },
  Motion:         { bg: colors.infoSoft,    border: colors.infoBorder,    text: colors.info,    emoji: "🟤" },
  Both:           { bg: colors.successSoft, border: colors.successBorder, text: colors.success, emoji: "🟢" },
  "Diaper Change":{ bg: colors.warningSoft, border: colors.warningBorder, text: colors.warning,  emoji: "🔵" },
  "Toilet Visit": { bg: "#F1F5F9", border: "#94A3B8", text: "#1E293B",  emoji: "🚽" },
  Accident:       { bg: "#FEE2E2", border: "#FCA5A5", text: "#7F1D1D",  emoji: "⚠️" },
  "Water Refilled":{ bg: "#CFFAFE", border: "#67E8F9", text: "#164E63", emoji: "💧" },
};
const defaultAccent = { bg: colors.yellow50, border: colors.yellow200, text: colors.yellow700, emoji: "🩺" };

// ── Reusable sub-components ─────────────────────────────────────────

function Pills({ items, active, onSelect }) {
  return (
    <div style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap" }}>
      {items.map(item => {
        const sel = item.id === active;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            style={{
              padding: `${spacing.xs - 2}px ${spacing.sm}px`,
              borderRadius: radius.full,
              border: `1.5px solid ${sel ? colors.yellow500 : colors.surface.border}`,
              background:   sel ? colors.yellow100 : colors.surface.card,
              color:        sel ? colors.text.onYellow : colors.text.secondary,
              fontWeight:   sel ? 700 : 500,
              fontSize: 13, cursor: "pointer",
              transition: "border-color 120ms, background 120ms",
            }}
          >{item.label}</button>
        );
      })}
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          height: 72, borderRadius: radius.lg, background: colors.gray100,
          animation: "pulse 1.5s ease-in-out infinite",
        }} />
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  );
}

function ErrorNote({ message }) {
  return (
    <div style={{
      padding: spacing.md, borderRadius: radius.lg,
      background: colors.dangerSoft, border: `1px solid ${colors.dangerBorder}`,
      color: colors.dangerStrong, fontSize: 14,
    }}>
      {message || "Could not load care log."}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: `${spacing.xl}px ${spacing.md}px`,
      background: colors.surface.raised, borderRadius: radius.xl,
      border: `1.5px dashed ${colors.surface.border}`,
    }}>
      <span style={{ fontSize: 44, marginBottom: spacing.sm }}>🩺</span>
      <p style={{ ...typography.bodySmall, color: colors.text.muted, margin: 0, textAlign: "center" }}>
        No care events logged yet for this day.
      </p>
    </div>
  );
}

function TypeSummaryPill({ type, count }) {
  const acc = TYPE_ACCENT[type] || defaultAccent;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: `${spacing.xs}px ${spacing.sm}px`,
      borderRadius: radius.full,
      background: acc.bg, border: `1.5px solid ${acc.border}`,
    }}>
      <span style={{ fontSize: 16 }}>{acc.emoji}</span>
      <span style={{ fontWeight: 700, color: acc.text, fontSize: 13 }}>{count}×</span>
      <span style={{ fontSize: 13, color: colors.text.secondary }}>{type}</span>
    </div>
  );
}

function CareCard({ record }) {
  const acc = TYPE_ACCENT[record.type] || defaultAccent;
  return (
    <div style={{
      padding: spacing.md, borderRadius: radius.lg,
      background: acc.bg, border: `1.5px solid ${acc.border}`,
      boxShadow: shadows.sm,
      display: "flex", gap: spacing.sm, alignItems: "flex-start",
    }}>
      {/* Emoji badge */}
      <div style={{
        width: 44, height: 44, borderRadius: radius.lg,
        background: colors.surface.card, border: `1.5px solid ${acc.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, flexShrink: 0,
      }}>{acc.emoji}</div>

      {/* Content */}
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <span style={{ fontWeight: 700, color: acc.text, fontSize: 15 }}>{record.type}</span>
        </div>
        {record.notes && (
          <p style={{ margin: "2px 0 0", fontSize: 13, color: colors.text.secondary }}>
            {record.notes}
          </p>
        )}
        <p style={{ margin: "4px 0 0", fontSize: 12, color: colors.text.muted }}>
          Logged by staff · {fmtTime(record.loggedAt)}
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────

export default function CareHygiene() {
  const { children } = useParentProfile();
  const [activeId, setActiveId] = useState(null);
  const [date, setDate]         = useState(todayISO());

  useEffect(() => {
    if (!activeId && children.length) setActiveId(children[0].studentId);
  }, [children, activeId]);

  const { data, loading, error } = useCareLog(activeId, date);
  const records = data?.records || [];

  // Summary: count per type
  const summary = useMemo(() => {
    const counts = {};
    for (const r of records) counts[r.type] = (counts[r.type] || 0) + 1;
    return counts;
  }, [records]);

  const nameById = useMemo(() => {
    const m = {};
    children.forEach(c => { m[c.studentId] = (c.studentName || "").split(" ")[0] || c.studentId; });
    return m;
  }, [children]);

  return (
    <div style={{ padding: spacing.lg, display: "flex", flexDirection: "column", gap: spacing.lg }}>

      {/* Header */}
      <header style={{ padding: `${spacing.xs}px ${spacing.xs}px 0` }}>
        <h1 style={{ ...typography.h1, color: colors.text.primary, margin: 0 }}>Care &amp; Hygiene</h1>
        <p style={{ ...typography.caption, color: colors.text.muted, margin: `${spacing.xs}px 0 0` }}>
          Daily care events logged by staff 🩺
        </p>
      </header>

      {/* Child switcher */}
      {children.length > 1 && (
        <Pills
          items={children.map(c => ({ id: c.studentId, label: nameById[c.studentId] }))}
          active={activeId}
          onSelect={setActiveId}
        />
      )}

      {/* Date picker */}
      <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
        <input
          type="date"
          value={date}
          max={todayISO()}
          onChange={e => setDate(e.target.value)}
          style={{
            padding: `${spacing.xs}px ${spacing.sm}px`,
            borderRadius: radius.md,
            border: `1.5px solid ${colors.surface.border}`,
            background: colors.surface.card,
            color: colors.text.primary, fontSize: 14,
            outline: "none",
          }}
        />
        {date !== todayISO() && (
          <button
            onClick={() => setDate(todayISO())}
            style={{
              padding: `${spacing.xs}px ${spacing.sm}px`,
              borderRadius: radius.full,
              border: `1.5px solid ${colors.yellow500}`,
              background: colors.yellow100,
              color: colors.text.onYellow,
              fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}
          >Today</button>
        )}
        <span style={{ fontSize: 13, color: colors.text.muted }}>
          {date === todayISO() ? "Today" : fmtDate(date)}
        </span>
      </div>

      {/* Summary pills */}
      {!loading && !error && Object.keys(summary).length > 0 && (
        <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: `${spacing.xs}px ${spacing.sm}px`,
            borderRadius: radius.full,
            background: colors.yellow100, border: `1.5px solid ${colors.yellow300}`,
          }}>
            <span style={{ fontWeight: 800, color: colors.yellow700, fontSize: 13 }}>{records.length} total</span>
          </div>
          {Object.entries(summary).map(([type, count]) => (
            <TypeSummaryPill key={type} type={type} count={count} />
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <Skeleton />
      ) : error ? (
        <ErrorNote message={error} />
      ) : records.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          {records.map(r => <CareCard key={r.logId} record={r} />)}
        </div>
      )}

    </div>
  );
}
