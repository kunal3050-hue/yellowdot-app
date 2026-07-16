/**
 * StudentProfile/index.jsx — profile shell (single canonical implementation)
 * ─────────────────────────────────────────────────────────────────
 * Modern SaaS profile pattern: sticky header + horizontal tab bar +
 * scrollable tab content, not a long scrolling form. Used by both
 * /students (Students/index.jsx) and /student-profile/:id
 * (src/pages/StudentProfile.jsx) -- there is only one profile shell
 * and one set of tab components (../components/) in the app.
 * ─────────────────────────────────────────────────────────────────
 */
import { useState } from "react";
import {
  User, IdCard, Users, CalendarCheck, Car, Receipt, HeartPulse, FileText,
  Activity, StickyNote, Utensils, Moon,
} from "lucide-react";
import StudentHeader from "../components/StudentHeader";
import StudentOverview from "../components/StudentOverview";
import PersonalInfo from "../components/PersonalInfo";
import ParentCard from "../components/ParentCard";
import AttendanceCard from "../components/AttendanceCard";
import PickupCard from "../components/PickupCard";
import FeesCard from "../components/FeesCard";
import MedicalCard from "../components/MedicalCard";
import DocumentsCard from "../components/DocumentsCard";
import JourneyTimeline from "../components/JourneyTimeline";
import StudentNotes from "../components/StudentNotes";
import FoodCard from "../components/FoodCard";
import NapCard from "../components/NapCard";

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

export default function StudentProfile({ studentId, students, onEdit, onDelete, onRefresh, toast, canEdit = true, canDelete = true, onBack = null }) {
  const student = students.find(s => (s.Student_ID || s.id) === studentId);
  const [activeTab, setActiveTab] = useState("overview");

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

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
      <StudentHeader student={student} onEdit={onEdit} onDelete={onDelete} canEdit={canEdit} canDelete={canDelete} onBack={onBack} />

      {/* Tab bar */}
      <div style={{ display: "flex", overflowX: "auto", borderTop: "1px solid var(--yd-border-light)", background: "var(--yd-surface)", flexShrink: 0 }} className="scrollbar-none">
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

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, background: "var(--yd-bg-sunken)" }}>
        {activeTab === "overview"   && <StudentOverview student={student} onEdit={onEdit} canEdit={canEdit} />}
        {activeTab === "personal"   && <PersonalInfo    student={student} />}
        {activeTab === "parents"    && <ParentCard      student={student} onSaved={onRefresh} toast={toast} />}
        {activeTab === "attendance" && <AttendanceCard  student={student} />}
        {activeTab === "pickup"     && <PickupCard      student={student} toast={toast} />}
        {activeTab === "fees"       && <FeesCard        student={student} />}
        {activeTab === "medical"    && <MedicalCard     student={student} toast={toast} />}
        {activeTab === "documents"  && <DocumentsCard   student={student} toast={toast} />}
        {activeTab === "journey"    && <JourneyTimeline student={student} />}
        {activeTab === "notes"      && <StudentNotes    student={student} toast={toast} />}
        {activeTab === "food"       && <FoodCard        student={student} />}
        {activeTab === "naps"       && <NapCard         student={student} />}
      </div>
    </div>
  );
}
