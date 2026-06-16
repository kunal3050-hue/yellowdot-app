import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

// ── Reference data ─────────────────────────────────────────────────────────────
const CLASS_OPTIONS = [
  { id: "1", name: "Playgroup",   code: "PG001" },
  { id: "2", name: "Nursery",     code: "NR001" },
  { id: "3", name: "Junior KG",   code: "JKG01" },
  { id: "4", name: "Senior KG",   code: "SKG01" },
  { id: "5", name: "Daycare",     code: "DC001" },
  { id: "6", name: "Abacus",      code: "AB001" },
  { id: "7", name: "Handwriting", code: "HW001" },
];

const BATCH_OPTIONS = [
  { id: "1", code: "PGB-AM", name: "Morning Batch",   classId: "1", className: "Playgroup",  startTime: "09:00", endTime: "12:00" },
  { id: "2", code: "PGB-PM", name: "Afternoon Batch", classId: "1", className: "Playgroup",  startTime: "13:00", endTime: "16:00" },
  { id: "3", code: "NRB-AM", name: "Morning Batch",   classId: "2", className: "Nursery",    startTime: "09:00", endTime: "12:00" },
  { id: "4", code: "NRB-PM", name: "Afternoon Batch", classId: "2", className: "Nursery",    startTime: "13:00", endTime: "16:00" },
  { id: "5", code: "JKB-AM", name: "Morning Batch",   classId: "3", className: "Junior KG",  startTime: "09:00", endTime: "12:00" },
  { id: "6", code: "SKB-AM", name: "Morning Batch",   classId: "4", className: "Senior KG",  startTime: "09:00", endTime: "12:00" },
];

const TEACHER_OPTIONS = [
  { id: "T1", name: "Priya Ma'am",  empId: "EMP001", subject: "General" },
  { id: "T2", name: "Neha Ma'am",   empId: "EMP002", subject: "General" },
  { id: "T3", name: "Rohan Sir",    empId: "EMP003", subject: "Maths"   },
  { id: "T4", name: "Sneha Ma'am",  empId: "EMP004", subject: "English" },
];

const CLASSROOM_LIST = [
  { id: "R1", name: "Room 1",        capacity: 15 },
  { id: "R2", name: "Room 2",        capacity: 15 },
  { id: "R3", name: "Room 3",        capacity: 20 },
  { id: "R4", name: "Activity Room", capacity: 25 },
  { id: "R5", name: "Daycare Hall",  capacity: 30 },
];

// ── Seed data ──────────────────────────────────────────────────────────────────
const SEED_TEACHER_ALLOCS = [
  { id: "TA1", teacherId: "T1", teacherName: "Priya Ma'am", empId: "EMP001",
    batchId: "1", batchCode: "PGB-AM", batchName: "Morning Batch",
    classId: "1", className: "Playgroup", startTime: "09:00", endTime: "12:00",
    effectiveDate: "2025-06-01", notes: "", status: "Active" },
  { id: "TA2", teacherId: "T1", teacherName: "Priya Ma'am", empId: "EMP001",
    batchId: "2", batchCode: "PGB-PM", batchName: "Afternoon Batch",
    classId: "1", className: "Playgroup", startTime: "13:00", endTime: "16:00",
    effectiveDate: "2025-06-01", notes: "", status: "Active" },
  { id: "TA3", teacherId: "T2", teacherName: "Neha Ma'am",  empId: "EMP002",
    batchId: "3", batchCode: "NRB-AM", batchName: "Morning Batch",
    classId: "2", className: "Nursery", startTime: "09:00", endTime: "12:00",
    effectiveDate: "2025-06-01", notes: "", status: "Active" },
  { id: "TA4", teacherId: "T3", teacherName: "Rohan Sir",   empId: "EMP003",
    batchId: "4", batchCode: "NRB-PM", batchName: "Afternoon Batch",
    classId: "2", className: "Nursery", startTime: "13:00", endTime: "16:00",
    effectiveDate: "2025-06-01", notes: "", status: "Active" },
  { id: "TA5", teacherId: "T3", teacherName: "Rohan Sir",   empId: "EMP003",
    batchId: "5", batchCode: "JKB-AM", batchName: "Morning Batch",
    classId: "3", className: "Junior KG", startTime: "09:00", endTime: "12:00",
    effectiveDate: "2025-06-01", notes: "", status: "Active" },
  { id: "TA6", teacherId: "T4", teacherName: "Sneha Ma'am", empId: "EMP004",
    batchId: "6", batchCode: "SKB-AM", batchName: "Morning Batch",
    classId: "4", className: "Senior KG", startTime: "09:00", endTime: "12:00",
    effectiveDate: "2025-06-01", notes: "", status: "Active" },
];

const SEED_CLASSROOM_ALLOCS = [
  { id: "CA1", classroomId: "R1", classroomName: "Room 1",        classroomCapacity: 15,
    batchId: "1", batchCode: "PGB-AM", batchName: "Morning Batch",
    classId: "1", className: "Playgroup", startTime: "09:00", endTime: "12:00",
    effectiveDate: "2025-06-01", notes: "", status: "Active" },
  { id: "CA2", classroomId: "R2", classroomName: "Room 2",        classroomCapacity: 15,
    batchId: "2", batchCode: "PGB-PM", batchName: "Afternoon Batch",
    classId: "1", className: "Playgroup", startTime: "13:00", endTime: "16:00",
    effectiveDate: "2025-06-01", notes: "", status: "Active" },
  { id: "CA3", classroomId: "R3", classroomName: "Room 3",        classroomCapacity: 20,
    batchId: "3", batchCode: "NRB-AM", batchName: "Morning Batch",
    classId: "2", className: "Nursery", startTime: "09:00", endTime: "12:00",
    effectiveDate: "2025-06-01", notes: "", status: "Active" },
  { id: "CA4", classroomId: "R4", classroomName: "Activity Room", classroomCapacity: 25,
    batchId: "4", batchCode: "NRB-PM", batchName: "Afternoon Batch",
    classId: "2", className: "Nursery", startTime: "13:00", endTime: "16:00",
    effectiveDate: "2025-06-01", notes: "", status: "Active" },
  { id: "CA5", classroomId: "R2", classroomName: "Room 2",        classroomCapacity: 15,
    batchId: "5", batchCode: "JKB-AM", batchName: "Morning Batch",
    classId: "3", className: "Junior KG", startTime: "09:00", endTime: "12:00",
    effectiveDate: "2025-06-01", notes: "", status: "Active" },
  { id: "CA6", classroomId: "R5", classroomName: "Daycare Hall",  classroomCapacity: 30,
    batchId: "6", batchCode: "SKB-AM", batchName: "Morning Batch",
    classId: "4", className: "Senior KG", startTime: "09:00", endTime: "12:00",
    effectiveDate: "2025-06-01", notes: "", status: "Active" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function timeToMins(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function timesOverlap(s1, e1, s2, e2) {
  return timeToMins(s1) < timeToMins(e2) && timeToMins(s2) < timeToMins(e1);
}
function fmt12(t) {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function fmtDate(d) {
  if (!d) return "—";
  const [y, mo, day] = d.split("-");
  return `${day}/${mo}/${y}`;
}

const PAGE_SIZE = 10;

// ── Shared UI components ───────────────────────────────────────────────────────
function StatTile({ label, value, sub, accent }) {
  return (
    <div className="yd-card" style={{ flex: 1, minWidth: 160, padding: "18px 20px" }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: accent || "#1C1917", letterSpacing: "-0.03em" }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#57534E", marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#A8A29E", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    Active:   { bg: "#DCFCE7", color: "#15803D" },
    Inactive: { bg: "#FEF9C3", color: "#854D0E" },
  };
  const s = map[status] || { bg: "#F5F3EF", color: "#57534E" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 10px",
      borderRadius: 99, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>
      {status}
    </span>
  );
}

function SortIcon({ active, dir }) {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 1,
      verticalAlign: "middle", marginLeft: 4, opacity: active ? 1 : 0.3 }}>
      <svg viewBox="0 0 8 5" width={8} height={5} fill={active && dir === "asc" ? "#1C1917" : "#A8A29E"}><path d="M4 0L8 5H0z"/></svg>
      <svg viewBox="0 0 8 5" width={8} height={5} fill={active && dir === "desc" ? "#1C1917" : "#A8A29E"}><path d="M4 5L0 0h8z"/></svg>
    </span>
  );
}

function FormField({ label, required, error, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "#57534E", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}{required && <span style={{ color: "#EF4444", marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {error && <span style={{ fontSize: 11, color: "#EF4444", marginTop: 2 }}>{error}</span>}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      padding: "8px 0", borderBottom: "1px solid #F5F3EF" }}>
      <span style={{ fontSize: 12, color: "#A8A29E", fontWeight: 500, minWidth: 120 }}>{label}</span>
      <span style={{ fontSize: 13, color: "#1C1917", fontWeight: 500, textAlign: "right" }}>{value || "—"}</span>
    </div>
  );
}

function ConflictWarning({ message }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "10px 14px", background: "#FEF3C7",
      border: "1px solid #FDE68A", borderRadius: 8 }}>
      <svg viewBox="0 0 20 20" width={16} height={16} fill="#D97706" style={{ flexShrink: 0, marginTop: 1 }}>
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
      </svg>
      <span style={{ fontSize: 12, color: "#92400E", lineHeight: 1.5 }}>{message}</span>
    </div>
  );
}

function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)" }} onClick={onCancel} />
      <div className="yd-card" style={{ position: "relative", width: 400, padding: "28px 28px 24px", zIndex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1C1917", marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 13, color: "#78716C", lineHeight: 1.6 }}>{message}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger btn-sm" onClick={onConfirm}>Remove</button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <tr><td colSpan={99}>
      <div style={{ textAlign: "center", padding: "48px 24px" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#57534E", marginBottom: 4 }}>No Allocations Found</div>
        <div style={{ fontSize: 12, color: "#A8A29E" }}>{message}</div>
      </div>
    </td></tr>
  );
}

function PagBtn({ children, active, disabled, onClick }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ minWidth: 32, height: 32, padding: "0 8px", borderRadius: 8, border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        background: active ? "#1C1917" : "transparent",
        color: active ? "#fff" : disabled ? "#D6D3D1" : "#57534E",
        fontSize: 13, fontWeight: 500, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      {children}
    </button>
  );
}

function Pagination({ page, total, perPage, onChange }) {
  const pages = Math.ceil(total / perPage) || 1;
  const start = (page - 1) * perPage + 1;
  const end   = Math.min(page * perPage, total);
  const pageNums = Array.from({ length: Math.min(pages, 5) }, (_, i) => {
    if (pages <= 5) return i + 1;
    if (page <= 3)  return i + 1;
    if (page >= pages - 2) return pages - 4 + i;
    return page - 2 + i;
  });
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "12px 20px 16px", flexWrap: "wrap", gap: 8 }}>
      <span style={{ fontSize: 12, color: "#A8A29E" }}>
        {total === 0 ? "0 results" : `${start}–${end} of ${total}`}
      </span>
      <div style={{ display: "flex", gap: 4 }}>
        <PagBtn disabled={page <= 1} onClick={() => onChange(page - 1)}>‹</PagBtn>
        {pageNums.map(p => <PagBtn key={p} active={p === page} onClick={() => onChange(p)}>{p}</PagBtn>)}
        <PagBtn disabled={page >= pages} onClick={() => onChange(page + 1)}>›</PagBtn>
      </div>
    </div>
  );
}

// ── Teacher Drawer ─────────────────────────────────────────────────────────────
function TeacherDrawer({ drawer, allocs, onClose, onSave, onRemove }) {
  const { alloc, mode: initMode } = drawer;
  const [mode, setMode] = useState(initMode);
  const [form, setForm] = useState(
    alloc
      ? { teacherId: alloc.teacherId, classId: alloc.classId, batchId: alloc.batchId,
          effectiveDate: alloc.effectiveDate, notes: alloc.notes, status: alloc.status }
      : { teacherId: "", classId: "", batchId: "",
          effectiveDate: new Date().toISOString().slice(0, 10), notes: "", status: "Active" }
  );
  const [errors, setErrors]       = useState({});
  const [conflict, setConflict]   = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const isView = mode === "view";
  const isEdit = mode === "edit";
  const isAdd  = mode === "add";

  const batchesForClass = BATCH_OPTIONS.filter(b => !form.classId || b.classId === form.classId);

  function checkConflict(f) {
    if (!f.teacherId || !f.batchId) return null;
    const batch   = BATCH_OPTIONS.find(b => b.id === f.batchId);
    if (!batch) return null;
    const teacher = TEACHER_OPTIONS.find(t => t.id === f.teacherId);
    const dup = allocs.find(a =>
      a.teacherId === f.teacherId && a.batchId === f.batchId && (!alloc || a.id !== alloc.id)
    );
    if (dup) return `${teacher?.name} is already assigned to ${dup.batchCode} — ${dup.batchName}.`;
    const overlap = allocs.find(a =>
      a.teacherId === f.teacherId && a.batchId !== f.batchId &&
      (!alloc || a.id !== alloc.id) &&
      timesOverlap(batch.startTime, batch.endTime, a.startTime, a.endTime)
    );
    if (overlap) return `Time conflict: ${teacher?.name} is already assigned to ${overlap.batchCode} (${fmt12(overlap.startTime)} – ${fmt12(overlap.endTime)}).`;
    return null;
  }

  function set(key, val) {
    const f = { ...form, [key]: val };
    if (key === "classId") f.batchId = "";
    setForm(f);
    setConflict(checkConflict(f));
    if (errors[key]) setErrors(e => ({ ...e, [key]: null }));
  }

  function validate() {
    const e = {};
    if (!form.teacherId)     e.teacherId     = "Required";
    if (!form.batchId)       e.batchId       = "Required";
    if (!form.effectiveDate) e.effectiveDate = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    const c = checkConflict(form);
    if (c) { setConflict(c); return; }
    const batch   = BATCH_OPTIONS.find(b => b.id === form.batchId);
    const teacher = TEACHER_OPTIONS.find(t => t.id === form.teacherId);
    onSave({
      ...(alloc || {}),
      id: alloc?.id || `TA${Date.now()}`,
      teacherId: form.teacherId, teacherName: teacher.name, empId: teacher.empId,
      batchId: form.batchId, batchCode: batch.code, batchName: batch.name,
      classId: batch.classId, className: batch.className,
      startTime: batch.startTime, endTime: batch.endTime,
      effectiveDate: form.effectiveDate, notes: form.notes, status: form.status,
    });
  }

  const teacherBatches = alloc ? allocs.filter(a => a.teacherId === alloc.teacherId) : [];

  return (
    <>
      <div className="yd-drawer-overlay" onClick={onClose} />
      <div className="yd-drawer" style={{ width: 420 }}>
        <div className="yd-drawer-header">
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#1C1917" }}>
              {isView ? alloc.teacherName : isEdit ? "Edit Allocation" : "Assign Teacher"}
            </div>
            {isView && <div style={{ fontSize: 12, color: "#A8A29E", marginTop: 2 }}>{alloc.empId} · {alloc.batchCode}</div>}
          </div>
          <button className="btn btn-ghost btn-xs" onClick={onClose}>
            <svg viewBox="0 0 20 20" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M4 4l12 12M16 4L4 16"/>
            </svg>
          </button>
        </div>

        <div className="yd-drawer-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {isView ? (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <StatusBadge status={alloc.status} />
                <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 10px",
                  borderRadius: 99, fontSize: 11, fontWeight: 600, background: "#EEF2FF", color: "#3730A3" }}>
                  {alloc.className}
                </span>
              </div>
              <div className="yd-card" style={{ padding: "16px 18px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#A8A29E", textTransform: "uppercase",
                  letterSpacing: "0.06em", marginBottom: 8 }}>Teacher Information</div>
                <InfoRow label="Teacher"        value={alloc.teacherName} />
                <InfoRow label="Employee ID"    value={alloc.empId} />
                <InfoRow label="Subject"        value={TEACHER_OPTIONS.find(t => t.id === alloc.teacherId)?.subject} />
                <InfoRow label="Effective Date" value={fmtDate(alloc.effectiveDate)} />
                {alloc.notes && <InfoRow label="Notes" value={alloc.notes} />}
              </div>
              <div className="yd-card" style={{ padding: "16px 18px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#A8A29E", textTransform: "uppercase",
                  letterSpacing: "0.06em", marginBottom: 8 }}>Batch Assignment</div>
                <InfoRow label="Batch Code" value={alloc.batchCode} />
                <InfoRow label="Batch Name" value={alloc.batchName} />
                <InfoRow label="Class"      value={alloc.className} />
                <InfoRow label="Timing"     value={`${fmt12(alloc.startTime)} – ${fmt12(alloc.endTime)}`} />
              </div>
              {teacherBatches.length > 1 && (
                <div className="yd-card" style={{ padding: "16px 18px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#A8A29E", textTransform: "uppercase",
                    letterSpacing: "0.06em", marginBottom: 10 }}>
                    Weekly Schedule ({teacherBatches.length} batches)
                  </div>
                  {teacherBatches.map(b => (
                    <div key={b.id} style={{ display: "flex", justifyContent: "space-between",
                      padding: "6px 0", borderBottom: "1px solid #F5F3EF", fontSize: 12 }}>
                      <span style={{ color: "#57534E", fontWeight: 500 }}>{b.batchCode} · {b.className}</span>
                      <span style={{ color: "#A8A29E" }}>{fmt12(b.startTime)} – {fmt12(b.endTime)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {conflict && <ConflictWarning message={conflict} />}
              <FormField label="Teacher" required error={errors.teacherId}>
                <select className="yd-input" value={form.teacherId} onChange={e => set("teacherId", e.target.value)}>
                  <option value="">Select teacher</option>
                  {TEACHER_OPTIONS.map(t => <option key={t.id} value={t.id}>{t.name} ({t.empId})</option>)}
                </select>
              </FormField>
              <FormField label="Class">
                <select className="yd-input" value={form.classId} onChange={e => set("classId", e.target.value)}>
                  <option value="">All classes</option>
                  {CLASS_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </FormField>
              <FormField label="Batch" required error={errors.batchId}>
                <select className="yd-input" value={form.batchId} onChange={e => set("batchId", e.target.value)}>
                  <option value="">Select batch</option>
                  {batchesForClass.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.code} — {b.className} {b.name} ({fmt12(b.startTime)} – {fmt12(b.endTime)})
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Effective Date" required error={errors.effectiveDate}>
                <input type="date" className="yd-input" value={form.effectiveDate}
                  onChange={e => set("effectiveDate", e.target.value)} />
              </FormField>
              <FormField label="Status">
                <select className="yd-input" value={form.status} onChange={e => set("status", e.target.value)}>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </FormField>
              <FormField label="Notes">
                <textarea className="yd-input" rows={3} value={form.notes}
                  onChange={e => set("notes", e.target.value)}
                  placeholder="Optional notes…" style={{ resize: "vertical" }} />
              </FormField>
            </>
          )}
        </div>

        <div className="yd-drawer-footer" style={{ justifyContent: isAdd ? "flex-end" : "space-between" }}>
          {isView && (
            <>
              <button className="btn btn-danger btn-sm" onClick={() => setConfirmRemove(true)}>Remove</button>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
                <button className="btn btn-primary btn-sm" onClick={() => setMode("edit")}>Edit</button>
              </div>
            </>
          )}
          {isEdit && (
            <>
              <button className="btn btn-danger btn-sm" onClick={() => setConfirmRemove(true)}>Remove</button>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setMode("view")}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!!conflict}>Save Changes</button>
              </div>
            </>
          )}
          {isAdd && (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!!conflict}>Assign Teacher</button>
            </div>
          )}
        </div>
      </div>
      {confirmRemove && (
        <ConfirmDialog
          title="Remove Allocation"
          message={`Remove ${alloc?.teacherName} from ${alloc?.batchCode}? This action cannot be undone.`}
          onConfirm={() => { onRemove(alloc.id); setConfirmRemove(false); onClose(); }}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
    </>
  );
}

// ── Classroom Drawer ───────────────────────────────────────────────────────────
function ClassroomDrawer({ drawer, allocs, onClose, onSave, onRemove }) {
  const { alloc, mode: initMode } = drawer;
  const [mode, setMode] = useState(initMode);
  const [form, setForm] = useState(
    alloc
      ? { classroomId: alloc.classroomId, classId: alloc.classId, batchId: alloc.batchId,
          effectiveDate: alloc.effectiveDate, notes: alloc.notes, status: alloc.status }
      : { classroomId: "", classId: "", batchId: "",
          effectiveDate: new Date().toISOString().slice(0, 10), notes: "", status: "Active" }
  );
  const [errors, setErrors]       = useState({});
  const [conflict, setConflict]   = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const isView = mode === "view";
  const isEdit = mode === "edit";
  const isAdd  = mode === "add";

  const batchesForClass = BATCH_OPTIONS.filter(b => !form.classId || b.classId === form.classId);

  function checkConflict(f) {
    if (!f.classroomId || !f.batchId) return null;
    const batch    = BATCH_OPTIONS.find(b => b.id === f.batchId);
    if (!batch) return null;
    const room = CLASSROOM_LIST.find(r => r.id === f.classroomId);
    const dup = allocs.find(a =>
      a.classroomId === f.classroomId && a.batchId === f.batchId && (!alloc || a.id !== alloc.id)
    );
    if (dup) return `${room?.name} is already assigned to ${dup.batchCode} — ${dup.batchName}.`;
    const overlap = allocs.find(a =>
      a.classroomId === f.classroomId && a.batchId !== f.batchId &&
      (!alloc || a.id !== alloc.id) &&
      timesOverlap(batch.startTime, batch.endTime, a.startTime, a.endTime)
    );
    if (overlap) return `Overlap: ${room?.name} is already in use for ${overlap.batchCode} (${fmt12(overlap.startTime)} – ${fmt12(overlap.endTime)}).`;
    return null;
  }

  function set(key, val) {
    const f = { ...form, [key]: val };
    if (key === "classId") f.batchId = "";
    setForm(f);
    setConflict(checkConflict(f));
    if (errors[key]) setErrors(e => ({ ...e, [key]: null }));
  }

  function validate() {
    const e = {};
    if (!form.classroomId)   e.classroomId   = "Required";
    if (!form.batchId)       e.batchId       = "Required";
    if (!form.effectiveDate) e.effectiveDate = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    const c = checkConflict(form);
    if (c) { setConflict(c); return; }
    const batch    = BATCH_OPTIONS.find(b => b.id === form.batchId);
    const room     = CLASSROOM_LIST.find(r => r.id === form.classroomId);
    onSave({
      ...(alloc || {}),
      id: alloc?.id || `CA${Date.now()}`,
      classroomId: form.classroomId, classroomName: room.name, classroomCapacity: room.capacity,
      batchId: form.batchId, batchCode: batch.code, batchName: batch.name,
      classId: batch.classId, className: batch.className,
      startTime: batch.startTime, endTime: batch.endTime,
      effectiveDate: form.effectiveDate, notes: form.notes, status: form.status,
    });
  }

  const roomAllocs = alloc ? allocs.filter(a => a.classroomId === alloc.classroomId) : [];

  return (
    <>
      <div className="yd-drawer-overlay" onClick={onClose} />
      <div className="yd-drawer" style={{ width: 420 }}>
        <div className="yd-drawer-header">
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#1C1917" }}>
              {isView ? alloc.classroomName : isEdit ? "Edit Allocation" : "Assign Classroom"}
            </div>
            {isView && <div style={{ fontSize: 12, color: "#A8A29E", marginTop: 2 }}>
              Cap: {alloc.classroomCapacity} · {alloc.batchCode}
            </div>}
          </div>
          <button className="btn btn-ghost btn-xs" onClick={onClose}>
            <svg viewBox="0 0 20 20" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M4 4l12 12M16 4L4 16"/>
            </svg>
          </button>
        </div>

        <div className="yd-drawer-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {isView ? (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <StatusBadge status={alloc.status} />
                <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 10px",
                  borderRadius: 99, fontSize: 11, fontWeight: 600, background: "#F3E8FF", color: "#7E22CE" }}>
                  {alloc.className}
                </span>
              </div>
              <div className="yd-card" style={{ padding: "16px 18px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#A8A29E", textTransform: "uppercase",
                  letterSpacing: "0.06em", marginBottom: 8 }}>Classroom Information</div>
                <InfoRow label="Classroom"      value={alloc.classroomName} />
                <InfoRow label="Capacity"       value={`${alloc.classroomCapacity} students`} />
                <InfoRow label="Effective Date" value={fmtDate(alloc.effectiveDate)} />
                {alloc.notes && <InfoRow label="Notes" value={alloc.notes} />}
              </div>
              <div className="yd-card" style={{ padding: "16px 18px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#A8A29E", textTransform: "uppercase",
                  letterSpacing: "0.06em", marginBottom: 8 }}>Batch Assignment</div>
                <InfoRow label="Batch Code" value={alloc.batchCode} />
                <InfoRow label="Batch Name" value={alloc.batchName} />
                <InfoRow label="Class"      value={alloc.className} />
                <InfoRow label="Timing"     value={`${fmt12(alloc.startTime)} – ${fmt12(alloc.endTime)}`} />
              </div>
              <div className="yd-card" style={{ padding: "16px 18px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#A8A29E", textTransform: "uppercase",
                  letterSpacing: "0.06em", marginBottom: 8 }}>Utilization</div>
                <InfoRow label="Total Sessions" value={`${roomAllocs.length} allocation(s)`} />
                <InfoRow label="Occupancy"      value={alloc.status === "Active" ? "Occupied" : "Available"} />
              </div>
            </>
          ) : (
            <>
              {conflict && <ConflictWarning message={conflict} />}
              <FormField label="Classroom" required error={errors.classroomId}>
                <select className="yd-input" value={form.classroomId} onChange={e => set("classroomId", e.target.value)}>
                  <option value="">Select classroom</option>
                  {CLASSROOM_LIST.map(r => <option key={r.id} value={r.id}>{r.name} (Cap: {r.capacity})</option>)}
                </select>
              </FormField>
              <FormField label="Class">
                <select className="yd-input" value={form.classId} onChange={e => set("classId", e.target.value)}>
                  <option value="">All classes</option>
                  {CLASS_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </FormField>
              <FormField label="Batch" required error={errors.batchId}>
                <select className="yd-input" value={form.batchId} onChange={e => set("batchId", e.target.value)}>
                  <option value="">Select batch</option>
                  {batchesForClass.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.code} — {b.className} {b.name} ({fmt12(b.startTime)} – {fmt12(b.endTime)})
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Effective Date" required error={errors.effectiveDate}>
                <input type="date" className="yd-input" value={form.effectiveDate}
                  onChange={e => set("effectiveDate", e.target.value)} />
              </FormField>
              <FormField label="Status">
                <select className="yd-input" value={form.status} onChange={e => set("status", e.target.value)}>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </FormField>
              <FormField label="Notes">
                <textarea className="yd-input" rows={3} value={form.notes}
                  onChange={e => set("notes", e.target.value)}
                  placeholder="Optional notes…" style={{ resize: "vertical" }} />
              </FormField>
            </>
          )}
        </div>

        <div className="yd-drawer-footer" style={{ justifyContent: isAdd ? "flex-end" : "space-between" }}>
          {isView && (
            <>
              <button className="btn btn-danger btn-sm" onClick={() => setConfirmRemove(true)}>Remove</button>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
                <button className="btn btn-primary btn-sm" onClick={() => setMode("edit")}>Edit</button>
              </div>
            </>
          )}
          {isEdit && (
            <>
              <button className="btn btn-danger btn-sm" onClick={() => setConfirmRemove(true)}>Remove</button>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setMode("view")}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!!conflict}>Save Changes</button>
              </div>
            </>
          )}
          {isAdd && (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!!conflict}>Assign Classroom</button>
            </div>
          )}
        </div>
      </div>
      {confirmRemove && (
        <ConfirmDialog
          title="Remove Allocation"
          message={`Remove ${alloc?.classroomName} from ${alloc?.batchCode}? This action cannot be undone.`}
          onConfirm={() => { onRemove(alloc.id); setConfirmRemove(false); onClose(); }}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
    </>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AcademicsTeacherAllocation() {
  const [searchParams]   = useSearchParams();
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") === "classrooms" ? "classrooms" : "teachers"
  );

  // Teacher allocation state
  const [teacherAllocs, setTeacherAllocs] = useState(SEED_TEACHER_ALLOCS);
  const [tSearch,       setTSearch]       = useState("");
  const [tFilterClass,  setTFilterClass]  = useState("");
  const [tFilterBatch,  setTFilterBatch]  = useState("");
  const [tFilterStatus, setTFilterStatus] = useState("");
  const [tSort,         setTSort]         = useState({ col: "teacherName", dir: "asc" });
  const [tPage,         setTPage]         = useState(1);
  const [tDrawer,       setTDrawer]       = useState(null);
  const [tConfirm,      setTConfirm]      = useState(null);

  // Classroom allocation state
  const [classroomAllocs, setClassroomAllocs] = useState(SEED_CLASSROOM_ALLOCS);
  const [cSearch,         setCSearch]         = useState("");
  const [cFilterClass,    setCFilterClass]    = useState("");
  const [cFilterBatch,    setCFilterBatch]    = useState("");
  const [cSort,           setCSort]           = useState({ col: "classroomName", dir: "asc" });
  const [cPage,           setCPage]           = useState(1);
  const [cDrawer,         setCDrawer]         = useState(null);
  const [cConfirm,        setCConfirm]        = useState(null);

  // Summary stats
  const assignedTeachers   = new Set(teacherAllocs.map(a => a.teacherId)).size;
  const assignedClassrooms = new Set(classroomAllocs.map(a => a.classroomId)).size;
  const totalAllocs        = teacherAllocs.length + classroomAllocs.length;
  const batchesWithBoth    = BATCH_OPTIONS.filter(b =>
    teacherAllocs.some(a  => a.batchId === b.id && a.status === "Active") &&
    classroomAllocs.some(a => a.batchId === b.id && a.status === "Active")
  ).length;
  const utilRate = BATCH_OPTIONS.length > 0 ? Math.round(batchesWithBoth / BATCH_OPTIONS.length * 100) : 0;

  // Teacher tab
  const handleTSort = col => setTSort(s => ({ col, dir: s.col === col && s.dir === "asc" ? "desc" : "asc" }));

  const filteredTeacher = useMemo(() => {
    let r = teacherAllocs;
    if (tSearch) {
      const q = tSearch.toLowerCase();
      r = r.filter(a =>
        a.teacherName.toLowerCase().includes(q) || a.empId.toLowerCase().includes(q) ||
        a.batchCode.toLowerCase().includes(q)   || a.className.toLowerCase().includes(q)
      );
    }
    if (tFilterClass)  r = r.filter(a => a.classId === tFilterClass);
    if (tFilterBatch)  r = r.filter(a => a.batchId === tFilterBatch);
    if (tFilterStatus) r = r.filter(a => a.status  === tFilterStatus);
    return [...r].sort((a, b) => {
      const v1 = String(a[tSort.col] || ""), v2 = String(b[tSort.col] || "");
      return tSort.dir === "asc" ? v1.localeCompare(v2) : v2.localeCompare(v1);
    });
  }, [teacherAllocs, tSearch, tFilterClass, tFilterBatch, tFilterStatus, tSort]);

  const tTotal = filteredTeacher.length;
  const tSlice = filteredTeacher.slice((tPage - 1) * PAGE_SIZE, tPage * PAGE_SIZE);

  const handleSaveTeacher = record => {
    setTeacherAllocs(prev =>
      prev.some(a => a.id === record.id) ? prev.map(a => a.id === record.id ? record : a) : [...prev, record]
    );
    setTDrawer(null);
  };
  const handleRemoveTeacher = id => {
    setTeacherAllocs(prev => prev.filter(a => a.id !== id));
    setTDrawer(null);
  };

  // Classroom tab
  const handleCSort = col => setCSort(s => ({ col, dir: s.col === col && s.dir === "asc" ? "desc" : "asc" }));

  const filteredClassroom = useMemo(() => {
    let r = classroomAllocs;
    if (cSearch) {
      const q = cSearch.toLowerCase();
      r = r.filter(a =>
        a.classroomName.toLowerCase().includes(q) ||
        a.batchCode.toLowerCase().includes(q)     ||
        a.className.toLowerCase().includes(q)
      );
    }
    if (cFilterClass) r = r.filter(a => a.classId === cFilterClass);
    if (cFilterBatch) r = r.filter(a => a.batchId === cFilterBatch);
    return [...r].sort((a, b) => {
      const v1 = String(a[cSort.col] || ""), v2 = String(b[cSort.col] || "");
      return cSort.dir === "asc" ? v1.localeCompare(v2) : v2.localeCompare(v1);
    });
  }, [classroomAllocs, cSearch, cFilterClass, cFilterBatch, cSort]);

  const cTotal = filteredClassroom.length;
  const cSlice = filteredClassroom.slice((cPage - 1) * PAGE_SIZE, cPage * PAGE_SIZE);

  const handleSaveClassroom = record => {
    setClassroomAllocs(prev =>
      prev.some(a => a.id === record.id) ? prev.map(a => a.id === record.id ? record : a) : [...prev, record]
    );
    setCDrawer(null);
  };
  const handleRemoveClassroom = id => {
    setClassroomAllocs(prev => prev.filter(a => a.id !== id));
    setCDrawer(null);
  };

  // Dashboard widget data
  const maxTeacherBatches = Math.max(...TEACHER_OPTIONS.map(t =>
    teacherAllocs.filter(a => a.teacherId === t.id).length), 1);

  return (
    <div style={{ padding: "32px 24px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1C1917", letterSpacing: "-0.02em", margin: 0 }}>
          Teacher &amp; Classroom Allocation
        </h1>
        <p style={{ fontSize: 13, color: "#A8A29E", margin: "4px 0 0" }}>
          Assign teachers and classrooms to batches and manage academic resources.
        </p>
      </div>

      {/* Stat tiles */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <StatTile label="Total Allocations"   value={totalAllocs}
          sub="Teacher and classroom assignments" />
        <StatTile label="Assigned Teachers"   value={`${assignedTeachers}/${TEACHER_OPTIONS.length}`}
          sub="Teachers allocated to batches" accent="#2563EB" />
        <StatTile label="Assigned Classrooms" value={`${assignedClassrooms}/${CLASSROOM_LIST.length}`}
          sub="Classrooms allocated to batches" accent="#7C3AED" />
        <StatTile label="Resource Utilization" value={`${utilRate}%`}
          sub="Batches with complete allocations" accent="#059669" />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", marginBottom: 20, borderBottom: "2px solid #F5F3EF" }}>
        {[{ id: "teachers", label: "Teacher Allocation" }, { id: "classrooms", label: "Classroom Allocation" }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ padding: "10px 20px", background: "none", border: "none", cursor: "pointer",
              fontSize: 14, fontWeight: 600,
              color: activeTab === tab.id ? "#1C1917" : "#A8A29E",
              borderBottom: `2px solid ${activeTab === tab.id ? "#1C1917" : "transparent"}`,
              marginBottom: -2 }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Teacher Allocation tab ── */}
      {activeTab === "teachers" && (
        <div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
            <div style={{ position: "relative", flex: "1 1 200px", minWidth: 180 }}>
              <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                viewBox="0 0 20 20" width={14} height={14} fill="none" stroke="#A8A29E" strokeWidth={2}>
                <circle cx="9" cy="9" r="6"/><path d="m15 15-3.5-3.5"/>
              </svg>
              <input className="yd-input" placeholder="Search teachers, batches…" value={tSearch}
                onChange={e => { setTSearch(e.target.value); setTPage(1); }}
                style={{ paddingLeft: 32 }} />
            </div>
            <select className="yd-input" style={{ flex: "0 1 150px" }} value={tFilterClass}
              onChange={e => { setTFilterClass(e.target.value); setTFilterBatch(""); setTPage(1); }}>
              <option value="">All Classes</option>
              {CLASS_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="yd-input" style={{ flex: "0 1 160px" }} value={tFilterBatch}
              onChange={e => { setTFilterBatch(e.target.value); setTPage(1); }}>
              <option value="">All Batches</option>
              {BATCH_OPTIONS.filter(b => !tFilterClass || b.classId === tFilterClass)
                .map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
            </select>
            <select className="yd-input" style={{ flex: "0 1 130px" }} value={tFilterStatus}
              onChange={e => { setTFilterStatus(e.target.value); setTPage(1); }}>
              <option value="">All Status</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
            <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }}
              onClick={() => setTDrawer({ alloc: null, mode: "add" })}>
              + Assign Teacher
            </button>
          </div>

          <div className="yd-card" style={{ overflow: "hidden" }}>
            <div className="yd-table-wrap">
              <table className="yd-table">
                <thead>
                  <tr>
                    {[
                      { key: "teacherName", label: "Teacher Name" },
                      { key: "empId",       label: "Employee ID"  },
                      { key: "className",   label: "Class"        },
                      { key: "batchCode",   label: "Batch"        },
                      { key: "startTime",   label: "Timing"       },
                      { key: "status",      label: "Status"       },
                    ].map(col => (
                      <th key={col.key} style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                        onClick={() => { handleTSort(col.key); setTPage(1); }}>
                        {col.label}<SortIcon active={tSort.col === col.key} dir={tSort.dir} />
                      </th>
                    ))}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tSlice.length === 0
                    ? <EmptyState message="Try adjusting your search or filters." />
                    : tSlice.map(a => (
                      <tr key={a.id} style={{ cursor: "pointer" }}
                        onClick={() => setTDrawer({ alloc: a, mode: "view" })}>
                        <td style={{ fontWeight: 600 }}>{a.teacherName}</td>
                        <td style={{ color: "#78716C" }}>{a.empId}</td>
                        <td>{a.className}</td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 600, background: "#EEF2FF",
                            color: "#3730A3", padding: "2px 8px", borderRadius: 6 }}>{a.batchCode}</span>
                          {" "}<span style={{ fontSize: 12, color: "#78716C" }}>{a.batchName}</span>
                        </td>
                        <td style={{ fontSize: 12, color: "#57534E", whiteSpace: "nowrap" }}>
                          {fmt12(a.startTime)} – {fmt12(a.endTime)}
                        </td>
                        <td><StatusBadge status={a.status} /></td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn btn-soft btn-xs"
                              onClick={() => setTDrawer({ alloc: a, mode: "edit" })}>Reassign</button>
                            <button className="btn btn-ghost btn-xs"
                              onClick={() => setTConfirm(a.id)}>Remove</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
            <Pagination page={tPage} total={tTotal} perPage={PAGE_SIZE} onChange={setTPage} />
          </div>
        </div>
      )}

      {/* ── Classroom Allocation tab ── */}
      {activeTab === "classrooms" && (
        <div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
            <div style={{ position: "relative", flex: "1 1 200px", minWidth: 180 }}>
              <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                viewBox="0 0 20 20" width={14} height={14} fill="none" stroke="#A8A29E" strokeWidth={2}>
                <circle cx="9" cy="9" r="6"/><path d="m15 15-3.5-3.5"/>
              </svg>
              <input className="yd-input" placeholder="Search classrooms, batches…" value={cSearch}
                onChange={e => { setCSearch(e.target.value); setCPage(1); }}
                style={{ paddingLeft: 32 }} />
            </div>
            <select className="yd-input" style={{ flex: "0 1 150px" }} value={cFilterClass}
              onChange={e => { setCFilterClass(e.target.value); setCFilterBatch(""); setCPage(1); }}>
              <option value="">All Classes</option>
              {CLASS_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="yd-input" style={{ flex: "0 1 160px" }} value={cFilterBatch}
              onChange={e => { setCFilterBatch(e.target.value); setCPage(1); }}>
              <option value="">All Batches</option>
              {BATCH_OPTIONS.filter(b => !cFilterClass || b.classId === cFilterClass)
                .map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
            </select>
            <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }}
              onClick={() => setCDrawer({ alloc: null, mode: "add" })}>
              + Assign Classroom
            </button>
          </div>

          <div className="yd-card" style={{ overflow: "hidden" }}>
            <div className="yd-table-wrap">
              <table className="yd-table">
                <thead>
                  <tr>
                    {[
                      { key: "classroomName",     label: "Classroom" },
                      { key: "classroomCapacity", label: "Capacity"  },
                      { key: "className",         label: "Class"     },
                      { key: "batchCode",         label: "Batch"     },
                      { key: "startTime",         label: "Timing"    },
                      { key: "status",            label: "Status"    },
                    ].map(col => (
                      <th key={col.key} style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                        onClick={() => { handleCSort(col.key); setCPage(1); }}>
                        {col.label}<SortIcon active={cSort.col === col.key} dir={cSort.dir} />
                      </th>
                    ))}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cSlice.length === 0
                    ? <EmptyState message="Try adjusting your search or filters." />
                    : cSlice.map(a => (
                      <tr key={a.id} style={{ cursor: "pointer" }}
                        onClick={() => setCDrawer({ alloc: a, mode: "view" })}>
                        <td style={{ fontWeight: 600 }}>{a.classroomName}</td>
                        <td style={{ color: "#78716C" }}>{a.classroomCapacity}</td>
                        <td>{a.className}</td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 600, background: "#F3E8FF",
                            color: "#7E22CE", padding: "2px 8px", borderRadius: 6 }}>{a.batchCode}</span>
                          {" "}<span style={{ fontSize: 12, color: "#78716C" }}>{a.batchName}</span>
                        </td>
                        <td style={{ fontSize: 12, color: "#57534E", whiteSpace: "nowrap" }}>
                          {fmt12(a.startTime)} – {fmt12(a.endTime)}
                        </td>
                        <td><StatusBadge status={a.status} /></td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn btn-soft btn-xs"
                              onClick={() => setCDrawer({ alloc: a, mode: "edit" })}>Reassign</button>
                            <button className="btn btn-ghost btn-xs"
                              onClick={() => setCConfirm(a.id)}>Remove</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
            <Pagination page={cPage} total={cTotal} perPage={PAGE_SIZE} onChange={setCPage} />
          </div>
        </div>
      )}

      {/* Dashboard widgets */}
      <div style={{ display: "flex", gap: 16, marginTop: 24, flexWrap: "wrap" }}>
        {/* Teacher Workload */}
        <div className="yd-card" style={{ flex: 1, minWidth: 260, padding: "20px 22px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1917", marginBottom: 14 }}>
            Teacher Workload Overview
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Total",      value: TEACHER_OPTIONS.length, color: "#1C1917" },
              { label: "Assigned",   value: assignedTeachers,        color: "#2563EB" },
              { label: "Unassigned", value: TEACHER_OPTIONS.length - assignedTeachers, color: "#A8A29E" },
            ].map(m => (
              <div key={m.label} style={{ flex: 1, textAlign: "center", padding: "10px 0",
                background: "#FAFAF8", borderRadius: 10 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: m.color }}>{m.value}</div>
                <div style={{ fontSize: 11, color: "#A8A29E", marginTop: 2 }}>{m.label}</div>
              </div>
            ))}
          </div>
          {TEACHER_OPTIONS.map(t => {
            const count = teacherAllocs.filter(a => a.teacherId === t.id).length;
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#57534E", flex: 1, whiteSpace: "nowrap" }}>{t.name}</span>
                <div style={{ flex: 2, height: 6, background: "#F5F3EF", borderRadius: 99 }}>
                  <div style={{ height: "100%", borderRadius: 99,
                    width: `${(count / maxTeacherBatches) * 100}%`, background: "#2563EB" }} />
                </div>
                <span style={{ fontSize: 11, color: "#A8A29E", minWidth: 16, textAlign: "right" }}>{count}</span>
              </div>
            );
          })}
        </div>

        {/* Classroom Utilization */}
        <div className="yd-card" style={{ flex: 1, minWidth: 260, padding: "20px 22px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1917", marginBottom: 14 }}>
            Classroom Utilization Overview
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Total",      value: CLASSROOM_LIST.length,                          color: "#1C1917" },
              { label: "Allocated",  value: assignedClassrooms,                             color: "#7C3AED" },
              { label: "Available",  value: CLASSROOM_LIST.length - assignedClassrooms,     color: "#059669" },
            ].map(m => (
              <div key={m.label} style={{ flex: 1, textAlign: "center", padding: "10px 0",
                background: "#FAFAF8", borderRadius: 10 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: m.color }}>{m.value}</div>
                <div style={{ fontSize: 11, color: "#A8A29E", marginTop: 2 }}>{m.label}</div>
              </div>
            ))}
          </div>
          {CLASSROOM_LIST.map(r => {
            const count = classroomAllocs.filter(a => a.classroomId === r.id).length;
            return (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#57534E", flex: 1 }}>{r.name}</span>
                <div style={{ flex: 2, height: 6, background: "#F5F3EF", borderRadius: 99 }}>
                  <div style={{ height: "100%", borderRadius: 99,
                    width: count > 0 ? "100%" : "0%", background: count > 0 ? "#7C3AED" : "transparent" }} />
                </div>
                <span style={{ fontSize: 11, color: "#A8A29E", minWidth: 16, textAlign: "right" }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Drawers */}
      {tDrawer && (
        <TeacherDrawer
          drawer={tDrawer} allocs={teacherAllocs}
          onClose={() => setTDrawer(null)}
          onSave={handleSaveTeacher}
          onRemove={handleRemoveTeacher}
        />
      )}
      {cDrawer && (
        <ClassroomDrawer
          drawer={cDrawer} allocs={classroomAllocs}
          onClose={() => setCDrawer(null)}
          onSave={handleSaveClassroom}
          onRemove={handleRemoveClassroom}
        />
      )}

      {/* Inline confirm dialogs (table Remove buttons) */}
      {tConfirm && (
        <ConfirmDialog
          title="Remove Allocation"
          message="Remove this teacher allocation? This action cannot be undone."
          onConfirm={() => { handleRemoveTeacher(tConfirm); setTConfirm(null); }}
          onCancel={() => setTConfirm(null)}
        />
      )}
      {cConfirm && (
        <ConfirmDialog
          title="Remove Allocation"
          message="Remove this classroom allocation? This action cannot be undone."
          onConfirm={() => { handleRemoveClassroom(cConfirm); setCConfirm(null); }}
          onCancel={() => setCConfirm(null)}
        />
      )}
    </div>
  );
}
