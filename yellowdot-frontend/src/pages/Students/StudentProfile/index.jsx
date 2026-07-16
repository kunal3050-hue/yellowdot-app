/**
 * StudentProfile/index.jsx — profile shell
 * ─────────────────────────────────────────────────────────────────
 * Modern SaaS profile pattern: sticky header + horizontal tab bar +
 * scrollable tab content, not a long scrolling form. Secondary actions
 * (Call, QR, Delete) live in a single overflow menu; Edit stays the one
 * always-visible primary action, per the "reduce clicks" UX goal.
 * ─────────────────────────────────────────────────────────────────
 */
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, Pencil, EllipsisVertical, Phone, QrCode, Trash2, TriangleAlert,
  User, IdCard, Users, CalendarCheck, Car, Receipt, HeartPulse, FileText,
  Activity, StickyNote, Utensils, Moon,
} from "lucide-react";
import { Avatar, StatusBadge } from "../../../components/ui";
import { EmergencyCallModal, QRModal } from "../QuickModals";
import { get } from "../shared";
import useClickOutside from "./useClickOutside";

import OverviewTab from "./OverviewTab";
import PersonalInfoTab from "./PersonalInfoTab";
import ParentsTab from "./ParentsTab";
import AttendanceTab from "./AttendanceTab";
import PickupTab from "./PickupTab";
import FeesTab from "./FeesTab";
import MedicalTab from "./MedicalTab";
import DocumentsTab from "./DocumentsTab";
import JourneyTab from "./JourneyTab";
import NotesTab from "./NotesTab";
import FoodTab from "./FoodTab";
import NapTab from "./NapTab";

const TABS = [
  { id: "overview",   label: "Overview",  icon: User },
  { id: "personal",   label: "Personal",  icon: IdCard },
  { id: "parents",    label: "Parents",   icon: Users },
  { id: "attendance", label: "Attendance",icon: CalendarCheck },
  { id: "pickup",     label: "Pickup",    icon: Car },
  { id: "fees",       label: "Fees",      icon: Receipt },
  { id: "medical",    label: "Medical",   icon: HeartPulse },
  { id: "documents",  label: "Documents", icon: FileText },
  { id: "journey",    label: "Journey",   icon: Activity },
  { id: "notes",      label: "Notes",     icon: StickyNote },
  { id: "food",       label: "Food",      icon: Utensils },
  { id: "naps",       label: "Naps",      icon: Moon },
];

function OverflowMenu({ onCall, onQR, onDelete, canDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="More actions"
        aria-expanded={open}
        className="yd-close-btn"
        style={{ width: 32, height: 32 }}
      >
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

export default function StudentProfile({ studentId, students, onEdit, onDelete, onRefresh, toast, canEdit = true, canDelete = true, onBack = null }) {
  const student = students.find(s => (s.Student_ID || s.id) === studentId);
  const [activeTab, setActiveTab] = useState("overview");
  const [showCallModal, setShowCallModal] = useState(false);
  const [showQRModal,   setShowQRModal  ] = useState(false);
  const [allergies,     setAllergies    ] = useState("");

  useEffect(() => { setActiveTab("overview"); }, [studentId]);

  useEffect(() => {
    if (!studentId) return;
    get(`/api/student-medical/${encodeURIComponent(studentId)}`)
      .then(d => setAllergies(d.entry?.allergies || ""))
      .catch(() => {});
  }, [studentId]);

  if (!student) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--yd-bg-sunken)" }}>
        <div style={{ textAlign: "center" }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--yd-text-soft)", marginBottom: 4 }}>Select a Student</h3>
          <p style={{ fontSize: 12, color: "var(--yd-text-muted)", maxWidth: 260 }}>Choose a student from the list to view their full profile.</p>
        </div>
      </div>
    );
  }

  const status = student.Status || "Active";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
      {showCallModal && <EmergencyCallModal student={student} onClose={() => setShowCallModal(false)} />}
      {showQRModal   && <QRModal student={student} onClose={() => setShowQRModal(false)} />}

      {/* Sticky header */}
      <div style={{ background: "var(--yd-surface)", borderBottom: "1px solid var(--yd-border-light)", boxShadow: "var(--yd-elevation-small)", flexShrink: 0 }}>
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
            <OverflowMenu
              onCall={() => setShowCallModal(true)}
              onQR={() => setShowQRModal(true)}
              onDelete={onDelete}
              canDelete={canDelete}
            />
          </div>
        </div>

        {allergies && (
          <div style={{ margin: "0 16px 10px", display: "flex", alignItems: "center", gap: 8, background: "var(--yd-danger-soft)", border: "1px solid var(--yd-danger-border)", borderRadius: 8, padding: "6px 12px" }}>
            <TriangleAlert size={13} strokeWidth={2.5} color="var(--yd-danger)" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--yd-danger)" }}>Allergy: {allergies}</span>
          </div>
        )}

        {/* Tab bar */}
        <div style={{ display: "flex", overflowX: "auto", borderTop: "1px solid var(--yd-border-light)" }} className="scrollbar-none">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-current={active ? "page" : undefined}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "10px 14px",
                  fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0,
                  borderBottom: `2px solid ${active ? "var(--yd-yellow)" : "transparent"}`,
                  color: active ? "var(--yd-charcoal)" : "var(--yd-text-muted)",
                  background: active ? "var(--yd-yellow-pale)" : "transparent",
                  transition: "color 0.14s ease, background 0.14s ease",
                }}
              >
                <Icon size={13} strokeWidth={2} /> {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, background: "var(--yd-bg-sunken)" }}>
        {activeTab === "overview"   && <OverviewTab      student={student} onEdit={onEdit} canEdit={canEdit} />}
        {activeTab === "personal"   && <PersonalInfoTab  student={student} />}
        {activeTab === "parents"    && <ParentsTab       student={student} onSaved={onRefresh} toast={toast} />}
        {activeTab === "attendance" && <AttendanceTab    student={student} />}
        {activeTab === "pickup"     && <PickupTab        student={student} toast={toast} />}
        {activeTab === "fees"       && <FeesTab          student={student} />}
        {activeTab === "medical"    && <MedicalTab       student={student} toast={toast} />}
        {activeTab === "documents"  && <DocumentsTab     student={student} toast={toast} />}
        {activeTab === "journey"    && <JourneyTab       student={student} />}
        {activeTab === "notes"      && <NotesTab         student={student} toast={toast} />}
        {activeTab === "food"       && <FoodTab          student={student} />}
        {activeTab === "naps"       && <NapTab           student={student} />}
      </div>
    </div>
  );
}
