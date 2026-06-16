/**
 * PTM.jsx — Parent Module · Parent-Teacher Meetings
 * ──────────────────────────────────────────────────────────────────
 * Shows PTMs visible to the child's class.
 * Supports: view details, book a slot, reschedule, cancel, view shared notes.
 */

import { useState } from "react";
import usePTM from "../hooks/usePTM";
import parentService from "../services/parentService";
import { colors, spacing, radius, shadows, typography } from "../theme";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function todayISO() { return new Date().toISOString().slice(0, 10); }

function fmtDate(iso) {
  const d = iso ? new Date(`${iso}T00:00:00`) : null;
  if (!d) return iso || "";
  return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function ptmStatus(meetingDate) {
  const today = todayISO();
  if (!meetingDate) return "upcoming";
  if (meetingDate < today) return "completed";
  if (meetingDate === today) return "today";
  return "upcoming";
}

const STATUS_META = {
  upcoming:  { label: "Upcoming", fg: colors.successStrong, bg: colors.successSoft,  bd: colors.successBorder },
  today:     { label: "Today!",   fg: colors.yellow700,     bg: colors.yellow100,     bd: colors.yellow200 },
  completed: { label: "Completed",fg: colors.gray500,       bg: colors.gray100,       bd: colors.gray200 },
};

// ── Slot Picker Modal ─────────────────────────────────────────────────────────

function SlotPickerModal({ ptm, studentId, onBook, onClose }) {
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [booking,      setBooking]      = useState(false);
  const [error,        setError]        = useState("");

  const handleBook = async () => {
    if (!selectedSlot) return;
    setBooking(true);
    setError("");
    try {
      await onBook(ptm.id, studentId, selectedSlot.id);
      onClose();
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Booking failed. Please try again.");
    } finally {
      setBooking(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "center", padding: spacing.md,
    }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} onClick={onClose} />
      <div style={{
        position: "relative", width: "100%", maxWidth: 420, maxHeight: "85vh",
        overflowY: "auto", borderRadius: radius.card, background: colors.surface.card,
        boxShadow: shadows.overlay,
      }}>
        {/* Header */}
        <div style={{
          padding: `${spacing.lg}px ${spacing.lg}px ${spacing.md}px`,
          background: "linear-gradient(160deg,#fff7d6 0%,#f5e4a8 100%)",
          borderRadius: `${radius.card}px ${radius.card}px 0 0`,
        }}>
          <p style={{ ...typography.meta, color: colors.yellow700, fontWeight: typography.weight.bold, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>
            Book a Slot
          </p>
          <h2 style={{ ...typography.h2, color: colors.text.primary, margin: 0 }}>{ptm.title}</h2>
          <p style={{ ...typography.caption, color: colors.text.muted, marginTop: 4 }}>{fmtDate(ptm.meetingDate)}</p>
        </div>

        <div style={{ padding: spacing.lg }}>
          {(ptm.slotsByTeacher || []).length === 0 ? (
            <p style={{ ...typography.body, color: colors.text.muted, textAlign: "center" }}>No slots available at the moment.</p>
          ) : (
            ptm.slotsByTeacher.map(group => (
              <div key={group.teacherId} style={{ marginBottom: spacing.lg }}>
                <p style={{
                  ...typography.caption, fontWeight: typography.weight.bold,
                  color: colors.text.muted, textTransform: "uppercase",
                  letterSpacing: "0.1em", marginBottom: spacing.sm,
                }}>
                  👤 {group.teacherName || group.teacherId}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm }}>
                  {group.slots.map(slot => {
                    const isAvail   = slot.status === "available";
                    const isSelected = selectedSlot?.id === slot.id;
                    return (
                      <button key={slot.id} disabled={!isAvail}
                        onClick={() => isAvail && setSelectedSlot(slot)}
                        style={{
                          padding: `${spacing.sm}px ${spacing.md}px`,
                          borderRadius: radius.md,
                          border: isSelected ? `2px solid ${colors.yellow700}` : `1px solid ${isAvail ? colors.surface.border : colors.gray200}`,
                          background: isSelected ? colors.yellow100 : isAvail ? colors.surface.raised : colors.gray100,
                          color: isSelected ? colors.yellow700 : isAvail ? colors.text.secondary : colors.gray400,
                          fontSize: typography.size.caption, fontWeight: typography.weight.semibold,
                          cursor: isAvail ? "pointer" : "not-allowed",
                          textDecoration: !isAvail ? "line-through" : "none",
                          transition: "all 0.15s",
                        }}>
                        {fmtTime(slot.startTime)}
                        {isSelected && " ✓"}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          {error && (
            <p style={{
              ...typography.caption, color: colors.dangerStrong, background: colors.dangerSoft,
              border: `1px solid ${colors.dangerBorder}`, borderRadius: radius.md,
              padding: `${spacing.sm}px ${spacing.md}px`, marginBottom: spacing.md,
            }}>{error}</p>
          )}

          <div style={{ display: "flex", gap: spacing.sm, marginTop: spacing.md }}>
            <button onClick={onClose} style={{
              flex: 1, padding: `${spacing.md}px`, borderRadius: radius.md,
              border: `1px solid ${colors.surface.border}`, background: colors.surface.raised,
              color: colors.text.secondary, fontSize: typography.size.caption, fontWeight: typography.weight.semibold,
              cursor: "pointer",
            }}>Cancel</button>
            <button onClick={handleBook} disabled={!selectedSlot || booking} style={{
              flex: 2, padding: `${spacing.md}px`, borderRadius: radius.md,
              background: selectedSlot ? "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)" : colors.gray100,
              color: selectedSlot ? "#5a4010" : colors.gray400,
              fontSize: typography.size.caption, fontWeight: typography.weight.bold,
              border: "none", cursor: selectedSlot ? "pointer" : "not-allowed",
              boxShadow: selectedSlot ? "0 4px 12px rgba(212,170,31,0.35)" : "none",
            }}>
              {booking ? "Booking…" : "Confirm Booking"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PTM Card ──────────────────────────────────────────────────────────────────

function PtmCard({ ptm, studentId, onReload }) {
  const status  = ptmStatus(ptm.meetingDate);
  const sm      = STATUS_META[status];
  const d       = ptm.meetingDate ? new Date(`${ptm.meetingDate}T00:00:00`) : null;
  const dayNum  = d ? d.getDate() : "?";
  const monthStr = d ? MONTHS[d.getMonth()] : "";
  const isToday  = status === "today";

  const [showPicker,   setShowPicker]   = useState(false);
  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [cancelling,   setCancelling]   = useState(false);

  const booking   = ptm.myBooking;
  const hasNotes  = ptm.notes && ptm.notes.sharedWithParent;
  const [showNotes, setShowNotes] = useState(false);

  const handleBook = async (ptmId, studentId, slotId) => {
    const { booking: b } = await parentService.bookPtmSlot(ptmId, studentId, slotId);
    onReload();
    return b;
  };

  const handleReschedule = async (ptmId, studentId, newSlotId) => {
    await parentService.reschedulePtmBooking(booking.id, newSlotId);
    onReload();
  };

  const handleCancel = async () => {
    if (!window.confirm("Cancel this PTM appointment?")) return;
    setCancelling(true);
    try {
      await parentService.cancelPtmBooking(booking.id);
      onReload();
    } finally {
      setCancelling(false);
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
          background: "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 12px rgba(212,170,31,0.32)",
        }}>
          <span style={{ color: "#7a5010", fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{monthStr}</span>
          <span style={{ color: "#3a2a06", fontSize: 20, fontWeight: 900, lineHeight: 1.1 }}>{dayNum}</span>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, flexWrap: "wrap", marginBottom: spacing.xs }}>
            <span style={{
              ...typography.meta, fontWeight: typography.weight.bold,
              color: sm.fg, background: sm.bg, border: `1px solid ${sm.bd}`,
              borderRadius: radius.pill, padding: `2px ${spacing.sm}px`,
            }}>{sm.label}</span>
            {ptm.availableSlots > 0 && (
              <span style={{
                ...typography.meta, color: colors.successStrong, background: colors.successSoft,
                border: `1px solid ${colors.successBorder}`, borderRadius: radius.pill, padding: `2px ${spacing.sm}px`,
              }}>{ptm.availableSlots} slots open</span>
            )}
          </div>

          <div style={{ ...typography.title, color: colors.text.primary, marginBottom: spacing.xs }}>{ptm.title}</div>

          <div style={{ ...typography.caption, color: colors.text.muted, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>📅 {fmtDate(ptm.meetingDate)}</span>
            {ptm.startTime && <span>🕐 {fmtTime(ptm.startTime)}{ptm.endTime ? ` – ${fmtTime(ptm.endTime)}` : ""}</span>}
            {ptm.venue && <span>📍 {ptm.venue}</span>}
          </div>

          {ptm.description && (
            <div style={{ ...typography.caption, color: colors.text.secondary, marginTop: spacing.sm }}>
              {ptm.description}
            </div>
          )}

          {/* Teachers */}
          {(ptm.teacherIds || []).length > 0 && (
            <div style={{ marginTop: spacing.sm, display: "flex", flexWrap: "wrap", gap: 4 }}>
              {ptm.slotsByTeacher?.map(g => (
                <span key={g.teacherId} style={{
                  ...typography.meta, color: colors.text.secondary,
                  background: colors.surface.raised, border: `1px solid ${colors.surface.border}`,
                  borderRadius: radius.pill, padding: `2px ${spacing.sm}px`,
                }}>
                  👤 {g.teacherName}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Booking section */}
      {status !== "completed" && (
        <div style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTop: `1px solid ${colors.surface.border}` }}>
          {!booking ? (
            ptm.availableSlots > 0 ? (
              <button onClick={() => setShowPicker(true)} style={{
                width: "100%", padding: `${spacing.md}px`,
                borderRadius: radius.md,
                background: "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)",
                color: "#5a4010", fontSize: typography.size.caption, fontWeight: typography.weight.bold,
                border: "none", cursor: "pointer",
                boxShadow: "0 4px 12px rgba(212,170,31,0.35)",
              }}>
                Book Appointment Slot
              </button>
            ) : (
              <p style={{ ...typography.caption, color: colors.text.muted, textAlign: "center" }}>
                No appointment slots available.
              </p>
            )
          ) : (
            <div>
              <div style={{
                background: colors.successSoft, border: `1px solid ${colors.successBorder}`,
                borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
              }}>
                <p style={{ ...typography.caption, fontWeight: typography.weight.bold, color: colors.successStrong, marginBottom: 4 }}>
                  ✅ Appointment Confirmed
                </p>
                <p style={{ ...typography.caption, color: colors.text.secondary }}>
                  {booking.slot?.teacherName && `👤 ${booking.slot.teacherName} · `}
                  🕐 {fmtTime(booking.slot?.startTime)} – {fmtTime(booking.slot?.endTime)}
                </p>
              </div>
              <div style={{ display: "flex", gap: spacing.sm }}>
                <button onClick={() => setRescheduleMode(true)} style={{
                  flex: 1, padding: `${spacing.sm}px`, borderRadius: radius.md,
                  border: `1px solid ${colors.surface.border}`, background: colors.surface.raised,
                  color: colors.text.secondary, fontSize: typography.size.caption, fontWeight: typography.weight.semibold,
                  cursor: "pointer",
                }}>Reschedule</button>
                <button onClick={handleCancel} disabled={cancelling} style={{
                  flex: 1, padding: `${spacing.sm}px`, borderRadius: radius.md,
                  border: `1px solid ${colors.dangerBorder}`, background: colors.dangerSoft,
                  color: colors.dangerStrong, fontSize: typography.size.caption, fontWeight: typography.weight.semibold,
                  cursor: cancelling ? "not-allowed" : "pointer", opacity: cancelling ? 0.6 : 1,
                }}>{cancelling ? "Cancelling…" : "Cancel Slot"}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Shared notes */}
      {hasNotes && (
        <div style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTop: `1px solid ${colors.surface.border}` }}>
          <button onClick={() => setShowNotes(v => !v)} style={{
            ...typography.caption, fontWeight: typography.weight.bold,
            color: colors.yellow700, background: "none", border: "none",
            cursor: "pointer", padding: 0, textDecoration: "underline",
          }}>
            {showNotes ? "Hide Meeting Notes" : "View Meeting Notes"}
          </button>
          {showNotes && (
            <div style={{ marginTop: spacing.sm, display: "flex", flexDirection: "column", gap: spacing.sm }}>
              {ptm.notes.summary && (
                <NoteBlock label="Summary" text={ptm.notes.summary} />
              )}
              {ptm.notes.strengths && (
                <NoteBlock label="Strengths" text={ptm.notes.strengths} />
              )}
              {ptm.notes.improvements && (
                <NoteBlock label="Areas of Improvement" text={ptm.notes.improvements} />
              )}
              {ptm.notes.actionItems && (
                <NoteBlock label="Action Items" text={ptm.notes.actionItems} />
              )}
            </div>
          )}
        </div>
      )}

      {/* Slot picker modals */}
      {showPicker && (
        <SlotPickerModal ptm={ptm} studentId={studentId} onBook={handleBook} onClose={() => setShowPicker(false)} />
      )}
      {rescheduleMode && (
        <SlotPickerModal ptm={{
          ...ptm,
          slotsByTeacher: ptm.slotsByTeacher?.map(g => ({
            ...g,
            slots: g.slots.filter(s => s.status === "available"),
          })),
        }} studentId={studentId}
          onBook={async (ptmId, sid, slotId) => handleReschedule(ptmId, sid, slotId)}
          onClose={() => setRescheduleMode(false)} />
      )}
    </div>
  );
}

function NoteBlock({ label, text }) {
  return (
    <div style={{
      background: colors.surface.raised, borderRadius: radius.md,
      padding: spacing.md, border: `1px solid ${colors.surface.border}`,
    }}>
      <p style={{ ...typography.meta, fontWeight: typography.weight.bold, color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
        {label}
      </p>
      <p style={{ ...typography.body, color: colors.text.secondary, margin: 0 }}>{text}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PTMPage({ studentId }) {
  const { data, loading, error, reload } = usePTM(studentId);
  const ptms = data?.ptms || [];

  const upcoming  = ptms.filter(p => ptmStatus(p.meetingDate) !== "completed");
  const completed = ptms.filter(p => ptmStatus(p.meetingDate) === "completed");

  return (
    <div style={{ padding: spacing.lg, display: "flex", flexDirection: "column", gap: spacing.lg }}>
      <header style={{ padding: `${spacing.xs}px ${spacing.xs}px 0` }}>
        <h1 style={{ ...typography.h1, color: colors.text.primary, margin: 0 }}>Parent-Teacher Meetings</h1>
        <p style={{ ...typography.caption, color: colors.text.muted, margin: `${spacing.xs}px 0 0` }}>
          Schedule your appointment with teachers
        </p>
      </header>

      {loading ? (
        <><CardSkeleton /><CardSkeleton /></>
      ) : error ? (
        <ErrorNote message={error} />
      ) : ptms.length === 0 ? (
        <Empty />
      ) : (
        <>
          {upcoming.length > 0 && (
            <section style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
              <SectionLabel>Upcoming Meetings</SectionLabel>
              {upcoming.map(p => (
                <PtmCard key={p.id} ptm={p} studentId={studentId} onReload={reload} />
              ))}
            </section>
          )}
          {completed.length > 0 && (
            <section style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
              <SectionLabel>Past Meetings</SectionLabel>
              {completed.map(p => (
                <PtmCard key={p.id} ptm={p} studentId={studentId} onReload={reload} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ── Utility components ────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <span style={{
      ...typography.caption, textTransform: "uppercase",
      letterSpacing: typography.tracking?.wider || "0.08em",
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
        width: 64, height: 64, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: `0 auto ${spacing.lg}px`,
        background: "linear-gradient(160deg,#fff7d6 0%,#f5e4a8 100%)",
      }}>
        <svg width={32} height={32} fill="none" stroke="#c79b12" strokeWidth={1.75} viewBox="0 0 24 24">
          <path d="M18 21a8 8 0 0 0-16 0" />
          <circle cx="10" cy="8" r="5" />
          <path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" />
        </svg>
      </div>
      <h2 style={{ ...typography.h2, color: colors.text.primary, margin: `0 0 ${spacing.sm}px` }}>No PTMs scheduled</h2>
      <p style={{ ...typography.body, color: colors.text.muted, margin: 0 }}>
        Parent-Teacher Meetings scheduled by the school will appear here.
      </p>
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
