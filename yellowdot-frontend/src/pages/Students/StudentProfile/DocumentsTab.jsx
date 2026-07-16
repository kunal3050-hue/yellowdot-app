/**
 * DocumentsTab — same storage contract as the original (localStorage-backed
 * per-student doc list; there is no backend document API yet — preserved
 * exactly, not fabricated), rebuilt as modern document cards with a
 * drag-and-drop upload zone added alongside the existing click-to-upload.
 */
import { useState, useRef, useCallback } from "react";
import { FileText, Upload, Trash2 } from "lucide-react";
import { Select, Button, EmptyState } from "../../../components/ui";
import { compressImage } from "../shared";

const DOC_TYPES = ["Birth Certificate", "Aadhaar Card", "Passport Photo", "Medical Record", "Transfer Certificate", "Other"];

export default function DocumentsTab({ student, toast }) {
  const [docs,       setDocs      ] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`yd_docs_${student.Student_ID}`) || "[]"); } catch { return []; }
  });
  const [docType,    setDocType   ] = useState(DOC_TYPES[0]);
  const [loading,    setLoading   ] = useState(false);
  const [dragOver,   setDragOver  ] = useState(false);
  const fileRef = useRef(null);

  async function uploadFile(file) {
    if (!file) return;
    setLoading(true);
    try {
      const dataUrl = file.type.startsWith("image/") ? await compressImage(file, 400, 400, 0.8) : "";
      const doc = { id: `doc-${Date.now()}`, type: docType, name: file.name, size: `${(file.size / 1024).toFixed(1)} KB`, mimeType: file.type, dataUrl, uploadedAt: new Date().toLocaleDateString("en-IN") };
      const updated = [doc, ...docs];
      setDocs(updated);
      localStorage.setItem(`yd_docs_${student.Student_ID}`, JSON.stringify(updated));
      toast.success(`${docType} uploaded.`);
    } catch { toast.error("Upload failed."); }
    finally { setLoading(false); }
  }

  function handleUpload(e) {
    uploadFile(e.target.files?.[0]);
    if (fileRef.current) fileRef.current.value = "";
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    uploadFile(e.dataTransfer.files?.[0]);
  }, [docType, docs]); // eslint-disable-line

  function remove(id) {
    const updated = docs.filter(d => d.id !== id);
    setDocs(updated);
    localStorage.setItem(`yd_docs_${student.Student_ID}`, JSON.stringify(updated));
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
          borderRadius: "var(--yd-radius-card)",
          padding: 20,
          textAlign: "center",
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
          <Button size="sm" variant="primary" leftIcon={<Upload size={12} strokeWidth={2} />} loading={loading} onClick={() => fileRef.current?.click()}>
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
