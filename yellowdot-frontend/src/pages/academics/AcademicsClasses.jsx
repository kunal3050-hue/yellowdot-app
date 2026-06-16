import { useState, useMemo, useCallback, useRef } from "react";

// ── Seed data ─────────────────────────────────────────────────────────────────
const SEED_CLASSES = [
  {
    id: "1", code: "PG001", name: "Playgroup",
    ageGroup: "2–3 years",
    description: "Early childhood program for toddlers aged 2–3 years, focusing on sensory play and socialisation.",
    students: 18, batches: 2, status: "Active",
  },
  {
    id: "2", code: "NR001", name: "Nursery",
    ageGroup: "3–4 years",
    description: "Foundation program preparing children for kindergarten through structured play and early literacy.",
    students: 22, batches: 3, status: "Active",
  },
  {
    id: "3", code: "JKG01", name: "Junior KG",
    ageGroup: "4–5 years",
    description: "Junior Kindergarten focusing on cognitive, social, and creative development.",
    students: 25, batches: 3, status: "Active",
  },
  {
    id: "4", code: "SKG01", name: "Senior KG",
    ageGroup: "5–6 years",
    description: "Senior Kindergarten preparing children for primary school with foundational academics.",
    students: 20, batches: 2, status: "Active",
  },
  {
    id: "5", code: "DC001", name: "Daycare",
    ageGroup: "1–5 years",
    description: "Full-day childcare program for working parents with structured activities and rest.",
    students: 30, batches: 4, status: "Active",
  },
  {
    id: "6", code: "AB001", name: "Abacus",
    ageGroup: "5–10 years",
    description: "Mental arithmetic program using abacus techniques to develop concentration and calculation speed.",
    students: 15, batches: 2, status: "Active",
  },
  {
    id: "7", code: "HW001", name: "Handwriting",
    ageGroup: "4–8 years",
    description: "Handwriting improvement program for fine motor skill development and letter formation.",
    students: 0, batches: 0, status: "Inactive",
  },
];

const AGE_GROUPS = [
  "1–2 years", "1–3 years", "1–5 years", "2–3 years", "2–4 years",
  "3–4 years", "3–5 years", "4–5 years", "4–6 years", "4–8 years",
  "5–6 years", "5–8 years", "5–10 years", "6–10 years",
];

const PAGE_SIZE_OPTIONS = [10, 25, 50];

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
    error:   useCallback(m => add("error", m),   [add]),
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
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "#A8A29E" }}>
          {label}
        </span>
        <span style={{ fontSize: 18, opacity: 0.5 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: "#1C1917", lineHeight: 1, marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#A8A29E" }}>{desc}</div>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  return (
    <span className={`badge ${status === "Active" ? "badge-success" : "badge-neutral"}`}>
      {status}
    </span>
  );
}

// ── Sort icon ─────────────────────────────────────────────────────────────────
function SortIcon({ active, dir }) {
  if (!active) return <span style={{ opacity: 0.25, fontSize: 9, marginLeft: 3 }}>⇅</span>;
  return <span style={{ fontSize: 9, color: "#D97706", marginLeft: 3 }}>{dir === "asc" ? "↑" : "↓"}</span>;
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

// ── Form field wrapper ────────────────────────────────────────────────────────
function FormField({ label, error, children }) {
  return (
    <div>
      <label style={{
        display: "block", fontSize: 10, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "0.08em", color: "#A8A29E", marginBottom: 5,
      }}>
        {label}
      </label>
      {children}
      {error && <p style={{ fontSize: 11, color: "#EF4444", marginTop: 4, margin: "4px 0 0" }}>{error}</p>}
    </div>
  );
}

// ── Class Drawer ──────────────────────────────────────────────────────────────
function ClassDrawer({ cls, existingCodes, onSave, onClose }) {
  const isEdit = !!cls?.id;
  const [form, setForm] = useState({
    code:        cls?.code        || "",
    name:        cls?.name        || "",
    ageGroup:    cls?.ageGroup    || "",
    description: cls?.description || "",
    status:      cls?.status      || "Active",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: "" })); };

  function validate() {
    const e = {};
    const code = form.code.trim().toUpperCase();
    if (!code)                                     e.code     = "Class code is required.";
    else if (!/^[A-Z0-9]{3,8}$/.test(code))        e.code     = "3–8 uppercase letters or digits.";
    else if (!isEdit && existingCodes.includes(code)) e.code  = "This code already exists.";
    if (!form.name.trim())                         e.name     = "Class name is required.";
    if (!form.ageGroup)                            e.ageGroup = "Age group is required.";
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 280));
    onSave({ ...cls, ...form, code: form.code.trim().toUpperCase(), name: form.name.trim() });
  }

  return (
    <>
      <div className="yd-drawer-overlay" onClick={onClose} />
      <div className="yd-drawer" style={{ width: "min(460px, 96vw)" }}>
        <div className="yd-drawer-header">
          <div>
            <h2>{isEdit ? "Edit Class" : "Add Class"}</h2>
            <p style={{ fontSize: 11, color: "#A8A29E", marginTop: 2 }}>
              {isEdit ? `${cls.code} — ${cls.name}` : "Create a new academic class"}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon" style={{ width: 30, height: 30 }}>✕</button>
        </div>

        <div className="yd-drawer-body">
          <form id="class-form" onSubmit={handleSubmit}>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12 }}>
                <FormField label="Class Code *" error={errors.code}>
                  <input
                    className={`yd-input${errors.code ? " error" : ""}`}
                    value={form.code}
                    onChange={e => set("code", e.target.value.toUpperCase())}
                    placeholder="PG001"
                    maxLength={8}
                    disabled={isEdit}
                    style={isEdit ? { opacity: 0.6, cursor: "not-allowed" } : {}}
                  />
                </FormField>
                <FormField label="Class Name *" error={errors.name}>
                  <input
                    className={`yd-input${errors.name ? " error" : ""}`}
                    value={form.name}
                    onChange={e => set("name", e.target.value)}
                    placeholder="e.g. Playgroup"
                  />
                </FormField>
              </div>

              <FormField label="Age Group *" error={errors.ageGroup}>
                <select
                  className={`yd-input${errors.ageGroup ? " error" : ""}`}
                  value={form.ageGroup}
                  onChange={e => set("ageGroup", e.target.value)}
                >
                  <option value="">Select age group…</option>
                  {AGE_GROUPS.map(ag => <option key={ag} value={ag}>{ag}</option>)}
                </select>
              </FormField>

              <FormField label="Description">
                <textarea
                  className="yd-input"
                  value={form.description}
                  onChange={e => set("description", e.target.value)}
                  placeholder="Brief description of this class…"
                  rows={3}
                  style={{ resize: "vertical", minHeight: 72 }}
                />
              </FormField>

              <FormField label="Status">
                <div style={{ display: "flex", gap: 16, paddingTop: 2 }}>
                  {["Active", "Inactive"].map(s => (
                    <label key={s} style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: 13, color: "#57534E" }}>
                      <input
                        type="radio" name="cls-status" value={s}
                        checked={form.status === s}
                        onChange={() => set("status", s)}
                        style={{ accentColor: "#F5C518" }}
                      />
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
          <button form="class-form" type="submit" className="btn btn-primary btn-sm" disabled={saving}
            style={{ minWidth: 100, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {saving && <span className="yd-spinner yd-spinner-sm" />}
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Class"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ isFiltered, onAdd }) {
  return (
    <tr>
      <td colSpan={7}>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "64px 24px", textAlign: "center",
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: "#F5F3EF",
            display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
          }}>
            <svg viewBox="0 0 24 24" width={26} height={26} fill="none" stroke="#A8A29E" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
              <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#57534E", marginBottom: 6 }}>
            {isFiltered ? "No Classes Found" : "No Classes Yet"}
          </div>
          <div style={{ fontSize: 13, color: "#A8A29E", maxWidth: 300, lineHeight: 1.6, marginBottom: 20 }}>
            {isFiltered
              ? "No classes match your search or filter. Try adjusting your criteria."
              : "Start by creating your first academic class."}
          </div>
          {!isFiltered && (
            <button onClick={onAdd} className="btn btn-primary btn-sm">+ Add Class</button>
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
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "11px 16px", borderTop: "1px solid #F0EDE8", flexWrap: "wrap", gap: 8,
    }}>
      <span style={{ fontSize: 12, color: "#A8A29E" }}>
        {total === 0 ? "No results" : `${from}–${to} of ${total} class${total !== 1 ? "es" : ""}`}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#A8A29E" }}>Rows:</span>
          <select
            value={pageSize}
            onChange={e => { onPageSize(Number(e.target.value)); onPage(1); }}
            style={{ border: "1px solid #E7E3DC", borderRadius: 6, padding: "3px 6px", fontSize: 12, background: "#FAFAF8", cursor: "pointer" }}
          >
            {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          <PagBtn label="«" onClick={() => onPage(1)} disabled={page === 1} />
          <PagBtn label="‹" onClick={() => onPage(page - 1)} disabled={page === 1} />
          {pageNums.map(p => (
            <PagBtn key={p} label={p} onClick={() => onPage(p)} active={page === p} />
          ))}
          <PagBtn label="›" onClick={() => onPage(page + 1)} disabled={page === totalPages} />
          <PagBtn label="»" onClick={() => onPage(totalPages)} disabled={page === totalPages} />
        </div>
      </div>
    </div>
  );
}

function PagBtn({ label, onClick, disabled, active }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-xs ${active ? "btn-primary" : "btn-ghost"}`}
      style={{ minWidth: 28, padding: "4px 7px", fontSize: 12 }}
    >
      {label}
    </button>
  );
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────
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

// ── Filter dropdown field ─────────────────────────────────────────────────────
function FilterField({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#A8A29E", marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const COLS = [
  { key: "code",     label: "Class Code",  width: 110 },
  { key: "name",     label: "Class Name",  width: null },
  { key: "ageGroup", label: "Age Group",   width: 120 },
  { key: "students", label: "Students",    width: 90,  align: "center" },
  { key: "batches",  label: "Batches",     width: 90,  align: "center" },
  { key: "status",   label: "Status",      width: 100 },
  { key: null,       label: "Actions",     width: 100, nosort: true },
];

export default function AcademicsClasses() {
  const [classes,       setClasses]       = useState(SEED_CLASSES);
  const [search,        setSearch]        = useState("");
  const [filterStatus,  setFilterStatus]  = useState("All");
  const [filterAge,     setFilterAge]     = useState("All");
  const [sortKey,       setSortKey]       = useState("name");
  const [sortDir,       setSortDir]       = useState("asc");
  const [page,          setPage]          = useState(1);
  const [pageSize,      setPageSize]      = useState(10);
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [editTarget,    setEditTarget]    = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [filterOpen,    setFilterOpen]    = useState(false);
  const filterAnchorRef = useRef(null);
  const toast = useToast();

  // ── Derived stats ───────────────────────────────────────────────────────────
  const totalClasses     = classes.length;
  const activeClasses    = classes.filter(c => c.status === "Active").length;
  const enrolledStudents = classes.reduce((s, c) => s + (c.students || 0), 0);
  const totalBatches     = classes.reduce((s, c) => s + (c.batches  || 0), 0);

  const ageGroupOptions = useMemo(() => {
    const s = new Set(classes.map(c => c.ageGroup));
    return ["All", ...Array.from(s).sort()];
  }, [classes]);

  // ── Filtered + sorted + paginated ───────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = classes.filter(c => {
      if (q && !(c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.ageGroup.toLowerCase().includes(q))) return false;
      if (filterStatus !== "All" && c.status !== filterStatus) return false;
      if (filterAge    !== "All" && c.ageGroup !== filterAge)   return false;
      return true;
    });
    return [...list].sort((a, b) => {
      if (!sortKey) return 0;
      let av = a[sortKey], bv = b[sortKey];
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      return av < bv ? (sortDir === "asc" ? -1 : 1) : av > bv ? (sortDir === "asc" ? 1 : -1) : 0;
    });
  }, [classes, search, filterStatus, filterAge, sortKey, sortDir]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  }

  function openAdd()     { setEditTarget(null); setDrawerOpen(true); }
  function openEdit(cls) { setEditTarget(cls);  setDrawerOpen(true); }
  function closeDrawer() { setDrawerOpen(false); setEditTarget(null); }

  function handleSave(data) {
    if (data.id) {
      setClasses(prev => prev.map(c => c.id === data.id ? { ...c, ...data } : c));
      toast.success(`"${data.name}" updated.`);
    } else {
      setClasses(prev => [...prev, { ...data, id: String(Date.now()), students: 0, batches: 0 }]);
      toast.success(`"${data.name}" created.`);
    }
    closeDrawer();
  }

  function handleDelete(cls) {
    setClasses(prev => prev.filter(c => c.id !== cls.id));
    toast.success(`"${cls.name}" deleted.`);
    setConfirmDelete(null);
  }

  function handleExport() {
    const headers = ["Code", "Name", "Age Group", "Students", "Batches", "Status", "Description"];
    const rows = filtered.map(c => [c.code, c.name, c.ageGroup, c.students, c.batches, c.status, c.description || ""]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "classes.csv";
    a.click();
    toast.success("Exported classes.csv");
  }

  function clearFilters() { setSearch(""); setFilterStatus("All"); setFilterAge("All"); setPage(1); setFilterOpen(false); }

  const hasFilters   = !!search || filterStatus !== "All" || filterAge !== "All";
  const activeFilterCount = [filterStatus !== "All", filterAge !== "All"].filter(Boolean).length;
  const existingCodes = classes.map(c => c.code);

  return (
    <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1C1917", letterSpacing: "-0.025em", margin: 0, lineHeight: 1.2 }}>
              Class Management
            </h1>
            <p style={{ fontSize: 13, color: "#A8A29E", margin: "5px 0 0" }}>
              Manage academic programs, age groups and class structure.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <button onClick={handleExport} className="btn btn-ghost btn-sm" style={{ gap: 5 }}>
              <ExportIcon /> Export
            </button>
            <button onClick={() => toast.success("Import feature coming soon.")} className="btn btn-ghost btn-sm" style={{ gap: 5 }}>
              <ImportIcon /> Import Classes
            </button>
            <button onClick={openAdd} className="btn btn-primary btn-sm">
              + Add Class
            </button>
          </div>
        </div>
      </div>

      {/* ── Stat Tiles ──────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
        <StatTile label="Total Classes"      value={totalClasses}     desc="Total academic classes created"    accent="#F5C518" icon="🏫" />
        <StatTile label="Active Classes"     value={activeClasses}    desc="Classes currently running"         accent="#10B981" icon="✅" />
        <StatTile label="Enrolled Students"  value={enrolledStudents} desc="Students assigned to classes"      accent="#3B82F6" icon="👥" />
        <StatTile label="Associated Batches" value={totalBatches}     desc="Total batches linked to classes"   accent="#8B5CF6" icon="📚" />
      </div>

      {/* ── Table Card ──────────────────────────────────────────────── */}
      <div className="yd-card" style={{ overflow: "hidden" }}>

        {/* Toolbar */}
        <div style={{
          padding: "12px 16px", borderBottom: "1px solid #F0EDE8",
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        }}>
          {/* Search */}
          <div style={{ position: "relative", flex: "1 1 180px", minWidth: 160, maxWidth: 300 }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#A8A29E", pointerEvents: "none", display: "flex" }}>
              <SearchIcon />
            </span>
            <input
              className="yd-input"
              style={{ paddingLeft: 32, width: "100%", fontSize: 13 }}
              placeholder="Search classes…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          {/* Filters */}
          <div style={{ position: "relative" }} ref={filterAnchorRef}>
            <button
              className={`btn btn-sm ${activeFilterCount > 0 ? "btn-soft" : "btn-ghost"}`}
              onClick={() => setFilterOpen(o => !o)}
              style={{ gap: 5, display: "flex", alignItems: "center" }}
            >
              <FilterIcon />
              Filters
              {activeFilterCount > 0 && (
                <span style={{
                  background: "#F5C518", color: "#78350F", borderRadius: "50%",
                  width: 16, height: 16, fontSize: 10, fontWeight: 800,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>
                  {activeFilterCount}
                </span>
              )}
            </button>

            {filterOpen && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setFilterOpen(false)} />
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 50,
                  background: "#fff", border: "1px solid #E7E3DC", borderRadius: 12,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.10)", padding: 16, minWidth: 240,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "#A8A29E", marginBottom: 12 }}>
                    Filter Options
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <FilterField label="Status">
                      <select className="yd-input" value={filterStatus}
                        onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
                        <option value="All">All Statuses</option>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </FilterField>
                    <FilterField label="Age Group">
                      <select className="yd-input" value={filterAge}
                        onChange={e => { setFilterAge(e.target.value); setPage(1); }}>
                        {ageGroupOptions.map(ag => (
                          <option key={ag} value={ag}>{ag === "All" ? "All Age Groups" : ag}</option>
                        ))}
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
            <button className="btn btn-ghost btn-xs" onClick={clearFilters}
              style={{ color: "#EF4444", borderColor: "#FECACA" }}>
              ✕ Clear
            </button>
          )}

          <div style={{ marginLeft: "auto", fontSize: 12, color: "#A8A29E", whiteSpace: "nowrap" }}>
            {filtered.length} {filtered.length === 1 ? "class" : "classes"}
          </div>
        </div>

        {/* Table */}
        <div className="yd-table-wrap">
          <table className="yd-table" style={{ minWidth: 700 }}>
            <thead>
              <tr>
                {COLS.map(col => (
                  <th key={col.label}
                    style={{
                      width:     col.width || undefined,
                      textAlign: col.align || "left",
                      cursor:    col.nosort || !col.key ? "default" : "pointer",
                      userSelect: "none",
                    }}
                    onClick={(!col.nosort && col.key) ? () => handleSort(col.key) : undefined}
                  >
                    {col.label}
                    {!col.nosort && col.key && (
                      <SortIcon active={sortKey === col.key} dir={sortDir} />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0
                ? <EmptyState isFiltered={hasFilters} onAdd={openAdd} />
                : paginated.map(cls => (
                    <tr key={cls.id} onClick={() => openEdit(cls)}>
                      <td>
                        <span style={{
                          fontFamily: "monospace", fontSize: 11.5, fontWeight: 700,
                          background: "#FEF9C3", color: "#92400E", borderRadius: 5,
                          padding: "2px 7px", letterSpacing: "0.04em",
                        }}>
                          {cls.code}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: "#1C1917", fontSize: 13, lineHeight: 1.3 }}>{cls.name}</div>
                        {cls.description && (
                          <div style={{
                            fontSize: 11, color: "#A8A29E", marginTop: 2,
                            maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {cls.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{
                          fontSize: 12, color: "#57534E", background: "#F5F3EF",
                          borderRadius: 6, padding: "3px 8px", fontWeight: 500, whiteSpace: "nowrap",
                        }}>
                          {cls.ageGroup}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: cls.students > 0 ? "#1C1917" : "#D1C9BF" }}>
                          {cls.students}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: cls.batches > 0 ? "#1C1917" : "#D1C9BF" }}>
                          {cls.batches}
                        </span>
                      </td>
                      <td><StatusBadge status={cls.status} /></td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 5 }}>
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => openEdit(cls)}
                            title="Edit"
                            style={{ padding: "4px 8px" }}
                          >
                            ✏️
                          </button>
                          <button
                            className="btn btn-xs"
                            onClick={() => setConfirmDelete(cls)}
                            title="Delete"
                            style={{ padding: "4px 8px", background: "#FEF2F2", color: "#EF4444", border: "1px solid #FECACA" }}
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          page={page}
          pageSize={pageSize}
          total={filtered.length}
          onPage={p => setPage(p)}
          onPageSize={n => setPageSize(n)}
        />
      </div>

      {/* ── Drawer ─────────────────────────────────────────────────── */}
      {drawerOpen && (
        <ClassDrawer
          cls={editTarget}
          existingCodes={existingCodes}
          onSave={handleSave}
          onClose={closeDrawer}
        />
      )}

      {/* ── Confirm Delete ──────────────────────────────────────────── */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Class"
          message={`Are you sure you want to delete "${confirmDelete.name}" (${confirmDelete.code})? This action cannot be undone.`}
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* ── Toasts ─────────────────────────────────────────────────── */}
      <Toasts toasts={toast.toasts} dismiss={toast.dismiss} />
    </div>
  );
}
