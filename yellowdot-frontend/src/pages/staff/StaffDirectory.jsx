/**
 * StaffDirectory.jsx — Employee Directory
 * ─────────────────────────────────────────
 * Table columns: photo · employee ID · name · mobile · email · department ·
 *                designation · branch · classroom · status · joining date.
 *
 * Features: search, filters (status / employment-type / department / designation),
 *           sort, CSV export, pagination, multi-select with bulk-activate /
 *           bulk-deactivate / bulk-delete.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import staffService, { STAFF_ENUMS, EMPLOYMENT_STATUS_META, LOGIN_STATUS_META } from "../../services/staffService";
import departmentService from "../../services/departmentService";
import designationService from "../../services/designationService";

const T = {
  bg:          "#FFFDF7",
  surface:     "#FFFFFF",
  border:      "rgba(0,0,0,0.08)",
  borderGold:  "rgba(244,196,0,0.35)",
  shadow:      "0 1px 4px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)",
  text:        "#2A2A2A",
  textMuted:   "#8C8880",
  textSoft:    "#6A6560",
  gold:        "#F4C400",
  goldDark:    "#78350F",
  goldMid:     "#B45309",
  goldLight:   "rgba(244,196,0,0.10)",
  red:         "#DC2626",
  redLight:    "rgba(220,38,38,0.09)",
};

const PAGE_SIZE = 25;

// ── Helpers ──────────────────────────────────────────────────────────

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCSV(filename, rows, columns) {
  const header = columns.map(c => c.label).join(",");
  const body   = rows.map(r => columns.map(c => csvEscape(c.get(r))).join(",")).join("\n");
  const blob   = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" });
  const a      = document.createElement("a");
  a.href       = URL.createObjectURL(blob);
  a.download   = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); document.body.removeChild(a); }, 0);
}

function StatusPill({ status }) {
  const meta = EMPLOYMENT_STATUS_META[status] || EMPLOYMENT_STATUS_META.inactive;
  return (
    <span style={{
      display: "inline-block",
      padding: "3px 9px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 600,
      background: meta.bg,
      color: meta.color,
      border: `1px solid ${meta.border}`,
    }}>{meta.label}</span>
  );
}

function Avatar({ name, photoUrl }) {
  const initial = (name || "?").charAt(0).toUpperCase();
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 8,
      background: T.goldLight,
      border: `1px solid ${T.borderGold}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, fontSize: 12, color: T.goldMid,
      overflow: "hidden", flexShrink: 0,
    }}>
      {photoUrl
        ? <img src={photoUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : initial}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────

export default function StaffDirectory() {
  const navigate = useNavigate();

  const [staff,        setStaff]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [departments,  setDepartments]  = useState([]);
  const [designations, setDesignations] = useState([]);

  // Filters
  const [search,           setSearch]           = useState("");
  const [statusFilter,     setStatusFilter]     = useState("");
  const [typeFilter,       setTypeFilter]       = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [designationFilter,setDesignationFilter]= useState("");
  const [categoryFilter,   setCategoryFilter]   = useState("");
  const [includeDeleted,   setIncludeDeleted]   = useState(false);

  // Sort
  const [sortKey, setSortKey] = useState("displayName");
  const [sortDir, setSortDir] = useState("asc");

  // Pagination
  const [page, setPage] = useState(1);

  // Selection
  const [selected, setSelected] = useState(() => new Set());

  // ── Load ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [s, d, g] = await Promise.all([
        staffService.getAll({ includeDeleted: includeDeleted ? "true" : undefined }),
        departmentService.getAll(),
        designationService.getAll(),
      ]);
      if (s?.success)  setStaff(s.staff || []);
      if (d?.success)  setDepartments(d.departments || []);
      if (g?.success)  setDesignations(g.designations || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to load staff.");
    } finally {
      setLoading(false);
    }
  }, [includeDeleted]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // ── Filter + sort pipeline ──────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let rows = staff;
    if (q) {
      rows = rows.filter(s =>
        s.displayName.toLowerCase().includes(q)      ||
        s.employeeCode.toLowerCase().includes(q)     ||
        (s.email || "").toLowerCase().includes(q)    ||
        (s.mobile || "").includes(q)                 ||
        (s.departmentName || "").toLowerCase().includes(q) ||
        (s.designationName || "").toLowerCase().includes(q)
      );
    }
    if (statusFilter)     rows = rows.filter(s => s.employmentStatus === statusFilter);
    if (typeFilter)       rows = rows.filter(s => s.employmentType   === typeFilter);
    if (departmentFilter) rows = rows.filter(s => s.departmentId     === departmentFilter);
    if (designationFilter)rows = rows.filter(s => s.designationId    === designationFilter);
    if (categoryFilter)   rows = rows.filter(s => s.category         === categoryFilter);

    const dir = sortDir === "asc" ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const av = (a[sortKey] || "").toString().toLowerCase();
      const bv = (b[sortKey] || "").toString().toLowerCase();
      return av.localeCompare(bv) * dir;
    });
    return rows;
  }, [staff, search, statusFilter, typeFilter, departmentFilter, designationFilter, categoryFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows   = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(1); }, [search, statusFilter, typeFilter, departmentFilter, designationFilter, categoryFilter]);

  // ── Selection helpers ───────────────────────────────────────────
  const allOnPageSelected = pageRows.length > 0 && pageRows.every(r => selected.has(r.staffId));
  function togglePage() {
    const next = new Set(selected);
    if (allOnPageSelected) pageRows.forEach(r => next.delete(r.staffId));
    else                   pageRows.forEach(r => next.add(r.staffId));
    setSelected(next);
  }
  function toggleOne(id) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  // ── Sort helper ─────────────────────────────────────────────────
  function setSort(key) {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  // ── Bulk actions ────────────────────────────────────────────────
  async function bulkSetStatus(employmentStatus, active) {
    if (selected.size === 0) return;
    const label = employmentStatus === "active" ? "activate" : "deactivate";
    if (!window.confirm(`${label[0].toUpperCase() + label.slice(1)} ${selected.size} employee${selected.size === 1 ? "" : "s"}?`)) return;
    try {
      await Promise.all([...selected].map(id => staffService.update(id, { employmentStatus, active })));
      setSelected(new Set());
      await load();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  }

  async function bulkSoftDelete() {
    if (selected.size === 0) return;
    if (!window.confirm(`Mark ${selected.size} employee${selected.size === 1 ? "" : "s"} as inactive? (Soft delete — records are preserved.)`)) return;
    try {
      await Promise.all([...selected].map(id => staffService.remove(id)));
      setSelected(new Set());
      await load();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  }

  // ── Export ──────────────────────────────────────────────────────
  function exportCSV() {
    const cols = [
      { label: "Employee ID",     get: r => r.employeeCode },
      { label: "Name",            get: r => r.displayName },
      { label: "Mobile",          get: r => r.mobile },
      { label: "Email",           get: r => r.email },
      { label: "Department",      get: r => r.departmentName },
      { label: "Designation",     get: r => r.designationName },
      { label: "Branch",          get: r => r.branch || r.centerId },
      { label: "Classrooms",      get: r => (r.assignedClassrooms || []).join(" | ") },
      { label: "Category",        get: r => r.category },
      { label: "Employment Type", get: r => r.employmentType },
      { label: "Status",          get: r => r.employmentStatus },
      { label: "Login Status",    get: r => r.loginStatus },
      { label: "Joining Date",    get: r => r.joiningDate },
    ];
    downloadCSV(`staff-directory-${new Date().toISOString().slice(0,10)}.csv`, filtered, cols);
  }

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid }}>
            Staff Management
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "4px 0 0", letterSpacing: "-0.02em" }}>
            Employees ({filtered.length})
          </h1>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={exportCSV}
            style={{ background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
          >Export CSV</button>
          <button
            onClick={() => navigate("/staff/employees/new")}
            style={{ background: T.gold, color: "#1E1E1E", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer", boxShadow: T.shadow }}
          >+ Add Employee</button>
        </div>
      </div>

      {error && (
        <div style={{ background: T.redLight, color: T.red, border: `1px solid ${T.red}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Toolbar */}
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 14, padding: 14, marginBottom: 14,
        display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
        boxShadow: T.shadow,
      }}>
        <input
          placeholder="Search by name, employee ID, email, mobile…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: "1 1 240px", minWidth: 220,
            border: `1px solid ${T.border}`, borderRadius: 10,
            padding: "10px 12px", fontSize: 13, outline: "none",
            background: "#FDFAF5",
          }}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
          <option value="">All statuses</option>
          {STAFF_ENUMS.employmentStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={selectStyle}>
          <option value="">All types</option>
          {STAFF_ENUMS.employmentTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} style={selectStyle}>
          <option value="">All departments</option>
          {departments.map(d => <option key={d.deptId} value={d.deptId}>{d.name}</option>)}
        </select>
        <select value={designationFilter} onChange={(e) => setDesignationFilter(e.target.value)} style={selectStyle}>
          <option value="">All designations</option>
          {designations.map(d => <option key={d.designationId} value={d.designationId}>{d.name}</option>)}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={selectStyle}>
          <option value="">All categories</option>
          {STAFF_ENUMS.categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.textSoft, paddingLeft: 4 }}>
          <input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} />
          Show deleted
        </label>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div style={{
          background: "#FFF7E0",
          border: `1px solid ${T.borderGold}`,
          borderRadius: 10,
          padding: "10px 14px",
          marginBottom: 14,
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
          fontSize: 13,
        }}>
          <strong>{selected.size}</strong> selected
          <span style={{ flex: 1 }} />
          <button onClick={() => bulkSetStatus("active",   true)}  style={bulkBtnStyle}>Mark Active</button>
          <button onClick={() => bulkSetStatus("inactive", false)} style={bulkBtnStyle}>Deactivate</button>
          <button onClick={bulkSoftDelete} style={{ ...bulkBtnStyle, background: T.red, color: "#fff", borderColor: T.red }}>Mark Inactive (Soft)</button>
          <button onClick={() => setSelected(new Set())} style={{ ...bulkBtnStyle, background: "transparent" }}>Clear</button>
        </div>
      )}

      {/* Table */}
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 14, boxShadow: T.shadow, overflow: "hidden",
      }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 1100 }}>
            <thead style={{ background: "#FDFAF5", borderBottom: `1px solid ${T.border}` }}>
              <tr>
                <th style={thStyle}>
                  <input type="checkbox" checked={allOnPageSelected} onChange={togglePage} />
                </th>
                <th style={thStyle}></th>
                <Th label="Emp ID"        col="employeeCode"    sortKey={sortKey} sortDir={sortDir} onSort={setSort} />
                <Th label="Name"          col="displayName"     sortKey={sortKey} sortDir={sortDir} onSort={setSort} />
                <th style={thStyle}>Mobile</th>
                <th style={thStyle}>Email</th>
                <Th label="Department"    col="departmentName"  sortKey={sortKey} sortDir={sortDir} onSort={setSort} />
                <Th label="Designation"   col="designationName" sortKey={sortKey} sortDir={sortDir} onSort={setSort} />
                <th style={thStyle}>Branch</th>
                <th style={thStyle}>Classrooms</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Login</th>
                <Th label="Joining Date" col="joiningDate"      sortKey={sortKey} sortDir={sortDir} onSort={setSort} />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={13} style={{ padding: 28, textAlign: "center", color: T.textMuted }}>Loading…</td></tr>
              )}
              {!loading && pageRows.length === 0 && (
                <tr><td colSpan={13} style={{ padding: 28, textAlign: "center", color: T.textMuted }}>
                  No employees match the current filters. Try clearing them or add a new employee.
                </td></tr>
              )}
              {!loading && pageRows.map((row) => (
                <tr
                  key={row.staffId}
                  onClick={() => navigate(`/staff/employees/${row.staffId}`)}
                  style={{
                    borderBottom: `1px solid ${T.border}`,
                    cursor: "pointer",
                    background: selected.has(row.staffId) ? "#FFF9DC" : "transparent",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = selected.has(row.staffId) ? "#FFF4BF" : T.goldLight; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = selected.has(row.staffId) ? "#FFF9DC" : "transparent"; }}
                >
                  <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(row.staffId)}
                      onChange={() => toggleOne(row.staffId)}
                    />
                  </td>
                  <td style={tdStyle}><Avatar name={row.displayName} photoUrl={row.photoUrl} /></td>
                  <td style={{ ...tdStyle, fontFamily: "ui-monospace, Cascadia Code, Courier New, monospace", fontSize: 12, color: T.textSoft }}>
                    {row.employeeCode}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: T.text }}>{row.displayName}</td>
                  <td style={tdStyle}>{row.mobile || "—"}</td>
                  <td style={{ ...tdStyle, color: T.textSoft, maxWidth: 180, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {row.email || "—"}
                  </td>
                  <td style={tdStyle}>{row.departmentName || "—"}</td>
                  <td style={tdStyle}>{row.designationName || "—"}</td>
                  <td style={tdStyle}>{row.branch || row.centerId || "—"}</td>
                  <td style={tdStyle}>
                    {row.assignedClassrooms?.length
                      ? <ClassroomCell rooms={row.assignedClassrooms} />
                      : "—"}
                  </td>
                  <td style={tdStyle}>
                    <StatusPill status={row.employmentStatus} />
                    {row.deletedAt && (
                      <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: T.red }}>(deleted)</span>
                    )}
                  </td>
                  <td style={tdStyle}><LoginPill status={row.loginStatus} /></td>
                  <td style={tdStyle}>{row.joiningDate || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "12px 18px", borderTop: `1px solid ${T.border}`,
            background: "#FDFAF5",
            fontSize: 12, color: T.textSoft,
          }}>
            <div>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pagerBtn(page === 1)}>‹</button>
              <span>Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pagerBtn(page === totalPages)}>›</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Local style helpers ────────────────────────────────────────────

const selectStyle = {
  border: `1px solid ${T.border}`,
  borderRadius: 10,
  padding: "9px 12px",
  fontSize: 13,
  background: "#FDFAF5",
  outline: "none",
  cursor: "pointer",
};

const bulkBtnStyle = {
  border: `1px solid ${T.border}`,
  background: T.surface,
  color: T.text,
  borderRadius: 8,
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const thStyle = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: T.textMuted,
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "10px 12px",
  fontSize: 13,
  color: T.text,
  whiteSpace: "nowrap",
};

function pagerBtn(disabled) {
  return {
    border: `1px solid ${T.border}`,
    background: T.surface,
    borderRadius: 6,
    width: 28, height: 28,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    fontSize: 14,
    color: T.text,
  };
}

function ClassroomCell({ rooms }) {
  const visible = rooms.slice(0, 2);
  const extra   = rooms.length - visible.length;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "wrap" }} title={rooms.join(", ")}>
      {visible.map((r, i) => (
        <span key={`${r}-${i}`} style={{
          background: T.goldLight, color: T.goldMid,
          border: `1px solid ${T.borderGold}`,
          borderRadius: 999, padding: "1px 8px",
          fontSize: 11, fontWeight: 600,
        }}>{r}</span>
      ))}
      {extra > 0 && (
        <span style={{ fontSize: 11, color: T.textMuted }}>+{extra}</span>
      )}
    </span>
  );
}

function LoginPill({ status }) {
  const meta = LOGIN_STATUS_META[status] || LOGIN_STATUS_META.not_linked;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "1px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
      background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: meta.dot }} />
      {meta.label}
    </span>
  );
}

function Th({ label, col, sortKey, sortDir, onSort }) {
  const active = sortKey === col;
  return (
    <th
      onClick={() => onSort(col)}
      style={{ ...thStyle, cursor: "pointer", color: active ? T.text : T.textMuted }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {label}
        {active && <span style={{ fontSize: 10 }}>{sortDir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}
