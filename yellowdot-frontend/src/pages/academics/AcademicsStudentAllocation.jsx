import { useState, useMemo } from "react";

// ── Reference data (mirrors Phase 1 & 2 seed) ─────────────────────────────────
const CLASS_OPTIONS = [
  { id: "1", name: "Playgroup",   code: "PG001", ageGroup: "2–3 years" },
  { id: "2", name: "Nursery",     code: "NR001", ageGroup: "3–4 years" },
  { id: "3", name: "Junior KG",   code: "JKG01", ageGroup: "4–5 years" },
  { id: "4", name: "Senior KG",   code: "SKG01", ageGroup: "5–6 years" },
  { id: "5", name: "Daycare",     code: "DC001", ageGroup: "1–5 years" },
  { id: "6", name: "Abacus",      code: "AB001", ageGroup: "5–10 years" },
  { id: "7", name: "Handwriting", code: "HW001", ageGroup: "4–8 years" },
];

const BATCH_OPTIONS = [
  { id: "1", code: "PGB-AM", name: "Morning Batch",   classId: "1", className: "Playgroup",  startTime: "09:00", endTime: "12:00", capacity: 12 },
  { id: "2", code: "PGB-PM", name: "Afternoon Batch", classId: "1", className: "Playgroup",  startTime: "13:00", endTime: "16:00", capacity: 12 },
  { id: "3", code: "NRB-AM", name: "Morning Batch",   classId: "2", className: "Nursery",    startTime: "09:00", endTime: "12:00", capacity: 15 },
  { id: "4", code: "NRB-PM", name: "Afternoon Batch", classId: "2", className: "Nursery",    startTime: "13:00", endTime: "16:00", capacity: 15 },
  { id: "5", code: "JKB-AM", name: "Morning Batch",   classId: "3", className: "Junior KG",  startTime: "09:00", endTime: "12:00", capacity: 20 },
  { id: "6", code: "SKB-AM", name: "Morning Batch",   classId: "4", className: "Senior KG",  startTime: "09:00", endTime: "12:00", capacity: 20 },
];

// ── Sample students (linked to the student module schema) ─────────────────────
const ALL_STUDENTS = [
  { id: "S01", name: "Aarav Sharma",    admNo: "YD-2025-001", gender: "Male",   dob: "2022-03-15", fatherName: "Vikram Sharma",    phone: "+91 98765 00001" },
  { id: "S02", name: "Priya Patel",     admNo: "YD-2025-002", gender: "Female", dob: "2022-07-22", fatherName: "Nitin Patel",      phone: "+91 98765 00002" },
  { id: "S03", name: "Rohan Kumar",     admNo: "YD-2025-003", gender: "Male",   dob: "2022-01-08", fatherName: "Suresh Kumar",     phone: "+91 98765 00003" },
  { id: "S04", name: "Ananya Singh",    admNo: "YD-2025-004", gender: "Female", dob: "2021-09-14", fatherName: "Rahul Singh",      phone: "+91 98765 00004" },
  { id: "S05", name: "Kiran Shah",      admNo: "YD-2025-005", gender: "Male",   dob: "2021-05-30", fatherName: "Ajay Shah",        phone: "+91 98765 00005" },
  { id: "S06", name: "Meera Joshi",     admNo: "YD-2025-006", gender: "Female", dob: "2021-11-19", fatherName: "Deepak Joshi",     phone: "+91 98765 00006" },
  { id: "S07", name: "Dev Verma",       admNo: "YD-2025-007", gender: "Male",   dob: "2020-04-03", fatherName: "Anil Verma",       phone: "+91 98765 00007" },
  { id: "S08", name: "Pooja Mehta",     admNo: "YD-2025-008", gender: "Female", dob: "2020-08-27", fatherName: "Sanjay Mehta",     phone: "+91 98765 00008" },
  { id: "S09", name: "Arjun Reddy",     admNo: "YD-2025-009", gender: "Male",   dob: "2019-12-11", fatherName: "Ravi Reddy",       phone: "+91 98765 00009" },
  { id: "S10", name: "Sneha Gupta",     admNo: "YD-2025-010", gender: "Female", dob: "2019-06-25", fatherName: "Manoj Gupta",      phone: "+91 98765 00010" },
  { id: "S11", name: "Ravi Nair",       admNo: "YD-2025-011", gender: "Male",   dob: "2022-02-18", fatherName: "Sunil Nair",       phone: "+91 98765 00011" },
  { id: "S12", name: "Kavya Iyer",      admNo: "YD-2025-012", gender: "Female", dob: "2021-10-05", fatherName: "Krishnan Iyer",    phone: "+91 98765 00012" },
  { id: "S13", name: "Ishaan Desai",    admNo: "YD-2025-013", gender: "Male",   dob: "2020-07-14", fatherName: "Hitesh Desai",     phone: "+91 98765 00013" },
  { id: "S14", name: "Nisha Rao",       admNo: "YD-2025-014", gender: "Female", dob: "2019-03-22", fatherName: "Prasad Rao",       phone: "+91 98765 00014" },
  { id: "S15", name: "Aditya Khanna",   admNo: "YD-2025-015", gender: "Male",   dob: "2022-09-07", fatherName: "Rakesh Khanna",    phone: "+91 98765 00015" },
];

// ── Seed enrollments ──────────────────────────────────────────────────────────
const SEED_ENROLLMENTS = [
  { id: "E01", studentId: "S01", classId: "1", batchId: "1", enrollmentDate: "2025-06-01", notes: "", status: "Active" },
  { id: "E02", studentId: "S02", classId: "1", batchId: "1", enrollmentDate: "2025-06-01", notes: "", status: "Active" },
  { id: "E03", studentId: "S03", classId: "1", batchId: "2", enrollmentDate: "2025-06-01", notes: "", status: "Active" },
  { id: "E04", studentId: "S04", classId: "2", batchId: "3", enrollmentDate: "2025-06-01", notes: "", status: "Active" },
  { id: "E05", studentId: "S05", classId: "2", batchId: "3", enrollmentDate: "2025-06-01", notes: "", status: "Active" },
  { id: "E06", studentId: "S06", classId: "2", batchId: "4", enrollmentDate: "2025-06-01", notes: "", status: "Active" },
  { id: "E07", studentId: "S07", classId: "3", batchId: "5", enrollmentDate: "2025-06-01", notes: "", status: "Active" },
  { id: "E08", studentId: "S08", classId: "3", batchId: "5", enrollmentDate: "2025-06-01", notes: "", status: "Active" },
  { id: "E09", studentId: "S09", classId: "4", batchId: "6", enrollmentDate: "2025-06-01", notes: "", status: "Active" },
  { id: "E10", studentId: "S10", classId: "4", batchId: "6", enrollmentDate: "2025-06-01", notes: "", status: "Active" },
  { id: "E11", studentId: "S13", classId: "3", batchId: "5", enrollmentDate: "2025-06-15", notes: "", status: "Active" },
  { id: "E12", studentId: "S14", classId: "4", batchId: "6", enrollmentDate: "2025-06-15", notes: "", status: "Active" },
];

// ── Seed transfer history ──────────────────────────────────────────────────────
const SEED_TRANSFERS = [
  {
    id: "TR1", studentId: "S04",
    fromClassId: "1", fromClassName: "Playgroup",  fromBatchId: "1", fromBatchCode: "PGB-AM",
    toClassId:   "2", toClassName:   "Nursery",    toBatchId:   "3", toBatchCode:   "NRB-AM",
    effectiveDate: "2025-06-01", reason: "Age group progression", status: "Completed",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
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

function occupancyColor(pct) {
  if (pct >= 100) return "#DC2626";
  if (pct >= 80)  return "#D97706";
  return "#16A34A";
}

function enrichEnrollment(e) {
  const student = ALL_STUDENTS.find(s => s.id === e.studentId) || {};
  const cls     = CLASS_OPTIONS.find(c => c.id === e.classId)  || {};
  const batch   = BATCH_OPTIONS.find(b => b.id === e.batchId)  || {};
  return {
    ...e,
    studentName: student.name  || "—",
    admNo:       student.admNo || "—",
    fatherName:  student.fatherName || "—",
    phone:       student.phone      || "—",
    className:   cls.name   || "—",
    classCode:   cls.code   || "",
    batchName:   batch.name || "—",
    batchCode:   batch.code || "",
    startTime:   batch.startTime || "",
    endTime:     batch.endTime   || "",
  };
}

const PAGE_SIZE = 10;

// ── Shared UI ─────────────────────────────────────────────────────────────────
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
    Active:      { bg: "#DCFCE7", color: "#15803D" },
    Inactive:    { bg: "#FEF9C3", color: "#854D0E" },
    Transferred: { bg: "#DBEAFE", color: "#1D4ED8" },
    Completed:   { bg: "#DCFCE7", color: "#15803D" },
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
      <span style={{ fontSize: 12, color: "#A8A29E", fontWeight: 500, minWidth: 130 }}>{label}</span>
      <span style={{ fontSize: 13, color: "#1C1917", fontWeight: 500, textAlign: "right" }}>{value || "—"}</span>
    </div>
  );
}

function CapacityBar({ enrolled, capacity }) {
  const pct  = capacity > 0 ? Math.round(enrolled / capacity * 100) : 0;
  const color = occupancyColor(pct);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#57534E", marginBottom: 4 }}>
        <span>{enrolled} / {capacity} students</span>
        <span style={{ color, fontWeight: 600 }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: "#F5F3EF", borderRadius: 99 }}>
        <div style={{ height: "100%", borderRadius: 99, width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
    </div>
  );
}

function ConfirmDialog({ title, message, onConfirm, onCancel, confirmLabel = "Remove", danger = true }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)" }} onClick={onCancel} />
      <div className="yd-card" style={{ position: "relative", width: 420, padding: "28px 28px 24px", zIndex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1C1917", marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 13, color: "#78716C", lineHeight: 1.6 }}>{message}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
          <button className={`btn btn-sm ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title = "No Records Found", message }) {
  return (
    <tr><td colSpan={99}>
      <div style={{ textAlign: "center", padding: "48px 24px" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#57534E", marginBottom: 4 }}>{title}</div>
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
  const nums  = Array.from({ length: Math.min(pages, 5) }, (_, i) => {
    if (pages <= 5)        return i + 1;
    if (page <= 3)         return i + 1;
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
        {nums.map(p => <PagBtn key={p} active={p === page} onClick={() => onChange(p)}>{p}</PagBtn>)}
        <PagBtn disabled={page >= pages} onClick={() => onChange(page + 1)}>›</PagBtn>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
      viewBox="0 0 20 20" width={14} height={14} fill="none" stroke="#A8A29E" strokeWidth={2}>
      <circle cx="9" cy="9" r="6"/><path d="m15 15-3.5-3.5"/>
    </svg>
  );
}

// ── Enrollment Drawer ─────────────────────────────────────────────────────────
function EnrollmentDrawer({ drawer, enrollments, onClose, onSave, onRemove }) {
  const { enrollment, mode: initMode } = drawer;
  const [mode, setMode] = useState(initMode);
  const [form, setForm] = useState(
    enrollment
      ? { studentId: enrollment.studentId, classId: enrollment.classId,
          batchId: enrollment.batchId, enrollmentDate: enrollment.enrollmentDate,
          notes: enrollment.notes, status: enrollment.status }
      : { studentId: "", classId: "", batchId: "",
          enrollmentDate: new Date().toISOString().slice(0, 10),
          notes: "", status: "Active" }
  );
  const [errors, setErrors]         = useState({});
  const [capWarn, setCapWarn]       = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const isView = mode === "view";
  const isEdit = mode === "edit";
  const isAdd  = mode === "add";

  const batchesForClass = BATCH_OPTIONS.filter(b => !form.classId || b.classId === form.classId);

  function getBatchEnrolled(batchId) {
    return enrollments.filter(e =>
      e.batchId === batchId && e.status === "Active" && (!enrollment || e.id !== enrollment.id)
    ).length;
  }

  function checkCapacity(f) {
    if (!f.batchId) return null;
    const batch = BATCH_OPTIONS.find(b => b.id === f.batchId);
    if (!batch) return null;
    const enrolled = getBatchEnrolled(f.batchId);
    if (enrolled >= batch.capacity) return `${batch.code} is at full capacity (${batch.capacity}/${batch.capacity}).`;
    if (enrolled >= batch.capacity * 0.9) return `${batch.code} is nearly full — ${batch.capacity - enrolled} seat(s) remaining.`;
    return null;
  }

  function checkDuplicate(f) {
    if (!f.studentId || !f.batchId) return null;
    const dup = enrollments.find(e =>
      e.studentId === f.studentId && e.batchId === f.batchId &&
      e.status === "Active" && (!enrollment || e.id !== enrollment.id)
    );
    if (dup) {
      const s = ALL_STUDENTS.find(x => x.id === f.studentId);
      return `${s?.name || "This student"} is already enrolled in this batch.`;
    }
    const dupClass = enrollments.find(e =>
      e.studentId === f.studentId && e.classId === f.classId &&
      e.status === "Active" && (!enrollment || e.id !== enrollment.id)
    );
    if (dupClass) {
      const s = ALL_STUDENTS.find(x => x.id === f.studentId);
      const cls = CLASS_OPTIONS.find(c => c.id === f.classId);
      return `${s?.name || "This student"} is already enrolled in ${cls?.name || "this class"}.`;
    }
    return null;
  }

  function set(key, val) {
    const f = { ...form, [key]: val };
    if (key === "classId") f.batchId = "";
    setForm(f);
    setCapWarn(checkCapacity(f));
    if (errors[key]) setErrors(e => ({ ...e, [key]: null }));
  }

  function validate() {
    const e = {};
    if (!form.studentId)     e.studentId     = "Required";
    if (!form.classId)       e.classId       = "Required";
    if (!form.batchId)       e.batchId       = "Required";
    if (!form.enrollmentDate) e.enrollmentDate = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    const dup = checkDuplicate(form);
    if (dup) { setErrors(e => ({ ...e, _dup: dup })); return; }
    const cap = checkCapacity(form);
    if (cap && cap.includes("full capacity")) { setCapWarn(cap); return; }
    const student = ALL_STUDENTS.find(s => s.id === form.studentId);
    const cls     = CLASS_OPTIONS.find(c => c.id === form.classId);
    const batch   = BATCH_OPTIONS.find(b => b.id === form.batchId);
    onSave({
      ...(enrollment || {}),
      id: enrollment?.id || `E${Date.now()}`,
      studentId: form.studentId, studentName: student.name, admNo: student.admNo,
      classId: form.classId, className: cls.name,
      batchId: form.batchId, batchCode: batch.code, batchName: batch.name,
      enrollmentDate: form.enrollmentDate, notes: form.notes, status: form.status,
    });
  }

  const studentHistory = enrollment
    ? [] // In a real system this would be fetched from history
    : [];

  const batchCapData = form.batchId ? (() => {
    const b = BATCH_OPTIONS.find(x => x.id === form.batchId);
    const enrolled = getBatchEnrolled(form.batchId);
    return b ? { ...b, enrolled } : null;
  })() : null;

  const enriched = enrollment ? enrichEnrollment(enrollment) : null;

  return (
    <>
      <div className="yd-drawer-overlay" onClick={onClose} />
      <div className="yd-drawer" style={{ width: 440 }}>
        <div className="yd-drawer-header">
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#1C1917" }}>
              {isView ? enriched?.studentName : isEdit ? "Edit Enrollment" : "Enroll Student"}
            </div>
            {isView && <div style={{ fontSize: 12, color: "#A8A29E", marginTop: 2 }}>
              {enriched?.admNo} · {enriched?.className}
            </div>}
          </div>
          <button className="btn btn-ghost btn-xs" onClick={onClose}>
            <svg viewBox="0 0 20 20" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M4 4l12 12M16 4L4 16"/></svg>
          </button>
        </div>

        <div className="yd-drawer-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {isView && enriched ? (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <StatusBadge status={enriched.status} />
                <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 10px",
                  borderRadius: 99, fontSize: 11, fontWeight: 600, background: "#EEF2FF", color: "#3730A3" }}>
                  {enriched.batchCode}
                </span>
              </div>
              <div className="yd-card" style={{ padding: "16px 18px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#A8A29E", textTransform: "uppercase",
                  letterSpacing: "0.06em", marginBottom: 8 }}>Student Information</div>
                <InfoRow label="Name"          value={enriched.studentName} />
                <InfoRow label="Admission No." value={enriched.admNo} />
                <InfoRow label="Parent"        value={enriched.fatherName} />
                <InfoRow label="Contact"       value={enriched.phone} />
              </div>
              <div className="yd-card" style={{ padding: "16px 18px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#A8A29E", textTransform: "uppercase",
                  letterSpacing: "0.06em", marginBottom: 8 }}>Academic Information</div>
                <InfoRow label="Class"           value={enriched.className} />
                <InfoRow label="Batch"           value={`${enriched.batchName} (${enriched.batchCode})`} />
                <InfoRow label="Timing"          value={enriched.startTime ? `${fmt12(enriched.startTime)} – ${fmt12(enriched.endTime)}` : "—"} />
                <InfoRow label="Enrollment Date" value={fmtDate(enriched.enrollmentDate)} />
                {enriched.notes && <InfoRow label="Notes" value={enriched.notes} />}
              </div>
            </>
          ) : (
            <>
              {errors._dup && (
                <div style={{ display: "flex", gap: 10, padding: "10px 14px", background: "#FEF2F2",
                  border: "1px solid #FECACA", borderRadius: 8 }}>
                  <span style={{ fontSize: 12, color: "#991B1B", lineHeight: 1.5 }}>{errors._dup}</span>
                </div>
              )}
              {capWarn && (
                <div style={{ display: "flex", gap: 10, padding: "10px 14px",
                  background: capWarn.includes("full capacity") ? "#FEF2F2" : "#FEF3C7",
                  border: `1px solid ${capWarn.includes("full capacity") ? "#FECACA" : "#FDE68A"}`,
                  borderRadius: 8 }}>
                  <span style={{ fontSize: 12, color: capWarn.includes("full capacity") ? "#991B1B" : "#92400E", lineHeight: 1.5 }}>
                    {capWarn}
                  </span>
                </div>
              )}
              <FormField label="Student" required error={errors.studentId}>
                <select className="yd-input" value={form.studentId} onChange={e => set("studentId", e.target.value)}>
                  <option value="">Select student</option>
                  {ALL_STUDENTS.map(s => <option key={s.id} value={s.id}>{s.name} ({s.admNo})</option>)}
                </select>
              </FormField>
              <FormField label="Class" required error={errors.classId}>
                <select className="yd-input" value={form.classId} onChange={e => set("classId", e.target.value)}>
                  <option value="">Select class</option>
                  {CLASS_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </FormField>
              <FormField label="Batch" required error={errors.batchId}>
                <select className="yd-input" value={form.batchId} onChange={e => set("batchId", e.target.value)}>
                  <option value="">Select batch</option>
                  {batchesForClass.map(b => {
                    const enrolled = getBatchEnrolled(b.id);
                    const avail    = b.capacity - enrolled;
                    return (
                      <option key={b.id} value={b.id} disabled={avail <= 0}>
                        {b.code} — {b.name} ({avail > 0 ? `${avail} seats` : "Full"})
                      </option>
                    );
                  })}
                </select>
              </FormField>
              {batchCapData && (
                <div style={{ padding: "10px 12px", background: "#FAFAF8", borderRadius: 8, border: "1px solid #E7E3DC" }}>
                  <CapacityBar enrolled={batchCapData.enrolled} capacity={batchCapData.capacity} />
                </div>
              )}
              <FormField label="Enrollment Date" required error={errors.enrollmentDate}>
                <input type="date" className="yd-input" value={form.enrollmentDate}
                  onChange={e => set("enrollmentDate", e.target.value)} />
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
                <button className="btn btn-primary btn-sm" onClick={handleSave}
                  disabled={capWarn?.includes("full capacity")}>Save Changes</button>
              </div>
            </>
          )}
          {isAdd && (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave}
                disabled={capWarn?.includes("full capacity")}>Enroll Student</button>
            </div>
          )}
        </div>
      </div>
      {confirmRemove && (
        <ConfirmDialog
          title="Remove Enrollment"
          message={`Remove ${enriched?.studentName || "this student"} from ${enriched?.className || "this class"}? The enrollment record will be deleted.`}
          onConfirm={() => { onRemove(enrollment.id); setConfirmRemove(false); onClose(); }}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
    </>
  );
}

// ── Transfer Drawer ───────────────────────────────────────────────────────────
function TransferDrawer({ enrollments, onClose, onSave }) {
  const [form, setForm] = useState({
    studentId: "", toClassId: "", toBatchId: "",
    effectiveDate: new Date().toISOString().slice(0, 10),
    reason: "",
  });
  const [errors, setErrors] = useState({});

  const currentEnrollment = enrollments.find(
    e => e.studentId === form.studentId && e.status === "Active"
  );
  const enrichedCurrent = currentEnrollment ? enrichEnrollment(currentEnrollment) : null;
  const toBatchesForClass = BATCH_OPTIONS.filter(b => !form.toClassId || b.classId === form.toClassId);

  function set(key, val) {
    const f = { ...form, [key]: val };
    if (key === "toClassId") f.toBatchId = "";
    setForm(f);
    if (errors[key]) setErrors(e => ({ ...e, [key]: null }));
  }

  function validate() {
    const e = {};
    if (!form.studentId)     e.studentId     = "Required";
    if (!form.toClassId)     e.toClassId     = "Required";
    if (!form.toBatchId)     e.toBatchId     = "Required";
    if (!form.effectiveDate) e.effectiveDate = "Required";
    if (!form.reason.trim()) e.reason        = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    const student  = ALL_STUDENTS.find(s => s.id === form.studentId);
    const toClass  = CLASS_OPTIONS.find(c => c.id === form.toClassId);
    const toBatch  = BATCH_OPTIONS.find(b => b.id === form.toBatchId);
    onSave({
      studentId:     form.studentId,
      fromClassId:   enrichedCurrent?.classId   || "",
      fromClassName: enrichedCurrent?.className || "—",
      fromBatchId:   enrichedCurrent?.batchId   || "",
      fromBatchCode: enrichedCurrent?.batchCode || "—",
      toClassId:     form.toClassId,
      toClassName:   toClass.name,
      toBatchId:     form.toBatchId,
      toBatchCode:   toBatch.code,
      effectiveDate: form.effectiveDate,
      reason:        form.reason,
    });
  }

  return (
    <>
      <div className="yd-drawer-overlay" onClick={onClose} />
      <div className="yd-drawer" style={{ width: 440 }}>
        <div className="yd-drawer-header">
          <div style={{ fontWeight: 700, fontSize: 16, color: "#1C1917" }}>New Transfer</div>
          <button className="btn btn-ghost btn-xs" onClick={onClose}>
            <svg viewBox="0 0 20 20" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M4 4l12 12M16 4L4 16"/></svg>
          </button>
        </div>

        <div className="yd-drawer-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <FormField label="Student" required error={errors.studentId}>
            <select className="yd-input" value={form.studentId} onChange={e => set("studentId", e.target.value)}>
              <option value="">Select student</option>
              {ALL_STUDENTS.map(s => <option key={s.id} value={s.id}>{s.name} ({s.admNo})</option>)}
            </select>
          </FormField>

          {enrichedCurrent && (
            <div style={{ padding: "12px 14px", background: "#FAFAF8", borderRadius: 10,
              border: "1px solid #E7E3DC" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#A8A29E", textTransform: "uppercase",
                letterSpacing: "0.05em", marginBottom: 8 }}>Current Allocation</div>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 99,
                  background: "#F5F3EF", color: "#57534E", fontWeight: 600 }}>
                  {enrichedCurrent.className}
                </span>
                <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 99,
                  background: "#EEF2FF", color: "#3730A3", fontWeight: 600 }}>
                  {enrichedCurrent.batchCode}
                </span>
              </div>
            </div>
          )}
          {form.studentId && !enrichedCurrent && (
            <div style={{ padding: "10px 14px", background: "#FEF3C7", border: "1px solid #FDE68A",
              borderRadius: 8, fontSize: 12, color: "#92400E" }}>
              This student has no active enrollment. They will be assigned directly.
            </div>
          )}

          <div style={{ borderTop: "2px dashed #E7E3DC", paddingTop: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#A8A29E", textTransform: "uppercase",
              letterSpacing: "0.05em", marginBottom: 12 }}>Transfer To</div>
          </div>

          <FormField label="New Class" required error={errors.toClassId}>
            <select className="yd-input" value={form.toClassId} onChange={e => set("toClassId", e.target.value)}>
              <option value="">Select class</option>
              {CLASS_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
          <FormField label="New Batch" required error={errors.toBatchId}>
            <select className="yd-input" value={form.toBatchId} onChange={e => set("toBatchId", e.target.value)}>
              <option value="">Select batch</option>
              {toBatchesForClass.map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
            </select>
          </FormField>
          <FormField label="Effective Date" required error={errors.effectiveDate}>
            <input type="date" className="yd-input" value={form.effectiveDate}
              onChange={e => set("effectiveDate", e.target.value)} />
          </FormField>
          <FormField label="Transfer Reason" required error={errors.reason}>
            <textarea className="yd-input" rows={3} value={form.reason}
              onChange={e => set("reason", e.target.value)}
              placeholder="e.g. Age group progression, parent request…"
              style={{ resize: "vertical" }} />
          </FormField>
        </div>

        <div className="yd-drawer-footer" style={{ justifyContent: "flex-end" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave}>Initiate Transfer</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AcademicsStudentAllocation() {
  const [activeTab, setActiveTab] = useState("allocations");

  // Core state
  const [enrollments, setEnrollments] = useState(() =>
    SEED_ENROLLMENTS.map(e => ({ ...e, ...enrichEnrollment(e) }))
  );
  const [transfers, setTransfers] = useState(SEED_TRANSFERS);

  // Tab 1 — Student Allocations
  const [search,       setSearch]       = useState("");
  const [filterClass,  setFilterClass]  = useState("");
  const [filterBatch,  setFilterBatch]  = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sort,         setSort]         = useState({ col: "studentName", dir: "asc" });
  const [page,         setPage]         = useState(1);
  const [drawer,       setDrawer]       = useState(null);
  const [confirm,      setConfirm]      = useState(null);

  // Tab 2 — Bulk Allocation
  const [selected,     setSelected]     = useState(new Set());
  const [bulkClass,    setBulkClass]    = useState("");
  const [bulkBatch,    setBulkBatch]    = useState("");
  const [bulkSearch,   setBulkSearch]   = useState("");
  const [bulkPreview,  setBulkPreview]  = useState(false);

  // Tab 3 — Transfers
  const [transferDrawer, setTransferDrawer] = useState(false);

  // ── Computed values ──────────────────────────────────────────────────────────
  const activeEnrollments = enrollments.filter(e => e.status === "Active");

  const totalCapacity = BATCH_OPTIONS.reduce((s, b) => s + b.capacity, 0);
  const totalEnrolled = activeEnrollments.length;
  const availableSeats = totalCapacity - totalEnrolled;
  const occupancyRate  = totalCapacity > 0 ? Math.round(totalEnrolled / totalCapacity * 100) : 0;

  const allocatedStudentIds = new Set(activeEnrollments.map(e => e.studentId));
  const unallocated = ALL_STUDENTS.filter(s => !allocatedStudentIds.has(s.id));

  // Per-batch enrolled count
  function batchEnrolled(batchId) {
    return activeEnrollments.filter(e => e.batchId === batchId).length;
  }

  // ── Tab 1 filter/sort/page ───────────────────────────────────────────────────
  const handleSort = col => setSort(s => ({ col, dir: s.col === col && s.dir === "asc" ? "desc" : "asc" }));

  const filtered = useMemo(() => {
    let r = enrollments;
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(e =>
        (e.studentName || "").toLowerCase().includes(q) ||
        (e.admNo       || "").toLowerCase().includes(q) ||
        (e.className   || "").toLowerCase().includes(q) ||
        (e.batchCode   || "").toLowerCase().includes(q)
      );
    }
    if (filterClass)  r = r.filter(e => e.classId  === filterClass);
    if (filterBatch)  r = r.filter(e => e.batchId  === filterBatch);
    if (filterStatus) r = r.filter(e => e.status   === filterStatus);
    return [...r].sort((a, b) => {
      const v1 = String(a[sort.col] || ""), v2 = String(b[sort.col] || "");
      return sort.dir === "asc" ? v1.localeCompare(v2) : v2.localeCompare(v1);
    });
  }, [enrollments, search, filterClass, filterBatch, filterStatus, sort]);

  const total = filtered.length;
  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Tab 1 handlers ───────────────────────────────────────────────────────────
  function handleSaveEnrollment(record) {
    const enriched = enrichEnrollment(record);
    setEnrollments(prev =>
      prev.some(e => e.id === record.id)
        ? prev.map(e => e.id === record.id ? enriched : e)
        : [...prev, enriched]
    );
    setDrawer(null);
  }

  function handleRemoveEnrollment(id) {
    setEnrollments(prev => prev.filter(e => e.id !== id));
    setDrawer(null);
  }

  // ── Tab 2 — Bulk ─────────────────────────────────────────────────────────────
  const bulkStudents = useMemo(() => {
    let r = ALL_STUDENTS;
    if (bulkSearch) {
      const q = bulkSearch.toLowerCase();
      r = r.filter(s => s.name.toLowerCase().includes(q) || s.admNo.toLowerCase().includes(q));
    }
    return r;
  }, [bulkSearch]);

  const bulkBatchesForClass = BATCH_OPTIONS.filter(b => !bulkClass || b.classId === bulkClass);

  function toggleSelect(id) {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function toggleAll() {
    if (selected.size === bulkStudents.length) setSelected(new Set());
    else setSelected(new Set(bulkStudents.map(s => s.id)));
  }

  function applyBulk() {
    if (!bulkClass || !bulkBatch || selected.size === 0) return;
    const cls   = CLASS_OPTIONS.find(c => c.id === bulkClass);
    const batch = BATCH_OPTIONS.find(b => b.id === bulkBatch);
    const newEnrollments = [...selected].map(sid => {
      const student = ALL_STUDENTS.find(s => s.id === sid);
      const record  = {
        id: `E${Date.now()}_${sid}`, studentId: sid,
        classId: bulkClass, batchId: bulkBatch,
        enrollmentDate: new Date().toISOString().slice(0, 10), notes: "", status: "Active",
        studentName: student.name, admNo: student.admNo, fatherName: student.fatherName,
        phone: student.phone, className: cls.name, batchCode: batch.code, batchName: batch.name,
        startTime: batch.startTime, endTime: batch.endTime,
      };
      return record;
    });
    setEnrollments(prev => {
      const ids = new Set(newEnrollments.map(e => e.studentId + ":" + e.batchId));
      const unchanged = prev.filter(e => !ids.has(e.studentId + ":" + e.batchId));
      return [...unchanged, ...newEnrollments];
    });
    setSelected(new Set()); setBulkClass(""); setBulkBatch("");
    setBulkPreview(false);
    setActiveTab("allocations");
  }

  // ── Tab 3 — Transfers ────────────────────────────────────────────────────────
  function handleSaveTransfer(transfer) {
    const newTransfer = {
      id: `TR${Date.now()}`,
      ...transfer,
      status: "Completed",
    };
    setTransfers(prev => [newTransfer, ...prev]);
    setEnrollments(prev =>
      prev.map(e =>
        e.studentId === transfer.studentId && e.status === "Active"
          ? { ...e, status: "Transferred" }
          : e
      )
    );
    const student  = ALL_STUDENTS.find(s => s.id === transfer.studentId);
    const toClass  = CLASS_OPTIONS.find(c => c.id === transfer.toClassId);
    const toBatch  = BATCH_OPTIONS.find(b => b.id === transfer.toBatchId);
    const newE = {
      id: `E${Date.now()}`, studentId: transfer.studentId,
      classId: transfer.toClassId, batchId: transfer.toBatchId,
      enrollmentDate: transfer.effectiveDate, notes: `Transferred: ${transfer.reason}`, status: "Active",
      studentName: student.name, admNo: student.admNo,
      fatherName: student.fatherName, phone: student.phone,
      className: toClass.name, batchCode: toBatch.code, batchName: toBatch.name,
      startTime: toBatch.startTime, endTime: toBatch.endTime,
    };
    setEnrollments(prev => [...prev, newE]);
    setTransferDrawer(false);
  }

  // ── Batch capacity summary ───────────────────────────────────────────────────
  const batchSummary = BATCH_OPTIONS.map(b => {
    const enrolled = batchEnrolled(b.id);
    const pct      = Math.round(enrolled / b.capacity * 100);
    return { ...b, enrolled, available: b.capacity - enrolled, pct };
  });
  const fullBatches     = batchSummary.filter(b => b.pct >= 100).length;
  const nearFullBatches = batchSummary.filter(b => b.pct >= 80 && b.pct < 100).length;

  // ── Class distribution ───────────────────────────────────────────────────────
  const classDist = CLASS_OPTIONS.map(c => ({
    ...c,
    enrolled: activeEnrollments.filter(e => e.classId === c.id).length,
  }));
  const maxClassCount = Math.max(...classDist.map(c => c.enrolled), 1);

  return (
    <div style={{ padding: "32px 24px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1C1917", letterSpacing: "-0.02em", margin: 0 }}>
          Student Allocation &amp; Enrollment
        </h1>
        <p style={{ fontSize: 13, color: "#A8A29E", margin: "4px 0 0" }}>
          Assign students to classes and batches while managing enrollment capacity and transfers.
        </p>
      </div>

      {/* Stat tiles */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <StatTile label="Total Enrollments" value={enrollments.length}
          sub="Students assigned to classes and batches" />
        <StatTile label="Active Students"   value={activeEnrollments.length}
          sub="Currently enrolled students" accent="#2563EB" />
        <StatTile label="Available Seats"   value={availableSeats}
          sub="Remaining seats across active batches" accent="#059669" />
        <StatTile label="Batch Occupancy"   value={`${occupancyRate}%`}
          sub="Overall enrollment utilization" accent={occupancyRate >= 90 ? "#DC2626" : occupancyRate >= 70 ? "#D97706" : "#059669"} />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", marginBottom: 20, borderBottom: "2px solid #F5F3EF" }}>
        {[
          { id: "allocations", label: "Student Allocations" },
          { id: "bulk",        label: "Bulk Allocation" },
          { id: "transfers",   label: "Student Transfers" },
        ].map(tab => (
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

      {/* ── Tab 1: Student Allocations ─── */}
      {activeTab === "allocations" && (
        <div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
            <div style={{ position: "relative", flex: "1 1 200px", minWidth: 180 }}>
              <SearchIcon />
              <input className="yd-input" placeholder="Search students, batches…" value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                style={{ paddingLeft: 32 }} />
            </div>
            <select className="yd-input" style={{ flex: "0 1 150px" }} value={filterClass}
              onChange={e => { setFilterClass(e.target.value); setFilterBatch(""); setPage(1); }}>
              <option value="">All Classes</option>
              {CLASS_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="yd-input" style={{ flex: "0 1 160px" }} value={filterBatch}
              onChange={e => { setFilterBatch(e.target.value); setPage(1); }}>
              <option value="">All Batches</option>
              {BATCH_OPTIONS.filter(b => !filterClass || b.classId === filterClass)
                .map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
            </select>
            <select className="yd-input" style={{ flex: "0 1 130px" }} value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
              <option value="">All Status</option>
              <option>Active</option>
              <option>Inactive</option>
              <option>Transferred</option>
            </select>
            <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }}
              onClick={() => setDrawer({ enrollment: null, mode: "add" })}>
              + Enroll Student
            </button>
          </div>

          <div className="yd-card" style={{ overflow: "hidden" }}>
            <div className="yd-table-wrap">
              <table className="yd-table">
                <thead>
                  <tr>
                    {[
                      { key: "studentName",    label: "Student Name"    },
                      { key: "admNo",          label: "Admission No."   },
                      { key: "className",      label: "Class"           },
                      { key: "batchCode",      label: "Batch"           },
                      { key: "enrollmentDate", label: "Enrollment Date" },
                      { key: "status",         label: "Status"          },
                    ].map(col => (
                      <th key={col.key} style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                        onClick={() => { handleSort(col.key); setPage(1); }}>
                        {col.label}<SortIcon active={sort.col === col.key} dir={sort.dir} />
                      </th>
                    ))}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {slice.length === 0
                    ? <EmptyState title="No Enrollments Found" message="Start by enrolling your first student." />
                    : slice.map(e => (
                      <tr key={e.id} style={{ cursor: "pointer" }}
                        onClick={() => setDrawer({ enrollment: e, mode: "view" })}>
                        <td style={{ fontWeight: 600 }}>{e.studentName}</td>
                        <td style={{ color: "#78716C", fontFamily: "monospace", fontSize: 12 }}>{e.admNo}</td>
                        <td>{e.className}</td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 600, background: "#EEF2FF",
                            color: "#3730A3", padding: "2px 8px", borderRadius: 6 }}>{e.batchCode}</span>
                          {" "}<span style={{ fontSize: 12, color: "#78716C" }}>{e.batchName}</span>
                        </td>
                        <td style={{ fontSize: 12, color: "#57534E" }}>{fmtDate(e.enrollmentDate)}</td>
                        <td><StatusBadge status={e.status} /></td>
                        <td onClick={ev => ev.stopPropagation()}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn btn-soft btn-xs"
                              onClick={() => setDrawer({ enrollment: e, mode: "edit" })}>Edit</button>
                            <button className="btn btn-ghost btn-xs"
                              onClick={() => setConfirm(e.id)}>Remove</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={total} perPage={PAGE_SIZE} onChange={setPage} />
          </div>
        </div>
      )}

      {/* ── Tab 2: Bulk Allocation ─── */}
      {activeTab === "bulk" && (
        <div>
          {/* Bulk controls */}
          <div className="yd-card" style={{ padding: "16px 20px", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1917", marginBottom: 14 }}>
              Bulk Assignment Settings
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 160px" }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#57534E", textTransform: "uppercase", letterSpacing: "0.05em" }}>Class</label>
                <select className="yd-input" value={bulkClass}
                  onChange={e => { setBulkClass(e.target.value); setBulkBatch(""); }}>
                  <option value="">Select class</option>
                  {CLASS_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 180px" }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#57534E", textTransform: "uppercase", letterSpacing: "0.05em" }}>Batch</label>
                <select className="yd-input" value={bulkBatch} onChange={e => setBulkBatch(e.target.value)}>
                  <option value="">Select batch</option>
                  {bulkBatchesForClass.map(b => {
                    const enrolled = batchEnrolled(b.id);
                    const avail    = b.capacity - enrolled;
                    return <option key={b.id} value={b.id} disabled={avail <= 0}>{b.code} — {b.name} ({avail} seats)</option>;
                  })}
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                {selected.size > 0 && bulkClass && bulkBatch && (
                  <button className="btn btn-soft btn-sm"
                    onClick={() => setBulkPreview(true)}>
                    Preview ({selected.size})
                  </button>
                )}
                <button className="btn btn-primary btn-sm"
                  disabled={selected.size === 0 || !bulkClass || !bulkBatch}
                  onClick={() => setBulkPreview(true)}>
                  Apply to {selected.size} student{selected.size !== 1 ? "s" : ""}
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <SearchIcon />
              <input className="yd-input" placeholder="Search students…" value={bulkSearch}
                onChange={e => setBulkSearch(e.target.value)}
                style={{ paddingLeft: 32 }} />
            </div>
          </div>

          <div className="yd-card" style={{ overflow: "hidden" }}>
            <div className="yd-table-wrap">
              <table className="yd-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>
                      <input type="checkbox"
                        checked={selected.size === bulkStudents.length && bulkStudents.length > 0}
                        onChange={toggleAll} />
                    </th>
                    <th>Student Name</th>
                    <th>Admission No.</th>
                    <th>Current Class</th>
                    <th>Current Batch</th>
                    <th>New Class</th>
                    <th>New Batch</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkStudents.map(s => {
                    const curr = enrollments.find(e => e.studentId === s.id && e.status === "Active");
                    return (
                      <tr key={s.id}
                        style={{ background: selected.has(s.id) ? "#F0F9FF" : "transparent", cursor: "pointer" }}
                        onClick={() => toggleSelect(s.id)}>
                        <td onClick={ev => ev.stopPropagation()}>
                          <input type="checkbox" checked={selected.has(s.id)}
                            onChange={() => toggleSelect(s.id)} />
                        </td>
                        <td style={{ fontWeight: 600 }}>{s.name}</td>
                        <td style={{ color: "#78716C", fontFamily: "monospace", fontSize: 12 }}>{s.admNo}</td>
                        <td>{curr?.className || <span style={{ color: "#A8A29E" }}>—</span>}</td>
                        <td>
                          {curr?.batchCode
                            ? <span style={{ fontSize: 11, fontWeight: 600, background: "#EEF2FF", color: "#3730A3", padding: "2px 8px", borderRadius: 6 }}>{curr.batchCode}</span>
                            : <span style={{ color: "#A8A29E" }}>—</span>}
                        </td>
                        <td>{bulkClass && selected.has(s.id)
                          ? <span style={{ color: "#059669", fontWeight: 600, fontSize: 12 }}>
                              {CLASS_OPTIONS.find(c => c.id === bulkClass)?.name || "—"}
                            </span>
                          : <span style={{ color: "#A8A29E" }}>—</span>}
                        </td>
                        <td>{bulkBatch && selected.has(s.id)
                          ? <span style={{ fontSize: 11, fontWeight: 600, background: "#DCFCE7", color: "#15803D", padding: "2px 8px", borderRadius: 6 }}>
                              {BATCH_OPTIONS.find(b => b.id === bulkBatch)?.code || "—"}
                            </span>
                          : <span style={{ color: "#A8A29E" }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 3: Student Transfers ─── */}
      {activeTab === "transfers" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setTransferDrawer(true)}>
              + New Transfer
            </button>
          </div>

          <div className="yd-card" style={{ overflow: "hidden" }}>
            <div className="yd-table-wrap">
              <table className="yd-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>From Class</th>
                    <th>From Batch</th>
                    <th>To Class</th>
                    <th>To Batch</th>
                    <th>Effective Date</th>
                    <th>Reason</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.length === 0
                    ? <EmptyState title="No Transfers Yet" message="Student transfers will appear here." />
                    : transfers.map(t => {
                      const student = ALL_STUDENTS.find(s => s.id === t.studentId);
                      return (
                        <tr key={t.id}>
                          <td style={{ fontWeight: 600 }}>{student?.name || "—"}<br/>
                            <span style={{ fontSize: 11, color: "#A8A29E" }}>{student?.admNo}</span>
                          </td>
                          <td>{t.fromClassName}</td>
                          <td>
                            <span style={{ fontSize: 11, fontWeight: 600, background: "#FEF3C7",
                              color: "#92400E", padding: "2px 8px", borderRadius: 6 }}>{t.fromBatchCode}</span>
                          </td>
                          <td>{t.toClassName}</td>
                          <td>
                            <span style={{ fontSize: 11, fontWeight: 600, background: "#DCFCE7",
                              color: "#15803D", padding: "2px 8px", borderRadius: 6 }}>{t.toBatchCode}</span>
                          </td>
                          <td style={{ fontSize: 12, color: "#57534E" }}>{fmtDate(t.effectiveDate)}</td>
                          <td style={{ fontSize: 12, color: "#78716C", maxWidth: 200 }}>{t.reason}</td>
                          <td><StatusBadge status={t.status} /></td>
                        </tr>
                      );
                    })
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Dashboard widgets ─── */}
      <div style={{ display: "flex", gap: 16, marginTop: 24, flexWrap: "wrap" }}>
        {/* Enrollment Overview */}
        <div className="yd-card" style={{ flex: 1, minWidth: 220, padding: "20px 22px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1917", marginBottom: 14 }}>
            Enrollment Overview
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { label: "Total",       value: ALL_STUDENTS.length,          color: "#1C1917" },
              { label: "Allocated",   value: allocatedStudentIds.size,      color: "#2563EB" },
              { label: "Unallocated", value: unallocated.length,           color: "#D97706" },
              { label: "Active",      value: activeEnrollments.length,     color: "#059669" },
            ].map(m => (
              <div key={m.label} style={{ flex: "1 1 80px", textAlign: "center", padding: "10px 0",
                background: "#FAFAF8", borderRadius: 10 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: m.color }}>{m.value}</div>
                <div style={{ fontSize: 11, color: "#A8A29E", marginTop: 2 }}>{m.label}</div>
              </div>
            ))}
          </div>
          {unallocated.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#A8A29E", textTransform: "uppercase",
                letterSpacing: "0.05em", marginBottom: 8 }}>Unallocated Students</div>
              {unallocated.slice(0, 4).map(s => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between",
                  padding: "5px 0", borderBottom: "1px solid #F5F3EF", fontSize: 12 }}>
                  <span style={{ color: "#57534E" }}>{s.name}</span>
                  <span style={{ color: "#A8A29E" }}>{s.admNo}</span>
                </div>
              ))}
              {unallocated.length > 4 && (
                <div style={{ fontSize: 11, color: "#A8A29E", marginTop: 6, textAlign: "right" }}>
                  +{unallocated.length - 4} more
                </div>
              )}
            </div>
          )}
        </div>

        {/* Batch Capacity */}
        <div className="yd-card" style={{ flex: 1, minWidth: 260, padding: "20px 22px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1917", marginBottom: 14 }}>
            Batch Capacity Overview
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Total Seats",  value: totalCapacity, color: "#1C1917" },
              { label: "Occupied",     value: totalEnrolled, color: "#2563EB" },
              { label: "Available",    value: availableSeats, color: "#059669" },
              { label: "Full Batches", value: fullBatches,   color: "#DC2626" },
            ].map(m => (
              <div key={m.label} style={{ flex: 1, textAlign: "center", padding: "10px 0",
                background: "#FAFAF8", borderRadius: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: m.color }}>{m.value}</div>
                <div style={{ fontSize: 10, color: "#A8A29E", marginTop: 2 }}>{m.label}</div>
              </div>
            ))}
          </div>
          {batchSummary.map(b => (
            <div key={b.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: "#57534E", fontWeight: 500 }}>{b.code} · {b.className}</span>
                <span style={{ color: occupancyColor(b.pct), fontWeight: 600 }}>{b.pct}%</span>
              </div>
              <CapacityBar enrolled={b.enrolled} capacity={b.capacity} />
            </div>
          ))}
        </div>

        {/* Class Distribution */}
        <div className="yd-card" style={{ flex: 1, minWidth: 220, padding: "20px 22px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1917", marginBottom: 14 }}>
            Class Distribution
          </div>
          {classDist.map(c => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: "#57534E", flex: 1, whiteSpace: "nowrap" }}>{c.name}</span>
              <div style={{ flex: 2, height: 8, background: "#F5F3EF", borderRadius: 99 }}>
                <div style={{ height: "100%", borderRadius: 99,
                  width: `${(c.enrolled / maxClassCount) * 100}%`, background: "#2563EB",
                  transition: "width 0.3s ease" }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#57534E", minWidth: 20, textAlign: "right" }}>
                {c.enrolled}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Drawers & Dialogs */}
      {drawer && (
        <EnrollmentDrawer
          drawer={drawer} enrollments={enrollments}
          onClose={() => setDrawer(null)}
          onSave={handleSaveEnrollment}
          onRemove={handleRemoveEnrollment}
        />
      )}
      {transferDrawer && (
        <TransferDrawer
          enrollments={enrollments}
          onClose={() => setTransferDrawer(false)}
          onSave={handleSaveTransfer}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title="Remove Enrollment"
          message="Remove this student enrollment? This action cannot be undone."
          onConfirm={() => { handleRemoveEnrollment(confirm); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}
      {bulkPreview && (
        <ConfirmDialog
          title={`Bulk Assign ${selected.size} Student${selected.size !== 1 ? "s" : ""}`}
          message={`Assign ${selected.size} student${selected.size !== 1 ? "s" : ""} to ${CLASS_OPTIONS.find(c => c.id === bulkClass)?.name} — ${BATCH_OPTIONS.find(b => b.id === bulkBatch)?.code}? Existing allocations to this batch will be updated.`}
          confirmLabel={`Assign ${selected.size} Student${selected.size !== 1 ? "s" : ""}`}
          danger={false}
          onConfirm={applyBulk}
          onCancel={() => setBulkPreview(false)}
        />
      )}
    </div>
  );
}
