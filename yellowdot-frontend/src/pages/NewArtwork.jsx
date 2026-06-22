// ─────────────────────────────────────────────────────────────────────────────
// NewArtwork — Upload a child's artwork to the journey
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { createEntry } from "../services/journeyService";
import { uploadArtwork } from "../services/storageService";
import { api } from "../services/authService";

const W = {
  bg1: "#FFFDF7", bg2: "#FFFBF0", bg3: "#FFF8E8",
  charcoal1: "#4A3A22", charcoal2: "#6A5737",
  gold1: "#F6D54A", gold2: "#F1C933",
  goldPale: "#FFF7D6", goldBorder: "#EFD978",
  muted1: "#8B7355",
};

const CATEGORIES = [
  { id: "drawing",  label: "Drawing",           emoji: "✏️",  bg: "#EEF2FF", border: "#C7D2FE", text: "#3730A3" },
  { id: "worksheet",label: "Worksheet",         emoji: "📄",  bg: "#F0FDF4", border: "#BBF7D0", text: "#14532D" },
  { id: "craft",    label: "Craft",             emoji: "✂️",  bg: "#FDF4FF", border: "#E9D5FF", text: "#6B21A8" },
  { id: "project",  label: "Project",           emoji: "🏗️",  bg: "#FFF7ED", border: "#FED7AA", text: "#9A3412" },
  { id: "coloring", label: "Coloring Activity", emoji: "🎨",  bg: "#FFFBEB", border: "#FDE68A", text: "#78350F" },
];

const VISIBILITY_OPTIONS = [
  { value: "all_parents", label: "Visible to parents" },
  { value: "staff_only",  label: "Staff only (private)" },
];

function todayISO() { return new Date().toISOString().split("T")[0]; }

export default function NewArtwork() {
  const navigate    = useNavigate();
  const [params]    = useSearchParams();

  const [students,    setStudents]    = useState([]);
  const [studentId,   setStudentId]   = useState(params.get("studentId") || "");
  const [category,    setCategory]    = useState("");
  const [title,       setTitle]       = useState("");
  const [caption,     setCaption]     = useState("");
  const [date,        setDate]        = useState(todayISO());
  const [visibility,  setVisibility]  = useState("all_parents");
  const [file,        setFile]        = useState(null);
  const [preview,     setPreview]     = useState(null);
  const [uploading,   setUploading]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    api.get("/api/students")
      .then(r => setStudents(r.data?.students || []))
      .catch(() => {});
  }, []);

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Please select an image file (JPG, PNG, or WebP).");
      return;
    }
    setFile(f);
    setError(null);
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target?.result);
    reader.readAsDataURL(f);
  }

  function handleDrop(e) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileChange({ target: { files: [f] } });
  }

  const selectedStudent = students.find(s => s.id === studentId);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!studentId) return setError("Please select a student.");
    if (!category)  return setError("Please choose an artwork category.");
    if (!file)      return setError("Please upload a photo of the artwork.");

    setSaving(true);
    setUploading(true);
    setError(null);
    try {
      const mediaUrl = await uploadArtwork(file);
      setUploading(false);

      await createEntry({
        studentId,
        studentName: selectedStudent
          ? (selectedStudent.name || `${selectedStudent.firstName || ""} ${selectedStudent.lastName || ""}`.trim())
          : "",
        kind:            "artwork",
        sourceModule:    "artwork",
        artworkCategory: category,
        artworkTitle:    title.trim(),
        caption:         caption.trim(),
        mediaUrl,
        date,
        visibility,
      });
      navigate("/child-journey");
    } catch (e) {
      setError(e.response?.data?.error || e.message);
      setSaving(false);
      setUploading(false);
    }
  }

  const INPUT = {
    fontSize: 14, padding: "10px 14px", borderRadius: 10,
    border: "1.5px solid rgba(139,125,101,.18)", background: "#fff",
    color: W.charcoal1, fontWeight: 500, outline: "none",
    fontFamily: "inherit", width: "100%",
  };
  const LABEL = { fontSize: 13, fontWeight: 700, color: W.charcoal2, marginBottom: 6, display: "block" };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: `linear-gradient(150deg,${W.bg1},${W.bg2} 50%,${W.bg3})` }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800;900&display=swap');
        .na-page, .na-page * { font-family: 'Inter Tight', system-ui, sans-serif; box-sizing: border-box; }
        .na-btn { background: linear-gradient(135deg,#F6D54A,#F1C933); color: #4A3A22; border: none; font-weight: 800; cursor: pointer; transition: box-shadow 80ms; }
        .na-btn:hover { box-shadow: 0 2px 12px rgba(241,201,51,.4); }
        .na-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .na-cat { cursor: pointer; transition: box-shadow 80ms, transform 80ms; border-radius: 12px; }
        .na-cat:hover { box-shadow: 0 2px 8px rgba(0,0,0,.10); transform: scale(1.02); }
        .na-drop { border: 2px dashed rgba(139,125,101,.28); border-radius: 14px; background: rgba(255,253,247,.8); transition: border-color 120ms, background 120ms; cursor: pointer; }
        .na-drop:hover, .na-drop.drag { border-color: #F6D54A; background: #FFFCE6; }
        textarea:focus, select:focus, input:focus { outline: 2px solid #F6D54A !important; }
      `}</style>

      <Sidebar />

      <div className="na-page" style={{ flex: 1, padding: "32px 28px", maxWidth: 680, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <button
            onClick={() => navigate("/child-journey")}
            style={{ background: "none", border: "none", cursor: "pointer", color: W.muted1, fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 12, display: "flex", alignItems: "center", gap: 4 }}>
            ← Back to Child Journey
          </button>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: W.charcoal1, letterSpacing: -0.5 }}>
            🎨 Upload Artwork
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: W.muted1 }}>
            Capture and share a child's creative work with their family.
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

          {/* Category */}
          <div>
            <label style={LABEL}>Artwork Category *</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
              {CATEGORIES.map(c => {
                const sel = category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className="na-cat"
                    onClick={() => setCategory(c.id)}
                    style={{
                      padding: "12px 6px",
                      background: sel ? c.bg : "#fff",
                      border: `2px solid ${sel ? c.border : "rgba(139,125,101,.14)"}`,
                      color: sel ? c.text : W.charcoal2,
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                      boxShadow: sel ? `0 2px 8px ${c.border}88` : "none",
                    }}>
                    <span style={{ fontSize: 22 }}>{c.emoji}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, textAlign: "center", lineHeight: 1.2 }}>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Artwork photo upload */}
          <div>
            <label style={LABEL}>Photo of Artwork *</label>
            {preview ? (
              <div style={{ position: "relative" }}>
                <img src={preview} alt="artwork preview" style={{ width: "100%", maxHeight: 300, objectFit: "contain", borderRadius: 12, background: "#F9F9F9", border: "1px solid rgba(139,125,101,.16)" }} />
                <button
                  type="button"
                  onClick={() => { setFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = ""; }}
                  style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,.55)", border: "none", color: "#fff", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  ✕
                </button>
              </div>
            ) : (
              <div
                className="na-drop"
                onClick={() => fileRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                style={{ padding: "40px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📷</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: W.charcoal1, marginBottom: 4 }}>
                  Tap to upload or drag a photo
                </div>
                <div style={{ fontSize: 12, color: W.muted1 }}>JPG, PNG or WebP · max 10 MB</div>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
          </div>

          {/* Title */}
          <div>
            <label style={LABEL}>Artwork Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={'e.g. "My Family Drawing"'}
              style={INPUT}
              maxLength={100}
            />
          </div>

          {/* Caption */}
          <div>
            <label style={LABEL}>Note / Caption</label>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              rows={3}
              placeholder="Describe the artwork or add context for the parent…"
              style={{ ...INPUT, resize: "vertical", lineHeight: 1.6 }}
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
              className="na-btn"
              disabled={saving}
              style={{ flex: 2, padding: "12px 0", borderRadius: 12, fontSize: 14, fontFamily: "inherit" }}>
              {uploading ? "Uploading photo…" : saving ? "Saving…" : "Save Artwork"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
