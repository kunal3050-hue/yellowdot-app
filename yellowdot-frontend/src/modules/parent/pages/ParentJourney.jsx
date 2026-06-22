/**
 * ParentJourney.jsx — Child Journey · Parent Timeline (V2)
 *
 * Redesigned with:
 *   - 4 stat cards: Memories / Observations / Artwork / Milestones
 *   - 5 filter tabs: All / Memories / Observations / Artwork / Milestones
 *   - Hybrid Instagram timeline:
 *       · Photos + Artwork with images → 2-column visual grid
 *       · Videos → full-width player
 *       · Observations → full-width teacher-note card
 *       · Milestones → full-width golden celebration card
 *   - Month-grouped, newest first
 *   - Client-side filtering from a single load (500 entries max)
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../../../services/authService";
import { useActiveChild } from "../contexts/ActiveChildContext";
import { colors } from "../theme";
import { currentAcademicYear } from "../../../utils/academicYear";

// ── Category system ───────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: "all",          label: "All",           emoji: null  },
  { key: "memories",     label: "Memories",      emoji: "📸" },
  { key: "observations", label: "Observations",  emoji: "📝" },
  { key: "artwork",      label: "Artwork",        emoji: "🎨" },
  { key: "milestones",   label: "Milestones",    emoji: "⭐" },
];

const CATEGORY_KINDS = {
  all:          null,
  memories:     ["photo", "video", "event-highlight"],
  observations: ["observation"],
  artwork:      ["artwork"],
  milestones:   ["milestone", "achievement"],
};

const STAT_DEFS = [
  { key: "memories",     label: "Memories"    },
  { key: "observations", label: "Observations"},
  { key: "artwork",      label: "Artwork"      },
  { key: "milestones",   label: "Milestones"  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const DOMAIN_LABELS = {
  social: "Social", emotional: "Emotional", communication: "Communication",
  creativity: "Creativity", leadership: "Leadership", confidence: "Confidence",
  fine_motor: "Fine Motor", gross_motor: "Gross Motor",
};

const ARTWORK_LABELS = {
  drawing: "Drawing", worksheet: "Worksheet", craft: "Craft",
  project: "Project", coloring: "Coloring",
};

function monthKey(e) { return (e.date || e.createdAt || "").slice(0, 7); }

function monthLabel(yyyymm) {
  if (!yyyymm) return "";
  const [y, m] = yyyymm.split("-");
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function fmtDay(dateStr) {
  if (!dateStr) return "";
  return new Date(`${dateStr}T00:00:00`)
    .toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function groupByMonth(entries) {
  const map = new Map();
  for (const e of entries) {
    const k = monthKey(e);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(e);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

function buildYearOptions() {
  const [s] = currentAcademicYear().split("-");
  const start = Number(s);
  return [0, 1, 2, 3].map(off => { const y = start - off; return `${y}-${String(y + 1).slice(2)}`; });
}

// ── Timeline block builder: groups consecutive media into a grid ──────────────
function buildBlocks(entries) {
  const blocks = [];
  let buf = [];
  const flush = () => { if (buf.length) { blocks.push({ type: "grid", items: [...buf] }); buf = []; } };
  for (const e of entries) {
    const isGrid = (e.kind === "photo" || e.kind === "artwork") && e.mediaUrl;
    if (isGrid) { buf.push(e); } else { flush(); blocks.push({ type: "card", item: e }); }
  }
  flush();
  return blocks;
}

// ── Card components ───────────────────────────────────────────────────────────

function ObsCard({ entry }) {
  const domain = DOMAIN_LABELS[entry.domain] || entry.domain;
  const stars  = entry.level ? "⭐".repeat(entry.level) : "";
  return (
    <div style={{
      background: "#FAFAFF", borderRadius: 14,
      border: "1px solid #E0E7FF", borderLeft: "4px solid #818CF8", borderRadius: "0 14px 14px 0",
      padding: "14px 16px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#4F46E5", background: "#EEF2FF", padding: "3px 9px", borderRadius: 10 }}>
            📝 Teacher note
          </span>
          {domain && (
            <span style={{ fontSize: 11, color: "#6B7280", background: "#F3F4F6", padding: "3px 9px", borderRadius: 10 }}>
              {domain}
            </span>
          )}
        </div>
        {stars && <span style={{ fontSize: 13, flexShrink: 0 }}>{stars}</span>}
      </div>
      {entry.observationText && (
        <p style={{ margin: 0, fontSize: 13, color: colors.text.secondary, lineHeight: 1.65 }}>
          {entry.observationText}
        </p>
      )}
      <div style={{ fontSize: 11, color: colors.text.faint, marginTop: 8 }}>{fmtDay(entry.date)}</div>
    </div>
  );
}

function VideoCard({ entry }) {
  return (
    <div style={{ borderRadius: 14, overflow: "hidden", background: "#000" }}>
      <video src={entry.mediaUrl} style={{ width: "100%", maxHeight: 300, display: "block" }} controls playsInline />
      {(entry.caption || entry.date) && (
        <div style={{ background: colors.surface.card, padding: "10px 14px" }}>
          {entry.caption && <p style={{ margin: 0, fontSize: 13, color: colors.text.secondary, lineHeight: 1.5 }}>{entry.caption}</p>}
          <div style={{ fontSize: 11, color: colors.text.faint, marginTop: entry.caption ? 4 : 0 }}>{fmtDay(entry.date)}</div>
        </div>
      )}
    </div>
  );
}

function MilestoneCard({ entry }) {
  const isBirthday = entry.milestoneCategory === "birthday";
  const isAttendance = entry.milestoneCategory === "attendance";
  const icon = isBirthday ? "🎂" : isAttendance ? "🎓" : "⭐";
  return (
    <div style={{
      background: "linear-gradient(135deg,#FFFCE6,#FFF8C8)",
      border: "2px solid #F0DA4A", borderRadius: 16,
      padding: "20px 18px", textAlign: "center", position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: -16, right: -16, width: 80, height: 80, borderRadius: "50%", background: "rgba(244,196,0,.12)" }} />
      <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#78350F", marginBottom: 4 }}>
        {entry.milestoneTitle}
      </div>
      {entry.momentNote && (
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#92400E", lineHeight: 1.55 }}>{entry.momentNote}</p>
      )}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#B45309" }}>{fmtDay(entry.date)}</span>
        {entry.autoDetected && (
          <span style={{ fontSize: 10, color: "#D97706", background: "rgba(251,191,36,.2)", padding: "2px 8px", borderRadius: 8 }}>
            Auto-detected ✨
          </span>
        )}
      </div>
    </div>
  );
}

function SpecialMomentCard({ entry }) {
  return (
    <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 14, padding: "14px 16px" }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#15803D", background: "#DCFCE7", padding: "3px 9px", borderRadius: 10, display: "inline-block", marginBottom: 8 }}>
        🎉 Special moment
      </span>
      {(entry.caption || entry.momentNote) && (
        <p style={{ margin: "0 0 8px", fontSize: 13, color: colors.text.secondary, lineHeight: 1.6 }}>
          {entry.caption || entry.momentNote}
        </p>
      )}
      <div style={{ fontSize: 11, color: colors.text.faint }}>{fmtDay(entry.date)}</div>
    </div>
  );
}

function MediaGrid({ items }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, borderRadius: 14, overflow: "hidden" }}>
      {items.map((e, i) => {
        const isArtwork = e.kind === "artwork";
        const cat = ARTWORK_LABELS[e.artworkCategory] || "";
        return (
          <div key={e.id} style={{ position: "relative", aspectRatio: "1/1", background: isArtwork ? "#FDF4FF" : "#FFF0D4", overflow: "hidden" }}>
            <img
              src={e.thumbnailUrl || e.mediaUrl}
              alt={e.artworkTitle || e.caption || ""}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(to top, rgba(0,0,0,.40) 0%, transparent 50%)",
            }} />
            <div style={{ position: "absolute", bottom: 6, left: 8, right: 8 }}>
              {isArtwork && cat && (
                <span style={{ fontSize: 10, fontWeight: 600, color: "#fff", background: "rgba(107,33,168,.7)", padding: "2px 7px", borderRadius: 8 }}>
                  {cat}
                </span>
              )}
              {!isArtwork && e.caption && (
                <div style={{ fontSize: 10, color: "rgba(255,255,255,.85)", lineHeight: 1.3 }}>{e.caption}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function JourneyBlock({ block }) {
  if (block.type === "grid") return <MediaGrid items={block.items} />;
  const { item: e } = block;
  if (e.kind === "video")           return <VideoCard entry={e} />;
  if (e.kind === "observation")     return <ObsCard entry={e} />;
  if (e.kind === "milestone" || e.kind === "achievement") return <MilestoneCard entry={e} />;
  if (e.kind === "event-highlight") return <SpecialMomentCard entry={e} />;
  return null;
}

// ── Empty state ───────────────────────────────────────────────────────────────
const EMPTY = {
  all:          { icon: "📖", text: "No entries yet.", sub: "Entries shared by teachers will appear here." },
  memories:     { icon: "📸", text: "No memories shared yet.",     sub: "Photos and videos from school will appear here." },
  observations: { icon: "📝", text: "No teacher notes yet.",       sub: "Your child's developmental observations will appear here." },
  artwork:      { icon: "🎨", text: "No artwork uploaded yet.",     sub: "Creative work from class will appear here." },
  milestones:   { icon: "⭐", text: "No milestones recorded yet.", sub: "Special achievements and auto-detected milestones will appear here." },
};

// ── Main component ────────────────────────────────────────────────────────────
export default function ParentJourney() {
  const { activeChild }  = useActiveChild();
  const [category,       setCategory]       = useState("all");
  const [academicYear,   setAcademicYear]   = useState(currentAcademicYear());
  const [allEntries,     setAllEntries]     = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);

  const yearOptions = useMemo(() => buildYearOptions(), []);

  const load = useCallback(async () => {
    if (!activeChild?.studentId) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const { data } = await api.get("/api/parent/journey", {
        params: { childId: activeChild.studentId, academicYear, limit: 500 },
      });
      setAllEntries(data?.entries || []);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Could not load journey.");
    } finally {
      setLoading(false);
    }
  }, [activeChild?.studentId, academicYear]);

  useEffect(() => { load(); }, [load]);

  // ── Derived stats (always from ALL entries) ───────────────────────────────
  const stats = useMemo(() => {
    const s = { memories: 0, observations: 0, artwork: 0, milestones: 0 };
    for (const e of allEntries) {
      if (["photo", "video", "event-highlight"].includes(e.kind)) s.memories++;
      else if (e.kind === "observation")                           s.observations++;
      else if (e.kind === "artwork")                               s.artwork++;
      else if (["milestone", "achievement"].includes(e.kind))     s.milestones++;
    }
    return s;
  }, [allEntries]);

  // ── Filtered entries for display ──────────────────────────────────────────
  const filtered = useMemo(() => {
    const kinds = CATEGORY_KINDS[category];
    return kinds ? allEntries.filter(e => kinds.includes(e.kind)) : allEntries;
  }, [allEntries, category]);

  const grouped  = useMemo(() => groupByMonth(filtered), [filtered]);
  const childName = activeChild?.name || activeChild?.studentName || "Your Child";

  const em = EMPTY[category] || EMPTY.all;

  return (
    <div style={{ minHeight: "100vh", background: colors.surface.background }}>
      <style>{`
        .pj-pill { cursor: pointer; white-space: nowrap; transition: background 100ms, border-color 100ms; font-family: inherit; }
        .pj-yr { font-size: 13px; padding: 5px 10px; border-radius: 8px; font-weight: 500; border: 1px solid; background: transparent; font-family: inherit; cursor: pointer; color: var(--yd-muted); border-color: rgba(139,125,101,.22); }
        .pj-yr:focus { outline: 2px solid #F4C400; }
        :root { --yd-muted: #8B7A2E; }
      `}</style>

      {/* ── Header band ─────────────────────────────────────────────────── */}
      <div style={{ background: "linear-gradient(180deg,#FFFCE6 0%,#FFF8D6 60%,#fff 100%)", paddingBottom: 0 }}>

        {/* Title row */}
        <div style={{ padding: "20px 18px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#3A2F00", letterSpacing: -0.3 }}>
              {childName}&rsquo;s Journey
            </h1>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#8B7A2E" }}>
              Growth, creativity, and milestones
            </p>
          </div>
          <select className="pj-yr" value={academicYear} onChange={e => setAcademicYear(e.target.value)}>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Stat cards (2×2 grid) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "14px 18px 0" }}>
          {STAT_DEFS.map(s => (
            <button
              key={s.key}
              onClick={() => setCategory(c => c === s.key ? "all" : s.key)}
              style={{
                padding: "12px 14px", borderRadius: 12, textAlign: "left", cursor: "pointer",
                background: category === s.key ? "#F4C400" : "#fff",
                border: `1.5px solid ${category === s.key ? "#F4C400" : "rgba(139,125,101,.20)"}`,
                boxShadow: category === s.key ? "0 2px 8px rgba(244,196,0,.3)" : "none",
                fontFamily: "inherit",
              }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: category === s.key ? "#3A2F00" : "#1F1D18", lineHeight: 1 }}>
                {loading ? "—" : stats[s.key]}
              </div>
              <div style={{ fontSize: 11, color: category === s.key ? "#5A4500" : "#78746A", marginTop: 3 }}>
                {s.label}
              </div>
            </button>
          ))}
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 7, overflowX: "auto", padding: "14px 18px", scrollbarWidth: "none", borderBottom: `1px solid ${colors.surface.border}` }}>
          {CATEGORIES.map(c => {
            const active = category === c.key;
            return (
              <button
                key={c.key}
                className="pj-pill"
                onClick={() => setCategory(c.key)}
                style={{
                  fontSize: 13, padding: "6px 14px", borderRadius: 20, flexShrink: 0,
                  border: `1.5px solid ${active ? colors.yellow500 : colors.surface.border}`,
                  background: active ? colors.yellow500 : colors.surface.card,
                  color: active ? "#3A2F00" : colors.text.secondary,
                  fontWeight: active ? 600 : 400, fontFamily: "inherit",
                }}>
                {c.emoji ? `${c.emoji} ${c.label}` : c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Timeline body ─────────────────────────────────────────────────── */}
      <div style={{ padding: "16px 16px 100px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: colors.text.faint }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>✦</div>
            Loading…
          </div>
        ) : error ? (
          <div style={{ background: "#FDECEC", border: "1px solid #F4B5B5", borderRadius: 12, padding: 14, color: "#B42318", fontSize: 13 }}>
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "56px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{em.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: colors.text.primary, marginBottom: 6 }}>{em.text}</div>
            <div style={{ fontSize: 13, color: colors.text.muted, lineHeight: 1.6 }}>{em.sub}</div>
          </div>
        ) : (
          grouped.map(([key, items]) => {
            const blocks = buildBlocks(items);
            return (
              <div key={key} style={{ marginBottom: 28 }}>
                {/* Month header */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
                  position: "sticky", top: 0, zIndex: 10,
                  background: "rgba(255,255,255,.93)", backdropFilter: "blur(6px)",
                  padding: "5px 0",
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: colors.text.primary, letterSpacing: 0.1 }}>
                    {monthLabel(key)}
                  </span>
                  <span style={{ fontSize: 11, color: colors.text.faint, background: colors.surface.raised, padding: "2px 7px", borderRadius: 8 }}>
                    {items.length}
                  </span>
                  <div style={{ flex: 1, height: "0.5px", background: colors.surface.border }} />
                </div>

                {/* Blocks */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {blocks.map((block, i) => (
                    <JourneyBlock key={i} block={block} />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
