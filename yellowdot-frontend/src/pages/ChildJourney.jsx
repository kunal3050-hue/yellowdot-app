// ─────────────────────────────────────────────────────────────────────────────
// Child Journey — Staff dashboard for reviewing and adding journey entries
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { getEntries, deleteEntry } from "../services/journeyService";
import { api } from "../services/authService";
import { currentAcademicYear } from "../utils/academicYear";

// ── Palette (Yellow Dot warm gold theme) ─────────────────────────────────────
const W = {
  bg1: "#FFFDF7", bg2: "#FFFBF0", bg3: "#FFF8E8",
  charcoal1: "#4A3A22", charcoal2: "#6A5737",
  gold1: "#F6D54A", gold2: "#F1C933",
  goldPale: "#FFF7D6", goldBorder: "#EFD978",
  muted1: "#8B7355", muted2: "#6A5737",
};

// ── Kind config ───────────────────────────────────────────────────────────────
const KIND = {
  observation:      { emoji: "👩‍🏫", label: "Observation",     bg: "#EEF2FF", border: "#C7D2FE", text: "#3730A3" },
  photo:            { emoji: "📸",   label: "Photo",           bg: "#FFF7ED", border: "#FED7AA", text: "#9A3412" },
  video:            { emoji: "🎬",   label: "Video",           bg: "#FEF3C7", border: "#FDE68A", text: "#78350F" },
  artwork:          { emoji: "🎨",   label: "Artwork",         bg: "#FDF4FF", border: "#E9D5FF", text: "#6B21A8" },
  milestone:        { emoji: "⭐",   label: "Milestone",       bg: "#FFFBEB", border: "#FDE68A", text: "#92400E" },
  achievement:      { emoji: "🏆",   label: "Achievement",     bg: "#FFFBEB", border: "#FDE68A", text: "#92400E" },
  "event-highlight":{ emoji: "🎉",   label: "Event Highlight", bg: "#F0FDF4", border: "#BBF7D0", text: "#14532D" },
};

const DOMAIN_LABELS = {
  social:        "Social Development",  emotional:     "Emotional Development",
  communication: "Communication",       creativity:    "Creativity",
  leadership:    "Leadership",          confidence:    "Confidence",
  fine_motor:    "Fine Motor Skills",   gross_motor:   "Gross Motor Skills",
};

function todayISO() { return new Date().toISOString().split("T")[0]; }

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function avatarGradient(name = "") {
  const idx = name.charCodeAt(0) % 6;
  const palettes = [
    ["#92400E","#78350F"],["#059669","#065F46"],["#4338CA","#3730A3"],
    ["#0891B2","#0E7490"],["#DC2626","#991B1B"],["#7C3AED","#6D28D9"],
  ];
  return palettes[idx];
}

// ── EntryCard ─────────────────────────────────────────────────────────────────
function EntryCard({ entry, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const k = KIND[entry.kind] || KIND.observation;
  const stars = entry.level ? "⭐".repeat(entry.level) : null;
  const [g1, g2] = avatarGradient(entry.studentName);

  return (
    <div style={{
      background: "#fff",
      border: "1px solid rgba(139,125,101,.10)",
      borderRadius: 14,
      padding: "16px 18px",
      boxShadow: "0 1px 4px rgba(31,26,23,.05)",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>
      {/* header */}
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
          <div style={{ fontWeight: 700, fontSize: 14, color: W.charcoal1, lineHeight: 1.2 }}>
            {entry.studentName || "Student"}
          </div>
          <div style={{ fontSize: 12, color: W.muted1, marginTop: 2 }}>
            {fmtDate(entry.date)} · {entry.academicYear}
          </div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
          background: k.bg, border: `1px solid ${k.border}`, color: k.text,
          letterSpacing: 0.3,
        }}>
          {k.emoji} {k.label}
        </span>
      </div>

      {/* content */}
      {entry.kind === "observation" && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#4338CA", marginBottom: 4 }}>
            {DOMAIN_LABELS[entry.domain] || entry.domain}{stars && <span style={{ marginLeft: 6 }}>{stars}</span>}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: W.charcoal2, lineHeight: 1.55 }}>
            {entry.observationText}
          </p>
        </div>
      )}
      {(entry.kind === "photo" || entry.kind === "video" || entry.kind === "artwork") && entry.mediaUrl && (
        <div style={{ borderRadius: 10, overflow: "hidden", maxHeight: 160 }}>
          {entry.kind === "video"
            ? <video src={entry.mediaUrl} style={{ width: "100%", objectFit: "cover", maxHeight: 160 }} controls />
            : <img src={entry.thumbnailUrl || entry.mediaUrl} alt="" style={{ width: "100%", objectFit: "cover", maxHeight: 160 }} />}
        </div>
      )}
      {entry.caption && <p style={{ margin: 0, fontSize: 13, color: W.charcoal2, lineHeight: 1.5 }}>{entry.caption}</p>}
      {entry.artworkTitle && entry.kind === "artwork" && (
        <div style={{ fontSize: 12, fontWeight: 700, color: "#6B21A8" }}>{entry.artworkTitle}</div>
      )}

      {/* footer */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, paddingTop: 4 }}>
        {confirming ? (
          <>
            <button
              onClick={() => setConfirming(false)}
              style={{ fontSize: 12, padding: "4px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", cursor: "pointer", color: "#374151", fontWeight: 600 }}>
              Cancel
            </button>
            <button
              onClick={() => onDelete(entry.id)}
              style={{ fontSize: 12, padding: "4px 12px", borderRadius: 8, border: "none", background: "#fee2e2", color: "#991b1b", cursor: "pointer", fontWeight: 700 }}>
              Delete
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            style={{ fontSize: 12, padding: "4px 12px", borderRadius: 8, border: "1px solid #fecaca", background: "#fff5f5", color: "#dc2626", cursor: "pointer", fontWeight: 600 }}>
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

  const [entries,     setEntries]     = useState([]);
  const [students,    setStudents]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  const [filterStudent,   setFilterStudent]   = useState("");
  const [filterKind,      setFilterKind]       = useState("");
  const [filterYear,      setFilterYear]       = useState(currentAcademicYear());

  // Load students for filter dropdown
  useEffect(() => {
    api.get("/api/students").then(r => setStudents(r.data?.students || [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { entries: list } = await getEntries({
        studentId:    filterStudent || undefined,
        kind:         filterKind    || undefined,
        academicYear: filterYear    || undefined,
      });
      setEntries(list || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [filterStudent, filterKind, filterYear]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id) {
    try {
      await deleteEntry(id);
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch (e) {
      alert(e.response?.data?.error || "Could not delete entry.");
    }
  }

  // Stat counts
  const counts = entries.reduce((acc, e) => {
    acc[e.kind] = (acc[e.kind] || 0) + 1;
    return acc;
  }, {});

  const INPUT = {
    fontSize: 13, padding: "8px 12px", borderRadius: 10,
    border: "1px solid rgba(139,125,101,.18)", background: "#fff",
    color: W.charcoal1, fontWeight: 500, outline: "none",
    fontFamily: "inherit",
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: `linear-gradient(150deg,${W.bg1},${W.bg2} 50%,${W.bg3})` }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800;900&display=swap');
        .cj-page, .cj-page * { font-family: 'Inter Tight', system-ui, -apple-system, sans-serif; box-sizing: border-box; }
        .cj-add-btn { background: linear-gradient(135deg,#F6D54A,#F1C933); color: #4A3A22; border: none; font-weight: 700; cursor: pointer; transition: box-shadow 80ms; }
        .cj-add-btn:hover { box-shadow: 0 2px 10px rgba(241,201,51,.38); }
        .cj-add-btn:active { transform: scale(0.97); }
        .cj-filter select:focus { outline: 2px solid #F6D54A; }
      `}</style>

      <Sidebar />

      <div className="cj-page" style={{ flex: 1, padding: "32px 28px", maxWidth: 960, margin: "0 auto" }}>
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: W.charcoal1, letterSpacing: -0.5 }}>
              📖 Child Journey
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: W.muted1 }}>
              Record observations and document each child's developmental story.
            </p>
          </div>
          <button
            className="cj-add-btn"
            onClick={() => navigate("/child-journey/observe")}
            style={{ padding: "10px 20px", borderRadius: 12, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            + New Observation
          </button>
        </div>

        {/* ── Quick stats ──────────────────────────────────────────────────── */}
        {!loading && entries.length > 0 && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
            {Object.entries(counts).map(([kind, n]) => {
              const k = KIND[kind] || KIND.observation;
              return (
                <div key={kind} style={{
                  background: k.bg, border: `1px solid ${k.border}`,
                  borderRadius: 10, padding: "6px 14px",
                  fontSize: 13, fontWeight: 700, color: k.text,
                  display: "flex", alignItems: "center", gap: 5,
                }}>
                  {k.emoji} {n} {k.label}{n !== 1 ? "s" : ""}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Filters ──────────────────────────────────────────────────────── */}
        <div className="cj-filter" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
          <select value={filterStudent} onChange={e => setFilterStudent(e.target.value)} style={{ ...INPUT, minWidth: 160 }}>
            <option value="">All Students</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.name || `${s.firstName} ${s.lastName}`}</option>
            ))}
          </select>

          <select value={filterKind} onChange={e => setFilterKind(e.target.value)} style={{ ...INPUT, minWidth: 150 }}>
            <option value="">All Types</option>
            {Object.entries(KIND).map(([k, v]) => (
              <option key={k} value={k}>{v.emoji} {v.label}</option>
            ))}
          </select>

          <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={{ ...INPUT, minWidth: 120 }}>
            {["2024-25","2025-26","2026-27","2027-28"].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* ── Content ──────────────────────────────────────────────────────── */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: W.muted1, fontSize: 14 }}>
            Loading journey entries…
          </div>
        ) : error ? (
          <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 12, padding: 16, color: "#991b1b", fontSize: 14 }}>
            {error}
          </div>
        ) : entries.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "60px 24px",
            background: W.goldPale, border: `1px solid ${W.goldBorder}`,
            borderRadius: 16,
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📖</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: W.charcoal1, marginBottom: 6 }}>
              No journey entries yet
            </div>
            <div style={{ fontSize: 14, color: W.muted1, marginBottom: 20 }}>
              Start recording observations to build each child's developmental story.
            </div>
            <button
              className="cj-add-btn"
              onClick={() => navigate("/child-journey/observe")}
              style={{ padding: "10px 24px", borderRadius: 12, fontSize: 14 }}>
              + Add First Observation
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
            {entries.map(e => (
              <EntryCard key={e.id} entry={e} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
