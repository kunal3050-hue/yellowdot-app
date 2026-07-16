/**
 * StudentOverview — hero card + at-a-glance KPIs + parent quick-contacts.
 * Detailed field-by-field data lives in PersonalInfo; this is the
 * "glance and go" landing view of the profile. Shared component --
 * used by the profile shell for both /students and /student-profile/:id.
 */
import { Phone } from "lucide-react";
import { Avatar, StatusBadge, Button, Card } from "../../../components/ui";
import { calcAge } from "../shared";

export default function StudentOverview({ student, onEdit, canEdit = true }) {
  const parents = [
    { role: "Father", name: student.Father_Name, phone: student.Father_WhatsApp },
    { role: "Mother", name: student.Mother_Name, phone: student.Mother_WhatsApp },
  ].filter(p => p.name);

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Avatar name={student.Student_Name} photoUrl={student.Profile_Image} size={64} shape="square" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--yd-charcoal)" }}>{student.Student_Name}</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--yd-text-muted)", fontFamily: "monospace" }}>{student.Student_ID}</span>
              <StatusBadge status={student.Status || "Active"} />
            </div>
            {canEdit && (
              <Button size="xs" variant="outline" onClick={onEdit} style={{ marginTop: 10 }}>
                Edit Profile
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
        {[
          { label: "Class", val: student.Class },
          { label: "Age", val: calcAge(student.DOB) },
          { label: "Center", val: student.Center },
          { label: "Joined", val: student.Admission_Date },
        ].map(({ label, val }) => (
          <Card key={label} padding="12px 14px">
            <p style={{ fontSize: 9, fontWeight: 800, color: "var(--yd-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--yd-charcoal)", marginTop: 3 }}>{val || "—"}</p>
          </Card>
        ))}
      </div>

      {parents.length > 0 && (
        <div>
          <h3 style={{ fontSize: 10, fontWeight: 800, color: "var(--yd-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Parent Contacts
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
            {parents.map(p => (
              <Card key={p.role} padding="12px 14px">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "var(--yd-charcoal)" }}>{p.name}</p>
                    <p style={{ fontSize: 10, color: "var(--yd-text-muted)" }}>{p.role}</p>
                    {p.phone && <p style={{ fontSize: 10, color: "var(--yd-text-soft)", fontFamily: "monospace" }}>{p.phone}</p>}
                  </div>
                  {p.phone && (
                    <Button as="a" href={`tel:${p.phone}`} size="xs" variant="outline" leftIcon={<Phone size={11} strokeWidth={2.5} />}>
                      Call
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
