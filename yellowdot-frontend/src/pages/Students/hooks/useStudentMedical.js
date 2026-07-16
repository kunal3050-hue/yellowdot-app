/**
 * useStudentMedical — GET/PUT /api/student-medical/:studentId
 * Same endpoint/payload contract as the original inline MedicalTab logic.
 */
import { useState, useEffect, useRef } from "react";
import { get, put } from "../shared";

const EMPTY_FORM = { bloodGroup: "", allergies: "", medications: "", doctorName: "", doctorPhone: "", emergencyNotes: "", notes: "" };

export default function useStudentMedical(studentId, toast) {
  const [form,    setForm   ] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving ] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    get(`/api/student-medical/${encodeURIComponent(studentId)}`)
      .then(d => {
        if (!mountedRef.current) return;
        const e = d.entry;
        if (e) setForm({ bloodGroup: e.bloodGroup || "", allergies: e.allergies || "", medications: e.medications || "", doctorName: e.doctorName || "", doctorPhone: e.doctorPhone || "", emergencyNotes: e.emergencyNotes || "", notes: e.notes || "" });
        else setForm(EMPTY_FORM);
      })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false); });
    return () => { mountedRef.current = false; };
  }, [studentId]);

  async function save(nextForm) {
    setSaving(true);
    try {
      const r = await put(`/api/student-medical/${studentId}`, nextForm);
      if (r.success) { toast?.success("Medical info saved."); setForm(nextForm); return true; }
      toast?.error(r.error || "Failed.");
      return false;
    } catch {
      toast?.error("Error saving.");
      return false;
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  return { form, loading, saving, save };
}
