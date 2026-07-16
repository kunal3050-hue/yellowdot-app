/**
 * StudentProfile.jsx — thin wrapper around the canonical profile shell
 * ─────────────────────────────────────────────────────────────────
 * Route: /student-profile/:id (deep-link target, e.g. from
 * FamilyProfile.jsx). Previously a second, independent ~1,700-line
 * implementation with several stub/placeholder tabs (fabricated demo
 * data). Per the Phase 2.2b cleanup, this now renders the exact same
 * profile shell + tab components used by /students -- there is only
 * one Student Profile implementation in the app.
 * ─────────────────────────────────────────────────────────────────
 */
import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { Modal, Button, ToastProvider, useToast } from "../components/ui";
import { get, put, del } from "./Students/shared";
import StudentProfileShell from "./Students/StudentProfile";
import StudentModal from "./Students/StudentModal";

function StudentProfileRouteInner() {
  const { id } = useParams();
  const navigate = useNavigate();
  const rawToast = useToast();
  const toast = {
    success: (m) => rawToast.show(m, "success"),
    error:   (m) => rawToast.show(m, "error"),
  };

  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editStudent, setEditStudent] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    get(`/students/${id}`)
      .then(data => setStudent(data))
      .catch(() => toast.error("Failed to load student."))
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  async function handleEditSave(formData) {
    setSaving(true);
    try {
      const res = await put(`/update-student/${editStudent.Student_ID}`, formData);
      if (res.success) { toast.success("Updated!"); setEditStudent(null); load(); }
      else toast.error(res.message || "Failed.");
    } catch (e) { toast.error(e.message || "Error."); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await del(`/delete-student/${student.Student_ID}`);
      if (res.success) {
        toast.success(`${student.Student_Name} removed.`);
        navigate("/students");
      } else toast.error(res.message || "Failed.");
    } catch (e) { toast.error(e.message || "Error."); }
    finally { setDeleting(false); }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", height: "100vh" }}>
        <Sidebar />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--yd-text-muted)" }}>
          Loading student…
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div style={{ display: "flex", height: "100vh" }}>
        <Sidebar />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--yd-text-soft)" }}>Student not found</h3>
            <Button variant="outline" size="sm" onClick={() => navigate("/students")} style={{ marginTop: 10 }}>Back to Students</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--yd-bg-sunken)", overflow: "hidden" }}>
      <Sidebar />

      {editStudent && (
        <StudentModal student={editStudent} saving={saving} onClose={() => setEditStudent(null)} onSave={handleEditSave} />
      )}

      {confirmDelete && (
        <Modal
          isOpen
          onClose={() => setConfirmDelete(false)}
          title="Remove Student?"
          footer={
            <>
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button variant="danger" onClick={handleDelete} loading={deleting}>Delete</Button>
            </>
          }
        >
          <p style={{ fontSize: 13, color: "var(--yd-text-soft)" }}>{student.Student_Name}</p>
          <p style={{ fontSize: 12, color: "var(--yd-text-muted)" }}>{student.Student_ID}</p>
        </Modal>
      )}

      <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        <StudentProfileShell
          studentId={student.Student_ID}
          students={[student]}
          onEdit={() => setEditStudent(student)}
          onDelete={() => setConfirmDelete(true)}
          onRefresh={load}
          toast={toast}
          canEdit
          canDelete
          onBack={() => navigate("/students")}
        />
      </div>
    </div>
  );
}

export default function StudentProfileRoute() {
  return (
    <ToastProvider>
      <StudentProfileRouteInner />
    </ToastProvider>
  );
}
