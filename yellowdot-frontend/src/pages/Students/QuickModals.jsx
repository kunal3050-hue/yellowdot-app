/**
 * QuickModals.jsx — EmergencyCallModal + QRModal
 * Same data/behavior as the originals in Students.jsx, rebuilt on the
 * shared Modal primitive for visual consistency with the rest of the app.
 */
import { Phone, QrCode } from "lucide-react";
import { Modal } from "../../components/ui";

export function EmergencyCallModal({ student, onClose }) {
  const contacts = [
    { role: "Father", name: student.Father_Name, phone: student.Father_WhatsApp },
    { role: "Mother", name: student.Mother_Name, phone: student.Mother_WhatsApp },
  ].filter(c => c.phone);

  return (
    <Modal isOpen onClose={onClose} title="Emergency Contacts" size="default">
      <p style={{ fontSize: 12, color: "var(--yd-text-muted)", fontWeight: 600, marginBottom: 12 }}>{student.Student_Name}</p>
      {contacts.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--yd-text-muted)", textAlign: "center", padding: "16px 0" }}>No contact numbers saved.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {contacts.map(c => (
            <div key={c.role} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--yd-soft)", borderRadius: 12, padding: "12px 16px", border: "1px solid var(--yd-border-light)" }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--yd-charcoal)" }}>{c.name || c.role}</p>
                <p style={{ fontSize: 11, color: "var(--yd-text-muted)" }}>{c.role} · {c.phone}</p>
              </div>
              <a href={`tel:${c.phone}`} style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px",
                background: "var(--yd-yellow)", color: "var(--yd-charcoal)", borderRadius: 8,
                fontSize: 11, fontWeight: 700, textDecoration: "none",
              }}>
                <Phone size={12} strokeWidth={2.5} /> Call
              </a>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function QRModal({ student, onClose }) {
  const qrData = JSON.stringify({ id: student.Student_ID, name: student.Student_Name, class: student.Class });
  return (
    <Modal isOpen onClose={onClose} title="Student QR Code" size="default">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ background: "var(--yd-soft)", padding: 16, borderRadius: 12, border: "1px solid var(--yd-border)" }}>
          <div style={{ width: 144, height: 144, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "1px solid var(--yd-border)" }}>
            <div style={{ textAlign: "center", color: "var(--yd-text-muted)" }}>
              <QrCode size={40} strokeWidth={1.5} />
              <p style={{ fontSize: 10, marginTop: 4 }}>QR Display</p>
            </div>
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontWeight: 800, color: "var(--yd-charcoal)", fontSize: 13 }}>{student.Student_Name}</p>
          <p style={{ fontSize: 11, color: "var(--yd-text-muted)", fontFamily: "monospace", marginTop: 2 }}>{student.Student_ID} · {student.Class}</p>
        </div>
        <div style={{ background: "var(--yd-soft)", borderRadius: 10, padding: "8px 12px", width: "100%" }}>
          <p style={{ fontSize: 9, color: "var(--yd-text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>QR Data</p>
          <p style={{ fontSize: 10, fontFamily: "monospace", color: "var(--yd-text-soft)", wordBreak: "break-all" }}>{qrData}</p>
        </div>
      </div>
    </Modal>
  );
}
