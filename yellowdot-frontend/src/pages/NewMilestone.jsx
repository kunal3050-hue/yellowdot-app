// ─────────────────────────────────────────────────────────────────────────────
// NewMilestone — Record a teacher-created milestone for a child
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../services/authService";

const W = {
  bg1: "var(--yd-bg)", bg2: "var(--yd-bg)", bg3: "var(--yd-bg)",
  charcoal1: "var(--yd-charcoal)", charcoal2: "var(--yd-text-soft)",
  gold1: "var(--yd-yellow)", gold2: "var(--yd-yellow-dark)",
  goldPale: "var(--yd-yellow-light)", goldBorder: "var(--yd-yellow)",
  muted1: "var(--yd-text-muted)",
};

const PRESETS = [
  { id: "first_friend",       label: "First Friend",       emoji: "🤝", desc: "Made their first friend at school" },
  { id: "first_performance",  label: "First Performance",  emoji: "🎭", desc: "Participated in a school performance" },
  { id: "reading_first_word", label: "Reading First Word", emoji: "📚", desc: "Read their first word independently" },
  { id: "writing_name",       label: "Writing My Name",    emoji: "✏️",  desc: "Wrote their name for the first time" },
  { id: "custom",             label: "Custom Milestone",   emoji: "⭐", desc: "Record your own milestone" },
];

const VISIBILITY_OPTIONS = [
  { value: "all_parents", label: "Visible to parents" },
  { value: "staff_only",  label: "Staff only (private)" },
];

function todayISO() { return new Date().toISOString().split("T")[0]; }

export default function NewMilestone() {
  const navigate    = useNavigate();
  const [params]    = useSearchParams();

  const [students,     setStudents]     = useState([]);
  const [studentId,    setStudentId]    = useState(params.get("studentId") || "");
  const [preset,       setPreset]       = useState(null);
  const [customTitle,  setCustomTitle]  = useState("");
  const [note,         setNote]         = useState("");
  const [date,         setDate]         = useState(todayISO());
  const [visibility,   setVisibility]   = useState("all_parents");
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState(null);

  useEffect(() => {
    api.get("/api/students")
      .then(r => setStudents(r.data?.students || []))
      .catch(() => {});
  }, []);

  const selectedStudent = students.find(s => s.id === studentId);
  const isCustom = preset?.id === "custom";

  const milestoneTitle = isCustom
    ? customTitle.trim()
    : preset ? `${preset.emoji} ${preset.label}` : "";

  async function handleSubmit(e) {
    e.preventDefault();
    if (!studentId)      return setError("Please select a student.");
    if (!preset)         return setError("Please choose a milestone type.");
    if (!milestoneTitle) return setError("Please enter a milestone title.");

    setSaving(true);
    setError(null);
    try {
      const studentName = selectedStudent
        ? (selectedStudent.name || `${selectedStudent.firstName || ""} ${selectedStudent.lastName || ""}`.trim())
        : "";

      await api.post("/api/milestones", {
        studentId,
        studentName,
        milestoneId:       preset.id,
        milestoneTitle,
        milestoneCategory: preset.id === "custom" ? "general" : preset.id.replace(/_/g, "-"),
        momentNote:        note.trim(),
        date,
        visibility,
      });
      navigate("/child-journey");
    } catch (e) {
      setError(e.response?.data?.error || e.message);
      setSaving(false);
    }
  }

  const INPUT = {
    fontSize: 14, padding: "10px 14px", borderRadius: 10,
    border: "1.5px solid rgba(139,125,101,.18)", background: "#fff",
    color: W.charcoal1, fontWeight: 500, outline: "none",
    fontFamily: "inherit", width: "100%",
  };
  const LABEL = { fontSize: 13, fontWeight: 700, color: W.charcoal2, marginBottom: 6, display: "block" };

  // MainLayout supplies the sidebar, topbar and scroll area; this page used to
  // render its own and sit outside the app shell entirely.
  return (
    <div>
      <style>{`
        .nm-page, .nm-page * { box-sizing: border-box; }
        .nm-btn { background: linear-gradient(135deg,var(--yd-yellow),var(--yd-yellow-dark)); color: var(--yd-black); border: none; font-weight: 800; cursor: pointer; transition: box-shadow 80ms; }
        .nm-btn:hover { box-shadow: 0 2px 12px rgba(244,196,0,.4); }
        .nm-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .nm-preset { cursor: pointer; transition: box-shadow 80ms, transform 80ms; }
        .nm-preset:hover { box-shadow: 0 2px 8px rgba(0,0,0,.10); transform: translateY(-1px); }
        textarea:focus, select:focus, input:focus { outline: 2px solid var(--yd-yellow) !important; }
      `}</style>


      <div className="nm-page" style={{ padding: "32px 28px", maxWidth: 680, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <button
            onClick={() => navigate("/child-journey")}
            style={{ background: "none", border: "none", cursor: "pointer", color: W.muted1, fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 12, display: "flex", alignItems: "center", gap: 4 }}>
            ← Back to Child Journey
          </button>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: W.charcoal1, letterSpacing: -0.5 }}>
            ⭐ Record Milestone
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: W.muted1 }}>
            Celebrate and document a child's special achievement.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {/* Student */}
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

          {/* Date */}
          <div>
            <label style={LABEL}>Date *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...INPUT, maxWidth: 200 }} required />
          </div>

          {/* Milestone type */}
          <div>
            <label style={LABEL}>Milestone Type *</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {PRESETS.map(p => {
                const sel = preset?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="nm-preset"
                    onClick={() => { setPreset(p); if (p.id !== "custom") setCustomTitle(""); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "14px 16px", borderRadius: 12, textAlign: "left",
                      background: sel ? W.goldPale : "#fff",
                      border: `2px solid ${sel ? W.gold1 : "rgba(139,125,101,.14)"}`,
                      boxShadow: sel ? `0 2px 10px rgba(244,196,0,.3)` : "none",
                    }}>
                    <span style={{ fontSize: 28, flexShrink: 0, lineHeight: 1 }}>{p.emoji}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: W.charcoal1 }}>{p.label}</div>
                      <div style={{ fontSize: 12, color: W.muted1, marginTop: 2 }}>{p.desc}</div>
                    </div>
                    {sel && <span style={{ marginLeft: "auto", fontSize: 18 }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom title (shown only for custom preset) */}
          {isCustom && (
            <div>
              <label style={LABEL}>Milestone Title *</label>
              <input
                type="text"
                value={customTitle}
                onChange={e => setCustomTitle(e.target.value)}
                placeholder={'e.g. "Climbed the big slide!"'}
                style={INPUT}
                maxLength={100}
              />
            </div>
          )}

          {/* Note */}
          <div>
            <label style={LABEL}>Note <span style={{ fontWeight: 400, color: W.muted1 }}>(optional)</span></label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="Add a personal message or description for the parent…"
              style={{ ...INPUT, resize: "vertical", lineHeight: 1.6 }}
              maxLength={500}
            />
          </div>

          {/* Visibility */}
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

          {error && (
            <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", color: "#991b1b", fontSize: 13, fontWeight: 600 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 12, paddingTop: 4 }}>
            <button
              type="button"
              onClick={() => navigate("/child-journey")}
              style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "1.5px solid rgba(139,125,101,.18)", background: "#fff", color: W.charcoal2, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
              Cancel
            </button>
            <button
              type="submit"
              className="nm-btn"
              disabled={saving}
              style={{ flex: 2, padding: "12px 0", borderRadius: 12, fontSize: 14, fontFamily: "inherit" }}>
              {saving ? "Saving…" : "Record Milestone"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
