/**
 * Events.jsx — Parent Module · School Events
 * ──────────────────────────────────────────────────────────────────
 * Shows upcoming and recent school events filtered to the child's class.
 * Supports RSVP if the event requires it.
 */

import { useState } from "react";
import useEvents from "../hooks/useEvents";
import parentService from "../services/parentService";
import { colors, spacing, radius, shadows, typography } from "../theme";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function todayISO() { return new Date().toISOString().slice(0, 10); }

function parseISO(iso) { return iso ? new Date(`${iso}T00:00:00`) : null; }

function fmtDate(iso) {
  const d = parseISO(iso);
  if (!d) return iso || "";
  return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2,"0")} ${ampm}`;
}

function eventStatus(eventDate) {
  const today = todayISO();
  if (!eventDate) return "upcoming";
  if (eventDate < today) return "completed";
  if (eventDate === today) return "ongoing";
  return "upcoming";
}

const STATUS_META = {
  upcoming:  { label: "Upcoming",  fg: colors.successStrong, bg: colors.successSoft,   bd: colors.successBorder },
  ongoing:   { label: "Today!",    fg: colors.yellow700,     bg: colors.yellow100,      bd: colors.yellow200 },
  completed: { label: "Completed", fg: colors.gray500,       bg: colors.gray100,        bd: colors.gray200 },
};

const RSVP_OPTIONS = [
  { value: "attending",     label: "Attending",     emoji: "✅" },
  { value: "not_attending", label: "Not Attending", emoji: "❌" },
  { value: "maybe",         label: "Maybe",         emoji: "🤔" },
];

export default function Events({ studentId }) {
  const { data, loading, error, reload } = useEvents(studentId);
  const events = data?.events || [];

  const upcoming  = events.filter(e => eventStatus(e.eventDate) !== "completed");
  const completed = events.filter(e => eventStatus(e.eventDate) === "completed");

  return (
    <div style={{ padding: spacing.lg, display: "flex", flexDirection: "column", gap: spacing.lg }}>

      <header style={{ padding: `${spacing.xs}px ${spacing.xs}px 0` }}>
        <h1 style={{ ...typography.h1, color: colors.text.primary, margin: 0 }}>Events</h1>
        <p style={{ ...typography.caption, color: colors.text.muted, margin: `${spacing.xs}px 0 0` }}>
          School events & activities 🎉
        </p>
      </header>

      {loading ? (
        <><CardSkeleton /><CardSkeleton /></>
      ) : error ? (
        <ErrorNote message={error} />
      ) : events.length === 0 ? (
        <Empty />
      ) : (
        <>
          {upcoming.length > 0 && (
            <section style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
              <SectionLabel>Upcoming Events</SectionLabel>
              {upcoming.map(ev => (
                <EventCard key={ev.id} event={ev} studentId={studentId} onRsvpChange={reload} />
              ))}
            </section>
          )}

          {completed.length > 0 && (
            <section style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
              <SectionLabel>Past Events</SectionLabel>
              {completed.map(ev => (
                <EventCard key={ev.id} event={ev} studentId={studentId} onRsvpChange={reload} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function EventCard({ event, studentId, onRsvpChange }) {
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [localRsvp,   setLocalRsvp]   = useState(event.myRsvp);

  const status = eventStatus(event.eventDate);
  const sm     = STATUS_META[status];
  const d      = parseISO(event.eventDate);
  const dayNum  = d ? d.getDate() : "?";
  const monthStr = d ? MONTHS[d.getMonth()] : "";
  const isToday  = status === "ongoing";

  const handleRsvp = async (response) => {
    if (rsvpLoading) return;
    setRsvpLoading(true);
    try {
      setLocalRsvp(response); // optimistic
      await parentService.submitRsvp(event.id, studentId, response);
      onRsvpChange();
    } catch {
      setLocalRsvp(event.myRsvp); // revert on error
    } finally {
      setRsvpLoading(false);
    }
  };

  return (
    <div style={{
      background: colors.surface.card,
      borderRadius: radius.card,
      boxShadow: shadows.card,
      padding: spacing.lg,
      border: isToday ? `1px solid ${colors.yellow300}` : `1px solid transparent`,
    }}>
      <div style={{ display: "flex", gap: spacing.md, alignItems: "flex-start" }}>
        {/* Date block */}
        <div style={{
          flexShrink: 0, width: 52, height: 52, borderRadius: radius.md,
          background: "linear-gradient(160deg,#a5b4fc 0%,#6366f1 100%)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 12px rgba(99,102,241,0.25)",
        }}>
          <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{monthStr}</span>
          <span style={{ color: "#fff", fontSize: 20, fontWeight: 900, lineHeight: 1.1 }}>{dayNum}</span>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, flexWrap: "wrap", marginBottom: spacing.xs }}>
            <span style={{
              ...typography.meta, fontWeight: typography.weight.bold,
              color: sm.fg, background: sm.bg, border: `1px solid ${sm.bd}`,
              borderRadius: radius.pill, padding: `2px ${spacing.sm}px`,
            }}>{sm.label}</span>
          </div>

          <div style={{ ...typography.title, color: colors.text.primary, marginBottom: spacing.xs }}>{event.title}</div>

          <div style={{ ...typography.caption, color: colors.text.muted, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>📅 {fmtDate(event.eventDate)}</span>
            {(event.startTime) && (
              <span>🕐 {fmtTime(event.startTime)}{event.endTime ? ` – ${fmtTime(event.endTime)}` : ""}</span>
            )}
            {event.venue && <span>📍 {event.venue}</span>}
          </div>

          {event.description && (
            <div style={{ ...typography.caption, color: colors.text.secondary, marginTop: spacing.sm }}>
              {event.description}
            </div>
          )}
        </div>
      </div>

      {/* RSVP section */}
      {event.rsvpRequired && status !== "completed" && (
        <div style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTop: `1px solid ${colors.surface.border}` }}>
          <div style={{ ...typography.meta, fontWeight: typography.weight.bold, color: colors.text.muted, marginBottom: spacing.sm }}>
            YOUR RSVP
          </div>
          <div style={{ display: "flex", gap: spacing.sm }}>
            {RSVP_OPTIONS.map(opt => {
              const selected = localRsvp === opt.value;
              return (
                <button key={opt.value} onClick={() => handleRsvp(opt.value)}
                  disabled={rsvpLoading}
                  style={{
                    flex: 1, padding: `${spacing.sm}px ${spacing.xs}px`,
                    borderRadius: radius.md, border: selected ? "1.5px solid #6366f1" : `1px solid ${colors.surface.border}`,
                    background: selected ? "#eef2ff" : colors.surface.raised,
                    color: selected ? "#4f46e5" : colors.text.secondary,
                    fontSize: typography.size.caption, fontWeight: selected ? typography.weight.bold : typography.weight.regular,
                    cursor: rsvpLoading ? "not-allowed" : "pointer",
                    transition: "all 0.15s", textAlign: "center",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  }}>
                  <span style={{ fontSize: 16 }}>{opt.emoji}</span>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Confirmed RSVP for completed events */}
      {event.rsvpRequired && status === "completed" && localRsvp && (
        <div style={{
          marginTop: spacing.md, paddingTop: spacing.md, borderTop: `1px solid ${colors.surface.border}`,
          ...typography.caption, color: colors.text.muted,
        }}>
          Your RSVP: <strong style={{ color: colors.text.primary, textTransform: "capitalize" }}>
            {localRsvp.replace("_", " ")}
          </strong>
        </div>
      )}
    </div>
  );
}

// ── utility components ────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <span style={{
      ...typography.caption, textTransform: "uppercase",
      letterSpacing: typography.tracking.wider,
      color: colors.text.muted, fontWeight: typography.weight.bold,
    }}>{children}</span>
  );
}

function Empty() {
  return (
    <div style={{
      background: colors.surface.card, borderRadius: radius.card, boxShadow: shadows.card,
      padding: `${spacing["3xl"]}px ${spacing.xl}px`, textAlign: "center",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: radius.pill, display: "flex",
        alignItems: "center", justifyContent: "center", fontSize: 30,
        margin: `0 auto ${spacing.lg}px`,
        background: "linear-gradient(160deg,#a5b4fc 0%,#6366f1 100%)",
        boxShadow: "0 4px 16px rgba(99,102,241,0.28)",
      }}>🎉</div>
      <h2 style={{ ...typography.h2, color: colors.text.primary, margin: `0 0 ${spacing.sm}px` }}>No upcoming events</h2>
      <p style={{ ...typography.body, color: colors.text.muted, margin: 0 }}>Events added by the school will appear here.</p>
    </div>
  );
}

function ErrorNote({ message }) {
  return (
    <div style={{
      ...typography.body, color: colors.dangerStrong, background: colors.dangerSoft,
      border: `1px solid ${colors.dangerBorder}`, borderRadius: radius.md, padding: spacing.lg,
    }}>{message}</div>
  );
}

function CardSkeleton() {
  return (
    <div style={{ background: colors.surface.card, borderRadius: radius.card, boxShadow: shadows.card, padding: spacing.lg }}>
      <div style={{ height: 14, width: "50%", borderRadius: radius.sm, background: colors.gray100, marginBottom: spacing.md }} />
      <div style={{ height: 11, width: "75%", borderRadius: radius.sm, background: colors.gray100 }} />
    </div>
  );
}
