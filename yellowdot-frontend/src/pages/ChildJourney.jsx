// ─────────────────────────────────────────────────────────────────────────────
// Child Journey — Staff dashboard (V2)
// Redesigned with 4 stat cards + 5-category filter tabs + entry card grid.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { getEntries, deleteEntry } from "../services/journeyService";
import { api } from "../services/authService";
import { currentAcademicYear } from "../utils/academicYear";

// ── Palette ───────────────────────────────────────────────────────────────────
const W = {
  bg1: "#FFFDF7", bg2: "#FFFBF0", bg3: "#FFF8E8",
  charcoal1: "#4A3A22", charcoal2: "#6A5737",
  gold1: "#F6D54A", gold2: "#F1C933",
  goldPale: "#FFF7D6", goldBorder: "#EFD978",
  muted1: "#8B7355",
};

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
  { key: "memories",     label: "Memories",      icon: "📸", bg: "#FFF7ED", border: "#FED7AA", text: "#9A3412" },
  { key: "observations", label: "Observations",  icon: "📝", bg: "#EEF2FF", border: "#C7D2FE", text: "#3730A3" },
  { key: "artwork",      label: "Artwork",        icon: "🎨", bg: "#FDF4FF", border: "#E9D5FF", text: "#6B21A8" },
  { key: "milestones",   label: "Milestones",    icon: "⭐", bg: "#FFFBEB", border: "#FDE68A", text: "#92400E" },
];

// ── Kind-level metadata for entry badge labels ────────────────────────────────
const KIND_META = {
  observation:      { emoji: "📝", label: "Observation",     bg: "#EEF2FF", border: "#C7D2FE", text: "#3730A3" },
  photo:            { emoji: "📸", label: "Photo",           bg: "#FFF7ED", border: "#FED7AA", text: "#9A3412" },
  video:            { emoji: "🎬", label: "Video",           bg: "#FEF3C7", border: "#FDE68A", text: "#78350F" },
  artwork:          { emoji: "🎨", label: "Artwork",         bg: "#FDF4FF", border: "#E9D5FF", text: "#6B21A8" },
  milestone:        { emoji: "⭐", label: "Milestone",       bg: "#FFFBEB", border: "#FDE68A", text: "#92400E" },
  achievement:      { emoji: "🏆", label: "Achievement",     bg: "#FFFBEB", border: "#FDE68A", text: "#92400E" },
  "event-highlight":{ emoji: "🎉", label: "Special Moment",  bg: "#F0FDF4", border: "#BBF7D0", text: "#14532D" },
};

const DOMAIN_LABELS = {
  social: "Social", emotional: "Emotional", communication: "Communication",
  creativity: "Creativity", leadership: "Leadership", confidence: "Confidence",
  fine_motor: "Fine Motor", gross_motor: "Gross Motor",
};

const ARTWORK_LABELS = {
  drawing: "Drawing", worksheet: "Worksheet", craft: "Craft",
  project: "Project", coloring: "Coloring",
};

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function avatarGradient(name = "") {
  const palettes = [
    ["#92400E","#78350F"],["#059669","#065F46"],["#4338CA","#3730A3"],
    ["#0891B2","#0E7490"],["#DC2626","#991B1B"],["#7C3AED","#6D28D9"],
  ];
  return palettes[name.charCodeAt(0) % palettes.length] || palettes[0];
}

// ── EntryCard ─────────────────────────────────────────────────────────────────
function EntryCard({ entry, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const k = KIND_META[entry.kind] || KIND_META.observation;
  const stars = entry.level ? "⭐".repeat(entry.level) : null;
  const [g1, g2] = avatarGradient(entry.studentName);

  return (
    <div style={{
      background: "#fff", border: "1px solid rgba(139,125,101,.10)", borderRadius: 14,
      padding: "16px 18px", boxShadow: "0 1px 4px rgba(31,26,23,.05)",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      {/* Student row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: `linear-gradient(135deg,${g1},${g2})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 800, fontSize: 14, flexShrink: 0,
        }}>
          {(entry.studentName || "?")[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: W.charcoal1 }}>
            {entry.studentName || "Student"}
          </div>
          <div style={{ fontSize: 12, color: W.muted1, marginTop: 1 }}>
            {fmtDate(entry.date)} · {entry.academicYear}
          </div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
          background: k.bg, border: `1px solid ${k.border}`, color: k.text,
          whiteSpace: "nowrap", flexShrink: 0,
        }}>
          {k.emoji} {k.label}
        </span>
      </div>

      {/* Content */}
      {entry.kind === "observation" && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#4338CA", marginBottom: 4 }}>
            {DOMAIN_LABELS[entry.domain] || entry.domain}
            {stars && <span style={{ marginLeft: 6 }}>{stars}</span>}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: W.charcoal2, lineHeight: 1.55 }}>
            {entry.observationText}
          </p>
        </div>
      )}
      {entry.kind === "milestone" && entry.milestoneTitle && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>⭐</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#78350F" }}>{entry.milestoneTitle}</div>
            {entry.autoDetected && <div style={{ fontSize: 11, color: "#B45309", marginTop: 1 }}>Auto-detected</div>}
          </div>
        </div>
      )}
      {(entry.kind === "photo" || entry.kind === "video" || entry.kind === "artwork") && entry.mediaUrl && (
        <div style={{ borderRadius: 10, overflow: "hidden", maxHeight: 180 }}>
          {entry.kind === "video"
            ? <video src={entry.mediaUrl} style={{ width: "100%", maxHeight: 180, objectFit: "cover" }} controls />
            : <img src={entry.thumbnailUrl || entry.mediaUrl} alt="" style={{ width: "100%", maxHeight: 180, objectFit: "cover" }} />}
        </div>
      )}
      {entry.kind === "artwork" && (entry.artworkTitle || entry.artworkCategory) && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {entry.artworkCategory && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "#6B21A8", background: "#F3E8FF", padding: "2px 9px", borderRadius: 10 }}>
              {ARTWORK_LABELS[entry.artworkCategory] || entry.artworkCategory}
            </span>
          )}
          {entry.artworkTitle && <span style={{ fontSize: 12, fontWeight: 600, color: W.charcoal2 }}>{entry.artworkTitle}</span>}
        </div>
      )}
      {entry.caption && <p style={{ margin: 0, fontSize: 13, color: W.charcoal2, lineHeight: 1.5 }}>{entry.caption}</p>}

      {/* Delete footer */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, paddingTop: 2 }}>
        {confirming ? (
          <>
            <button
              onClick={() => setConfirming(false)}
              style={{ fontSize: 12, padding: "4px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", cursor: "pointer", color: "#374151", fontFamily: "inherit" }}>
              Cancel
            </button>
            <button
              onClick={() => onDelete(entry.id)}
              style={{ fontSize: 12, padding: "4px 12px", borderRadius: 8, border: "none", background: "#fee2e2", color: "#991b1b", cursor: "pointer", fontWeight: 700, fontFamily: "inherit" }}>
              Delete
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            style={{ fontSize: 12, padding: "4px 12px", borderRadius: 8, border: "1px solid #fecaca", background: "#fff5f5", color: "#dc2626", cursor: "pointer", fontFamily: "inherit" }}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ChildJourney() {
  const navigate = useNavigate();

  const [allEntries,    setAllEntries]    = useState([]);
  const [students,      setStudents]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [filterStudent, setFilterStudent] = useState("");
  const [filterYear,    setFilterYear]    = useState(currentAcademicYear());
  const [category,      setCategory]      = useState("all");

  useEffect(() => {
    api.get("/api/students").then(r => setStudents(r.data?.students || [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { entries: list } = await getEntries({
        studentId:    filterStudent || undefined,
        academicYear: filterYear    || undefined,
        limit:        500,
      });
      setAllEntries(list || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [filterStudent, filterYear]);

  useEffect(() => { load(); }, [load]);

  // ── Stats from all loaded entries ─────────────────────────────────────────
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
  const entries = useMemo(() => {
    const kinds = CATEGORY_KINDS[category];
    return kinds ? allEntries.filter(e => kinds.includes(e.kind)) : allEntries;
  }, [allEntries, category]);

  async function handleDelete(id) {
    try {
      await deleteEntry(id);
      setAllEntries(prev => prev.filter(e => e.id !== id));
    } catch (e) {
      alert(e.response?.data?.error || "Could not delete entry.");
    }
  }

  const INPUT = {
    fontSize: 13, padding: "8px 12px", borderRadius: 10,
    border: "1px solid rgba(139,125,101,.18)", background: "#fff",
    color: W.charcoal1, fontWeight: 500, outline: "none", fontFamily: "inherit",
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: `linear-gradient(150deg,${W.bg1},${W.bg2} 50%,${W.bg3})` }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800;900&display=swap');
        .cj-page, .cj-page * { font-family: 'Inter Tight', system-ui, sans-serif; box-sizing: border-box; }
        .cj-action { background: linear-gradient(135deg,#F6D54A,#F1C933); color: #4A3A22; border: none; font-weight: 700; cursor: pointer; transition: box-shadow 80ms, transform 80ms; }
        .cj-action:hover { box-shadow: 0 2px 10px rgba(241,201,51,.38); }
        .cj-action:active { transform: scale(0.97); }
        .cj-tab { cursor: pointer; white-space: nowrap; transition: background 80ms, border-color 80ms; font-family: inherit; }
        .cj-tab:hover { opacity: .85; }
        select:focus, input:focus { outline: 2px solid #F6D54A !important; }
      `}</style>

      <Sidebar />

      <div className="cj-page" style={{ flex: 1, padding: "32px 28px", maxWidth: 1000, margin: "0 auto" }}>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: W.charcoal1, letterSpacing: -0.5 }}>
              📖 Child Journey
            </h1>
            <p style={{ margin: "5px 0 0", fontSize: 14, color: W.muted1 }}>
              Record memories, observations, artwork, and milestones.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="cj-action" onClick={() => navigate("/child-journey/observe")}
              style={{ padding: "9px 16px", borderRadius: 12, fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}>
              📝 Observation
            </button>
            <button className="cj-action" onClick={() => navigate("/child-journey/artwork")}
              style={{ padding: "9px 16px", borderRadius: 12, fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}>
              🎨 Artwork
            </button>
            <button className="cj-action" onClick={() => navigate("/child-journey/milestone")}
              style={{ padding: "9px 16px", borderRadius: 12, fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}>
              ⭐ Milestone
            </button>
          </div>
        </div>

        {/* ── Stat cards (4 cards) ──────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 22 }}>
          {STAT_DEFS.map(s => (
            <button
              key={s.key}
              className="cj-tab"
              onClick={() => setCategory(c => c === s.key ? "all" : s.key)}
              style={{
                padding: "14px 16px", borderRadius: 14, textAlign: "left",
                background: category === s.key ? s.bg : "#fff",
                border: `1.5px solid ${category === s.key ? s.border : "rgba(139,125,101,.14)"}`,
                boxShadow: category === s.key ? `0 2px 8px ${s.border}60` : "0 1px 3px rgba(0,0,0,.04)",
              }}>
              <div style={{ fontSize: 11, color: category === s.key ? s.text : W.muted1, marginBottom: 4 }}>
                {s.icon} {s.label}
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: category === s.key ? s.text : W.charcoal1, lineHeight: 1 }}>
                {loading ? "—" : stats[s.key]}
              </div>
            </button>
          ))}
        </div>

        {/* ── Filter row ─────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
          {/* Category tabs */}
          <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" }}>
            {CATEGORIES.map(c => {
              const active = category === c.key;
              return (
                <button
                  key={c.key}
                  className="cj-tab"
                  onClick={() => setCategory(c.key)}
                  style={{
                    fontSize: 13, padding: "7px 14px", borderRadius: 20,
                    border: `1.5px solid ${active ? W.gold1 : "rgba(139,125,101,.18)"}`,
                    background: active ? W.goldPale : "#fff",
                    color: active ? W.charcoal1 : W.muted1,
                    fontWeight: active ? 700 : 500,
                  }}>
                  {c.emoji ? `${c.emoji} ${c.label}` : c.label}
                </button>
              );
            })}
          </div>

          {/* Student + year selects */}
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <select value={filterStudent} onChange={e => setFilterStudent(e.target.value)} style={{ ...INPUT, minWidth: 150 }}>
              <option value="">All Students</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.name || `${s.firstName || ""} ${s.lastName || ""}`}</option>
              ))}
            </select>
            <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={{ ...INPUT, minWidth: 110 }}>
              {["2024-25","2025-26","2026-27","2027-28"].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Content ────────────────────────────────────────────────────── */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: W.muted1, fontSize: 14 }}>
            Loading journey entries…
          </div>
        ) : error ? (
          <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 12, padding: 16, color: "#991b1b", fontSize: 14 }}>
            {error}
          </div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "56px 24px", background: W.goldPale, border: `1px solid ${W.goldBorder}`, borderRadius: 16 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📖</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: W.charcoal1, marginBottom: 6 }}>
              {category === "all" ? "No journey entries yet" : `No ${CATEGORIES.find(c => c.key === category)?.label?.toLowerCase()} yet`}
            </div>
            <div style={{ fontSize: 14, color: W.muted1, marginBottom: 20 }}>
              {category === "all"
                ? "Start building each child's story with observations, artwork, and milestones."
                : "Entries will appear here once you add them."}
            </div>
            {category === "all" && (
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                <button className="cj-action" onClick={() => navigate("/child-journey/observe")} style={{ padding: "9px 18px", borderRadius: 12, fontSize: 13 }}>📝 Observation</button>
                <button className="cj-action" onClick={() => navigate("/child-journey/artwork")} style={{ padding: "9px 18px", borderRadius: 12, fontSize: 13 }}>🎨 Artwork</button>
                <button className="cj-action" onClick={() => navigate("/child-journey/milestone")} style={{ padding: "9px 18px", borderRadius: 12, fontSize: 13 }}>⭐ Milestone</button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: W.muted1, marginBottom: 12 }}>
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
              {category !== "all" && ` · ${CATEGORIES.find(c => c.key === category)?.label}`}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
              {entries.map(e => (
                <EntryCard key={e.id} entry={e} onDelete={handleDelete} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
