/**
 * Attendance.jsx — Parent Module · Phase 3
 * ──────────────────────────────────────────────────────────────────
 * Read-only attendance view for a parent's linked child/children.
 *
 * V1 widgets (intentionally small):
 *   1. Today's status (Present | Absent | Holiday | Not marked)
 *   2. Monthly attendance percentage
 *   3. Calendar view (month grid, colour-coded)
 *   4. History list
 *
 * Multi-child: a switcher selects the active child; data refetches on change.
 * Green is used ONLY for Present. Theme tokens only — no hardcoded colours.
 * No editing, teacher actions, reports, charts, or exports.
 */

import { useEffect, useMemo, useState } from "react";
import useParentProfile from "../hooks/useParentProfile";
import useChildAttendance from "../hooks/useChildAttendance";
import { colors, spacing, radius, shadows, typography } from "../theme";

// ── Status → theme styling (Present is the ONLY green) ─────────────
const STATUS = {
  Present:   { label: "Present",    fg: colors.successStrong, bg: colors.successSoft, border: colors.successBorder, dot: colors.success },
  Absent:    { label: "Absent",     fg: colors.dangerStrong,  bg: colors.dangerSoft,  border: colors.dangerBorder,  dot: colors.danger },
  Late:      { label: "Late",       fg: colors.warningStrong, bg: colors.warningSoft, border: colors.warningBorder, dot: colors.warning },
  Holiday:   { label: "Holiday",    fg: colors.yellow700,     bg: colors.yellow100,   border: colors.yellow200,     dot: colors.yellow500 },
  NotMarked: { label: "Not marked", fg: colors.text.muted,    bg: colors.gray100,     border: colors.surface.border, dot: colors.gray300 },
};
const statusOf = s => STATUS[s] || STATUS.NotMarked;

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS = ["S","M","T","W","T","F","S"];

const nowMonth = () => new Date().toISOString().slice(0, 7);
const todayISO = () => new Date().toISOString().slice(0, 10);

function shiftMonth(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtHistDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

// checkIn/checkOut are stored as UTC wall-clock strings ("HH:MM:SS"). Combine
// with the record's date and render in the school timezone (IST) as 12-hour.
function fmtClock(dateISO, timeStr) {
  if (!timeStr) return "";
  const d = new Date(`${dateISO}T${timeStr}Z`);
  if (isNaN(d.getTime())) return timeStr;
  return d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });
}

export default function Attendance() {
  const { children, loading: childrenLoading } = useParentProfile();
  const [activeId, setActiveId] = useState(null);
  const [month, setMonth] = useState(nowMonth());

  // Default to first child once loaded
  useEffect(() => {
    if (!activeId && children.length) setActiveId(children[0].studentId);
  }, [children, activeId]);

  const { data, loading, error } = useChildAttendance(activeId, month);

  const activeChild = children.find(c => c.studentId === activeId);
  const isCurrentMonth = month === nowMonth();

  return (
    <div style={{ padding: spacing.lg, display: "flex", flexDirection: "column", gap: spacing.lg }}>

      {/* Header */}
      <header style={{ padding: `${spacing.xs}px ${spacing.xs}px 0` }}>
        <h1 style={{ ...typography.h1, color: colors.text.primary, margin: 0 }}>Attendance</h1>
        {activeChild && (
          <p style={{ ...typography.caption, color: colors.text.muted, margin: `${spacing.xs}px 0 0` }}>
            {activeChild.studentName}{activeChild.class ? ` · ${activeChild.class}` : ""}
          </p>
        )}
      </header>

      {/* Child switcher (multi-child only) */}
      {children.length > 1 && (
        <ChildSwitcher children={children} activeId={activeId} onSelect={setActiveId} />
      )}

      {/* Body */}
      {childrenLoading || (loading && !data) ? (
        <CardSkeleton />
      ) : error ? (
        <ErrorNote message={error} />
      ) : !activeChild ? (
        <EmptyCard title="No child linked" body="No child is linked to your account yet." />
      ) : (
        <>
          <TodayCard today={data?.today} />
          <PercentCard percentage={data?.percentage} summary={data?.summary} />
          <Calendar
            month={month}
            days={data?.days || {}}
            onPrev={() => setMonth(m => shiftMonth(m, -1))}
            onNext={() => setMonth(m => shiftMonth(m, +1))}
            canNext={!isCurrentMonth}
          />
          <History history={data?.history || []} />
        </>
      )}
    </div>
  );
}

// ── Child switcher ──────────────────────────────────────────────────
function ChildSwitcher({ children, activeId, onSelect }) {
  return (
    <div style={{ display: "flex", gap: spacing.sm, overflowX: "auto", paddingBottom: spacing.xs }}>
      {children.map(c => {
        const active = c.studentId === activeId;
        return (
          <button
            key={c.studentId}
            onClick={() => onSelect(c.studentId)}
            style={{
              ...typography.caption,
              flexShrink: 0,
              padding: `${spacing.sm}px ${spacing.lg}px`,
              borderRadius: radius.pill,
              cursor: "pointer",
              fontWeight: typography.weight.bold,
              color: active ? colors.text.onYellow : colors.text.secondary,
              background: active ? colors.brand.gradient : colors.surface.card,
              border: `1px solid ${active ? "transparent" : colors.surface.border}`,
              boxShadow: active ? shadows.primary : "none",
            }}
          >
            {(c.studentName || "").split(" ")[0] || c.studentId}
          </button>
        );
      })}
    </div>
  );
}

// ── Today's status ──────────────────────────────────────────────────
function TodayCard({ today }) {
  const meta = statusOf(today?.status);
  return (
    <Card>
      <Label>Today</Label>
      <div style={{ display: "flex", alignItems: "center", gap: spacing.md, marginTop: spacing.sm }}>
        <span style={{ width: 14, height: 14, borderRadius: radius.pill, background: meta.dot, flexShrink: 0 }} />
        <span style={{ ...typography.h2, color: meta.fg }}>{meta.label}</span>
      </div>
    </Card>
  );
}

// ── Monthly percentage ──────────────────────────────────────────────
function PercentCard({ percentage, summary }) {
  const has = percentage !== null && percentage !== undefined;
  return (
    <Card>
      <Label>This month</Label>
      <div style={{ display: "flex", alignItems: "baseline", gap: spacing.sm, marginTop: spacing.sm }}>
        <span style={{ ...typography.hero, color: has ? colors.yellow700 : colors.text.faint }}>
          {has ? `${percentage}%` : "—"}
        </span>
        <span style={{ ...typography.caption, color: colors.text.muted }}>attendance</span>
      </div>
      {summary && summary.recorded > 0 && (
        <div style={{ display: "flex", gap: spacing.lg, marginTop: spacing.md, flexWrap: "wrap" }}>
          <Stat n={summary.present} label="Present" color={colors.success} />
          <Stat n={summary.absent}  label="Absent"  color={colors.danger} />
          {summary.late  > 0 && <Stat n={summary.late}  label="Late"    color={colors.warning} />}
          {summary.holiday > 0 && <Stat n={summary.holiday} label={summary.holiday === 1 ? "Holiday" : "Holidays"} color={colors.yellow500} />}
        </div>
      )}
    </Card>
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

// ── Calendar ────────────────────────────────────────────────────────
function Calendar({ month, days, onPrev, onNext, canNext }) {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstWeekday = new Date(y, m - 1, 1).getDay();
  const cells = useMemo(() => {
    const arr = [];
    for (let i = 0; i < firstWeekday; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    return arr;
  }, [firstWeekday, daysInMonth]);

  const td = todayISO();

  return (
    <Card>
      {/* Month nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
        <NavBtn onClick={onPrev} dir="‹" />
        <span style={{ ...typography.title, color: colors.text.primary }}>
          {MONTHS[m - 1]} {y}
        </span>
        <NavBtn onClick={canNext ? onNext : undefined} dir="›" disabled={!canNext} />
      </div>

      {/* Weekday header */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: spacing.xs, marginBottom: spacing.xs }}>
        {WEEKDAYS.map((w, i) => (
          <div key={i} style={{ ...typography.meta, textAlign: "center", color: colors.text.faint }}>{w}</div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: spacing.xs }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={`b${i}`} />;
          const iso = `${month}-${String(d).padStart(2, "0")}`;
          const status = days[iso];
          const meta = status ? statusOf(status) : null;
          const isToday = iso === td;
          return (
            <div
              key={iso}
              style={{
                aspectRatio: "1 / 1",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                borderRadius: radius.md,
                background: meta ? meta.bg : "transparent",
                border: isToday ? `2px solid ${colors.yellow500}` : `1px solid ${meta ? meta.border : "transparent"}`,
                color: meta ? meta.fg : colors.text.muted,
              }}
            >
              <span style={{ ...typography.caption, fontWeight: isToday ? typography.weight.bold : typography.weight.medium }}>
                {d}
              </span>
              {meta && <span style={{ width: 5, height: 5, borderRadius: radius.pill, background: meta.dot, marginTop: 2 }} />}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: spacing.md, flexWrap: "wrap", marginTop: spacing.md }}>
        <LegendDot color={colors.success}   label="Present" />
        <LegendDot color={colors.danger}    label="Absent" />
        <LegendDot color={colors.warning}   label="Late" />
        <LegendDot color={colors.yellow500} label="Holiday" />
      </div>
    </Card>
  );
}

function NavBtn({ onClick, dir, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 32, height: 32, borderRadius: radius.md,
        border: `1px solid ${colors.surface.border}`,
        background: colors.surface.card,
        color: disabled ? colors.text.faint : colors.text.secondary,
        cursor: disabled ? "default" : "pointer",
        fontSize: typography.size.lg, lineHeight: 1,
        opacity: disabled ? 0.5 : 1,
      }}
    >{dir}</button>
  );
}

function LegendDot({ color, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: spacing.xs }}>
      <span style={{ width: 8, height: 8, borderRadius: radius.pill, background: color }} />
      <span style={{ ...typography.meta, color: colors.text.muted }}>{label}</span>
    </div>
  );
}

// ── History ─────────────────────────────────────────────────────────
function History({ history }) {
  return (
    <Card>
      <Label>History</Label>
      {history.length === 0 ? (
        <p style={{ ...typography.body, color: colors.text.muted, margin: `${spacing.sm}px 0 0` }}>
          No attendance records this month yet.
        </p>
      ) : (
        <div style={{ marginTop: spacing.sm }}>
          {history.map((h, i) => {
            const meta = statusOf(h.status);
            return (
              <div key={h.date + i} style={{
                display: "flex", alignItems: "center", gap: spacing.md,
                padding: `${spacing.md}px 0`,
                borderBottom: i < history.length - 1 ? `1px solid ${colors.surface.border}` : "none",
              }}>
                <span style={{ width: 10, height: 10, borderRadius: radius.pill, background: meta.dot, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...typography.body, color: colors.text.primary, fontWeight: typography.weight.semibold }}>
                    {fmtHistDate(h.date)}
                  </div>
                  {(h.checkIn || h.checkOut) && (
                    <div style={{ ...typography.meta, color: colors.text.muted }}>
                      {h.checkIn ? `In ${fmtClock(h.date, h.checkIn)}` : ""}{h.checkIn && h.checkOut ? " · " : ""}{h.checkOut ? `Out ${fmtClock(h.date, h.checkOut)}` : ""}
                    </div>
                  )}
                </div>
                <span style={{
                  ...typography.meta, fontWeight: typography.weight.bold,
                  color: meta.fg, background: meta.bg, border: `1px solid ${meta.border}`,
                  borderRadius: radius.pill, padding: `${spacing.xs}px ${spacing.md}px`,
                }}>
                  {meta.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ── Shared bits ─────────────────────────────────────────────────────
function Card({ children }) {
  return (
    <div style={{
      background: colors.surface.card,
      borderRadius: radius.card,
      boxShadow: shadows.card,
      padding: spacing.lg,
    }}>{children}</div>
  );
}

function Label({ children }) {
  return (
    <span style={{
      ...typography.caption,
      textTransform: "uppercase",
      letterSpacing: typography.tracking.wider,
      color: colors.text.muted,
      fontWeight: typography.weight.bold,
    }}>{children}</span>
  );
}

function EmptyCard({ title, body }) {
  return (
    <Card>
      <h2 style={{ ...typography.h2, color: colors.text.primary, margin: 0 }}>{title}</h2>
      <p style={{ ...typography.body, color: colors.text.muted, margin: `${spacing.sm}px 0 0` }}>{body}</p>
    </Card>
  );
}

function ErrorNote({ message }) {
  return (
    <div style={{
      ...typography.body,
      color: colors.dangerStrong, background: colors.dangerSoft,
      border: `1px solid ${colors.dangerBorder}`, borderRadius: radius.md,
      padding: spacing.lg,
    }}>{message}</div>
  );
}

function CardSkeleton() {
  return (
    <Card>
      <div style={{ height: 12, width: "30%", borderRadius: radius.sm, background: colors.gray100, marginBottom: spacing.md }} />
      <div style={{ height: 40, width: "55%", borderRadius: radius.sm, background: colors.gray100 }} />
    </Card>
  );
}
