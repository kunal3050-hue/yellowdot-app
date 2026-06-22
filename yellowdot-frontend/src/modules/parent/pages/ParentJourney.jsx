/**
 * ParentJourney.jsx — Unified child timeline for parents
 *
 * Displays all journeyEntries for the active child, grouped by month.
 * Filters: All · Photos · Videos · Observations · Artwork · Milestones · Achievements
 * Academic year selector with the last 4 years.
 * Replaces the V1 Memories timeline.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../../../services/authService";
import { useActiveChild } from "../contexts/ActiveChildContext";
import { colors } from "../theme";
import { currentAcademicYear } from "../../../utils/academicYear";

// ── Kind filter pills ──────────────────────────────────────────────────────────
const FILTERS = [
  { key: "all",          label: "All",           emoji: null  },
  { key: "photo",        label: "Photos",        emoji: "📸" },
  { key: "video",        label: "Videos",        emoji: "🎬" },
  { key: "observation",  label: "Observations",  emoji: "👩‍🏫" },
  { key: "artwork",      label: "Artwork",        emoji: "🎨" },
  { key: "milestone",    label: "Milestones",    emoji: "⭐" },
  { key: "achievement",  label: "Achievements",  emoji: "🏆" },
];

const DOMAIN_LABELS = {
  social: "Social", emotional: "Emotional", communication: "Communication",
  creativity: "Creativity", leadership: "Leadership", confidence: "Confidence",
  fine_motor: "Fine Motor", gross_motor: "Gross Motor",
};

const ARTWORK_LABELS = {
  drawing: "Drawing", worksheet: "Worksheet", craft: "Craft",
  project: "Project", coloring: "Coloring",
};

// ── Academic year selector ─────────────────────────────────────────────────────
function buildYearOptions() {
  const current = currentAcademicYear();
  const [s] = current.split("-");
  const start = Number(s);
  return [0, 1, 2, 3].map(offset => {
    const y = start - offset;
    return `${y}-${String(y + 1).slice(2)}`;
  });
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function monthKey(dateStr) { return (dateStr || "").slice(0, 7); } // "2026-06"
function monthLabel(yyyymm) {
  if (!yyyymm) return "";
  const [y, m] = yyyymm.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}
function fmtDay(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function groupByMonth(entries) {
  const map = new Map();
  for (const e of entries) {
    const key = monthKey(e.date || e.createdAt || "");
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

// ── Entry card components ─────────────────────────────────────────────────────

function ObservationCard({ entry }) {
  const domain = DOMAIN_LABELS[entry.domain] || entry.domain;
  const stars  = entry.level ? "⭐".repeat(entry.level) : "";
  return (
    <div style={{
      background: "#FAFAFF",
      borderRadius: 16,
      border: "1px solid #E0E7FF",
      borderLeft: "4px solid #818CF8",
      padding: "16px 18px",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#4F46E5", background: "#EEF2FF", padding: "3px 10px", borderRadius: 20 }}>
            👩‍🏫 Observation
          </span>
          {domain && (
            <span style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", background: "#F3F4F6", padding: "3px 10px", borderRadius: 20 }}>
              {domain}
            </span>
          )}
        </div>
        {stars && <span style={{ fontSize: 14, flexShrink: 0 }}>{stars}</span>}
      </div>
      {entry.observationText && (
        <p style={{ margin: 0, fontSize: 14, color: colors.text.secondary, lineHeight: 1.65 }}>
          {entry.observationText}
        </p>
      )}
      <div style={{ fontSize: 11, color: colors.text.faint }}>{fmtDay(entry.date)}</div>
    </div>
  );
}

function MediaCard({ entry }) {
  const isVideo = entry.kind === "video";
  return (
    <div style={{ borderRadius: 16, overflow: "hidden", background: "#000", boxShadow: "0 2px 12px rgba(0,0,0,.10)" }}>
      {isVideo
        ? <video src={entry.mediaUrl} style={{ width: "100%", maxHeight: 360, display: "block" }} controls playsInline />
        : <img src={entry.thumbnailUrl || entry.mediaUrl} alt={entry.caption || "Photo"} style={{ width: "100%", maxHeight: 360, objectFit: "cover", display: "block" }} />}
      {(entry.caption || entry.date) && (
        <div style={{ background: "#fff", padding: "10px 14px" }}>
          {entry.caption && <p style={{ margin: 0, fontSize: 13, color: colors.text.secondary, lineHeight: 1.5 }}>{entry.caption}</p>}
          <div style={{ fontSize: 11, color: colors.text.faint, marginTop: entry.caption ? 4 : 0 }}>{fmtDay(entry.date)}</div>
        </div>
      )}
    </div>
  );
}

function ArtworkCard({ entry }) {
  const catLabel = ARTWORK_LABELS[entry.artworkCategory] || entry.artworkCategory;
  return (
    <div style={{ borderRadius: 16, overflow: "hidden", background: "#fff", border: "1px solid #E9D5FF", boxShadow: "0 2px 12px rgba(107,33,168,.08)" }}>
      {entry.mediaUrl && (
        <img src={entry.thumbnailUrl || entry.mediaUrl} alt={entry.artworkTitle || "Artwork"} style={{ width: "100%", maxHeight: 320, objectFit: "cover", display: "block" }} />
      )}
      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          {catLabel && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "#6B21A8", background: "#FDF4FF", padding: "3px 10px", borderRadius: 20 }}>
              🎨 {catLabel}
            </span>
          )}
        </div>
        {entry.artworkTitle && (
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.text.primary, marginBottom: 2 }}>
            {entry.artworkTitle}
          </div>
        )}
        {entry.caption && <p style={{ margin: 0, fontSize: 13, color: colors.text.secondary, lineHeight: 1.5 }}>{entry.caption}</p>}
        <div style={{ fontSize: 11, color: colors.text.faint, marginTop: 6 }}>{fmtDay(entry.date)}</div>
      </div>
    </div>
  );
}

function MilestoneCard({ entry }) {
  const isAuto = entry.autoDetected;
  return (
    <div style={{
      background: "linear-gradient(135deg, #FFFCE6 0%, #FFF8CC 60%, #FFF4A8 100%)",
      border: "2px solid #F6D54A",
      borderRadius: 18,
      padding: "22px 20px",
      boxShadow: "0 4px 20px rgba(246,213,74,.30)",
      textAlign: "center",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: -20, right: -20,
        width: 100, height: 100, borderRadius: "50%",
        background: "rgba(246,213,74,.15)",
      }} />
      <div style={{ fontSize: 44, marginBottom: 8, lineHeight: 1 }}>
        {entry.milestoneCategory === "birthday" ? "🎂" : entry.milestoneCategory === "attendance" ? "🎓" : "⭐"}
      </div>
      <div style={{ fontSize: 16, fontWeight: 900, color: "#78350F", marginBottom: 6, letterSpacing: -0.3 }}>
        {entry.milestoneTitle}
      </div>
      {entry.momentNote && (
        <p style={{ margin: "0 0 10px", fontSize: 13, color: "#92400E", lineHeight: 1.55 }}>
          {entry.momentNote}
        </p>
      )}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#B45309", fontWeight: 700 }}>{fmtDay(entry.date)}</span>
        {isAuto && (
          <span style={{ fontSize: 10, fontWeight: 700, color: "#D97706", background: "rgba(251,191,36,.25)", padding: "2px 8px", borderRadius: 10 }}>
            Auto-detected ✨
          </span>
        )}
      </div>
    </div>
  );
}

function AchievementCard({ entry }) {
  return (
    <div style={{
      background: "#FFFDF0",
      border: "1px solid #FDE68A",
      borderRadius: 16,
      padding: "16px 18px",
      display: "flex", gap: 14, alignItems: "flex-start",
    }}>
      <span style={{ fontSize: 32, flexShrink: 0, lineHeight: 1, marginTop: 2 }}>🏆</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {(entry.caption || entry.observationText) && (
          <p style={{ margin: "0 0 6px", fontSize: 14, color: colors.text.secondary, lineHeight: 1.6 }}>
            {entry.caption || entry.observationText}
          </p>
        )}
        <div style={{ fontSize: 11, color: colors.text.faint }}>{fmtDay(entry.date)}</div>
      </div>
    </div>
  );
}

function EntryCard({ entry }) {
  switch (entry.kind) {
    case "observation":     return <ObservationCard entry={entry} />;
    case "photo":
    case "video":           return <MediaCard entry={entry} />;
    case "artwork":         return <ArtworkCard entry={entry} />;
    case "milestone":       return <MilestoneCard entry={entry} />;
    case "achievement":     return <AchievementCard entry={entry} />;
    case "event-highlight": return (
      <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 16, padding: "14px 16px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#15803D", marginBottom: 6 }}>🎉 Event Highlight</div>
        {(entry.caption || entry.momentNote) && (
          <p style={{ margin: "0 0 6px", fontSize: 14, color: colors.text.secondary, lineHeight: 1.6 }}>
            {entry.caption || entry.momentNote}
          </p>
        )}
        <div style={{ fontSize: 11, color: colors.text.faint }}>{fmtDay(entry.date)}</div>
      </div>
    );
    default: return null;
  }
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ filter }) {
  const msgs = {
    all:         { emoji: "📖", text: "No journey entries yet." },
    photo:       { emoji: "📸", text: "No photos shared yet." },
    video:       { emoji: "🎬", text: "No videos shared yet." },
    observation: { emoji: "👩‍🏫", text: "No observations recorded yet." },
    artwork:     { emoji: "🎨", text: "No artwork uploaded yet." },
    milestone:   { emoji: "⭐", text: "No milestones recorded yet." },
    achievement: { emoji: "🏆", text: "No achievements recorded yet." },
  };
  const m = msgs[filter] || msgs.all;
  return (
    <div style={{ textAlign: "center", padding: "60px 24px" }}>
      <div style={{ fontSize: 52, marginBottom: 14 }}>{m.emoji}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: colors.text.primary, marginBottom: 6 }}>{m.text}</div>
      <div style={{ fontSize: 13, color: colors.text.muted }}>
        As your child's teachers add entries, they'll appear here.
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ParentJourney() {
  const { activeChild } = useActiveChild();
  const [filter,       setFilter]       = useState("all");
  const [academicYear, setAcademicYear] = useState(currentAcademicYear());
  const [entries,      setEntries]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);

  const yearOptions = useMemo(() => buildYearOptions(), []);

  const load = useCallback(async () => {
    if (!activeChild?.studentId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const params = { childId: activeChild.studentId, academicYear, limit: 200 };
      if (filter !== "all") params.kind = filter;
      const { data } = await api.get("/api/parent/journey", { params });
      setEntries(data?.entries || []);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Could not load journey.");
    } finally {
      setLoading(false);
    }
  }, [activeChild?.studentId, filter, academicYear]);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => groupByMonth(entries), [entries]);
  const childName = activeChild?.name || activeChild?.studentName || "Your Child";

  return (
    <div style={{ minHeight: "100vh", background: colors.surface.background }}>
      <style>{`
        .pj-pill { cursor: pointer; white-space: nowrap; transition: background 120ms, color 120ms; }
        .pj-pill:hover { opacity: 0.85; }
        .pj-yr { font-size: 13px; padding: 6px 12px; border-radius: 10px; font-weight: 600; cursor: pointer; border: 1.5px solid; background: #fff; font-family: inherit; }
        .pj-yr:focus { outline: 2px solid #F4C400; }
      `}</style>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div style={{
        padding: "24px 20px 0",
        background: "linear-gradient(180deg, #FFFCE6 0%, #FFFFFF 100%)",
        borderBottom: `1px solid ${colors.surface.border}`,
      }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: colors.text.primary, letterSpacing: -0.5 }}>
            📖 {childName}&rsquo;s Journey
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: colors.text.muted }}>
            A timeline of growth, creativity, and milestones.
          </p>
        </div>

        {/* Academic year selector */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <select
            className="pj-yr"
            value={academicYear}
            onChange={e => setAcademicYear(e.target.value)}
            style={{ borderColor: colors.surface.border, color: colors.text.secondary }}>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Filter pills — horizontal scroll */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 14, scrollbarWidth: "none" }}>
          {FILTERS.map(f => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                className="pj-pill"
                onClick={() => setFilter(f.key)}
                style={{
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  padding: "7px 16px", borderRadius: 24,
                  border: `1.5px solid ${active ? colors.yellow500 : colors.surface.border}`,
                  background: active ? colors.yellow500 : "#fff",
                  color: active ? colors.text.onYellow : colors.text.secondary,
                  flexShrink: 0,
                }}>
                {f.emoji ? `${f.emoji} ${f.label}` : f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div style={{ padding: "20px 16px 100px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: colors.text.faint }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
            Loading journey…
          </div>
        ) : error ? (
          <div style={{ background: "#FDECEC", border: "1px solid #F4B5B5", borderRadius: 12, padding: 16, color: "#B42318", fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          grouped.map(([key, items]) => (
            <div key={key} style={{ marginBottom: 32 }}>
              {/* Month header */}
              <div style={{
                display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
                position: "sticky", top: 0, background: "rgba(255,255,255,.92)",
                backdropFilter: "blur(6px)", padding: "6px 0", zIndex: 10,
              }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: colors.text.primary, letterSpacing: 0.2 }}>
                  {monthLabel(key)}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: colors.text.faint,
                  background: colors.surface.raised, padding: "2px 8px", borderRadius: 10 }}>
                  {items.length} {items.length === 1 ? "entry" : "entries"}
                </span>
                <div style={{ flex: 1, height: 1, background: colors.surface.border }} />
              </div>

              {/* Cards for this month */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {items.map(e => <EntryCard key={e.id} entry={e} />)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
