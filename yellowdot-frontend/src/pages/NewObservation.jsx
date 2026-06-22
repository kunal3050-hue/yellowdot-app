// ─────────────────────────────────────────────────────────────────────────────
// NewObservation — Record a teacher observation for a child
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { createEntry } from "../services/journeyService";
import { api } from "../services/authService";

// ── Palette ───────────────────────────────────────────────────────────────────
const W = {
  bg1: "#FFFDF7", bg2: "#FFFBF0", bg3: "#FFF8E8",
  charcoal1: "#4A3A22", charcoal2: "#6A5737",
  gold1: "#F6D54A", gold2: "#F1C933",
  goldPale: "#FFF7D6", goldBorder: "#EFD978",
  muted1: "#8B7355",
};

// ── 8 developmental domains ──────────────────────────────────────────────────
const DOMAINS = [
  { id: "social",        label: "Social",        emoji: "🤝", bg: "#F0FDF4", border: "#BBF7D0", text: "#14532D" },
  { id: "emotional",     label: "Emotional",     emoji: "💛", bg: "#FFFBEB", border: "#FDE68A", text: "#92400E" },
  { id: "communication", label: "Communication", emoji: "💬", bg: "#EFF6FF", border: "#BFDBFE", text: "#1E3A8A" },
  { id: "creativity",    label: "Creativity",    emoji: "🎨", bg: "#FDF4FF", border: "#E9D5FF", text: "#6B21A8" },
  { id: "leadership",    label: "Leadership",    emoji: "🌟", bg: "#FFFBEB", border: "#FDE68A", text: "#78350F" },
  { id: "confidence",    label: "Confidence",    emoji: "💪", bg: "#FFF7ED", border: "#FED7AA", text: "#9A3412" },
  { id: "fine_motor",    label: "Fine Motor",    emoji: "✋", bg: "#F0FDF4", border: "#BBF7D0", text: "#065F46" },
  { id: "gross_motor",   label: "Gross Motor",   emoji: "🏃", bg: "#EEF2FF", border: "#C7D2FE", text: "#3730A3" },
];

function todayISO() { return new Date().toISOString().split("T")[0]; }

const VISIBILITY_OPTIONS = [
  { value: "all_parents",     label: "Visible to parents" },
  { value: "staff_only",      label: "Staff only (private)" },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function NewObservation() {
  const navigate      = useNavigate();
  const [params]      = useSearchParams();

  const [students,    setStudents]    = useState([]);
  const [studentId,   setStudentId]   = useState(params.get("studentId") || "");
  const [domain,      setDomain]      = useState("");
  const [level,       setLevel]       = useState(0);
  const [hoverLevel,  setHoverLevel]  = useState(0);
  const [text,        setText]        = useState("");
  const [date,        setDate]        = useState(todayISO());
  const [visibility,  setVisibility]  = useState("all_parents");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState(null);

  useEffect(() => {
    api.get("/api/students")
      .then(r => setStudents(r.data?.students || []))
      .catch(() => {});
  }, []);

  const selectedStudent = students.find(s => s.id === studentId);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!studentId)    return setError("Please select a student.");
    if (!domain)       return setError("Please choose a developmental domain.");
    if (!level)        return setError("Please set a level (1–5 stars).");
    if (!text.trim())  return setError("Please write what you observed.");

    setSaving(true);
    setError(null);
    try {
      await createEntry({
        studentId,
        studentName: selectedStudent
          ? (selectedStudent.name || `${selectedStudent.firstName || ""} ${selectedStudent.lastName || ""}`.trim())
          : "",
        kind:            "observation",
        sourceModule:    "observation",
        domain,
        level,
        observationText: text.trim(),
        date,
        visibility,
      });
      navigate("/child-journey");
    } catch (e) {
      setError(e.response?.data?.error || e.message);
      setSaving(false);
    }
  }

  const selectedDomain = DOMAINS.find(d => d.id === domain);

  const INPUT = {
    fontSize: 14, padding: "10px 14px", borderRadius: 10,
    border: "1.5px solid rgba(139,125,101,.18)", background: "#fff",
    color: W.charcoal1, fontWeight: 500, outline: "none",
    fontFamily: "inherit", width: "100%",
  };

  const LABEL = {
    fontSize: 13, fontWeight: 700, color: W.charcoal2, marginBottom: 6, display: "block",
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: `linear-gradient(150deg,${W.bg1},${W.bg2} 50%,${W.bg3})` }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800;900&display=swap');
        .no-page, .no-page * { font-family: 'Inter Tight', system-ui, sans-serif; box-sizing: border-box; }
        .no-save-btn { background: linear-gradient(135deg,#F6D54A,#F1C933); color: #4A3A22; border: none; font-weight: 800; cursor: pointer; transition: box-shadow 80ms; }
        .no-save-btn:hover { box-shadow: 0 2px 12px rgba(241,201,51,.4); }
        .no-save-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .no-domain-btn { cursor: pointer; transition: box-shadow 80ms, transform 80ms; border-radius: 12px; }
        .no-domain-btn:hover { box-shadow: 0 2px 8px rgba(0,0,0,.10); transform: scale(1.02); }
        .no-star { cursor: pointer; transition: transform 80ms; font-size: 28px; line-height: 1; }
        .no-star:hover { transform: scale(1.15); }
        textarea:focus, select:focus, input:focus { outline: 2px solid #F6D54A !important; }
      `}</style>

      <Sidebar />

      <div className="no-page" style={{ flex: 1, padding: "32px 28px", maxWidth: 680, margin: "0 auto" }}>
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <button
            onClick={() => navigate("/child-journey")}
            style={{ background: "none", border: "none", cursor: "pointer", color: W.muted1, fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 12, display: "flex", alignItems: "center", gap: 4 }}>
            ← Back to Child Journey
          </button>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: W.charcoal1, letterSpacing: -0.5 }}>
            👩‍🏫 New Observation
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: W.muted1 }}>
            Document what you observed in the child's development today.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {/* ── Student ──────────────────────────────────────────────────── */}
          <div>
            <label style={LABEL}>Student *</label>
            <select value={studentId} onChange={e => setStudentId(e.target.value)} style={INPUT} required>
              <option value="">Select a student…</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name || `${s.firstName || ""} ${s.lastName || ""}`.trim() || s.id}
                </option>
              ))}
            </select>
          </div>

          {/* ── Date ─────────────────────────────────────────────────────── */}
          <div>
            <label style={LABEL}>Date *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...INPUT, maxWidth: 200 }} required />
          </div>

          {/* ── Developmental domain ──────────────────────────────────────── */}
          <div>
            <label style={LABEL}>Developmental Domain *</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {DOMAINS.map(d => {
                const selected = domain === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    className="no-domain-btn"
                    onClick={() => setDomain(d.id)}
                    style={{
                      padding: "12px 8px",
                      background: selected ? d.bg : "#fff",
                      border: `2px solid ${selected ? d.border : "rgba(139,125,101,.14)"}`,
                      color: selected ? d.text : W.charcoal2,
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                      boxShadow: selected ? `0 2px 8px ${d.border}88` : "none",
                    }}>
                    <span style={{ fontSize: 22 }}>{d.emoji}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, textAlign: "center", lineHeight: 1.2 }}>{d.label}</span>
                  </button>
                );
              })}
            </div>
            {selectedDomain && (
              <div style={{ marginTop: 8, fontSize: 12, color: selectedDomain.text, fontWeight: 600 }}>
                ✓ {selectedDomain.label} selected
              </div>
            )}
          </div>

          {/* ── Level ────────────────────────────────────────────────────── */}
          <div>
            <label style={LABEL}>Proficiency Level *</label>
            <p style={{ margin: "0 0 10px", fontSize: 12, color: W.muted1 }}>
              1 = Emerging · 3 = Developing · 5 = Excelling
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {[1,2,3,4,5].map(n => (
                <span
                  key={n}
                  className="no-star"
                  onMouseEnter={() => setHoverLevel(n)}
                  onMouseLeave={() => setHoverLevel(0)}
                  onClick={() => setLevel(n)}
                  style={{ opacity: n <= (hoverLevel || level) ? 1 : 0.25 }}>
                  ⭐
                </span>
              ))}
              {level > 0 && (
                <span style={{ fontSize: 13, fontWeight: 700, color: "#92400E", marginLeft: 8 }}>
                  Level {level}
                </span>
              )}
            </div>
          </div>

          {/* ── Observation text ──────────────────────────────────────────── */}
          <div>
            <label style={LABEL}>What did you observe? *</label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={5}
              placeholder={'Write in first person, e.g. "Aarav confidently introduced himself to new friends during morning circle. He initiated play and showed empathy when a classmate was upset."'}
              style={{ ...INPUT, resize: "vertical", lineHeight: 1.6 }}
              required
            />
            <div style={{ fontSize: 11, color: W.muted1, textAlign: "right", marginTop: 4 }}>
              {text.length} characters
            </div>
          </div>

          {/* ── Visibility ───────────────────────────────────────────────── */}
          <div>
            <label style={LABEL}>Visibility</label>
            <div style={{ display: "flex", gap: 10 }}>
              {VISIBILITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setVisibility(opt.value)}
                  style={{
                    fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 10, cursor: "pointer",
                    border: `2px solid ${visibility === opt.value ? W.gold1 : "rgba(139,125,101,.16)"}`,
                    background: visibility === opt.value ? W.goldPale : "#fff",
                    color: visibility === opt.value ? W.charcoal1 : W.muted1,
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Error ────────────────────────────────────────────────────── */}
          {error && (
            <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", color: "#991b1b", fontSize: 13, fontWeight: 600 }}>
              {error}
            </div>
          )}

          {/* ── Actions ──────────────────────────────────────────────────── */}
          <div style={{ display: "flex", gap: 12, paddingTop: 4 }}>
            <button
              type="button"
              onClick={() => navigate("/child-journey")}
              style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "1.5px solid rgba(139,125,101,.18)", background: "#fff", color: W.charcoal2, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
              Cancel
            </button>
            <button
              type="submit"
              className="no-save-btn"
              disabled={saving}
              style={{ flex: 2, padding: "12px 0", borderRadius: 12, fontSize: 14, fontFamily: "inherit" }}>
              {saving ? "Saving…" : "Save Observation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
