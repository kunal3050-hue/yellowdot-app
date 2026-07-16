/**
 * DocumentsCard — same storage contract as the original (localStorage-
 * backed; no backend document API exists yet), now backed by the
 * shared useStudentDocuments hook. Drag-and-drop upload alongside the
 * existing click-to-upload. Shared component -- used by the profile
 * shell for both /students and /student-profile/:id.
 */
import { useState, useRef } from "react";
import { FileText, Upload, Trash2 } from "lucide-react";
import { Select, Button, EmptyState } from "../../../components/ui";
import useStudentDocuments from "../hooks/useStudentDocuments";

const DOC_TYPES = ["Birth Certificate", "Aadhaar Card", "Passport Photo", "Medical Record", "Transfer Certificate", "Other"];

export default function DocumentsCard({ student, toast }) {
  const { docs, uploading, upload, remove } = useStudentDocuments(student.Student_ID, toast);
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  function handleUpload(e) {
    upload(e.target.files?.[0], docType);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    upload(e.dataTransfer.files?.[0], docType);
  }

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <h3 style={{ fontSize: 13, fontWeight: 800, color: "var(--yd-charcoal)" }}>Documents</h3>

      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragOver ? "var(--yd-yellow)" : "var(--yd-border)"}`,
          borderRadius: "var(--yd-radius-card)", padding: 20, textAlign: "center",
          background: dragOver ? "var(--yd-yellow-pale)" : "var(--yd-soft)",
          transition: "border-color 0.15s ease, background 0.15s ease",
        }}
      >
        <Upload size={22} strokeWidth={1.5} color="var(--yd-text-muted)" style={{ marginBottom: 8 }} />
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--yd-text-soft)", marginBottom: 10 }}>
          Drag &amp; drop a file here, or choose a type and upload
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <div style={{ minWidth: 160 }}>
            <Select value={docType} onChange={e => setDocType(e.target.value)} options={DOC_TYPES} />
          </div>
          <Button size="sm" variant="primary" leftIcon={<Upload size={12} strokeWidth={2} />} loading={uploading} onClick={() => fileRef.current?.click()}>
            Upload
          </Button>
          <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx" style={{ display: "none" }} onChange={handleUpload} />
        </div>
      </div>

      {docs.length === 0 ? (
        <EmptyState size="sm" title="No documents uploaded" description="Upload birth certificates, medical records, and other files here." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
          {docs.map(doc => (
            <div key={doc.id} style={{ border: "1px solid var(--yd-border)", borderRadius: "var(--yd-radius-card)", overflow: "hidden", background: "var(--yd-surface)" }}>
              <div style={{ height: 100, background: "var(--yd-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {doc.dataUrl ? (
                  <a href={doc.dataUrl} target="_blank" rel="noreferrer">
                    <img src={doc.dataUrl} alt={doc.type} style={{ width: "100%", height: 100, objectFit: "cover" }} />
                  </a>
                ) : (
                  <FileText size={28} strokeWidth={1.5} color="var(--yd-text-muted)" />
                )}
              </div>
              <div style={{ padding: "10px 12px" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--yd-charcoal)" }}>{doc.type}</p>
                <p style={{ fontSize: 10, color: "var(--yd-text-muted)", marginTop: 2 }}>{doc.name}</p>
                <p style={{ fontSize: 10, color: "var(--yd-text-muted)" }}>{doc.size} · {doc.uploadedAt}</p>
                <Button size="xs" variant="ghost" leftIcon={<Trash2 size={11} strokeWidth={2} />} onClick={() => remove(doc.id)} style={{ marginTop: 6 }}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
