/**
 * useStudentNotes — GET/POST/DELETE /api/student-notes. Same endpoint
 * contract as the original inline NotesTab logic.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { get, post, del } from "../shared";

export default function useStudentNotes(studentId, toast) {
  const [notes,   setNotes  ] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving ] = useState(false);
  const mountedRef = useRef(true);

  const load = useCallback(() => {
    setLoading(true);
    get(`/api/student-notes/${encodeURIComponent(studentId)}`)
      .then(d => { if (mountedRef.current) setNotes(d.notes || []); })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false); });
  }, [studentId]);

  useEffect(() => { mountedRef.current = true; load(); return () => { mountedRef.current = false; }; }, [load]);

  async function addNote(text) {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const r = await post(`/api/student-notes/${studentId}`, { note: text.trim(), createdBy: "Staff" });
      if (r.success) { toast?.success("Note saved."); load(); return true; }
      toast?.error(r.error || "Failed.");
      return false;
    } catch { toast?.error("Error saving note."); return false; }
    finally { setSaving(false); }
  }

  async function deleteNote(noteId) {
    try {
      const r = await del(`/api/student-notes/${noteId}`);
      if (r.success) { toast?.success("Note deleted."); load(); }
      else toast?.error(r.error || "Failed.");
    } catch { toast?.error("Error deleting."); }
  }

  return { notes, loading, saving, addNote, deleteNote };
}
