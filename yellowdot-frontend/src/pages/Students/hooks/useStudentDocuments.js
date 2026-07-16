/**
 * useStudentDocuments — localStorage-backed per-student doc list. There is
 * no backend document API yet (confirmed during the Phase 2.2 audit) --
 * same storage contract as the original inline DocumentsTab logic.
 */
import { useState } from "react";
import { compressImage } from "../shared";

export default function useStudentDocuments(studentId, toast) {
  const key = `yd_docs_${studentId}`;
  const [docs, setDocs] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
  });
  const [uploading, setUploading] = useState(false);

  async function upload(file, docType) {
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = file.type.startsWith("image/") ? await compressImage(file, 400, 400, 0.8) : "";
      const doc = { id: `doc-${Date.now()}`, type: docType, name: file.name, size: `${(file.size / 1024).toFixed(1)} KB`, mimeType: file.type, dataUrl, uploadedAt: new Date().toLocaleDateString("en-IN") };
      const updated = [doc, ...docs];
      setDocs(updated);
      localStorage.setItem(key, JSON.stringify(updated));
      toast?.success(`${docType} uploaded.`);
    } catch { toast?.error("Upload failed."); }
    finally { setUploading(false); }
  }

  function remove(id) {
    const updated = docs.filter(d => d.id !== id);
    setDocs(updated);
    localStorage.setItem(key, JSON.stringify(updated));
  }

  return { docs, uploading, upload, remove };
}
