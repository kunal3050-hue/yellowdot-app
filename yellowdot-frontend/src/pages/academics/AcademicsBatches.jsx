import { useState, useMemo, useCallback } from "react";

// ── Reference data (mirrors Phase 1 seed classes) ─────────────────────────────
const CLASS_OPTIONS = [
  { id: "1", name: "Playgroup",   code: "PG001" },
  { id: "2", name: "Nursery",     code: "NR001" },
  { id: "3", name: "Junior KG",   code: "JKG01" },
  { id: "4", name: "Senior KG",   code: "SKG01" },
  { id: "5", name: "Daycare",     code: "DC001" },
  { id: "6", name: "Abacus",      code: "AB001" },
  { id: "7", name: "Handwriting", code: "HW001" },
];

const CLASSROOM_OPTIONS = [
  "Room A", "Room B", "Room C", "Room D", "Room E",
  "Room F", "Room G", "Room H", "Hall 1", "Hall 2", "Online",
];

// ── Seed data ─────────────────────────────────────────────────────────────────
const SEED_BATCHES = [
  {
    id: "1", code: "PGB-AM", name: "Morning Batch",
    classId: "1", className: "Playgroup", classCode: "PG001",
    startTime: "09:00", endTime: "12:00",
    capacity: 12, enrolled: 9,
    classroom: "Room A",
    description: "Morning session for Playgroup students with focused play-based learning.",
    status: "Active",
  },
  {
    id: "2", code: "PGB-PM", name: "Afternoon Batch",
    classId: "1", className: "Playgroup", classCode: "PG001",
    startTime: "13:00", endTime: "16:00",
    capacity: 12, enrolled: 9,
    classroom: "Room B",
    description: "Afternoon session for Playgroup students.",
    status: "Active",
  },
  {
    id: "3", code: "NRB-AM", name: "Morning Batch",
    classId: "2", className: "Nursery", classCode: "NR001",
    startTime: "09:00", endTime: "12:00",
    capacity: 15, enrolled: 12,
    classroom: "Room C",
    description: "Morning nursery session focused on early literacy and numeracy.",
    status: "Active",
  },
  {
    id: "4", code: "NRB-PM", name: "Afternoon Batch",
    classId: "2", className: "Nursery", classCode: "NR001",
    startTime: "13:00", endTime: "16:00",
    capacity: 15, enrolled: 10,
    classroom: "Room D",
    description: "Afternoon nursery session.",
    status: "Active",
  },
  {
    id: "5", code: "JKB-AM", name: "Morning Batch",
    classId: "3", className: "Junior KG", classCode: "JKG01",
    startTime: "09:00", endTime: "12:00",
    capacity: 20, enrolled: 15,
    classroom: "Room E",
    description: "Morning Junior KG session with structured curriculum activities.",
    status: "Active",
  },
  {
    id: "6", code: "SKB-AM", name: "Morning Batch",
    classId: "4", className: "Senior KG", classCode: "SKG01",
    startTime: "09:00", endTime: "12:00",
    capacity: 20, enrolled: 14,
    classroom: "Room F",
    description: "Morning Senior KG session preparing students for primary school.",
    status: "Active",
  },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt12(time24) {
  if (!time24) return "—";
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12  = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function occupancyColor(pct) {
  if (pct >= 90) return "#EF4444";
  if (pct >= 70) return "#F59E0B";
  return "#10B981";
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((type, msg) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, type, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3800);
  }, []);
  return {
    toasts,
    success: useCallback(m => add("success", m), [add]),
    error:   useCallback(m => add("error",   m), [add]),
    dismiss: useCallback(id => setToasts(t => t.filter(x => x.id !== id)), []),
  };
}
function Toasts({ toasts, dismiss }) {
  if (!toasts.length) return null;
  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 999, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
      {toasts.map(t => (
        <div key={t.id}
          className={`yd-toast ${t.type === "success" ? "yd-toast-success" : "yd-toast-error"}`}
          style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 10, minWidth: 260 }}>
          <span>{t.type === "success" ? "✓" : "✕"}</span>
          <span style={{ flex: 1, fontSize: 13 }}>{t.msg}</span>
          <button onClick={() => dismiss(t.id)}
            style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 4, width: 20, height: 20, cursor: "pointer", color: "inherit", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Stat tile ─────────────────────────────────────────────────────────────────
function StatTile({ label, value, desc, accent, icon }) {
  return (
    <div className="yd-card" style={{ padding: "18px 20px", borderLeft: `4px solid ${accent}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "#A8A29E" }}>{label}</span>
        <span style={{ fontSize: 18, opacity: 0.5 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: "#1C1917", lineHeight: 1, marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#A8A29E" }}>{desc}</div>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  return <span className={`badge ${status === "Active" ? "badge-success" : "badge-neutral"}`}>{status}</span>;
}

// ── Sort icon ─────────────────────────────────────────────────────────────────
function SortIcon({ active, dir }) {
  if (!active) return <span style={{ opacity: 0.25, fontSize: 9, marginLeft: 3 }}>⇅</span>;
  return <span style={{ fontSize: 9, color: "#D97706", marginLeft: 3 }}>{dir === "asc" ? "↑" : "↓"}</span>;
}

// ── Capacity bar ──────────────────────────────────────────────────────────────
function CapacityBar({ enrolled, capacity, showLabel = false }) {
  const pct = capacity > 0 ? Math.round((enrolled / capacity) * 100) : 0;
  const color = occupancyColor(pct);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: showLabel ? 4 : 0 }}>
        <div style={{ flex: 1, height: 5, background: "#F0EDE8", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.3s" }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 30, textAlign: "right" }}>{pct}%</span>
      </div>
      {showLabel && (
        <div style={{ fontSize: 11, color: "#A8A29E" }}>{enrolled} enrolled · {Math.max(0, capacity - enrolled)} available</div>
      )}
    </div>
  );
}

// ── Form field ────────────────────────────────────────────────────────────────
function FormField({ label, error, children, hint }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#A8A29E", marginBottom: 5 }}>
        {label}
      </label>
      {children}
      {hint  && <p style={{ fontSize: 11, color: "#A8A29E", marginTop: 4 }}>{hint}</p>}
      {error && <p style={{ fontSize: 11, color: "#EF4444", marginTop: 4 }}>{error}</p>}
    </div>
  );
}

// ── Confirm dialog ────────────────────────────────────────────────────────────
function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div className="yd-overlay">
      <div className="yd-modal" style={{ maxWidth: 400 }}>
        <div className="yd-modal-header">
          <h2>{title}</h2>
          <button onClick={onCancel} className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }}>✕</button>
        </div>
        <div className="yd-modal-body">
          <p style={{ fontSize: 14, color: "#57534E", lineHeight: 1.6, margin: 0 }}>{message}</p>
        </div>
        <div className="yd-modal-footer">
          <button onClick={onCancel} className="btn btn-ghost btn-sm">Cancel</button>
          <button onClick={onConfirm} className="btn btn-danger btn-sm">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Detail info row ───────────────────────────────────────────────────────────
function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "9px 0", borderBottom: "1px solid #F5F3EF" }}>
      <span style={{ fontSize: 12, color: "#A8A29E", fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: "#1C1917", fontWeight: 600, textAlign: "right" }}>{value || "—"}</span>
    </div>
  );
}

// ── Batch Drawer (view + edit/add) ────────────────────────────────────────────
function BatchDrawer({ batch, mode, existingCodes, onSave, onClose, onEdit }) {
  const isView = mode === "view";
  const isEdit = mode === "edit";
  const isAdd  = mode === "add";

  const [form, setForm] = useState({
    code:        batch?.code        || "",
    name:        batch?.name        || "",
    classId:     batch?.classId     || "",
    startTime:   batch?.startTime   || "09:00",
    endTime:     batch?.endTime     || "12:00",
    capacity:    batch?.capacity    || 20,
    classroom:   batch?.classroom   || "",
    description: batch?.description || "",
    status:      batch?.status      || "Active",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: "" })); };

  const selectedClass = CLASS_OPTIONS.find(c => c.id === form.classId);
  const availableSeats = Math.max(0, (batch?.capacity || 0) - (batch?.enrolled || 0));
  const occupancyPct   = batch?.capacity > 0 ? Math.round((batch.enrolled / batch.capacity) * 100) : 0;

  function validate() {
    const e = {};
    const code = form.code.trim().toUpperCase();
    if (!code)                                         e.code      = "Batch code is required.";
    else if (!/^[A-Z0-9]{2,10}(-[A-Z0-9]{1,6})?$/.test(code))
                                                        e.code      = "2–10 chars, uppercase letters, digits or hyphens.";
    else if (isAdd && existingCodes.includes(code))    e.code      = "This code already exists.";
    if (!form.name.trim())                             e.name      = "Batch name is required.";
    if (!form.classId)                                 e.classId   = "Please select a class.";
    if (!form.startTime)                               e.startTime = "Start time is required.";
    if (!form.endTime)                                 e.endTime   = "End time is required.";
    else if (form.startTime && form.endTime >= "00:00" && form.endTime <= form.startTime)
                                                        e.endTime   = "End time must be after start time.";
    const cap = Number(form.capacity);
    if (!cap || cap < 1)                               e.capacity  = "Capacity must be at least 1.";
    else if (isEdit && batch?.enrolled && cap < batch.enrolled)
                                                        e.capacity  = `Cannot be less than ${batch.enrolled} enrolled students.`;
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 280));
    const cls = CLASS_OPTIONS.find(c => c.id === form.classId);
    onSave({
      ...batch,
      ...form,
      code:      form.code.trim().toUpperCase(),
      name:      form.name.trim(),
      className: cls?.name || "",
      classCode: cls?.code || "",
      capacity:  Number(form.capacity),
      enrolled:  batch?.enrolled || 0,
    });
  }

  return (
    <>
      <div className="yd-drawer-overlay" onClick={onClose} />
      <div className="yd-drawer" style={{ width: "min(500px, 96vw)" }}>

        {/* ── Header ── */}
        <div className="yd-drawer-header">
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1C1917" }}>
              {isAdd  ? "Add Batch" :
               isEdit ? "Edit Batch" :
               batch?.name}
            </h2>
            <p style={{ fontSize: 11, color: "#A8A29E", marginTop: 2 }}>
              {isAdd  ? "Create a new batch for an existing class" :
               isEdit ? `${batch?.code} — ${batch?.className}` :
               `${batch?.code} · ${batch?.className}`}
            </p>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {isView && (
              <button onClick={onEdit} className="btn btn-primary btn-sm">Edit</button>
            )}
            <button onClick={onClose} className="btn btn-ghost btn-icon" style={{ width: 30, height: 30 }}>✕</button>
          </div>
        </div>

        {/* ── View Mode ── */}
        {isView && (
          <div className="yd-drawer-body" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Status + class chip */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <StatusBadge status={batch.status} />
              <span style={{ fontSize: 12, background: "#F5F3EF", color: "#57534E", borderRadius: 6, padding: "3px 9px", fontWeight: 600 }}>
                {batch.className}
              </span>
            </div>

            {/* Batch info */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "#A8A29E", marginBottom: 6 }}>
                Batch Information
              </div>
              <div className="yd-card" style={{ padding: "4px 16px" }}>
                <InfoRow label="Batch Code"   value={
                  <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, background: "#FEF9C3", color: "#92400E", borderRadius: 5, padding: "2px 7px" }}>
                    {batch.code}
                  </span>
                } />
                <InfoRow label="Batch Name"   value={batch.name} />
                <InfoRow label="Linked Class" value={`${batch.className} (${batch.classCode})`} />
                <InfoRow label="Classroom"    value={batch.classroom || "Not assigned"} />
              </div>
            </div>

            {/* Timings */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "#A8A29E", marginBottom: 6 }}>
                Timings
              </div>
              <div className="yd-card" style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#1C1917" }}>{fmt12(batch.startTime)}</div>
                    <div style={{ fontSize: 10, color: "#A8A29E", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Start</div>
                  </div>
                  <div style={{ flex: 1, height: 2, background: "#F0EDE8", borderRadius: 1, position: "relative" }}>
                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "#F5F3EF", padding: "2px 8px", borderRadius: 10, fontSize: 10, color: "#A8A29E", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {(() => {
                        const [sh, sm] = batch.startTime.split(":").map(Number);
                        const [eh, em] = batch.endTime.split(":").map(Number);
                        const mins = (eh * 60 + em) - (sh * 60 + sm);
                        return mins >= 60 ? `${Math.floor(mins/60)}h ${mins%60 ? `${mins%60}m` : ""}`.trim() : `${mins}m`;
                      })()}
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#1C1917" }}>{fmt12(batch.endTime)}</div>
                    <div style={{ fontSize: 10, color: "#A8A29E", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>End</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Enrollment summary */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "#A8A29E", marginBottom: 6 }}>
                Enrollment Summary
              </div>
              <div className="yd-card" style={{ padding: "16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                  {[
                    { label: "Capacity",   value: batch.capacity,                      color: "#1C1917" },
                    { label: "Enrolled",   value: batch.enrolled,                      color: "#3B82F6" },
                    { label: "Available",  value: availableSeats,                      color: availableSeats === 0 ? "#EF4444" : "#10B981" },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: "#A8A29E", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <CapacityBar enrolled={batch.enrolled} capacity={batch.capacity} showLabel />
              </div>
            </div>

            {batch.description && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "#A8A29E", marginBottom: 6 }}>
                  Description
                </div>
                <p style={{ fontSize: 13, color: "#57534E", lineHeight: 1.65, background: "#FAFAF8", borderRadius: 10, padding: "12px 14px", border: "1px solid #F0EDE8", margin: 0 }}>
                  {batch.description}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Add / Edit Mode ── */}
        {!isView && (
          <>
            <div className="yd-drawer-body">
              <form id="batch-form" onSubmit={handleSubmit}>
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

                  {/* Code + Name */}
                  <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 12 }}>
                    <FormField label="Batch Code *" error={errors.code}>
                      <input
                        className={`yd-input${errors.code ? " error" : ""}`}
                        value={form.code}
                        onChange={e => set("code", e.target.value.toUpperCase())}
                        placeholder="PGB-AM"
                        maxLength={12}
                        disabled={isEdit}
                        style={isEdit ? { opacity: 0.6, cursor: "not-allowed" } : {}}
                      />
                    </FormField>
                    <FormField label="Batch Name *" error={errors.name}>
                      <input
                        className={`yd-input${errors.name ? " error" : ""}`}
                        value={form.name}
                        onChange={e => set("name", e.target.value)}
                        placeholder="e.g. Morning Batch"
                      />
                    </FormField>
                  </div>

                  {/* Linked Class */}
                  <FormField label="Linked Class *" error={errors.classId}>
                    <select
                      className={`yd-input${errors.classId ? " error" : ""}`}
                      value={form.classId}
                      onChange={e => set("classId", e.target.value)}
                    >
                      <option value="">Select class…</option>
                      {CLASS_OPTIONS.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                      ))}
                    </select>
                  </FormField>

                  {/* Start + End Time */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <FormField label="Start Time *" error={errors.startTime}>
                      <input
                        type="time"
                        className={`yd-input${errors.startTime ? " error" : ""}`}
                        value={form.startTime}
                        onChange={e => set("startTime", e.target.value)}
                      />
                    </FormField>
                    <FormField label="End Time *" error={errors.endTime}>
                      <input
                        type="time"
                        className={`yd-input${errors.endTime ? " error" : ""}`}
                        value={form.endTime}
                        onChange={e => set("endTime", e.target.value)}
                      />
                    </FormField>
                  </div>

                  {/* Capacity + Classroom */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <FormField
                      label="Capacity *"
                      error={errors.capacity}
                      hint={isEdit && batch?.enrolled ? `${batch.enrolled} students currently enrolled` : undefined}
                    >
                      <input
                        type="number"
                        className={`yd-input${errors.capacity ? " error" : ""}`}
                        value={form.capacity}
                        onChange={e => set("capacity", e.target.value)}
                        min={isEdit && batch?.enrolled ? batch.enrolled : 1}
                        max={200}
                        placeholder="20"
                      />
                    </FormField>
                    <FormField label="Classroom">
                      <select
                        className="yd-input"
                        value={form.classroom}
                        onChange={e => set("classroom", e.target.value)}
                      >
                        <option value="">Not assigned</option>
                        {CLASSROOM_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </FormField>
                  </div>

                  {/* Description */}
                  <FormField label="Description">
                    <textarea
                      className="yd-input"
                      value={form.description}
                      onChange={e => set("description", e.target.value)}
                      placeholder="Brief description of this batch…"
                      rows={3}
                      style={{ resize: "vertical", minHeight: 72 }}
                    />
                  </FormField>

                  {/* Status */}
                  <FormField label="Status">
                    <div style={{ display: "flex", gap: 16, paddingTop: 2 }}>
                      {["Active", "Inactive"].map(s => (
                        <label key={s} style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: 13, color: "#57534E" }}>
                          <input type="radio" name="batch-status" value={s}
                            checked={form.status === s}
                            onChange={() => set("status", s)}
                            style={{ accentColor: "#F5C518" }} />
                          <span style={{ fontWeight: form.status === s ? 700 : 400 }}>{s}</span>
                        </label>
                      ))}
                    </div>
                  </FormField>

                </div>
              </form>
            </div>

            <div className="yd-drawer-footer">
              <button onClick={onClose} className="btn btn-ghost btn-sm" type="button">Cancel</button>
              <button form="batch-form" type="submit" className="btn btn-primary btn-sm" disabled={saving}
                style={{ minWidth: 110, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {saving && <span className="yd-spinner yd-spinner-sm" />}
                {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Batch"}
              </button>
            </div>
          </>
        )}

      </div>
    </>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ isFiltered, onAdd }) {
  return (
    <tr>
      <td colSpan={10}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 24px", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "#F5F3EF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <svg viewBox="0 0 24 24" width={26} height={26} fill="none" stroke="#A8A29E" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"/>
              <polyline points="2 17 12 22 22 17"/>
              <polyline points="2 12 12 17 22 12"/>
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#57534E", marginBottom: 6 }}>
            {isFiltered ? "No Batches Found" : "No Batches Yet"}
          </div>
          <div style={{ fontSize: 13, color: "#A8A29E", maxWidth: 300, lineHeight: 1.6, marginBottom: 20 }}>
            {isFiltered
              ? "No batches match your search or filter. Try adjusting your criteria."
              : "Start by creating your first batch."}
          </div>
          {!isFiltered && (
            <button onClick={onAdd} className="btn btn-primary btn-sm">+ Add Batch</button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────
function Pagination({ page, pageSize, total, onPage, onPageSize }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);
  const pageNums = useMemo(() => {
    const count = Math.min(5, totalPages);
    let start = Math.max(1, page - 2);
    if (start + count - 1 > totalPages) start = Math.max(1, totalPages - count + 1);
    return Array.from({ length: Math.min(count, totalPages - start + 1) }, (_, i) => start + i);
  }, [page, totalPages]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", borderTop: "1px solid #F0EDE8", flexWrap: "wrap", gap: 8 }}>
      <span style={{ fontSize: 12, color: "#A8A29E" }}>
        {total === 0 ? "No results" : `${from}–${to} of ${total} batch${total !== 1 ? "es" : ""}`}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#A8A29E" }}>Rows:</span>
          <select value={pageSize} onChange={e => { onPageSize(Number(e.target.value)); onPage(1); }}
            style={{ border: "1px solid #E7E3DC", borderRadius: 6, padding: "3px 6px", fontSize: 12, background: "#FAFAF8", cursor: "pointer" }}>
            {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          {[["«",1], ["‹",page-1]].map(([l,p]) => (
            <button key={l} onClick={() => onPage(p)} disabled={page === 1}
              className="btn btn-ghost btn-xs" style={{ minWidth: 28, padding: "4px 7px", fontSize: 12 }}>{l}</button>
          ))}
          {pageNums.map(p => (
            <button key={p} onClick={() => onPage(p)}
              className={`btn btn-xs ${page === p ? "btn-primary" : "btn-ghost"}`}
              style={{ minWidth: 28, padding: "4px 7px", fontSize: 12 }}>{p}</button>
          ))}
          {[["›",page+1], ["»",totalPages]].map(([l,p]) => (
            <button key={l} onClick={() => onPage(p)} disabled={page === totalPages}
              className="btn btn-ghost btn-xs" style={{ minWidth: 28, padding: "4px 7px", fontSize: 12 }}>{l}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Inline icons ──────────────────────────────────────────────────────────────
const SearchIcon = () => (
  <svg viewBox="0 0 20 20" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="9" r="6"/><path d="M15 15l3 3"/>
  </svg>
);
const FilterIcon = () => (
  <svg viewBox="0 0 20 20" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 5h12M7 10h6M9.5 15h1"/>
  </svg>
);
const ExportIcon = () => (
  <svg viewBox="0 0 20 20" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13V3M6 9l4 4 4-4M4 16h12"/>
  </svg>
);
const ImportIcon = () => (
  <svg viewBox="0 0 20 20" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 7v10M6 11l4-4 4 4M4 16h12"/>
  </svg>
);
function FilterField({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#A8A29E", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const COLS = [
  { key: "code",      label: "Batch Code",      width: 110 },
  { key: "name",      label: "Batch Name",       width: null },
  { key: "className", label: "Class",            width: 110 },
  { key: "startTime", label: "Start Time",       width: 100 },
  { key: "endTime",   label: "End Time",         width: 100 },
  { key: "capacity",  label: "Capacity",         width: 90, align: "center" },
  { key: "enrolled",  label: "Enrolled",         width: 130, nosort: true },
  { key: "classroom", label: "Classroom",        width: 110 },
  { key: "status",    label: "Status",           width: 90 },
  { key: null,        label: "Actions",          width: 100, nosort: true },
];

export default function AcademicsBatches() {
  const [batches,       setBatches]       = useState(SEED_BATCHES);
  const [search,        setSearch]        = useState("");
  const [filterClass,   setFilterClass]   = useState("All");
  const [filterStatus,  setFilterStatus]  = useState("All");
  const [sortKey,       setSortKey]       = useState("className");
  const [sortDir,       setSortDir]       = useState("asc");
  const [page,          setPage]          = useState(1);
  const [pageSize,      setPageSize]      = useState(10);

  // drawer state: { batch, mode } mode = "view" | "edit" | "add"
  const [drawer,        setDrawer]        = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [filterOpen,    setFilterOpen]    = useState(false);
  const toast = useToast();

  // ── Derived stats ───────────────────────────────────────────────────────────
  const totalBatches       = batches.length;
  const activeBatches      = batches.filter(b => b.status === "Active").length;
  const totalCapacity      = batches.reduce((s, b) => s + (b.capacity || 0), 0);
  const totalEnrolled      = batches.reduce((s, b) => s + (b.enrolled || 0), 0);
  const availableCapacity  = Math.max(0, totalCapacity - totalEnrolled);
  const occupancyRate      = totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0;

  const classOptions = useMemo(() => {
    const names = [...new Set(batches.map(b => b.className))].sort();
    return ["All", ...names];
  }, [batches]);

  // ── Filtered + sorted ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = batches.filter(b => {
      if (q && !(
        b.name.toLowerCase().includes(q)      ||
        b.code.toLowerCase().includes(q)      ||
        b.className.toLowerCase().includes(q) ||
        (b.classroom || "").toLowerCase().includes(q)
      )) return false;
      if (filterClass  !== "All" && b.className !== filterClass)  return false;
      if (filterStatus !== "All" && b.status    !== filterStatus) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      if (!sortKey) return 0;
      let av = a[sortKey], bv = b[sortKey];
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      return av < bv ? (sortDir === "asc" ? -1 : 1) : av > bv ? (sortDir === "asc" ? 1 : -1) : 0;
    });
  }, [batches, search, filterClass, filterStatus, sortKey, sortDir]);

  const paginated = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  }

  function openView(batch) { setDrawer({ batch, mode: "view" }); }
  function openEdit(batch) { setDrawer({ batch, mode: "edit" }); }
  function openAdd()       { setDrawer({ batch: null, mode: "add" }); }
  function closeDrawer()   { setDrawer(null); }

  function handleSave(data) {
    if (data.id) {
      setBatches(prev => prev.map(b => b.id === data.id ? { ...b, ...data } : b));
      toast.success(`"${data.name}" updated.`);
    } else {
      setBatches(prev => [...prev, { ...data, id: String(Date.now()), enrolled: 0 }]);
      toast.success(`"${data.name}" created.`);
    }
    closeDrawer();
  }

  function handleDelete(batch) {
    setBatches(prev => prev.filter(b => b.id !== batch.id));
    toast.success(`"${batch.name}" deleted.`);
    setConfirmDelete(null);
  }

  function handleExport() {
    const headers = ["Code","Name","Class","Start Time","End Time","Capacity","Enrolled","Available","Classroom","Status"];
    const rows = filtered.map(b => [b.code, b.name, b.className, fmt12(b.startTime), fmt12(b.endTime), b.capacity, b.enrolled, Math.max(0, b.capacity - b.enrolled), b.classroom || "", b.status]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "batches.csv";
    a.click();
    toast.success("Exported batches.csv");
  }

  function clearFilters() { setSearch(""); setFilterClass("All"); setFilterStatus("All"); setPage(1); setFilterOpen(false); }

  const hasFilters       = !!search || filterClass !== "All" || filterStatus !== "All";
  const activeFilterCount = [filterClass !== "All", filterStatus !== "All"].filter(Boolean).length;
  const existingCodes    = batches.map(b => b.code);

  return (
    <div style={{ padding: "24px", maxWidth: 1200, margin: "0 auto" }}>

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1C1917", letterSpacing: "-0.025em", margin: 0, lineHeight: 1.2 }}>
              Batch Management
            </h1>
            <p style={{ fontSize: 13, color: "#A8A29E", margin: "5px 0 0" }}>
              Manage batch timings, capacity and classroom allocation.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <button onClick={handleExport} className="btn btn-ghost btn-sm" style={{ gap: 5 }}>
              <ExportIcon /> Export
            </button>
            <button onClick={() => toast.success("Import feature coming soon.")} className="btn btn-ghost btn-sm" style={{ gap: 5 }}>
              <ImportIcon /> Import Batches
            </button>
            <button onClick={openAdd} className="btn btn-primary btn-sm">+ Add Batch</button>
          </div>
        </div>
      </div>

      {/* ── Stat Tiles ──────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
        <StatTile label="Total Batches"      value={totalBatches}      desc="Total batches created across all classes"   accent="#F5C518" icon="📦" />
        <StatTile label="Active Batches"     value={activeBatches}     desc="Batches currently running"                  accent="#10B981" icon="✅" />
        <StatTile label="Available Capacity" value={availableCapacity} desc="Remaining seats across all batches"         accent="#3B82F6" icon="💺" />
        <StatTile label="Occupancy Rate"     value={`${occupancyRate}%`} desc="Current batch utilization percentage"     accent={occupancyColor(occupancyRate)} icon="📊" />
      </div>

      {/* ── Table Card ──────────────────────────────────────────────── */}
      <div className="yd-card" style={{ overflow: "hidden" }}>

        {/* Toolbar */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #F0EDE8", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 180px", minWidth: 160, maxWidth: 300 }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#A8A29E", pointerEvents: "none", display: "flex" }}>
              <SearchIcon />
            </span>
            <input
              className="yd-input"
              style={{ paddingLeft: 32, width: "100%", fontSize: 13 }}
              placeholder="Search batches…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          {/* Filter dropdown */}
          <div style={{ position: "relative" }}>
            <button
              className={`btn btn-sm ${activeFilterCount > 0 ? "btn-soft" : "btn-ghost"}`}
              onClick={() => setFilterOpen(o => !o)}
              style={{ gap: 5, display: "flex", alignItems: "center" }}
            >
              <FilterIcon />
              Filters
              {activeFilterCount > 0 && (
                <span style={{ background: "#F5C518", color: "#78350F", borderRadius: "50%", width: 16, height: 16, fontSize: 10, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  {activeFilterCount}
                </span>
              )}
            </button>

            {filterOpen && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setFilterOpen(false)} />
                <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 50, background: "#fff", border: "1px solid #E7E3DC", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.10)", padding: 16, minWidth: 250 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "#A8A29E", marginBottom: 12 }}>Filter Options</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <FilterField label="Class">
                      <select className="yd-input" value={filterClass} onChange={e => { setFilterClass(e.target.value); setPage(1); }}>
                        {classOptions.map(c => <option key={c} value={c}>{c === "All" ? "All Classes" : c}</option>)}
                      </select>
                    </FilterField>
                    <FilterField label="Status">
                      <select className="yd-input" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
                        <option value="All">All Statuses</option>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </FilterField>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 14, paddingTop: 12, borderTop: "1px solid #F0EDE8" }}>
                    <button className="btn btn-ghost btn-xs" onClick={clearFilters}>Clear All</button>
                    <button className="btn btn-primary btn-xs" onClick={() => setFilterOpen(false)}>Apply</button>
                  </div>
                </div>
              </>
            )}
          </div>

          {hasFilters && (
            <button className="btn btn-ghost btn-xs" onClick={clearFilters} style={{ color: "#EF4444", borderColor: "#FECACA" }}>
              ✕ Clear
            </button>
          )}
          <div style={{ marginLeft: "auto", fontSize: 12, color: "#A8A29E", whiteSpace: "nowrap" }}>
            {filtered.length} {filtered.length === 1 ? "batch" : "batches"}
          </div>
        </div>

        {/* Table */}
        <div className="yd-table-wrap">
          <table className="yd-table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                {COLS.map(col => (
                  <th key={col.label}
                    style={{ width: col.width || undefined, textAlign: col.align || "left", cursor: col.nosort || !col.key ? "default" : "pointer", userSelect: "none" }}
                    onClick={(!col.nosort && col.key) ? () => handleSort(col.key) : undefined}
                  >
                    {col.label}
                    {!col.nosort && col.key && <SortIcon active={sortKey === col.key} dir={sortDir} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0
                ? <EmptyState isFiltered={hasFilters} onAdd={openAdd} />
                : paginated.map(batch => {
                    const available = Math.max(0, batch.capacity - batch.enrolled);
                    const pct = batch.capacity > 0 ? Math.round((batch.enrolled / batch.capacity) * 100) : 0;
                    return (
                      <tr key={batch.id} onClick={() => openView(batch)} style={{ cursor: "pointer" }}>
                        {/* Batch Code */}
                        <td>
                          <span style={{ fontFamily: "monospace", fontSize: 11.5, fontWeight: 700, background: "#EFF6FF", color: "#1E40AF", borderRadius: 5, padding: "2px 7px", letterSpacing: "0.04em" }}>
                            {batch.code}
                          </span>
                        </td>
                        {/* Batch Name */}
                        <td>
                          <div style={{ fontWeight: 600, color: "#1C1917", fontSize: 13 }}>{batch.name}</div>
                          {batch.description && (
                            <div style={{ fontSize: 11, color: "#A8A29E", marginTop: 1, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {batch.description}
                            </div>
                          )}
                        </td>
                        {/* Class */}
                        <td>
                          <span style={{ fontSize: 12, background: "#F5F3EF", color: "#57534E", borderRadius: 6, padding: "3px 8px", fontWeight: 600, whiteSpace: "nowrap" }}>
                            {batch.className}
                          </span>
                        </td>
                        {/* Start Time */}
                        <td style={{ fontSize: 13, fontWeight: 600, color: "#1C1917", whiteSpace: "nowrap" }}>
                          {fmt12(batch.startTime)}
                        </td>
                        {/* End Time */}
                        <td style={{ fontSize: 13, fontWeight: 600, color: "#1C1917", whiteSpace: "nowrap" }}>
                          {fmt12(batch.endTime)}
                        </td>
                        {/* Capacity */}
                        <td style={{ textAlign: "center" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#1C1917" }}>{batch.capacity}</span>
                        </td>
                        {/* Enrolled / Available */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 60 }}>
                              <CapacityBar enrolled={batch.enrolled} capacity={batch.capacity} />
                            </div>
                            <div style={{ fontSize: 11, color: "#57534E", whiteSpace: "nowrap", flexShrink: 0 }}>
                              <span style={{ fontWeight: 700 }}>{batch.enrolled}</span>
                              <span style={{ color: "#A8A29E" }}> / </span>
                              <span style={{ color: available === 0 ? "#EF4444" : "#10B981", fontWeight: 600 }}>{available} left</span>
                            </div>
                          </div>
                        </td>
                        {/* Classroom */}
                        <td style={{ fontSize: 12, color: batch.classroom ? "#57534E" : "#D1C9BF" }}>
                          {batch.classroom || "—"}
                        </td>
                        {/* Status */}
                        <td><StatusBadge status={batch.status} /></td>
                        {/* Actions */}
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: "flex", gap: 5 }}>
                            <button className="btn btn-ghost btn-xs" onClick={() => openEdit(batch)} title="Edit" style={{ padding: "4px 8px" }}>✏️</button>
                            <button className="btn btn-xs" onClick={() => setConfirmDelete(batch)} title="Delete"
                              style={{ padding: "4px 8px", background: "#FEF2F2", color: "#EF4444", border: "1px solid #FECACA" }}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>

        <Pagination page={page} pageSize={pageSize} total={filtered.length} onPage={p => setPage(p)} onPageSize={n => setPageSize(n)} />
      </div>

      {/* ── Batch Drawer ─────────────────────────────────────────────── */}
      {drawer && (
        <BatchDrawer
          batch={drawer.batch}
          mode={drawer.mode}
          existingCodes={existingCodes}
          onSave={handleSave}
          onClose={closeDrawer}
          onEdit={() => setDrawer(d => ({ ...d, mode: "edit" }))}
        />
      )}

      {/* ── Confirm Delete ──────────────────────────────────────────── */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Batch"
          message={`Are you sure you want to delete "${confirmDelete.name}" (${confirmDelete.code})? This action cannot be undone.`}
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <Toasts toasts={toast.toasts} dismiss={toast.dismiss} />
    </div>
  );
}
