/**
 * UserManagement.jsx — Yellow Dot staff user directory
 * ──────────────────────────────────────────────────────
 * Full CRUD for Users sheet entries.
 * Developer + super_admin + admin + center_admin can access.
 *
 * Features:
 *   • Stats bar — total / active / inactive / role spread
 *   • Search by name, email, or mobile
 *   • Filter by role, status, and center
 *   • Table: avatar · name/email · role badge · center · status · last login · actions
 *   • Add / Edit slide-in modal
 *   • Inline status toggle with optimistic update
 *   • Password reset trigger
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth }   from "../contexts/AuthContext";
import { useToast, Modal } from "../components/ui";
import userService   from "../services/userService";
import roleService   from "../services/roleService";
import { ROLE_LABELS, ROLE_HIERARCHY, isBypassRole } from "../config/permissions";

// ── Constants ─────────────────────────────────────────────────────

const MANAGEABLE_ROLES = ROLE_HIERARCHY.filter(
  (r) => !["developer", "super_admin"].includes(r)
);

const STATUS_OPTIONS = [
  { value: "all",      label: "All Status" },
  { value: "active",   label: "Active" },
  { value: "inactive", label: "Inactive" },
];

// ── Role badge colour map ─────────────────────────────────────────

const ROLE_COLORS = {
  developer:    { bg: "#1E1E1E", color: "#F4C400" },
  super_admin:  { bg: "#7C3AED", color: "#fff" },
  admin:        { bg: "#F4C400", color: "#1E1E1E" },
  center_admin: { bg: "#F4C400", color: "#1E1E1E" },
  center_owner: { bg: "#F4C400", color: "#1E1E1E" },
  teacher:      { bg: "#16A34A", color: "#fff" },
  accountant:   { bg: "#2563EB", color: "#fff" },
  reception:    { bg: "#D97706", color: "#fff" },
  parent:       { bg: "#0891B2", color: "#fff" },
};

// ── SVG icons ─────────────────────────────────────────────────────

const S = { w: 15, h: 15, fill: "none", stroke: "currentColor", sw: "1.75", lc: "round", lj: "round" };
const ico = (d) => (
  <svg width={S.w} height={S.h} viewBox="0 0 24 24" fill={S.fill}
    stroke={S.stroke} strokeWidth={S.sw} strokeLinecap={S.lc} strokeLinejoin={S.lj}>
    {d}
  </svg>
);

const Ico = {
  Search:   () => ico(<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>),
  Plus:     () => ico(<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>),
  Edit:     () => ico(<><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></>),
  Key:      () => ico(<><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></>),
  ChevDown: () => ico(<><polyline points="6 9 12 15 18 9"/></>),
  X:        () => ico(<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>),
  Users:    () => ico(<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></>),
  Filter:   () => ico(<><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></>),
  Mail:     () => ico(<><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>),
};

// ── Helpers ───────────────────────────────────────────────────────

function initials(name = "", email = "") {
  const src = name || email;
  return src.split(/[\s@]/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7)  return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: diffDays > 365 ? "2-digit" : undefined });
  } catch { return "—"; }
}

function fmtCenters(centers) {
  if (!centers) return "—";
  const arr = Array.isArray(centers)
    ? centers
    : String(centers).split(",").map((s) => s.trim()).filter(Boolean);
  if (!arr.length) return "—";
  return arr.join(", ");
}

// ── Sub-components ────────────────────────────────────────────────

function UserAvatar({ user, size = 34 }) {
  const [err, setErr] = useState(false);
  const ini = initials(user.name, user.email);

  if (user.photoUrl && !err) {
    return (
      <img
        src={user.photoUrl}
        alt={user.name}
        onError={() => setErr(true)}
        style={{
          width: size, height: size, borderRadius: 9,
          objectFit: "cover", flexShrink: 0, display: "block",
          border: "1.5px solid var(--yd-border-light)",
        }}
      />
    );
  }

  const color = ROLE_COLORS[user.role] || { bg: "var(--yd-yellow)", color: "var(--yd-black)" };
  return (
    <div style={{
      width: size, height: size, borderRadius: 9,
      background: color.bg, color: color.color,
      fontWeight: 800, fontSize: Math.round(size * 0.34),
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, letterSpacing: "-0.5px",
      border: "1.5px solid rgba(0,0,0,0.08)",
    }}>
      {ini}
    </div>
  );
}

function RoleBadge({ role, roleColor, roleLabel }) {
  // Dynamic color from Firestore > static map > default
  const hex = roleColor || ROLE_COLORS[role]?.bg;
  const bg  = hex ? `${hex}18` : "var(--yd-soft)";
  const fg  = hex || ROLE_COLORS[role]?.color || "var(--yd-text-soft)";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 9px", borderRadius: 100,
      background: bg, color: fg,
      border: hex ? `1.5px solid ${hex}33` : "none",
      fontSize: 10, fontWeight: 700,
      letterSpacing: "0.04em", textTransform: "uppercase",
      whiteSpace: "nowrap",
    }}>
      {roleLabel || ROLE_LABELS[role] || role}
    </span>
  );
}

function StatusPill({ status, onClick, disabled }) {
  const on = status === "active";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={on ? "Click to deactivate" : "Click to activate"}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "3px 10px", borderRadius: 100,
        background: on ? "var(--yd-success-soft)" : "var(--yd-soft)",
        color:      on ? "var(--yd-success)"      : "var(--yd-text-muted)",
        border: `1px solid ${on ? "var(--yd-success-border)" : "var(--yd-border)"}`,
        fontSize: 11, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 140ms",
        fontFamily: "var(--yd-font)",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: on ? "var(--yd-success)" : "var(--yd-text-muted)",
        flexShrink: 0,
      }} />
      {on ? "Active" : "Inactive"}
    </button>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: "var(--yd-surface)",
      border: "1px solid var(--yd-border)",
      borderRadius: 12,
      padding: "14px 18px",
      display: "flex", flexDirection: "column", gap: 3,
      boxShadow: "var(--yd-shadow-xs)",
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--yd-text-muted)" }}>
        {label}
      </span>
      <span style={{
        fontSize: 26, fontWeight: 800, letterSpacing: "-1px",
        color: accent || "var(--yd-charcoal)", lineHeight: 1.1,
      }}>
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: 11, color: "var(--yd-text-soft)", marginTop: 1 }}>{sub}</span>
      )}
    </div>
  );
}

// ── Add / Edit modal form ─────────────────────────────────────────

const EMPTY_FORM = {
  name: "", email: "", mobile: "",
  role: "teacher", centers: "", status: "active",
};

function UserForm({ isOpen, onClose, initial, onSave, saving, isBypass, availableRoles = [] }) {
  // State is reset via key prop in parent — no effect needed.
  const isEdit = !!initial;
  const [form, setForm] = useState(() =>
    initial
      ? {
          name:    initial.name    || "",
          email:   initial.email   || "",
          mobile:  initial.mobile  || "",
          role:    initial.role    || "teacher",
          centers: fmtCenters(initial.centers) === "—" ? "" : fmtCenters(initial.centers),
          status:  initial.status  || "active",
        }
      : EMPTY_FORM
  );
  const [errors, setErrors] = useState({});

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const setV = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  function validate() {
    const e = {};
    if (!form.name.trim())  e.name  = "Full name is required";
    if (!form.email.trim()) e.email = "Email address is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "Enter a valid email address";
    if (!form.role) e.role = "Role is required";
    if (form.mobile && form.mobile.trim() && !/^[+\d\s\-().]{7,20}$/.test(form.mobile.trim())) {
      e.mobile = "Enter a valid phone number";
    }
    setErrors(e);
    return !Object.keys(e).length;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    const centersArr = form.centers
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      name:    form.name.trim(),
      email:   form.email.trim().toLowerCase(),
      mobile:  form.mobile.trim(),
      role:    form.role,
      centers: centersArr,
      status:  form.status,
    };
    onSave(payload);
  }

  // Prefer dynamic roles from Firestore; fall back to static ROLE_HIERARCHY
  const roleOptions = availableRoles.length > 0
    ? (isBypass
        ? availableRoles
        : availableRoles.filter(r => !["developer","super_admin"].includes(r.roleId)))
    : (isBypass ? ROLE_HIERARCHY : MANAGEABLE_ROLES).map(r => ({ roleId: r, name: ROLE_LABELS[r] || r }));

  const footer = (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
      <button className="btn btn-ghost btn-sm" onClick={onClose} type="button">Cancel</button>
      <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={saving} type="submit">
        {saving ? "Saving…" : isEdit ? "Save Changes" : "Add User"}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit User" : "Add New User"}
      footer={footer}
      size="wide"
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Row 1 — name + email */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="yd-field">
            <label className="yd-label">Full Name *</label>
            <input
              className={`yd-input${errors.name ? " error" : ""}`}
              value={form.name}
              onChange={set("name")}
              placeholder="Priya Sharma"
              autoFocus
            />
            {errors.name && <span className="yd-error-text">{errors.name}</span>}
          </div>
          <div className="yd-field">
            <label className="yd-label">Email Address *</label>
            <input
              className={`yd-input${errors.email ? " error" : ""}`}
              type="email"
              value={form.email}
              onChange={set("email")}
              placeholder="priya@school.com"
              disabled={isEdit} // can't change email after creation
            />
            {errors.email && <span className="yd-error-text">{errors.email}</span>}
            {isEdit && <span className="yd-hint-text">Email cannot be changed after account creation.</span>}
          </div>
        </div>

        {/* Row 2 — mobile + role */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="yd-field">
            <label className="yd-label">Mobile Number</label>
            <input
              className={`yd-input${errors.mobile ? " error" : ""}`}
              type="tel"
              value={form.mobile}
              onChange={set("mobile")}
              placeholder="+91 98765 43210"
            />
            {errors.mobile && <span className="yd-error-text">{errors.mobile}</span>}
          </div>
          <div className="yd-field">
            <label className="yd-label">Role *</label>
            <select
              className={`yd-input${errors.role ? " error" : ""}`}
              value={form.role}
              onChange={set("role")}
            >
              {roleOptions.map((r) => (
                <option key={r.roleId || r} value={r.roleId || r}>
                  {r.name || ROLE_LABELS[r] || r}
                </option>
              ))}
            </select>
            {errors.role && <span className="yd-error-text">{errors.role}</span>}
          </div>
        </div>

        {/* Row 3 — centers + status (edit only) */}
        <div style={{ display: "grid", gridTemplateColumns: isEdit ? "1fr 1fr" : "1fr", gap: 12 }}>
          <div className="yd-field">
            <label className="yd-label">Centers</label>
            <input
              className="yd-input"
              value={form.centers}
              onChange={set("centers")}
              placeholder="Main Branch, North Campus"
            />
            <span className="yd-hint-text">Comma-separated list of centers this user can access.</span>
          </div>
          {isEdit && (
            <div className="yd-field">
              <label className="yd-label">Status</label>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                {["active", "inactive"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setV("status", s)}
                    style={{
                      flex: 1, padding: "7px 0", borderRadius: 8,
                      border: `1.5px solid ${form.status === s ? (s === "active" ? "var(--yd-success)" : "var(--yd-danger)") : "var(--yd-border)"}`,
                      background: form.status === s
                        ? (s === "active" ? "var(--yd-success-soft)" : "var(--yd-danger-soft)")
                        : "var(--yd-soft)",
                      color: form.status === s
                        ? (s === "active" ? "var(--yd-success)" : "var(--yd-danger)")
                        : "var(--yd-text-muted)",
                      fontWeight: 600, fontSize: 12,
                      cursor: "pointer", fontFamily: "var(--yd-font)",
                      transition: "all 120ms",
                      textTransform: "capitalize",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Auth method note on edit */}
        {isEdit && initial?.authMethod && (
          <div style={{
            padding: "8px 12px", borderRadius: 8,
            background: "var(--yd-soft)", border: "1px solid var(--yd-border-light)",
            fontSize: 12, color: "var(--yd-text-muted)", display: "flex", gap: 6, alignItems: "center",
          }}>
            <Ico.Mail />
            Auth method: <strong style={{ color: "var(--yd-text-soft)", textTransform: "capitalize" }}>
              {initial.authMethod}
            </strong>
            {initial.lastLoginAt && (
              <span style={{ marginLeft: "auto" }}>Last login: {fmtDate(initial.lastLoginAt)}</span>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}

// ── Confirm dialog ────────────────────────────────────────────────

function ConfirmModal({ isOpen, onClose, title, message, confirmLabel, onConfirm, danger, loading }) {
  const footer = (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
      <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
      <button
        className={`btn btn-sm ${danger ? "btn-danger" : "btn-primary"}`}
        onClick={onConfirm}
        disabled={loading}
      >
        {loading ? "Working…" : confirmLabel}
      </button>
    </div>
  );
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} footer={footer}>
      <p style={{ fontSize: 13, color: "var(--yd-text-soft)", lineHeight: 1.6, margin: 0 }}>{message}</p>
    </Modal>
  );
}

// ── Filter toolbar chip ───────────────────────────────────────────

function FilterSelect({ value, onChange, options, icon }) {
  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      {icon && (
        <span style={{
          position: "absolute", left: 10, color: "var(--yd-text-muted)",
          display: "flex", alignItems: "center", pointerEvents: "none",
        }}>
          {icon}
        </span>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          paddingLeft: icon ? 32 : 12, paddingRight: 28, height: 36,
          border: "1.5px solid var(--yd-border)",
          borderRadius: 9, background: "var(--yd-surface)",
          fontSize: 12, fontWeight: 500, color: "var(--yd-text)",
          fontFamily: "var(--yd-font)", cursor: "pointer", outline: "none",
          appearance: "none", transition: "border-color 140ms",
          minWidth: 130,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <span style={{
        position: "absolute", right: 9, color: "var(--yd-text-muted)",
        display: "flex", alignItems: "center", pointerEvents: "none",
      }}>
        <Ico.ChevDown />
      </span>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────

function EmptyRow({ cols, search }) {
  return (
    <tr>
      <td colSpan={cols} style={{ padding: "48px 20px", textAlign: "center" }}>
        <div style={{ color: "var(--yd-text-muted)", fontSize: 13 }}>
          {search ? (
            <>No users match <strong>"{search}"</strong></>
          ) : (
            "No users found. Add your first team member."
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Skeleton row ──────────────────────────────────────────────────

function SkeletonRow() {
  const cell = (w) => (
    <td style={{ padding: "10px 14px" }}>
      <div style={{
        height: 14, width: w, borderRadius: 6,
        background: "var(--yd-soft)",
        animation: "yd-shimmer 1.4s ease-in-out infinite",
        backgroundSize: "400% 100%",
        backgroundImage: "linear-gradient(90deg, var(--yd-soft) 25%, var(--yd-border-light) 50%, var(--yd-soft) 75%)",
      }} />
    </td>
  );
  return (
    <tr>
      <td style={{ padding: "10px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--yd-soft)", flexShrink: 0 }} />
          <div>
            <div style={{ height: 12, width: 120, borderRadius: 5, background: "var(--yd-soft)", marginBottom: 5 }} />
            <div style={{ height: 10, width: 160, borderRadius: 5, background: "var(--yd-soft)" }} />
          </div>
        </div>
      </td>
      {cell(80)} {cell(100)} {cell(60)} {cell(70)} {cell(60)}
    </tr>
  );
}

// ══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════

export default function UserManagement() {
  const { role, devRole, isDeveloper, canDo } = useAuth();
  const { show: toast } = useToast();

  const effectiveRole = devRole || role;
  const isBypass = isBypassRole(effectiveRole) || isDeveloper;

  // Action-level permission flags (staff module)
  const perm = {
    create: canDo("staff", "create"),
    edit:   canDo("staff", "edit"),
    delete: canDo("staff", "delete"),
  };

  // ── Data state ──────────────────────────────────────────────────
  const [users,          setUsers]          = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // ── UI state ────────────────────────────────────────────────────
  const [search,        setSearch]        = useState("");
  const [roleFilter,    setRoleFilter]    = useState("all");
  const [statusFilter,  setStatusFilter]  = useState("all");
  const [centerFilter,  setCenterFilter]  = useState("");

  // ── Modal state ─────────────────────────────────────────────────
  const [formOpen,    setFormOpen]    = useState(false);
  const [editTarget,  setEditTarget]  = useState(null);   // null = add mode
  const [formSaving,  setFormSaving]  = useState(false);
  const [formKey,     setFormKey]     = useState(0);      // bumped to remount form

  // ── Confirm modal ────────────────────────────────────────────────
  const [confirm,     setConfirm]     = useState(null);   // { user, action }
  const [confirmWork, setConfirmWork] = useState(false);

  // ── New user temp-password reveal ────────────────────────────────
  const [newUserInfo, setNewUserInfo] = useState(null);  // { name, email, tempPassword }

  // ── Inline working states (optimistic) ──────────────────────────
  const [toggling,    setToggling]    = useState(new Set()); // userId set

  // ── Load users + roles ───────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [data, rolesData] = await Promise.all([
        userService.getAll(),
        roleService.getAll().catch(() => ({ roles: [] })),
      ]);
      setUsers(Array.isArray(data) ? data : data.users || []);
      setAvailableRoles(rolesData.roles || []);
    } catch (e) {
      setError(e.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  // Mount-time fetch — call load() in a microtask so setState calls
  // happen outside the synchronous effect body (satisfies set-state-in-effect).
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  // ── Filtered list ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (centerFilter) {
        const cs = fmtCenters(u.centers).toLowerCase();
        if (!cs.includes(centerFilter.toLowerCase())) return false;
      }
      if (q) {
        return (
          (u.name   || "").toLowerCase().includes(q) ||
          (u.email  || "").toLowerCase().includes(q) ||
          (u.mobile || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [users, search, roleFilter, statusFilter, centerFilter]);

  // ── Stats ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const active   = users.filter((u) => u.status === "active").length;
    const inactive = users.filter((u) => u.status !== "active").length;
    const now      = new Date();
    const thisMonth = users.filter((u) => {
      if (!u.createdAt) return false;
      const d = new Date(u.createdAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
    // role spread: top 3 non-bypass roles
    const roleMap = {};
    users.forEach((u) => {
      if (!isBypassRole(u.role)) roleMap[u.role] = (roleMap[u.role] || 0) + 1;
    });
    const topRole = Object.entries(roleMap).sort((a, b) => b[1] - a[1])[0];
    return { total: users.length, active, inactive, thisMonth, topRole };
  }, [users]);

  // ── Role filter options (dynamic from Firestore, fallback to static) ─────────
  const roleOptions = useMemo(() => {
    const used = new Set(users.map(u => u.role));
    if (availableRoles.length > 0) {
      return [
        { value: "all", label: "All Roles" },
        ...availableRoles
          .filter(r => used.has(r.roleId))
          .map(r => ({ value: r.roleId, label: r.name })),
      ];
    }
    return [
      { value: "all", label: "All Roles" },
      ...ROLE_HIERARCHY
        .filter(r => used.has(r))
        .map(r => ({ value: r, label: ROLE_LABELS[r] || r })),
    ];
  }, [users, availableRoles]);

  // ── Unique centers for filter ────────────────────────────────────
  const centerSet = useMemo(() => {
    const s = new Set();
    users.forEach((u) => {
      const arr = Array.isArray(u.centers)
        ? u.centers
        : String(u.centers || "").split(",").map((x) => x.trim()).filter(Boolean);
      arr.forEach((c) => s.add(c));
    });
    return [...s].sort();
  }, [users]);

  // ── Handlers ────────────────────────────────────────────────────

  const openAdd  = () => { setEditTarget(null); setFormKey((k) => k + 1); setFormOpen(true); };
  const openEdit = (u) => { setEditTarget(u);   setFormKey((k) => k + 1); setFormOpen(true); };

  async function handleFormSave(payload) {
    setFormSaving(true);
    try {
      if (editTarget) {
        const updated = await userService.update(editTarget.userId || editTarget.id, payload);
        setUsers((prev) =>
          prev.map((u) =>
            (u.userId || u.id) === (editTarget.userId || editTarget.id)
              ? { ...u, ...updated }
              : u
          )
        );
        toast("User updated", "success");
      } else {
        const result = await userService.create(payload);
        const created = result?.user ?? result;
        setUsers((prev) => [created, ...prev]);
        setFormOpen(false);
        // Show temp password modal if backend generated one
        if (result?.tempPassword) {
          setNewUserInfo({
            name:        created?.name || payload.name,
            email:       created?.email || payload.email,
            tempPassword: result.tempPassword,
          });
        } else {
          toast("User added successfully", "success");
        }
        return; // skip the setFormOpen(false) below (already called)
      }
      setFormOpen(false);
    } catch (e) {
      toast(e.message || "Save failed", "error");
    }
    setFormSaving(false);
  }

  async function handleStatusToggle(u) {
    const uid = u.userId || u.id;
    const next = u.status === "active" ? "inactive" : "active";

    // Deactivating → confirm first
    if (next === "inactive") {
      setConfirm({ user: u, action: "deactivate" });
      return;
    }

    // Activating → optimistic, no confirm
    setToggling((s) => new Set([...s, uid]));
    setUsers((prev) => prev.map((x) => (x.userId || x.id) === uid ? { ...x, status: next } : x));
    try {
      await userService.setStatus(uid, next);
      toast("User activated", "success");
    } catch (e) {
      setUsers((prev) => prev.map((x) => (x.userId || x.id) === uid ? { ...x, status: u.status } : x));
      toast(e.message || "Failed to update status", "error");
    }
    setToggling((s) => { const ns = new Set(s); ns.delete(uid); return ns; });
  }

  async function handleConfirmAction() {
    if (!confirm) return;
    const uid  = confirm.user.userId || confirm.user.id;
    const next = confirm.action === "deactivate" ? "inactive" : "active";
    setConfirmWork(true);
    try {
      await userService.setStatus(uid, next);
      setUsers((prev) => prev.map((u) => (u.userId || u.id) === uid ? { ...u, status: next } : u));
      toast(`User ${next === "inactive" ? "deactivated" : "activated"}`, "success");
      setConfirm(null);
    } catch (e) {
      toast(e.message || "Failed", "error");
    }
    setConfirmWork(false);
  }

  async function handleResetPassword(u) {
    const uid = u.userId || u.id;
    try {
      await userService.resetPassword(uid);
      toast(`Password reset email sent to ${u.email}`, "success");
    } catch (e) {
      toast(e.message || "Reset failed", "error");
    }
  }

  const hasFilters = search || roleFilter !== "all" || statusFilter !== "all" || centerFilter;

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div style={{ padding: "28px 32px 48px", maxWidth: 1100 }}>

      {/* ── Page header ─────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "flex-start",
        justifyContent: "space-between", gap: 16, marginBottom: 24,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", color: "var(--yd-charcoal)", margin: 0, lineHeight: 1.1 }}>
            Staff Management
          </h1>
          <p style={{ fontSize: 13, color: "var(--yd-text-soft)", margin: "4px 0 0", fontWeight: 400 }}>
            Manage staff accounts, roles and center access.
          </p>
        </div>
        {perm.create && (
          <button
            className="btn btn-primary btn-sm"
            onClick={openAdd}
            style={{ flexShrink: 0 }}
          >
            <Ico.Plus /> Add User
          </button>
        )}
      </div>

      {/* ── Stats row ───────────────────────────────────────────── */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        gap: 12, marginBottom: 20,
      }}>
        <StatCard label="Total Users"  value={stats.total}    sub={loading ? "Loading…" : `${stats.active} active`} />
        <StatCard label="Active"       value={stats.active}   sub="Currently enabled" accent="var(--yd-success)" />
        <StatCard label="Inactive"     value={stats.inactive} sub="Disabled accounts" accent={stats.inactive > 0 ? "var(--yd-danger)" : undefined} />
        <StatCard label="Added This Month" value={stats.thisMonth} sub={stats.topRole ? `Most: ${ROLE_LABELS[stats.topRole[0]]}` : "No data"} />
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        flexWrap: "wrap", marginBottom: 14,
      }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 340 }}>
          <span style={{
            position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
            color: "var(--yd-text-muted)", display: "flex", alignItems: "center", pointerEvents: "none",
          }}>
            <Ico.Search />
          </span>
          <input
            className="yd-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, mobile…"
            style={{ paddingLeft: 34, height: 36, fontSize: 12 }}
          />
        </div>

        {/* Role filter */}
        <FilterSelect
          value={roleFilter}
          onChange={setRoleFilter}
          options={roleOptions}
        />

        {/* Status filter */}
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_OPTIONS}
        />

        {/* Center filter */}
        {centerSet.length > 0 && (
          <FilterSelect
            value={centerFilter || "all"}
            onChange={(v) => setCenterFilter(v === "all" ? "" : v)}
            options={[
              { value: "all", label: "All Centers" },
              ...centerSet.map((c) => ({ value: c, label: c })),
            ]}
          />
        )}

        {/* Clear filters */}
        {hasFilters && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setSearch(""); setRoleFilter("all"); setStatusFilter("all"); setCenterFilter(""); }}
          >
            <Ico.X /> Clear
          </button>
        )}

        {/* Count */}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--yd-text-muted)", whiteSpace: "nowrap" }}>
          {loading ? "Loading…" : `${filtered.length} of ${users.length} users`}
        </span>
      </div>

      {/* ── Error state ─────────────────────────────────────────── */}
      {error && (
        <div style={{
          padding: "12px 16px", borderRadius: 10, marginBottom: 14,
          background: "var(--yd-danger-soft)", border: "1px solid var(--yd-danger-border)",
          fontSize: 13, color: "var(--yd-danger)", display: "flex", gap: 10, alignItems: "center",
        }}>
          <span>⚠ {error}</span>
          <button className="btn btn-ghost btn-xs" onClick={load} style={{ marginLeft: "auto" }}>Retry</button>
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────── */}
      <div style={{
        background: "var(--yd-surface)",
        border: "1px solid var(--yd-border)",
        borderRadius: 12, overflow: "hidden",
        boxShadow: "var(--yd-shadow-xs)",
      }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--yd-soft)", borderBottom: "1px solid var(--yd-border)" }}>
                {["User", "Role", "Centers", "Status", "Last Login", ""].map((h, i) => (
                  <th key={i} style={{
                    padding: "9px 14px", textAlign: "left",
                    fontSize: 10, fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: "0.07em",
                    color: "var(--yd-text-muted)", whiteSpace: "nowrap",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              ) : filtered.length === 0 ? (
                <EmptyRow cols={6} search={search} />
              ) : (
                filtered.map((u) => {
                  const uid      = u.userId || u.id;
                  const isToggling = toggling.has(uid);
                  return (
                    <tr
                      key={uid}
                      style={{ borderBottom: "1px solid var(--yd-border-light)", transition: "background 100ms" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--yd-soft)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = ""}
                    >
                      {/* User cell */}
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <UserAvatar user={u} size={34} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{
                              fontWeight: 600, color: "var(--yd-charcoal)",
                              fontSize: 13, lineHeight: 1.2,
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                              maxWidth: 180,
                            }}>
                              {u.name || "—"}
                            </div>
                            <div style={{
                              fontSize: 11, color: "var(--yd-text-muted)", marginTop: 1,
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                              maxWidth: 180,
                            }}>
                              {u.email}
                              {u.mobile && <span style={{ marginLeft: 6, color: "var(--yd-border-warm)" }}>·</span>}
                              {u.mobile && <span style={{ marginLeft: 6 }}>{u.mobile}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        <RoleBadge
                          role={u.role}
                          roleColor={availableRoles.find(r => r.roleId === u.role)?.color}
                          roleLabel={availableRoles.find(r => r.roleId === u.role)?.name}
                        />
                      </td>

                      {/* Centers */}
                      <td style={{ padding: "10px 14px", color: "var(--yd-text-soft)", fontSize: 12, maxWidth: 160 }}>
                        <span style={{
                          display: "block", overflow: "hidden",
                          textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {fmtCenters(u.centers)}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        <StatusPill
                          status={u.status}
                          onClick={() => handleStatusToggle(u)}
                          disabled={isToggling}
                        />
                      </td>

                      {/* Last login */}
                      <td style={{ padding: "10px 14px", color: "var(--yd-text-muted)", fontSize: 12, whiteSpace: "nowrap" }}>
                        {fmtDate(u.lastLoginAt)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          {perm.edit && (
                            <ActionBtn title="Edit user" onClick={() => openEdit(u)}>
                              <Ico.Edit />
                            </ActionBtn>
                          )}
                          <ActionBtn title="Send password reset" onClick={() => handleResetPassword(u)}>
                            <Ico.Key />
                          </ActionBtn>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        {!loading && users.length > 0 && (
          <div style={{
            padding: "8px 16px", borderTop: "1px solid var(--yd-border-light)",
            background: "var(--yd-soft)", display: "flex", alignItems: "center",
            justifyContent: "space-between", fontSize: 11, color: "var(--yd-text-muted)",
          }}>
            <span>
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
              {hasFilters && ` (filtered from ${users.length})`}
            </span>
            <span>Users sheet · auto-synced</span>
          </div>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────── */}
      <UserForm
        key={formKey}
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        initial={editTarget}
        onSave={handleFormSave}
        saving={formSaving}
        isBypass={isBypass}
        availableRoles={availableRoles}
      />

      <ConfirmModal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        title="Deactivate User"
        message={`Are you sure you want to deactivate ${confirm?.user?.name || confirm?.user?.email}? They will lose access immediately. You can reactivate them any time.`}
        confirmLabel="Deactivate"
        onConfirm={handleConfirmAction}
        danger
        loading={confirmWork}
      />

      {/* ── New-user temp-password reveal ─────────────────────────── */}
      {newUserInfo && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)",
        }}>
          <div style={{
            background: "#fff", borderRadius: 16, padding: "32px 28px",
            width: "min(420px, 92vw)", boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            display: "flex", flexDirection: "column", gap: 18,
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: "#F4C400", display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                  stroke="#1E1E1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#111" }}>
                  User Created Successfully
                </div>
                <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
                  {newUserInfo.name} · {newUserInfo.email}
                </div>
              </div>
            </div>

            {/* Temp password block */}
            <div style={{
              background: "#FFFBEB", border: "1.5px solid #FCD34D",
              borderRadius: 10, padding: "14px 16px",
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#92400E", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Temporary Password
              </div>
              <div style={{
                fontFamily: "monospace", fontSize: 20, fontWeight: 700,
                color: "#1E1E1E", letterSpacing: "0.08em",
                userSelect: "all",
              }}>
                {newUserInfo.tempPassword}
              </div>
              <div style={{ fontSize: 12, color: "#B45309", marginTop: 8 }}>
                Share this with {newUserInfo.name}. Ask them to log in and reset their password immediately.
              </div>
            </div>

            {/* Copy button + dismiss */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(newUserInfo.tempPassword).catch(() => {});
                  toast("Password copied to clipboard", "success");
                }}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 10,
                  background: "#F4C400", border: "none", cursor: "pointer",
                  fontWeight: 700, fontSize: 14, color: "#1E1E1E",
                }}
              >
                Copy Password
              </button>
              <button
                onClick={() => setNewUserInfo(null)}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 10,
                  background: "#F3F4F6", border: "none", cursor: "pointer",
                  fontWeight: 600, fontSize: 14, color: "#374151",
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small icon button ─────────────────────────────────────────────

function ActionBtn({ title, onClick, children }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 30, height: 30, borderRadius: 7,
        border: "1px solid var(--yd-border)",
        background: hover ? "var(--yd-yellow-light)" : "var(--yd-surface)",
        color: hover ? "var(--yd-charcoal)" : "var(--yd-text-muted)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", transition: "all 110ms",
        fontFamily: "var(--yd-font)",
      }}
    >
      {children}
    </button>
  );
}
