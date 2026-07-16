/**
 * Students/index.jsx — main page
 * ─────────────────────────────────────────────────────────────────
 * Same route (/students), same data-fetching/handlers as the original
 * monolithic Students.jsx. Presentation restructured: a full-width List
 * view (KPI cards + DataTable v2) toggles to a full-width Profile view
 * on row click, both under this one component -- no new routes.
 *
 * This also replaces the old "desktop two-panel + separate mobile
 * drawer" duality with one unified list⇄profile toggle that works the
 * same way at every breakpoint (a deliberate simplification -- the same
 * capability, less special-casing).
 * ─────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import { ToastProvider, useToast } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { get, put, del } from "./shared";
import StudentList from "./StudentList";
import StudentProfile from "./StudentProfile";
import StudentModal from "./StudentModal";
import { Modal, Button } from "../../components/ui";

function StudentsInner() {
  const rawToast = useToast();
  // Thin adapter: every tab component in this module calls the ergonomic
  // toast.success(msg)/toast.error(msg) shape. The shared useToast() only
  // exposes show(message, type)/dismiss(id) -- this bridges the two so
  // nothing downstream needs to change.
  const toast = {
    success: (m) => rawToast.show(m, "success"),
    error:   (m) => rawToast.show(m, "error"),
    info:    (m) => rawToast.show(m, "info"),
  };
  const navigate = useNavigate();
  const location = useLocation();
  const mountedRef = useRef(true);
  const { canDo } = useAuth();

  const perm = {
    create: canDo("students", "create"),
    edit:   canDo("students", "edit"),
    delete: canDo("students", "delete"),
  };

  const [students,   setStudents  ] = useState([]);
  const [loading,    setLoading   ] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  const [editStudent,   setEditStudent  ] = useState(null);
  const [deleteStudent, setDeleteStudent] = useState(null);
  const [bulkDeleteRows, setBulkDeleteRows] = useState(null);
  const [saving,  setSaving ] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    if (location.state?.admissionSuccess) {
      toast.success(`${location.state.admissionSuccess} admitted successfully!`);
      window.history.replaceState({}, "", location.pathname);
    }
  }, []); // eslint-disable-line

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await get("/students");
      if (!mountedRef.current) return;
      setStudents(Array.isArray(data) ? data : []);
    } catch { toast.error("Failed to load students."); }
    finally { if (mountedRef.current) setLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => { loadStudents(); }, []); // eslint-disable-line

  const handleEdit = async (formData) => {
    if (!editStudent) return;
    setSaving(true);
    try {
      const res = await put(`/update-student/${editStudent.Student_ID}`, formData);
      if (res.success) { toast.success("Updated!"); setEditStudent(null); await loadStudents(); }
      else toast.error(res.message || "Failed.");
    } catch (e) { toast.error(e.message || "Error."); }
    finally { if (mountedRef.current) setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteStudent) return;
    setDeleting(true);
    try {
      const res = await del(`/delete-student/${deleteStudent.Student_ID}`);
      if (res.success) {
        toast.success(`${deleteStudent.Student_Name} removed.`);
        setDeleteStudent(null);
        if (selectedId === deleteStudent.Student_ID) setSelectedId(null);
        await loadStudents();
      } else toast.error(res.message || "Failed.");
    } catch (e) { toast.error(e.message || "Error."); }
    finally { if (mountedRef.current) setDeleting(false); }
  };

  // Bulk delete loops the same single-student delete endpoint used above --
  // no new backend behavior, just client-side orchestration of an existing call.
  const handleBulkDelete = async () => {
    if (!bulkDeleteRows?.length) return;
    setDeleting(true);
    let okCount = 0;
    for (const row of bulkDeleteRows) {
      try {
        const res = await del(`/delete-student/${row.Student_ID}`);
        if (res.success) okCount++;
      } catch { /* continue with remaining rows */ }
    }
    setDeleting(false);
    setBulkDeleteRows(null);
    if (okCount > 0) toast.success(`${okCount} student${okCount === 1 ? "" : "s"} removed.`);
    if (okCount < bulkDeleteRows.length) toast.error(`${bulkDeleteRows.length - okCount} could not be removed.`);
    await loadStudents();
  };

  const selectedStudentObj = students.find(s => (s.Student_ID || s.id) === selectedId);

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--yd-bg-sunken)", overflow: "hidden" }}>
      <Sidebar />

      {editStudent && (
        <StudentModal student={editStudent} onSave={handleEdit} onClose={() => setEditStudent(null)} saving={saving} />
      )}

      {deleteStudent && (
        <Modal
          isOpen
          onClose={() => setDeleteStudent(null)}
          title="Remove Student?"
          size="default"
          footer={
            <>
              <Button variant="outline" onClick={() => setDeleteStudent(null)}>Cancel</Button>
              <Button variant="danger" onClick={handleDelete} loading={deleting}>Delete</Button>
            </>
          }
        >
          <p style={{ fontSize: 13, color: "var(--yd-text-soft)" }}>{deleteStudent.Student_Name}</p>
          <p style={{ fontSize: 12, color: "var(--yd-text-muted)" }}>{deleteStudent.Student_ID}</p>
        </Modal>
      )}

      {bulkDeleteRows && (
        <Modal
          isOpen
          onClose={() => setBulkDeleteRows(null)}
          title={`Remove ${bulkDeleteRows.length} Students?`}
          size="default"
          footer={
            <>
              <Button variant="outline" onClick={() => setBulkDeleteRows(null)}>Cancel</Button>
              <Button variant="danger" onClick={handleBulkDelete} loading={deleting}>Delete All</Button>
            </>
          }
        >
          <p style={{ fontSize: 13, color: "var(--yd-text-soft)" }}>
            This will remove {bulkDeleteRows.length} student record{bulkDeleteRows.length === 1 ? "" : "s"}. This cannot be undone.
          </p>
        </Modal>
      )}

      <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        {selectedId ? (
          <StudentProfile
            studentId={selectedId}
            students={students}
            onEdit={() => setEditStudent(selectedStudentObj)}
            onDelete={() => setDeleteStudent(selectedStudentObj)}
            onRefresh={loadStudents}
            toast={toast}
            canEdit={perm.edit}
            canDelete={perm.delete}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <StudentList
            students={students}
            loading={loading}
            onSelect={setSelectedId}
            onAdd={() => navigate("/students/new")}
            onEdit={setEditStudent}
            onDelete={setDeleteStudent}
            onBulkDelete={setBulkDeleteRows}
            canAdd={perm.create}
            canEdit={perm.edit}
            canDelete={perm.delete}
          />
        )}
      </div>
    </div>
  );
}

export default function Students() {
  return (
    <ToastProvider>
      <StudentsInner />
    </ToastProvider>
  );
}
