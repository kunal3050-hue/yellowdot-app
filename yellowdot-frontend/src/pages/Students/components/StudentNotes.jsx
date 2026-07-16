/**
 * StudentNotes — same API contract as the original (/api/student-notes),
 * now backed by the shared useStudentNotes hook. Shared component --
 * used by the profile shell for both /students and /student-profile/:id.
 */
import { useState } from "react";
import { Card, Button, EmptyState, Skeleton } from "../../../components/ui";
import useStudentNotes from "../hooks/useStudentNotes";

const SUGGESTIONS = ["Cries during nap", "Picky eater", "Shy initially", "Hydration reminder", "Needs extra attention", "Allergic reaction risk", "Separation anxiety"];

export default function StudentNotes({ student, toast }) {
  const { notes, loading, saving, addNote, deleteNote } = useStudentNotes(student.Student_ID, toast);
  const [newNote, setNewNote] = useState("");

  async function handleAdd() {
    const ok = await addNote(newNote);
    if (ok) setNewNote("");
  }

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <h3 style={{ fontSize: 13, fontWeight: 800, color: "var(--yd-charcoal)" }}>
        Staff Notes <span style={{ fontSize: 10, fontWeight: 500, color: "var(--yd-text-muted)", marginLeft: 4 }}>private · internal only</span>
      </h3>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {SUGGESTIONS.map(s => (
          <button key={s} onClick={() => setNewNote(n => n ? `${n}, ${s}` : s)}
            style={{
              padding: "3px 10px", fontSize: 10, fontWeight: 600, borderRadius: 999,
              background: "var(--yd-soft)", color: "var(--yd-text-soft)", border: "1px solid var(--yd-border-light)", cursor: "pointer",
            }}>
            {s}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <textarea
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          placeholder="Add internal staff note…"
          rows={2}
          className="yd-input"
          style={{ flex: 1, resize: "none" }}
          onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) handleAdd(); }}
        />
        <Button variant="primary" size="sm" onClick={handleAdd} loading={saving} disabled={!newNote.trim()}>Add</Button>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={44} />)}
        </div>
      ) : notes.length === 0 ? (
        <EmptyState size="sm" title="No notes yet" description="Add internal staff observations." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
          {notes.map(n => (
            <Card key={n.noteId} padding="10px 14px" style={{ background: "var(--yd-yellow-pale)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, color: "var(--yd-charcoal)", fontWeight: 500, lineHeight: 1.5 }}>{n.note}</p>
                  <p style={{ fontSize: 10, color: "var(--yd-text-muted)", marginTop: 3 }}>{n.createdBy} · {n.createdAt}</p>
                </div>
                <Button size="xs" variant="ghost" onClick={() => deleteNote(n.noteId)}>✕</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
