/**
 * Consumption.jsx — Parent Module · Daily Care · Consumption Log (read-only)
 * ──────────────────────────────────────────────────────────────────────────
 * Daily summary + timeline of what the child ate/skipped per meal.
 * Reuses staff foodConsumption via GET /api/parent/consumption (ownership-scoped).
 * Green is used only for "Ate" (positive). Theme tokens only.
 */

import { useEffect, useMemo, useState } from "react";
import useParentProfile from "../hooks/useParentProfile";
import useConsumption from "../hooks/useConsumption";
import { colors, spacing, radius, shadows, typography } from "../theme";

const MEAL_EMOJI = {
  "Breakfast": "🍳", "Mid-Morning": "🥤", "Roti Sabzi": "🫓",
  "Dal Rice": "🍛", "Milk": "🥛", "Snacks": "🍪",
};
const todayISO = () => new Date().toISOString().slice(0, 10);
function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export default function Consumption() {
  const { children } = useParentProfile();
  const [activeId, setActiveId] = useState(null);
  const [date, setDate] = useState(undefined); // undefined → most recent logged

  useEffect(() => { if (!activeId && children.length) setActiveId(children[0].studentId); }, [children, activeId]);
  // Reset date to "latest" when switching child.
  useEffect(() => { setDate(undefined); }, [activeId]);

  const { data, loading, error } = useConsumption(activeId, date);
  const entries = data?.entries || [];
  const summary = data?.summary;
  const availableDates = data?.availableDates || [];
  const shownDate = data?.date;

  const nameById = useMemo(() => {
    const m = {}; children.forEach(c => { m[c.studentId] = (c.studentName || "").split(" ")[0] || c.studentId; }); return m;
  }, [children]);

  return (
    <div style={{ padding: spacing.lg, display: "flex", flexDirection: "column", gap: spacing.lg }}>

      <header style={{ padding: `${spacing.xs}px ${spacing.xs}px 0` }}>
        <h1 style={{ ...typography.h1, color: colors.text.primary, margin: 0 }}>Consumption Log</h1>
        <p style={{ ...typography.caption, color: colors.text.muted, margin: `${spacing.xs}px 0 0` }}>
          {shownDate ? `${shownDate === todayISO() ? "Today · " : ""}${fmtDate(shownDate)}` : "What your child ate 🍽️"}
        </p>
      </header>

      {children.length > 1 && (
        <Pills items={children.map(c => ({ id: c.studentId, label: nameById[c.studentId] }))} active={activeId} onSelect={setActiveId} />
      )}
      {availableDates.length > 1 && (
        <Pills items={availableDates.map(d => ({ id: d, label: d === todayISO() ? "Today" : fmtDate(d) }))} active={shownDate} onSelect={setDate} />
      )}

      {loading ? (
        <CardSkeleton />
      ) : error ? (
        <ErrorNote message={error} />
      ) : (
        <>
          <SummaryCard summary={summary} />
          {entries.length === 0 ? (
            <Empty />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
              {entries.map((e, i) => <EntryCard key={i} entry={e} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({ summary }) {
  const s = summary || { ate: 0, skipped: 0, logged: 0 };
  return (
    <div style={{ background: colors.surface.card, borderRadius: radius.card, boxShadow: shadows.card, padding: spacing.lg }}>
      <Label>Today's summary</Label>
      <div style={{ display: "flex", gap: spacing.xl, marginTop: spacing.sm, flexWrap: "wrap" }}>
        <Stat n={s.ate} label="Ate" color={colors.success} />
        <Stat n={s.skipped} label="Skipped" color={colors.danger} />
        <Stat n={s.logged} label="Meals logged" color={colors.yellow500} />
      </div>
    </div>
  );
}
function Stat({ n, label, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: spacing.xs }}>
      <span style={{ width: 8, height: 8, borderRadius: radius.pill, background: color }} />
      <span style={{ ...typography.caption, color: colors.text.secondary }}>
        <strong style={{ color: colors.text.primary }}>{n}</strong> {label}
      </span>
    </div>
  );
}

function EntryCard({ entry }) {
  const ate = entry.status === "Ate";
  const has = !!entry.status;
  const fg = has ? (ate ? colors.successStrong : colors.dangerStrong) : colors.text.muted;
  const bg = has ? (ate ? colors.successSoft : colors.dangerSoft) : colors.gray100;
  const bd = has ? (ate ? colors.successBorder : colors.dangerBorder) : colors.surface.border;
  return (
    <div style={{ background: colors.surface.card, borderRadius: radius.card, boxShadow: shadows.card, padding: spacing.lg }}>
      <div style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
        <span style={{
          width: 40, height: 40, borderRadius: radius.md, flexShrink: 0,
          background: colors.yellow100, border: `1px solid ${colors.yellow200}`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
        }}>{MEAL_EMOJI[entry.mealType] || "🍽️"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...typography.title, color: colors.text.primary }}>{entry.mealType}</div>
          {(entry.foodItem || entry.quantity) && (
            <div style={{ ...typography.caption, color: colors.text.muted }}>
              {entry.foodItem}{entry.quantity ? `${entry.foodItem ? " · " : ""}${entry.quantity}${entry.unit ? " " + entry.unit : ""}` : ""}
            </div>
          )}
        </div>
        <span style={{
          ...typography.meta, fontWeight: typography.weight.bold, flexShrink: 0,
          color: fg, background: bg, border: `1px solid ${bd}`,
          borderRadius: radius.pill, padding: `${spacing.xs}px ${spacing.md}px`,
        }}>{entry.status || "—"}</span>
      </div>
      {entry.notes && (
        <div style={{ ...typography.caption, color: colors.text.secondary, marginTop: spacing.sm, paddingLeft: 52 }}>
          “{entry.notes}”
        </div>
      )}
    </div>
  );
}

// ── bits ────────────────────────────────────────────────────────────
function Pills({ items, active, onSelect }) {
  return (
    <div style={{ display: "flex", gap: spacing.sm, overflowX: "auto", paddingBottom: spacing.xs }}>
      {items.map(it => {
        const sel = it.id === active;
        return (
          <button key={it.id} onClick={() => onSelect(it.id)} style={{
            ...typography.caption, flexShrink: 0,
            padding: `${spacing.sm}px ${spacing.lg}px`, borderRadius: radius.pill, cursor: "pointer",
            fontWeight: typography.weight.bold,
            color: sel ? colors.text.onYellow : colors.text.secondary,
            background: sel ? colors.brand.gradient : colors.surface.card,
            border: `1px solid ${sel ? "transparent" : colors.surface.border}`,
            boxShadow: sel ? shadows.primary : "none",
          }}>{it.label}</button>
        );
      })}
    </div>
  );
}
function Label({ children }) {
  return <span style={{ ...typography.caption, textTransform: "uppercase", letterSpacing: typography.tracking.wider, color: colors.text.muted, fontWeight: typography.weight.bold }}>{children}</span>;
}
function Empty() {
  return (
    <div style={{ background: colors.surface.card, borderRadius: radius.card, boxShadow: shadows.card, padding: `${spacing["3xl"]}px ${spacing.xl}px`, textAlign: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: radius.pill, background: colors.brand.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, margin: `0 auto ${spacing.lg}px`, boxShadow: shadows.primary }}>🍽️</div>
      <h2 style={{ ...typography.h2, color: colors.text.primary, margin: `0 0 ${spacing.sm}px` }}>Nothing logged yet</h2>
      <p style={{ ...typography.body, color: colors.text.muted, margin: 0 }}>Meals will appear here as staff log them through the day.</p>
    </div>
  );
}
function ErrorNote({ message }) {
  return <div style={{ ...typography.body, color: colors.dangerStrong, background: colors.dangerSoft, border: `1px solid ${colors.dangerBorder}`, borderRadius: radius.md, padding: spacing.lg }}>{message}</div>;
}
function CardSkeleton() {
  return (
    <div style={{ background: colors.surface.card, borderRadius: radius.card, boxShadow: shadows.card, padding: spacing.lg }}>
      <div style={{ height: 14, width: "40%", borderRadius: radius.sm, background: colors.gray100, marginBottom: spacing.md }} />
      <div style={{ height: 11, width: "70%", borderRadius: radius.sm, background: colors.gray100 }} />
    </div>
  );
}
