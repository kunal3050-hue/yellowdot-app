/**
 * Holidays.jsx — Parent Module · Daily Care · Holiday Calendar (read-only)
 * ──────────────────────────────────────────────────────────────────────
 * Shows the school holiday calendar exactly as staff enters it:
 *   • Upcoming Holidays — name, date, day of week, type, optional description.
 *   • Calendar — month view with holiday dates highlighted; browse any month.
 *
 * Reads the existing staff holidays collection via GET /api/parent/holidays.
 * Type-agnostic: any `type` string ("School Closed", "Half Day", "National
 * Holiday", "Festival Holiday", "Special Event", …) styles via TYPE_META with
 * a safe fallback — new types need no code change. Theme tokens only.
 */

import { useMemo, useState } from "react";
import useHolidays from "../hooks/useHolidays";
import { colors, spacing, radius, shadows, typography } from "../theme";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const todayISO = () => new Date().toISOString().slice(0, 10);
function parseISO(iso) { return iso ? new Date(`${iso}T00:00:00`) : null; }
function fmtFull(iso) {
  const d = parseISO(iso);
  return d ? d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : iso;
}
function fmtRange(start, end) {
  if (!end || end === start) return fmtFull(start);
  const s = parseISO(start), e = parseISO(end);
  const sameMonth = s && e && s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const sStr = s.toLocaleDateString("en-IN", { day: "numeric", ...(sameMonth ? {} : { month: "short" }) });
  const eStr = e.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return `${sStr} – ${eStr}`;
}
function inRange(iso, h) { return iso >= h.startDate && iso <= (h.endDate || h.startDate); }

// Type → visual treatment. Covers current staff types AND future-ready ones;
// anything unrecognised falls back to the brand tint (no schema change needed).
function typeMeta(type) {
  const t = String(type || "").toLowerCase();
  if (t.includes("emergency") || t.includes("closed") || t.includes("closure"))
    return { emoji: "🚫", fg: colors.dangerStrong, bg: colors.dangerSoft, bd: colors.dangerBorder };
  if (t.includes("half"))
    return { emoji: "🌓", fg: colors.warningStrong, bg: colors.warningSoft, bd: colors.warningBorder };
  if (t.includes("national"))
    return { emoji: "🇮🇳", fg: colors.warningStrong, bg: colors.warningSoft, bd: colors.warningBorder };
  if (t.includes("festival"))
    return { emoji: "🪔", fg: colors.yellow700, bg: colors.yellow100, bd: colors.yellow200 };
  if (t.includes("event") || t.includes("special"))
    return { emoji: "🎉", fg: colors.successStrong, bg: colors.successSoft, bd: colors.successBorder };
  if (t.includes("vacation"))
    return { emoji: "🏖️", fg: colors.yellow700, bg: colors.yellow100, bd: colors.yellow200 };
  return { emoji: "📅", fg: colors.yellow700, bg: colors.yellow100, bd: colors.yellow200 };
}

export default function Holidays() {
  const { data, loading, error } = useHolidays();
  const holidays = data?.holidays || [];
  const upcoming = data?.upcoming || [];

  return (
    <div style={{ padding: spacing.lg, display: "flex", flexDirection: "column", gap: spacing.lg }}>

      <header style={{ padding: `${spacing.xs}px ${spacing.xs}px 0` }}>
        <h1 style={{ ...typography.h1, color: colors.text.primary, margin: 0 }}>Holidays</h1>
        <p style={{ ...typography.caption, color: colors.text.muted, margin: `${spacing.xs}px 0 0` }}>
          School calendar & closures 📅
        </p>
      </header>

      {loading ? (
        <><CardSkeleton /><CardSkeleton /></>
      ) : error ? (
        <ErrorNote message={error} />
      ) : (
        <>
          <CalendarCard holidays={holidays} />

          <section style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
            <Label>Upcoming Holidays</Label>
            {upcoming.length === 0 ? (
              <Empty />
            ) : (
              upcoming.map(h => <HolidayCard key={h.id} holiday={h} />)
            )}
          </section>
        </>
      )}
    </div>
  );
}

function HolidayCard({ holiday }) {
  const m = typeMeta(holiday.type);
  const isToday = inRange(todayISO(), holiday);
  return (
    <div style={{
      background: colors.surface.card, borderRadius: radius.card, boxShadow: shadows.card,
      padding: spacing.lg, border: isToday ? `1px solid ${colors.yellow300}` : `1px solid transparent`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
        <span style={{
          width: 44, height: 44, borderRadius: radius.md, flexShrink: 0,
          background: m.bg, border: `1px solid ${m.bd}`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
        }}>{m.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...typography.title, color: colors.text.primary }}>
            {holiday.title}{isToday ? " · Today" : ""}
          </div>
          <div style={{ ...typography.caption, color: colors.text.muted }}>
            {fmtRange(holiday.startDate, holiday.endDate)}
          </div>
        </div>
        <span style={{
          ...typography.meta, fontWeight: typography.weight.bold, flexShrink: 0,
          color: m.fg, background: m.bg, border: `1px solid ${m.bd}`,
          borderRadius: radius.pill, padding: `${spacing.xs}px ${spacing.md}px`,
        }}>{holiday.type}</span>
      </div>
      {holiday.description && (
        <div style={{ ...typography.caption, color: colors.text.secondary, marginTop: spacing.sm, paddingLeft: 56 }}>
          {holiday.description}
        </div>
      )}
    </div>
  );
}

function CalendarCard({ holidays }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const prev = () => setMonth(m => { if (m === 0) { setYear(y => y - 1); return 11; } return m - 1; });
  const next = () => setMonth(m => { if (m === 11) { setYear(y => y + 1); return 0; } return m + 1; });

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: firstDow + daysInMonth }, (_, i) => (i < firstDow ? null : i - firstDow + 1));

  const today = todayISO();
  const tD = now.getDate(), tM = now.getMonth(), tY = now.getFullYear();

  function holidayOn(day) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return holidays.find(h => inRange(iso, h));
  }

  // Holidays that fall (even partly) within the visible month — quick legend.
  const monthLabel = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthHolidays = useMemo(
    () => holidays.filter(h => (h.startDate || "").slice(0, 7) <= monthLabel && (h.endDate || h.startDate || "").slice(0, 7) >= monthLabel),
    [holidays, monthLabel]
  );

  return (
    <div style={{ background: colors.surface.card, borderRadius: radius.card, boxShadow: shadows.card, padding: spacing.lg }}>
      {/* Month header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
        <NavBtn onClick={prev} dir="prev" />
        <span style={{ ...typography.title, color: colors.text.primary }}>{MONTHS[month]} {year}</span>
        <NavBtn onClick={next} dir="next" />
      </div>

      {/* Day-of-week labels */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: spacing.xs, marginBottom: spacing.xs }}>
        {DOW.map(d => (
          <div key={d} style={{ ...typography.meta, fontWeight: typography.weight.bold, color: colors.text.faint, textAlign: "center" }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: spacing.xs }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const h = holidayOn(day);
          const isToday = year === tY && month === tM && day === tD;
          const m = h ? typeMeta(h.type) : null;
          return (
            <div key={i} title={h?.title || ""} style={{
              aspectRatio: "1 / 1", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", position: "relative",
              borderRadius: radius.md,
              background: h ? m.bg : "transparent",
              border: isToday ? `2px solid ${colors.yellow500}` : `1px solid transparent`,
            }}>
              <span style={{
                ...typography.caption,
                fontWeight: h || isToday ? typography.weight.bold : typography.weight.regular,
                color: h ? m.fg : colors.text.secondary,
              }}>{day}</span>
              {h && <span style={{ width: 4, height: 4, borderRadius: radius.pill, background: m.fg, marginTop: 2 }} />}
            </div>
          );
        })}
      </div>

      {/* This month's holidays (compact legend) */}
      {monthHolidays.length > 0 && (
        <div style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTop: `1px solid ${colors.surface.border}`, display: "flex", flexDirection: "column", gap: spacing.sm }}>
          {monthHolidays.map(h => {
            const m = typeMeta(h.type);
            return (
              <div key={h.id} style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
                <span style={{ width: 8, height: 8, borderRadius: radius.pill, background: m.fg, flexShrink: 0 }} />
                <span style={{ ...typography.meta, fontWeight: typography.weight.bold, color: colors.text.primary }}>
                  {MONTHS_SHORT[parseISO(h.startDate).getMonth()]} {parseISO(h.startDate).getDate()}
                </span>
                <span style={{ ...typography.meta, color: colors.text.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {h.title}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NavBtn({ onClick, dir }) {
  return (
    <button onClick={onClick} aria-label={dir === "prev" ? "Previous month" : "Next month"} style={{
      width: 36, height: 36, borderRadius: radius.md, cursor: "pointer",
      background: colors.surface.raised, border: `1px solid ${colors.surface.border}`,
      color: colors.text.secondary, fontSize: 16, fontWeight: typography.weight.bold,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>{dir === "prev" ? "‹" : "›"}</button>
  );
}

// ── bits ────────────────────────────────────────────────────────────
function Label({ children }) {
  return <span style={{ ...typography.caption, textTransform: "uppercase", letterSpacing: typography.tracking.wider, color: colors.text.muted, fontWeight: typography.weight.bold }}>{children}</span>;
}
function Empty() {
  return (
    <div style={{ background: colors.surface.card, borderRadius: radius.card, boxShadow: shadows.card, padding: `${spacing["3xl"]}px ${spacing.xl}px`, textAlign: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: radius.pill, background: colors.brand.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, margin: `0 auto ${spacing.lg}px`, boxShadow: shadows.primary }}>📅</div>
      <h2 style={{ ...typography.h2, color: colors.text.primary, margin: `0 0 ${spacing.sm}px` }}>No upcoming holidays</h2>
      <p style={{ ...typography.body, color: colors.text.muted, margin: 0 }}>Holidays added by the school will appear here.</p>
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
