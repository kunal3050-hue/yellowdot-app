/**
 * FamilyProfile.jsx — Family Profile (V2)
 * Route: /family/:familyId
 *
 * Sections: Hero · Guardian Details · Children ·
 *           Outstanding Fees · Sibling Discount ·
 *           Notes · Documents · Timeline
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import familyService from "../services/familyService";
import { api } from "../services/authService";

const T = {
  bg:         "#FFFDF7",
  surface:    "#FFFFFF",
  surfaceWarm:"#FDFAF5",
  border:     "rgba(0,0,0,0.08)",
  borderGold: "rgba(244,196,0,0.35)",
  shadow:     "0 1px 4px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)",
  shadowMd:   "0 4px 20px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
  text:       "#2A2A2A",
  textMuted:  "#8C8880",
  textSoft:   "#6A6560",
  gold:       "#F4C400",
  goldDark:   "#78350F",
  goldMid:    "#B45309",
  goldLight:  "rgba(244,196,0,0.10)",
  green:      "#059669",
  greenLight: "rgba(5,150,105,0.10)",
  red:        "#DC2626",
  redLight:   "rgba(220,38,38,0.09)",
  blue:       "#2563EB",
  blueLight:  "rgba(37,99,235,0.08)",
  purple:     "#7C3AED",
  purpleLight:"rgba(124,58,237,0.08)",
  orange:     "#EA580C",
  orangeLight:"rgba(234,88,12,0.08)",
};

function fmt(n) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
}

function timeAgo(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60)   return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)return `${Math.floor(s / 3600)}h ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ── Shared primitives ───────────────────────────────────────────────

function Detail({ label, value }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: value ? T.text : T.textMuted }}>{value || "—"}</div>
    </div>
  );
}

function SectionCard({ title, icon, children, action }) {
  return (
    <div style={{
      background: T.surface, borderRadius: 14, border: `1px solid ${T.border}`,
      boxShadow: T.shadow, marginBottom: 20, overflow: "hidden",
    }}>
      <div style={{
        padding: "14px 20px 10px",
        borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: T.surfaceWarm,
      }}>
        <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.text, display: "flex", alignItems: "center", gap: 7 }}>
          <span>{icon}</span>{title}
        </h3>
        {action}
      </div>
      <div style={{ padding: "16px 20px" }}>{children}</div>
    </div>
  );
}

function AttendancePill({ status }) {
  if (!status) return <span style={{ fontSize: 11.5, color: T.textMuted }}>—</span>;
  const cfg = {
    Present:      { bg: T.greenLight,  color: T.green,  label: "Present" },
    Absent:       { bg: T.redLight,    color: T.red,    label: "Absent"  },
    "Checked In": { bg: T.blueLight,   color: T.blue,   label: "In School" },
  }[status] || { bg: T.surfaceWarm, color: T.textSoft, label: status };
  return (
    <span style={{
      padding: "2px 9px", borderRadius: 10,
      background: cfg.bg, color: cfg.color,
      fontSize: 11.5, fontWeight: 600,
    }}>{cfg.label}</span>
  );
}

// ── Child card ───────────────────────────────────────────────────────

function ChildCard({ student, onUnlink, canEdit }) {
  const initials = (student.studentName || "?").charAt(0).toUpperCase();
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 14px", border: `1px solid ${T.border}`,
      borderRadius: 12, marginBottom: 10, background: T.surfaceWarm,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {student.profileImage ? (
          <img src={student.profileImage} alt="" style={{ width: 42, height: 42, borderRadius: 12, objectFit: "cover" }} />
        ) : (
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: T.goldLight, border: `1px solid ${T.borderGold}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 16, color: T.goldMid,
          }}>{initials}</div>
        )}
        <div>
          <Link to={`/student-profile/${student.studentId}`}
            style={{ fontWeight: 600, fontSize: 14, color: T.text, textDecoration: "none" }}>
            {student.studentName}
          </Link>
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
            {[student.class, student.gender, student.centerId].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <AttendancePill status={student.todayStatus} />
        {canEdit && (
          <button onClick={() => onUnlink(student.studentId)} style={{
            padding: "4px 10px", borderRadius: 6, fontSize: 11.5,
            border: `1px solid ${T.border}`, background: "transparent",
            color: T.red, cursor: "pointer",
          }}>Unlink</button>
        )}
      </div>
    </div>
  );
}

// ── Link student modal (V2: quick list + search) ─────────────────────

function LinkStudentModal({ familyId, linkedIds, onClose, onLinked }) {
  const [query,    setQuery]    = useState("");
  const [results,  setResults]  = useState([]);
  const [quick,    setQuick]    = useState([]);    // unlinked students loaded upfront
  const [loading,  setLoading]  = useState(true);
  const [linking,  setLinking]  = useState(null);
  const [error,    setError]    = useState("");

  // Load unlinked students on mount for quick linking
  useEffect(() => {
    (async () => {
      try {
        const { students } = await api.get("/students").then(r => r.data);
        const unlinked = (students || []).filter(s => {
          const id = s.studentId || s.Student_ID;
          return !linkedIds.includes(id) && !s.familyId;
        }).slice(0, 12);
        setQuick(unlinked);
      } catch { /* ignore — search still works */ }
      finally { setLoading(false); }
    })();
  }, [linkedIds]);

  async function search(q) {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const { students } = await api.get("/students", { params: { search: q } }).then(r => r.data);
      setResults((students || []).filter(s => !linkedIds.includes(s.studentId || s.Student_ID)));
    } catch { setResults([]); }
    finally { setLoading(false); }
  }

  function handleQuery(v) {
    setQuery(v);
    clearTimeout(window._lstTimeout);
    window._lstTimeout = setTimeout(() => search(v), 300);
  }

  async function link(studentId) {
    setLinking(studentId); setError("");
    try {
      await familyService.linkStudent(familyId, studentId);
      onLinked();
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to link student.");
    } finally {
      setLinking(null);
    }
  }

  const shown  = query ? results : quick;
  const emptyMsg = query
    ? "No students match your search."
    : "All students are already linked to families.";

  const rowStyle = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 14px", borderRadius: 10,
    border: `1px solid ${T.border}`, marginBottom: 6, background: T.surfaceWarm,
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: T.surface, borderRadius: 16, width: "100%", maxWidth: 480,
        boxShadow: "0 24px 64px rgba(0,0,0,0.14)", padding: "24px 24px 20px",
        maxHeight: "80vh", overflowY: "auto",
      }} onClick={e => e.stopPropagation()}>
        <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700, color: T.text }}>Link Child to Family</h2>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: T.textMuted }}>
          {query ? "Search results" : "Students not yet in a family — click to link instantly."}
        </p>

        <input
          autoFocus
          value={query}
          onChange={e => handleQuery(e.target.value)}
          placeholder="Search by name or ID…"
          style={{
            width: "100%", padding: "9px 12px", fontSize: 13.5,
            border: `1px solid ${T.border}`, borderRadius: 10,
            background: T.surfaceWarm, color: T.text, outline: "none",
            boxSizing: "border-box", marginBottom: 12,
          }}
        />

        {loading && <div style={{ fontSize: 13, color: T.textMuted, padding: "8px 0" }}>Loading…</div>}
        {error   && <div style={{ fontSize: 12.5, color: T.red, padding: "6px 0" }}>{error}</div>}

        {!loading && shown.map(s => {
          const id   = s.studentId || s.Student_ID;
          const name = s.studentName || s.Student_Name;
          return (
            <div key={id} style={rowStyle}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: T.text }}>{name}</div>
                <div style={{ fontSize: 12, color: T.textMuted }}>{id} · {s.class || s.Class || ""}</div>
              </div>
              <button onClick={() => link(id)} disabled={linking === id} style={{
                padding: "5px 14px", borderRadius: 7, fontSize: 12.5, fontWeight: 600,
                background: T.gold, color: T.goldDark, border: "none",
                cursor: linking === id ? "wait" : "pointer",
                opacity: linking === id ? 0.6 : 1,
              }}>{linking === id ? "Linking…" : "Link"}</button>
            </div>
          );
        })}

        {!loading && shown.length === 0 && (
          <div style={{ fontSize: 13, color: T.textMuted, padding: "8px 0" }}>{emptyMsg}</div>
        )}

        <div style={{ marginTop: 16, textAlign: "right" }}>
          <button onClick={onClose} style={{
            padding: "7px 18px", borderRadius: 8, fontSize: 13,
            border: `1px solid ${T.border}`, background: "transparent",
            color: T.textSoft, cursor: "pointer",
          }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Sibling Discount Rules modal ─────────────────────────────────────

function DiscountRulesModal({ rules: initialRules, onClose, onSaved }) {
  const [rows,   setRows]   = useState(
    (initialRules?.length ? initialRules : [
      { siblingOrder: 2, discountPercent: 10, label: "2nd Child" },
      { siblingOrder: 3, discountPercent: 15, label: "3rd Child" },
      { siblingOrder: 4, discountPercent: 20, label: "4th Child+" },
    ]).map(r => ({ ...r })),
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  function setRow(i, key, val) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
  }

  async function save() {
    setSaving(true); setError("");
    try {
      await familyService.updateDiscountRules(rows);
      onSaved(rows);
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to save rules.");
    } finally {
      setSaving(false);
    }
  }

  const inputS = {
    padding: "6px 9px", fontSize: 13, width: "100%",
    border: `1px solid ${T.border}`, borderRadius: 7,
    background: T.surfaceWarm, color: T.text, outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: T.surface, borderRadius: 16, width: "100%", maxWidth: 460,
        boxShadow: "0 24px 64px rgba(0,0,0,0.14)", padding: "24px 24px 20px",
      }} onClick={e => e.stopPropagation()}>
        <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700, color: T.text }}>Sibling Discount Rules</h2>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: T.textMuted }}>School-wide discount applied by sibling order on invoices.</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
          {["Position", "Discount %", "Label"].map(h => (
            <span key={h} style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
          ))}
        </div>

        {rows.map((row, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <input style={inputS} type="number" min={2} value={row.siblingOrder}
              onChange={e => setRow(i, "siblingOrder", parseInt(e.target.value, 10) || 2)} />
            <input style={inputS} type="number" min={0} max={100} step={0.5} value={row.discountPercent}
              onChange={e => setRow(i, "discountPercent", parseFloat(e.target.value) || 0)} />
            <input style={inputS} value={row.label}
              onChange={e => setRow(i, "label", e.target.value)} />
          </div>
        ))}

        {error && <div style={{ marginTop: 10, fontSize: 12.5, color: T.red }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "7px 16px", borderRadius: 8, fontSize: 13,
            border: `1px solid ${T.border}`, background: "transparent", color: T.textSoft, cursor: "pointer",
          }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{
            padding: "7px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: T.gold, color: T.goldDark, border: "none",
            cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1,
          }}>{saving ? "Saving…" : "Save Rules"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Add document modal ────────────────────────────────────────────────

function AddDocumentModal({ familyId, onClose, onAdded }) {
  const [form,   setForm]   = useState({ name: "", url: "", type: "other" });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const DOC_TYPES = [
    { v: "other",       l: "Other" },
    { v: "admission",   l: "Admission Form" },
    { v: "medical",     l: "Medical Record" },
    { v: "id_proof",    l: "ID Proof" },
    { v: "address",     l: "Address Proof" },
    { v: "photo",       l: "Photo" },
    { v: "birth_cert",  l: "Birth Certificate" },
  ];

  async function save(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Document name is required."); return; }
    setSaving(true); setError("");
    try {
      await familyService.addDocument(familyId, form);
      onAdded();
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to add document.");
    } finally {
      setSaving(false);
    }
  }

  const inputS = {
    width: "100%", padding: "8px 10px", fontSize: 13,
    border: `1px solid ${T.border}`, borderRadius: 8,
    background: T.surfaceWarm, color: T.text, outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: T.surface, borderRadius: 16, width: "100%", maxWidth: 420,
        boxShadow: "0 24px 64px rgba(0,0,0,0.14)", padding: "24px 24px 20px",
      }} onClick={e => e.stopPropagation()}>
        <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700, color: T.text }}>Add Document</h2>
        <form onSubmit={save}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: T.textSoft, display: "block", marginBottom: 4 }}>Document Name *</label>
            <input style={inputS} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Birth Certificate" autoFocus />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: T.textSoft, display: "block", marginBottom: 4 }}>Type</label>
            <select style={inputS} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {DOC_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: T.textSoft, display: "block", marginBottom: 4 }}>URL / Drive Link</label>
            <input style={inputS} value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://drive.google.com/…" />
          </div>
          {error && <div style={{ marginBottom: 10, fontSize: 12.5, color: T.red }}>{error}</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} style={{
              padding: "7px 16px", borderRadius: 8, fontSize: 13,
              border: `1px solid ${T.border}`, background: "transparent", color: T.textSoft, cursor: "pointer",
            }}>Cancel</button>
            <button type="submit" disabled={saving} style={{
              padding: "7px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: T.gold, color: T.goldDark, border: "none",
              cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1,
            }}>{saving ? "Saving…" : "Add Document"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Timeline event icon & colour ─────────────────────────────────────

const TIMELINE_CONFIG = {
  FAMILY_CREATED: { icon: "🏠", color: T.green,  bg: T.greenLight },
  CHILD_LINKED:   { icon: "🔗", color: T.blue,   bg: T.blueLight  },
  CHILD_UNLINKED: { icon: "🔓", color: T.red,    bg: T.redLight   },
  NOTE_ADDED:     { icon: "📝", color: T.purple, bg: T.purpleLight},
  DOCUMENT_ADDED: { icon: "📄", color: T.orange, bg: T.orangeLight},
  FAMILY_UPDATED: { icon: "✏️",  color: T.goldMid,bg: T.goldLight  },
};

// ── Main ─────────────────────────────────────────────────────────────

export default function FamilyProfile() {
  const { familyId } = useParams();
  const navigate     = useNavigate();

  const [family,       setFamily]       = useState(null);
  const [students,     setStudents]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");

  // Modals
  const [linkModal,    setLinkModal]    = useState(false);
  const [confirm,      setConfirm]      = useState(null);  // { studentId, name }
  const [discountModal,setDiscountModal]= useState(false);
  const [docModal,     setDocModal]     = useState(false);

  // V2 sub-sections
  const [notes,        setNotes]        = useState([]);
  const [documents,    setDocuments]    = useState([]);
  const [timeline,     setTimeline]     = useState([]);
  const [fees,         setFees]         = useState(null);
  const [discountRules,setDiscountRules]= useState([]);

  const [noteInput,    setNoteInput]    = useState("");
  const [addingNote,   setAddingNote]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { family: fam } = await familyService.getOne(familyId);
      if (!fam) { setError("Family not found."); setLoading(false); return; }
      setFamily(fam);

      if (fam.studentIds?.length) {
        const { students: all } = await api.get("/students").then(r => r.data);
        const linked = (all || []).filter(s => fam.studentIds.includes(s.studentId || s.Student_ID));
        setStudents(linked.map(s => ({
          studentId:    s.studentId || s.Student_ID,
          studentName:  s.studentName || s.Student_Name,
          class:        s.class || s.Class || "",
          gender:       s.gender || s.Gender || "",
          centerId:     s.centerId || s.Center || "",
          profileImage: s.profileImage || s.Profile_Image || "",
        })));
      } else {
        setStudents([]);
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Failed to load family.");
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  const loadSections = useCallback(async () => {
    const [notesRes, docsRes, timelineRes, feesRes, discountRes] = await Promise.allSettled([
      familyService.getNotes(familyId),
      familyService.getDocuments(familyId),
      familyService.getTimeline(familyId),
      familyService.getFeesSummary(familyId),
      familyService.getDiscountRules(),
    ]);

    if (notesRes.status    === "fulfilled") setNotes(notesRes.value.notes || []);
    if (docsRes.status     === "fulfilled") setDocuments(docsRes.value.documents || []);
    if (timelineRes.status === "fulfilled") setTimeline(timelineRes.value.events || []);
    if (feesRes.status     === "fulfilled") setFees(feesRes.value);
    if (discountRes.status === "fulfilled") setDiscountRules(discountRes.value.rules || []);
  }, [familyId]);

  useEffect(() => {
    load();
    loadSections();
  }, [load, loadSections]);

  async function handleUnlink(studentId) {
    try {
      await familyService.unlinkStudent(familyId, studentId);
      setConfirm(null);
      load();
      loadSections();
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to unlink student.");
    }
  }

  async function handleAddNote() {
    if (!noteInput.trim()) return;
    setAddingNote(true);
    try {
      await familyService.addNote(familyId, noteInput.trim());
      setNoteInput("");
      const r = await familyService.getNotes(familyId);
      setNotes(r.notes || []);
      const t = await familyService.getTimeline(familyId);
      setTimeline(t.events || []);
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to add note.");
    } finally {
      setAddingNote(false);
    }
  }

  async function handleDeleteNote(noteId) {
    try {
      await familyService.deleteNote(familyId, noteId);
      setNotes(prev => prev.filter(n => n.noteId !== noteId));
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to delete note.");
    }
  }

  async function handleDeleteDocument(docId) {
    try {
      await familyService.deleteDocument(familyId, docId);
      setDocuments(prev => prev.filter(d => d.docId !== docId));
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to delete document.");
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontSize: 14 }}>Loading family profile…</div>
      </MainLayout>
    );
  }

  if (error || !family) {
    return (
      <MainLayout>
        <div style={{ padding: 40, textAlign: "center" }}>
          <p style={{ color: T.red, fontSize: 14 }}>{error || "Family not found."}</p>
          <button onClick={() => navigate("/families")} style={{
            marginTop: 10, padding: "7px 18px", borderRadius: 8, fontSize: 13,
            border: `1px solid ${T.border}`, background: "transparent", color: T.textSoft, cursor: "pointer",
          }}>← Back to Families</button>
        </div>
      </MainLayout>
    );
  }

  const primaryName = family.guardian1Name || family.guardian2Name || "Family";

  // Sibling discount lookup: find rule for each sibling by order
  function discountForOrder(order) {
    if (!discountRules.length) return null;
    const r = discountRules.find(r => r.siblingOrder === order);
    return r || (order >= 4 ? discountRules.find(r => r.siblingOrder >= 4) : null);
  }

  return (
    <MainLayout>
      <div style={{ padding: "28px 28px 60px", maxWidth: 900, margin: "0 auto" }}>

        {/* ── Breadcrumb ──────────────────────────────────────────── */}
        <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.textMuted }}>
          <Link to="/families" style={{ color: T.textMuted, textDecoration: "none" }}>Families</Link>
          <span>›</span>
          <span style={{ color: T.text }}>{primaryName}</span>
        </div>

        {/* ── Hero ────────────────────────────────────────────────── */}
        <div style={{
          background: T.surface, borderRadius: 16, border: `1px solid ${T.border}`,
          boxShadow: T.shadowMd, padding: "24px 28px", marginBottom: 20,
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: T.goldLight, border: `1px solid ${T.borderGold}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, fontWeight: 700, color: T.goldMid,
            }}>
              {primaryName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: T.text }}>{primaryName} Family</h1>
              <div style={{ marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{
                  padding: "2px 10px", borderRadius: 10,
                  background: T.goldLight, color: T.goldMid,
                  fontSize: 11.5, fontWeight: 600, border: `1px solid ${T.borderGold}`,
                }}>{family.familyCode}</span>
                <span style={{
                  padding: "2px 10px", borderRadius: 10,
                  background: family.active !== false ? T.greenLight : T.redLight,
                  color: family.active !== false ? T.green : T.red,
                  fontSize: 11.5, fontWeight: 600,
                }}>{family.active !== false ? "Active" : "Inactive"}</span>
                <span style={{ fontSize: 12, color: T.textMuted }}>
                  {students.length} {students.length === 1 ? "child" : "children"}
                </span>
                {fees?.totalOutstanding > 0 && (
                  <span style={{
                    padding: "2px 10px", borderRadius: 10,
                    background: T.redLight, color: T.red,
                    fontSize: 11.5, fontWeight: 600,
                  }}>⚠ {fmt(fees.totalOutstanding)} outstanding</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={() => navigate("/families")} style={{
            padding: "7px 16px", borderRadius: 8, fontSize: 12.5,
            border: `1px solid ${T.border}`, background: "transparent",
            color: T.textSoft, cursor: "pointer",
          }}>← All Families</button>
        </div>

        {/* ── Guardian Details ─────────────────────────────────────── */}
        <SectionCard title="Guardian Details" icon="👤">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <Detail label="Guardian 1"       value={family.guardian1Name} />
            <Detail label="Guardian 2"       value={family.guardian2Name} />
            <Detail label="Primary Contact"  value={family.primaryContact} />
            <Detail label="Alternate Contact"value={family.alternateContact} />
            <Detail label="Email"            value={family.email} />
            <Detail label="Center"           value={family.centerId} />
          </div>
          {family.address && <Detail label="Address" value={family.address} />}
        </SectionCard>

        {/* ── Children ─────────────────────────────────────────────── */}
        <SectionCard
          title={`Children (${students.length})`}
          icon="🧒"
          action={
            <button onClick={() => setLinkModal(true)} style={{
              padding: "5px 14px", borderRadius: 7, fontSize: 12.5, fontWeight: 600,
              background: T.gold, color: T.goldDark, border: "none", cursor: "pointer",
            }}>+ Link Child</button>
          }
        >
          {students.length === 0 ? (
            <div style={{ padding: "16px 0", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 13.5, color: T.textMuted }}>No children linked yet.</p>
              <button onClick={() => setLinkModal(true)} style={{
                marginTop: 10, padding: "6px 16px", borderRadius: 7, fontSize: 13,
                background: T.gold, color: T.goldDark, border: "none", cursor: "pointer", fontWeight: 600,
              }}>Link First Child</button>
            </div>
          ) : (
            students.map((s, idx) => {
              const rule = discountForOrder(idx + 1);
              return (
                <div key={s.studentId}>
                  <ChildCard
                    student={s}
                    onUnlink={id => setConfirm({ studentId: id, name: s.studentName })}
                    canEdit
                  />
                  {rule && idx > 0 && (
                    <div style={{
                      fontSize: 11.5, color: T.green, fontWeight: 600,
                      marginTop: -6, marginBottom: 10, marginLeft: 4,
                    }}>
                      ✓ {rule.label} — {rule.discountPercent}% sibling discount applies
                    </div>
                  )}
                </div>
              );
            })
          )}
        </SectionCard>

        {/* ── Outstanding Fees ──────────────────────────────────────── */}
        {fees && (
          <SectionCard title="Outstanding Fees" icon="💰">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: fees.byStudent.some(r => r.invoiceCount > 0) ? 16 : 0 }}>
              <div style={{ background: fees.totalOutstanding > 0 ? T.redLight : T.greenLight, borderRadius: 10, padding: "12px 16px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Outstanding</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: fees.totalOutstanding > 0 ? T.red : T.green }}>{fmt(fees.totalOutstanding)}</div>
              </div>
              <div style={{ background: T.surfaceWarm, borderRadius: 10, padding: "12px 16px", border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Total Invoiced</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{fmt(fees.totalInvoiced)}</div>
              </div>
              <div style={{ background: T.surfaceWarm, borderRadius: 10, padding: "12px 16px", border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Total Paid</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.green }}>{fmt(fees.totalPaid)}</div>
              </div>
            </div>

            {fees.byStudent.filter(r => r.invoiceCount > 0).map(r => (
              <div key={r.studentId} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "9px 14px", borderRadius: 10, border: `1px solid ${T.border}`,
                background: T.surfaceWarm, marginBottom: 6,
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: T.text }}>{r.studentName}</div>
                  <div style={{ fontSize: 11.5, color: T.textMuted }}>{r.invoiceCount} invoice{r.invoiceCount !== 1 ? "s" : ""}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: r.outstanding > 0 ? T.red : T.green }}>{fmt(r.outstanding)}</div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>outstanding</div>
                </div>
              </div>
            ))}

            {fees.totalInvoiced === 0 && (
              <p style={{ margin: 0, fontSize: 13, color: T.textMuted }}>No invoices found for this family's children.</p>
            )}
          </SectionCard>
        )}

        {/* ── Sibling Discount Rules ────────────────────────────────── */}
        <SectionCard
          title="Sibling Discount Rules"
          icon="🏷"
          action={
            <button onClick={() => setDiscountModal(true)} style={{
              padding: "4px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600,
              border: `1px solid ${T.border}`, background: "transparent",
              color: T.textSoft, cursor: "pointer",
            }}>Edit Rules</button>
          }
        >
          {discountRules.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: T.textMuted }}>No discount rules configured.</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {discountRules.map(r => (
                <div key={r.siblingOrder} style={{
                  padding: "8px 14px", borderRadius: 10,
                  background: T.greenLight, border: `1px solid rgba(5,150,105,0.2)`,
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span style={{ fontSize: 16 }}>👶</span>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: T.green }}>{r.label}</div>
                    <div style={{ fontSize: 11.5, color: T.textSoft }}>{r.discountPercent}% off</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* ── Notes ────────────────────────────────────────────────── */}
        <SectionCard title={`Notes (${notes.length})`} icon="📝">
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <textarea
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAddNote(); }}
              placeholder="Add a note… (Ctrl+Enter to save)"
              rows={2}
              style={{
                flex: 1, padding: "8px 10px", fontSize: 13,
                border: `1px solid ${T.border}`, borderRadius: 8,
                background: T.surfaceWarm, color: T.text, outline: "none",
                resize: "vertical", fontFamily: "inherit",
              }}
            />
            <button
              onClick={handleAddNote}
              disabled={addingNote || !noteInput.trim()}
              style={{
                padding: "8px 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                background: T.gold, color: T.goldDark, border: "none",
                cursor: addingNote || !noteInput.trim() ? "default" : "pointer",
                opacity: !noteInput.trim() ? 0.5 : 1, alignSelf: "flex-end",
              }}
            >{addingNote ? "Adding…" : "Add"}</button>
          </div>

          {notes.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: T.textMuted }}>No notes yet.</p>
          ) : (
            notes.map(note => (
              <div key={note.noteId} style={{
                padding: "12px 14px", borderRadius: 10, border: `1px solid ${T.border}`,
                background: T.surfaceWarm, marginBottom: 8, position: "relative",
              }}>
                <p style={{ margin: "0 24px 6px 0", fontSize: 13.5, color: T.text, lineHeight: 1.5 }}>
                  {note.content}
                </p>
                <div style={{ fontSize: 11, color: T.textMuted }}>
                  {note.authorName} · {timeAgo(note.createdAt)}
                </div>
                <button
                  onClick={() => handleDeleteNote(note.noteId)}
                  style={{
                    position: "absolute", top: 10, right: 10,
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 14, color: T.textMuted, lineHeight: 1,
                    padding: "2px 6px",
                  }}
                  title="Delete note"
                >✕</button>
              </div>
            ))
          )}
        </SectionCard>

        {/* ── Documents ─────────────────────────────────────────────── */}
        <SectionCard
          title={`Documents (${documents.length})`}
          icon="📄"
          action={
            <button onClick={() => setDocModal(true)} style={{
              padding: "5px 14px", borderRadius: 7, fontSize: 12.5, fontWeight: 600,
              background: T.gold, color: T.goldDark, border: "none", cursor: "pointer",
            }}>+ Add</button>
          }
        >
          {documents.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: T.textMuted }}>No documents attached. Use "Add" to attach document links.</p>
          ) : (
            documents.map(doc => (
              <div key={doc.docId} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", borderRadius: 10,
                border: `1px solid ${T.border}`, background: T.surfaceWarm, marginBottom: 8,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>📎</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: T.text }}>{doc.name}</div>
                    <div style={{ fontSize: 11.5, color: T.textMuted }}>
                      {doc.type} · {doc.uploadedByName} · {timeAgo(doc.createdAt)}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {doc.url && (
                    <a href={doc.url} target="_blank" rel="noreferrer" style={{
                      padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                      background: T.blueLight, color: T.blue, textDecoration: "none",
                    }}>Open</a>
                  )}
                  <button onClick={() => handleDeleteDocument(doc.docId)} style={{
                    padding: "4px 8px", borderRadius: 6, fontSize: 11.5,
                    border: `1px solid ${T.border}`, background: "transparent",
                    color: T.red, cursor: "pointer",
                  }}>✕</button>
                </div>
              </div>
            ))
          )}
        </SectionCard>

        {/* ── Timeline ──────────────────────────────────────────────── */}
        <SectionCard title="Activity Timeline" icon="🕒">
          {timeline.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: T.textMuted }}>No activity recorded yet.</p>
          ) : (
            <div style={{ position: "relative", paddingLeft: 28 }}>
              {/* Vertical line */}
              <div style={{
                position: "absolute", left: 9, top: 8, bottom: 8,
                width: 2, background: T.border, borderRadius: 1,
              }} />
              {timeline.map((evt, idx) => {
                const cfg = TIMELINE_CONFIG[evt.type] || { icon: "📌", color: T.textSoft, bg: T.surfaceWarm };
                return (
                  <div key={evt.eventId || idx} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14, position: "relative" }}>
                    {/* Dot */}
                    <div style={{
                      position: "absolute", left: -28, top: 2,
                      width: 20, height: 20, borderRadius: "50%",
                      background: cfg.bg, border: `2px solid ${cfg.color}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, flexShrink: 0,
                    }}>{cfg.icon}</div>
                    <div>
                      <div style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{evt.description}</div>
                      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{timeAgo(evt.createdAt)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

      </div>

      {/* ── Modals ──────────────────────────────────────────────────── */}

      {linkModal && (
        <LinkStudentModal
          familyId={familyId}
          linkedIds={family.studentIds || []}
          onClose={() => setLinkModal(false)}
          onLinked={() => { setLinkModal(false); load(); loadSections(); }}
        />
      )}

      {confirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div style={{
            background: T.surface, borderRadius: 14, padding: "24px 28px", maxWidth: 380, width: "100%",
            boxShadow: "0 24px 64px rgba(0,0,0,0.14)",
          }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.text }}>Remove from Family?</h3>
            <p style={{ margin: "0 0 20px", fontSize: 13.5, color: T.textSoft }}>
              <strong>{confirm.name}</strong> will be unlinked from this family. Their student record will not be deleted.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirm(null)} style={{
                padding: "7px 16px", borderRadius: 7, fontSize: 13,
                border: `1px solid ${T.border}`, background: "transparent", color: T.textSoft, cursor: "pointer",
              }}>Cancel</button>
              <button onClick={() => handleUnlink(confirm.studentId)} style={{
                padding: "7px 16px", borderRadius: 7, fontSize: 13, fontWeight: 600,
                background: T.red, color: "#FFF", border: "none", cursor: "pointer",
              }}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {discountModal && (
        <DiscountRulesModal
          rules={discountRules}
          onClose={() => setDiscountModal(false)}
          onSaved={newRules => { setDiscountRules(newRules); setDiscountModal(false); }}
        />
      )}

      {docModal && (
        <AddDocumentModal
          familyId={familyId}
          onClose={() => setDocModal(false)}
          onAdded={() => {
            setDocModal(false);
            familyService.getDocuments(familyId).then(r => setDocuments(r.documents || []));
            familyService.getTimeline(familyId).then(r => setTimeline(r.events || []));
          }}
        />
      )}
    </MainLayout>
  );
}
