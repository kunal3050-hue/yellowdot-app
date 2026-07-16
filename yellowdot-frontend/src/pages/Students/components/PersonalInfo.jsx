/**
 * PersonalInfo — full field-by-field detail, split out from Overview
 * so Overview stays a quick-glance hero and this stays the "all fields"
 * reference view (modern SaaS profile pattern: summary tab + detail tab).
 * Shared component -- used by the profile shell for both /students and
 * /student-profile/:id.
 */
import { Card } from "../../../components/ui";
import { calcAge } from "../shared";

export default function PersonalInfo({ student }) {
  const fields = [
    { label: "Full Name", val: student.Student_Name },
    { label: "Student ID", val: student.Student_ID },
    { label: "Class", val: student.Class },
    { label: "Gender", val: student.Gender },
    { label: "Date of Birth", val: student.DOB },
    { label: "Age", val: calcAge(student.DOB) },
    { label: "Admission Date", val: student.Admission_Date },
    { label: "Center", val: student.Center },
    { label: "Status", val: student.Status || "Active" },
  ];

  return (
    <div style={{ padding: 20 }}>
      <h3 style={{ fontSize: 13, fontWeight: 800, color: "var(--yd-charcoal)", marginBottom: 12 }}>Personal Information</h3>
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
          {fields.map(({ label, val }) => (
            <div key={label}>
              <p style={{ fontSize: 9, fontWeight: 800, color: "var(--yd-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--yd-charcoal)", marginTop: 3 }}>{val || "—"}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
