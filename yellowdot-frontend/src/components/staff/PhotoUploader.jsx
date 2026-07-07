/**
 * PhotoUploader.jsx — square-crop profile photo uploader for Staff
 * ──────────────────────────────────────────────────────────────────
 * Self-contained: no third-party crop library. Pure canvas + drag/zoom.
 *
 * Flow
 *   1. Click "Upload" → file picker
 *   2. Inline crop modal opens (square, pan + zoom)
 *   3. On Save → render to 512×512 JPEG, upload to Firebase Storage at
 *      staff-photos/{schoolId}/{staffId}/{timestamp}.jpg
 *   4. Call onChange({ url, path }) so the parent can persist photoUrl
 *      + photoStoragePath on the staff doc.
 *
 * Replace = same as Upload (overwrites photoUrl).
 * Remove  = best-effort delete + onChange({ url: "", path: "" }).
 */

import { useEffect, useRef, useState } from "react";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../../firebase/firebase";

const T = {
  surface:    "#FFFFFF",
  surfaceWarm:"#FDFAF5",
  border:     "rgba(0,0,0,0.08)",
  borderGold: "rgba(244,196,0,0.35)",
  text:       "#2A2A2A",
  textMuted:  "#8C8880",
  textSoft:   "#6A6560",
  gold:       "#F4C400",
  goldMid:    "#B45309",
  goldLight:  "rgba(244,196,0,0.10)",
  red:        "#DC2626",
};

const PREVIEW_SIZE = 280;
const OUTPUT_SIZE  = 512;

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

export default function PhotoUploader({
  schoolId,
  staffId,            // optional; required for actually uploading. If omitted, returns a data: URL.
  displayName,
  photoUrl,
  photoStoragePath,
  onChange,           // ({ url, path }) => void
  size = 96,
  disabled = false,
}) {
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState("");
  const [editing,  setEditing]  = useState(null); // { dataUrl, image, scale, offsetX, offsetY }
  const fileInputRef = useRef(null);

  function chooseFile() {
    setError("");
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setError("Image is larger than 6 MB.");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      const image   = await loadImage(dataUrl);
      // Initial scale so the smaller dimension fills the preview
      const baseScale = Math.max(PREVIEW_SIZE / image.width, PREVIEW_SIZE / image.height);
      setEditing({ dataUrl, image, scale: baseScale, offsetX: 0, offsetY: 0, baseScale });
    } catch (err) {
      setError(err.message || "Failed to read file.");
    }
  }

  async function saveCrop() {
    if (!editing) return;
    setBusy(true);
    setError("");
    try {
      // Render the cropped square to OUTPUT_SIZE
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      // Map preview-space crop → source-image pixels.
      // The image is drawn into PREVIEW_SIZE space with `scale` applied,
      // centred at (PREVIEW_SIZE/2 + offset). We invert that mapping.
      const { image, scale, offsetX, offsetY } = editing;
      const previewToImage = 1 / scale;
      // Top-left of the preview area in source-image coordinates:
      const srcX = (image.width  / 2) - (PREVIEW_SIZE / 2 + offsetX) * previewToImage;
      const srcY = (image.height / 2) - (PREVIEW_SIZE / 2 + offsetY) * previewToImage;
      const srcW = PREVIEW_SIZE * previewToImage;
      const srcH = PREVIEW_SIZE * previewToImage;

      ctx.drawImage(image, srcX, srcY, srcW, srcH, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      // → Blob
      const blob = await new Promise(resolve =>
        canvas.toBlob(b => resolve(b), "image/jpeg", 0.86),
      );

      if (!staffId) {
        // No staffId yet → just return the data URL so caller can hold it
        // until the staff doc is created, then upload.
        const dataUrl = canvas.toDataURL("image/jpeg", 0.86);
        onChange?.({ url: dataUrl, path: "", localBlob: blob });
        setEditing(null);
        return;
      }

      const path = `staff-photos/${schoolId || "default"}/${staffId}/${Date.now()}.jpg`;
      const sref = storageRef(storage, path);
      const snap = await uploadBytes(sref, blob, { contentType: "image/jpeg" });
      const url  = await getDownloadURL(snap.ref);

      // Best-effort cleanup of the previous photo
      if (photoStoragePath && photoStoragePath !== path) {
        try { await deleteObject(storageRef(storage, photoStoragePath)); } catch { /* ignore */ }
      }

      onChange?.({ url, path });
      setEditing(null);
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    if (disabled) return;
    if (!window.confirm("Remove this profile photo?")) return;
    setBusy(true);
    setError("");
    try {
      if (photoStoragePath) {
        try { await deleteObject(storageRef(storage, photoStoragePath)); } catch { /* ignore */ }
      }
      onChange?.({ url: "", path: "" });
    } catch (err) {
      setError(err.message || "Remove failed.");
    } finally {
      setBusy(false);
    }
  }

  const initial = (displayName || "?").charAt(0).toUpperCase();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{
        width: size, height: size, borderRadius: 14,
        background: T.goldLight,
        border: `1px solid ${T.borderGold}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: 28, color: T.goldMid,
        overflow: "hidden",
      }}>
        {photoUrl
          ? <img src={photoUrl} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : initial}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={chooseFile}
            disabled={busy || disabled}
            style={primaryBtn(busy || disabled)}
          >{photoUrl ? "Replace" : "Upload"} Photo</button>
          {photoUrl && (
            <button
              type="button"
              onClick={removePhoto}
              disabled={busy || disabled}
              style={ghostBtn(busy || disabled, T.red)}
            >Remove</button>
          )}
        </div>
        <div style={{ fontSize: 11, color: T.textMuted }}>
          JPG / PNG · square crop · max 6 MB
        </div>
        {error && <div style={{ fontSize: 12, color: T.red }}>{error}</div>}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelected}
        style={{ display: "none" }}
      />

      {editing && (
        <CropModal
          editing={editing}
          setEditing={setEditing}
          onCancel={() => setEditing(null)}
          onSave={saveCrop}
          busy={busy}
        />
      )}
    </div>
  );
}

// ── Crop modal (drag + zoom) ───────────────────────────────────────

function CropModal({ editing, setEditing, onCancel, onSave, busy }) {
  const dragging = useRef(null); // { startX, startY, offsetX, offsetY }

  function onPointerDown(e) {
    e.preventDefault();
    dragging.current = {
      startX:  e.clientX,
      startY:  e.clientY,
      offsetX: editing.offsetX,
      offsetY: editing.offsetY,
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup",   onPointerUp);
  }
  function onPointerMove(e) {
    if (!dragging.current) return;
    const dx = e.clientX - dragging.current.startX;
    const dy = e.clientY - dragging.current.startY;
    setEditing(prev => ({
      ...prev,
      offsetX: dragging.current.offsetX + dx,
      offsetY: dragging.current.offsetY + dy,
    }));
  }
  function onPointerUp() {
    dragging.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup",   onPointerUp);
  }
  useEffect(() => () => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup",   onPointerUp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { image, scale, offsetX, offsetY, baseScale } = editing;

  return (
    <div onClick={onCancel} style={{
      position: "fixed", inset: 0,
      background: "rgba(20,18,12,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 300,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 16, padding: 22, width: "min(380px, calc(100vw - 32px))",
        boxShadow: "0 24px 80px rgba(0,0,0,0.20)",
      }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.text }}>Crop Photo</h3>
        <div style={{ fontSize: 12, color: T.textSoft, marginTop: 4 }}>
          Drag to reposition · use slider to zoom.
        </div>

        <div
          onPointerDown={onPointerDown}
          style={{
            position: "relative",
            width: PREVIEW_SIZE, height: PREVIEW_SIZE,
            margin: "16px auto",
            borderRadius: "50%",
            overflow: "hidden",
            background: "#000",
            cursor: dragging.current ? "grabbing" : "grab",
            touchAction: "none",
            userSelect: "none",
            border: `2px solid ${T.borderGold}`,
          }}
        >
          <img
            src={editing.dataUrl}
            alt="crop preview"
            draggable={false}
            style={{
              position: "absolute",
              top: "50%", left: "50%",
              width:  image.width  * scale,
              height: image.height * scale,
              transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`,
              pointerEvents: "none",
            }}
          />
        </div>

        <input
          type="range"
          min={baseScale}
          max={baseScale * 4}
          step={0.01}
          value={scale}
          onChange={(e) => setEditing(p => ({ ...p, scale: parseFloat(e.target.value) }))}
          style={{ width: "100%", accentColor: T.gold }}
        />

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          <button onClick={onCancel} disabled={busy} style={ghostBtn(busy)}>Cancel</button>
          <button onClick={onSave} disabled={busy} style={primaryBtn(busy)}>
            {busy ? "Saving…" : "Save Photo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Buttons ────────────────────────────────────────────────────────

function primaryBtn(disabled) {
  return {
    background: T.gold, color: "#1E1E1E",
    border: "none", borderRadius: 10,
    padding: "8px 16px", fontWeight: 700, fontSize: 13,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity:  disabled ? 0.5 : 1,
  };
}
function ghostBtn(disabled, color = T.text) {
  return {
    background: T.surface, color,
    border: `1px solid ${color === T.text ? T.border : `${color}55`}`,
    borderRadius: 10,
    padding: "8px 14px", fontWeight: 600, fontSize: 13,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity:  disabled ? 0.5 : 1,
  };
}
