/**
 * StudentHeader — profile hero strip: avatar, name, status, allergy
 * banner, edit action, overflow menu. Extracted from the profile shell
 * so it's a standalone, reusable building block (Shared Components).
 */
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Pencil, EllipsisVertical, Phone, QrCode, Trash2, TriangleAlert } from "lucide-react";
import { Avatar, StatusBadge } from "../../../components/ui";
import { EmergencyCallModal, QRModal } from "../QuickModals";
import { get } from "../shared";
import useClickOutside from "../hooks/useClickOutside";

function OverflowMenu({ onCall, onQR, onDelete, canDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button onClick={() => setOpen(o => !o)} aria-label="More actions" aria-expanded={open} className="yd-close-btn" style={{ width: 32, height: 32 }}>
        <EllipsisVertical size={16} strokeWidth={2} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "110%", right: 0, zIndex: 20, minWidth: 180,
          background: "var(--yd-surface)", border: "1px solid var(--yd-border)",
          borderRadius: "var(--yd-radius-sm)", boxShadow: "var(--yd-elevation-medium)", padding: 4,
        }}>
          <button onClick={() => { setOpen(false); onCall(); }} className="yd-overflow-item">
            <Phone size={13} strokeWidth={2} /> Emergency Call
          </button>
          <button onClick={() => { setOpen(false); onQR(); }} className="yd-overflow-item">
            <QrCode size={13} strokeWidth={2} /> QR Code
          </button>
          {canDelete && (
            <button onClick={() => { setOpen(false); onDelete(); }} className="yd-overflow-item yd-overflow-item--danger">
              <Trash2 size={13} strokeWidth={2} /> Delete Student
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function StudentHeader({ student, onEdit, onDelete, canEdit = true, canDelete = true, onBack = null }) {
  const [showCallModal, setShowCallModal] = useState(false);
  const [showQRModal,   setShowQRModal  ] = useState(false);
  const [allergies,     setAllergies    ] = useState("");
  const status = student.Status || "Active";

  useEffect(() => {
    if (!student.Student_ID) return;
    get(`/api/student-medical/${encodeURIComponent(student.Student_ID)}`)
      .then(d => setAllergies(d.entry?.allergies || ""))
      .catch(() => {});
  }, [student.Student_ID]);

  return (
    <div style={{ background: "var(--yd-surface)", borderBottom: "1px solid var(--yd-border-light)", boxShadow: "var(--yd-elevation-small)", flexShrink: 0 }}>
      {showCallModal && <EmergencyCallModal student={student} onClose={() => setShowCallModal(false)} />}
      {showQRModal   && <QRModal student={student} onClose={() => setShowQRModal(false)} />}

      {onBack && (
        <div style={{ padding: "10px 16px 0" }}>
          <button onClick={onBack} className="yd-back-link">
            <ArrowLeft size={14} strokeWidth={2.5} /> Students
          </button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
        <Avatar name={student.Student_Name} photoUrl={student.Profile_Image} size={48} shape="square" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--yd-charcoal)" }}>{student.Student_Name}</h2>
            <StatusBadge status={status} />
          </div>
          <p style={{ fontSize: 11, color: "var(--yd-text-muted)", marginTop: 2 }}>
            {student.Class} · <span style={{ fontFamily: "monospace" }}>{student.Student_ID}</span>{student.Center && ` · ${student.Center}`}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {canEdit && (
            <button onClick={onEdit} className="btn btn-primary btn-sm" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Pencil size={12} strokeWidth={2.5} /> Edit
            </button>
          )}
          <OverflowMenu onCall={() => setShowCallModal(true)} onQR={() => setShowQRModal(true)} onDelete={onDelete} canDelete={canDelete} />
        </div>
      </div>

      {allergies && (
        <div style={{ margin: "0 16px 10px", display: "flex", alignItems: "center", gap: 8, background: "var(--yd-danger-soft)", border: "1px solid var(--yd-danger-border)", borderRadius: 8, padding: "6px 12px" }}>
          <TriangleAlert size={13} strokeWidth={2.5} color="var(--yd-danger)" />
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--yd-danger)" }}>Allergy: {allergies}</span>
        </div>
      )}
    </div>
  );
}
