/**
 * NapTracker.jsx — Parent Module · Daily Care · Nap Tracker (read-only)
 * ──────────────────────────────────────────────────────────────────────
 * Total nap duration + timeline of naps (start–end in IST, duration, status).
 * Reuses staff napLogs via GET /api/parent/naps (ownership-scoped). Theme only.
 */

import { useEffect, useMemo, useState } from "react";
import useParentProfile from "../hooks/useParentProfile";
import useNaps from "../hooks/useNaps";
import { colors, spacing, radius, shadows, typography } from "../theme";

const todayISO = () => new Date().toISOString().slice(0, 10);
function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}
// startTime/endTime are full ISO timestamps → render in IST.
function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });
}
function hm(min) {
  const m = Number(min) || 0;
  if (m <= 0) return "0m";
  const h = Math.floor(m / 60), r = m % 60;
  return h ? `${h}h${r ? ` ${r}m` : ""}` : `${r}m`;
}

export default function NapTracker() {
  const { children } = useParentProfile();
  const [activeId, setActiveId] = useState(null);
  const [date, setDate] = useState(undefined);

  useEffect(() => { if (!activeId && children.length) setActiveId(children[0].studentId); }, [children, activeId]);
  useEffect(() => { setDate(undefined); }, [activeId]);

  const { data, loading, error } = useNaps(activeId, date);
  const naps = data?.naps || [];
  const availableDates = data?.availableDates || [];
  const shownDate = data?.date;

  const nameById = useMemo(() => {
    const m = {}; children.forEach(c => { m[c.studentId] = (c.studentName || "").split(" ")[0] || c.studentId; }); return m;
  }, [children]);

  return (
    <div style={{ padding: spacing.lg, display: "flex", flexDirection: "column", gap: spacing.lg }}>

      <header style={{ padding: `${spacing.xs}px ${spacing.xs}px 0` }}>
        <h1 style={{ ...typography.h1, color: colors.text.primary, margin: 0 }}>Nap Tracker</h1>
        <p style={{ ...typography.caption, color: colors.text.muted, margin: `${spacing.xs}px 0 0` }}>
          {shownDate ? `${shownDate === todayISO() ? "Today · " : ""}${fmtDate(shownDate)}` : "Rest & sleep 😴"}
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
          <TotalCard totalMinutes={data?.totalMinutes} count={data?.count} activeCount={data?.activeCount} />
          {naps.length === 0 ? (
            <Empty />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
              {naps.map((n, i) => <NapCard key={n.napId || i} nap={n} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TotalCard({ totalMinutes, count, activeCount }) {
  return (
    <div style={{ background: colors.surface.card, borderRadius: radius.card, boxShadow: shadows.card, padding: spacing.lg }}>
      <Label>Total nap time</Label>
      <div style={{ display: "flex", alignItems: "baseline", gap: spacing.sm, marginTop: spacing.sm }}>
        <span style={{ ...typography.hero, color: colors.yellow700 }}>{hm(totalMinutes)}</span>
        <span style={{ ...typography.caption, color: colors.text.muted }}>
          {count || 0} nap{(count || 0) === 1 ? "" : "s"}{activeCount ? ` · ${activeCount} ongoing` : ""}
        </span>
      </div>
    </div>
  );
}

function NapCard({ nap }) {
  const sleeping = nap.status === "sleeping";
  const fg = sleeping ? colors.warningStrong : colors.successStrong;
  const bg = sleeping ? colors.warningSoft : colors.successSoft;
  const bd = sleeping ? colors.warningBorder : colors.successBorder;
  return (
    <div style={{ background: colors.surface.card, borderRadius: radius.card, boxShadow: shadows.card, padding: spacing.lg }}>
      <div style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
        <span style={{
          width: 40, height: 40, borderRadius: radius.md, flexShrink: 0,
          background: colors.yellow100, border: `1px solid ${colors.yellow200}`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
        }}>😴</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...typography.title, color: colors.text.primary }}>
            {fmtTime(nap.startTime)}{nap.endTime ? ` – ${fmtTime(nap.endTime)}` : ""}
          </div>
          <div style={{ ...typography.caption, color: colors.text.muted }}>
            {sleeping ? "In progress" : `Slept ${hm(nap.duration)}`}{nap.mood ? ` · ${nap.mood}` : ""}
          </div>
        </div>
        <span style={{
          ...typography.meta, fontWeight: typography.weight.bold, flexShrink: 0,
          color: fg, background: bg, border: `1px solid ${bd}`,
          borderRadius: radius.pill, padding: `${spacing.xs}px ${spacing.md}px`,
        }}>{sleeping ? "Sleeping" : "Woke up"}</span>
      </div>
      {nap.notes && (
        <div style={{ ...typography.caption, color: colors.text.secondary, marginTop: spacing.sm, paddingLeft: 52 }}>
          “{nap.notes}”
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
      <div style={{ width: 64, height: 64, borderRadius: radius.pill, background: colors.brand.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, margin: `0 auto ${spacing.lg}px`, boxShadow: shadows.primary }}>😴</div>
      <h2 style={{ ...typography.h2, color: colors.text.primary, margin: `0 0 ${spacing.sm}px` }}>No naps logged yet</h2>
      <p style={{ ...typography.body, color: colors.text.muted, margin: 0 }}>Nap times will appear here as staff record them.</p>
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
