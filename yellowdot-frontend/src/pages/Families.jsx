/**
 * Families.jsx — Family & Sibling Management
 * ─────────────────────────────────────────────────────────────────
 * Lists all families, supports search + filters, create / edit / view.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import familyService from "../services/familyService";
import { useAuth } from "../contexts/AuthContext";

// ── Design tokens (matches app-wide Yellow Dot palette) ──────────────
const T = {
  bg:         "#FFFDF7",
  surface:    "#FFFFFF",
  surfaceWarm:"#FDFAF5",
  border:     "rgba(0,0,0,0.08)",
  borderGold: "rgba(244,196,0,0.35)",
  shadow:     "0 1px 4px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)",
  shadowMd:   "0 4px 20px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
  text:       "#2A2A2A",
  textMuted:  "#8C8880",
  textSoft:   "#6A6560",
  gold:       "#F4C400",
  goldDark:   "#78350F",
  goldMid:    "#B45309",
  goldLight:  "rgba(244,196,0,0.10)",
  green:      "#059669",
  red:        "#DC2626",
  redLight:   "rgba(220,38,38,0.09)",
};

// ── Tiny reusables ───────────────────────────────────────────────────

const Chip = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: "5px 14px",
      borderRadius: 20,
      fontSize: 12,
      fontWeight: active ? 600 : 400,
      border: `1px solid ${active ? T.goldDark : T.border}`,
      background: active ? T.goldLight : "transparent",
      color: active ? T.goldMid : T.textSoft,
      cursor: "pointer",
      transition: "all 120ms",
    }}
  >{label}</button>
);

const Badge = ({ count }) => count > 0 ? (
  <span style={{
    background: T.goldLight,
    color: T.goldMid,
    border: `1px solid ${T.borderGold}`,
    borderRadius: 10,
    padding: "1px 8px",
    fontSize: 11,
    fontWeight: 600,
    marginLeft: 6,
  }}>{count}</span>
) : null;

// ── Family row card ──────────────────────────────────────────────────

function FamilyRow({ family, onEdit, onView }) {
  const primaryName = family.fatherName || family.motherName || "—";
  const secondName  = family.fatherName && family.motherName ? family.motherName : "";
  const initials    = primaryName.charAt(0).toUpperCase();

  return (
    <div
      onClick={() => onView(family.familyId)}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 120px 140px 80px 100px",
        alignItems: "center",
        gap: 12,
        padding: "14px 20px",
        borderBottom: `1px solid ${T.border}`,
        cursor: "pointer",
        transition: "background 120ms",
        background: "transparent",
      }}
      onMouseEnter={e => e.currentTarget.style.background = T.goldLight}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      {/* Family name + code */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: T.goldLight,
          border: `1px solid ${T.borderGold}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: 14, color: T.goldMid, flexShrink: 0,
        }}>{initials}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {primaryName}
          </div>
          {secondName && (
            <div style={{ fontSize: 11.5, color: T.textMuted }}>{secondName}</div>
          )}
        </div>
      </div>

      {/* Family code */}
      <div style={{ fontSize: 12.5, color: T.textSoft, fontFamily: "monospace" }}>
        {family.familyCode}
      </div>

      {/* Children count */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>
          {family.studentIds?.length || 0}
        </span>
        <span style={{ fontSize: 11.5, color: T.textMuted }}>
          {(family.studentIds?.length || 0) === 1 ? "child" : "children"}
        </span>
      </div>

      {/* Contact */}
      <div style={{ fontSize: 12.5, color: T.textSoft }}>
        {family.primaryContact || "—"}
      </div>

      {/* Center */}
      <div style={{ fontSize: 12.5, color: T.textSoft }}>
        {family.centerId || "—"}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
        <button
          onClick={() => onEdit(family)}
          style={{
            padding: "4px 10px", fontSize: 12, borderRadius: 6,
            border: `1px solid ${T.border}`,
            background: "transparent", color: T.textSoft,
            cursor: "pointer",
          }}
        >Edit</button>
      </div>
    </div>
  );
}

// ── Family form modal ────────────────────────────────────────────────

function FamilyModal({ initial, onClose, onSaved }) {
  const isEdit = Boolean(initial?.familyId);
  const [form, setForm] = useState({
    fatherName:        initial?.fatherName        || "",
    motherName:        initial?.motherName        || "",
    primaryContact:    initial?.primaryContact    || "",
    alternateContact:  initial?.alternateContact  || "",
    email:             initial?.email             || "",
    address:           initial?.address           || "",
    centerId:          initial?.centerId          || "",
    billingPreference: initial?.billingPreference || "separate",
    active:            initial?.active !== false,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.fatherName && !form.motherName) {
      setError("At least one guardian name is required.");
      return;
    }
    setSaving(true); setError("");
    try {
      if (isEdit) {
        await familyService.update(initial.familyId, form);
      } else {
        await familyService.create(form);
      }
      onSaved();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: "100%", padding: "8px 10px", fontSize: 13,
    border: `1px solid ${T.border}`, borderRadius: 8,
    background: T.surfaceWarm, color: T.text, outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle = { fontSize: 11.5, fontWeight: 600, color: T.textSoft, marginBottom: 4, display: "block" };
  const row2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }} onClick={onClose}>
      <div
        style={{
          background: T.surface, borderRadius: 16, width: "100%", maxWidth: 520,
          boxShadow: "0 24px 64px rgba(0,0,0,0.14)", padding: "28px 28px 24px",
          maxHeight: "90vh", overflowY: "auto",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.text }}>
            {isEdit ? "Edit Family" : "Add New Family"}
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>
            {isEdit ? "Update family details below." : "Create a new family unit for linked siblings."}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={row2}>
            <div>
              <label style={labelStyle}>Guardian 1 Name</label>
              <input style={inputStyle} value={form.fatherName} onChange={e => set("fatherName", e.target.value)} placeholder="Guardian 1 full name" />
            </div>
            <div>
              <label style={labelStyle}>Guardian 2 Name</label>
              <input style={inputStyle} value={form.motherName} onChange={e => set("motherName", e.target.value)} placeholder="Guardian 2 full name" />
            </div>
          </div>

          <div style={{ ...row2, marginTop: 12 }}>
            <div>
              <label style={labelStyle}>Primary Contact *</label>
              <input style={inputStyle} value={form.primaryContact} onChange={e => set("primaryContact", e.target.value)} placeholder="+91 98765 43210" required />
            </div>
            <div>
              <label style={labelStyle}>Alternate Contact</label>
              <input style={inputStyle} value={form.alternateContact} onChange={e => set("alternateContact", e.target.value)} placeholder="+91 98765 43211" />
            </div>
          </div>

          <div style={{ ...row2, marginTop: 12 }}>
            <div>
              <label style={labelStyle}>Email Address</label>
              <input style={inputStyle} type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="family@example.com" />
            </div>
            <div>
              <label style={labelStyle}>Center</label>
              <input style={inputStyle} value={form.centerId} onChange={e => set("centerId", e.target.value)} placeholder="Center ID" />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Address</label>
            <textarea
              style={{ ...inputStyle, resize: "vertical", minHeight: 64 }}
              value={form.address}
              onChange={e => set("address", e.target.value)}
              placeholder="Full address…"
            />
          </div>

          {isEdit && (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" id="active-chk" checked={form.active} onChange={e => set("active", e.target.checked)} />
              <label htmlFor="active-chk" style={{ fontSize: 13, color: T.text, cursor: "pointer" }}>Family is active</label>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: T.redLight, color: T.red, fontSize: 12.5 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} style={{
              padding: "8px 18px", borderRadius: 8, fontSize: 13,
              border: `1px solid ${T.border}`, background: "transparent", color: T.textSoft, cursor: "pointer",
            }}>Cancel</button>
            <button type="submit" disabled={saving} style={{
              padding: "8px 22px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: T.gold, color: T.goldDark, border: "none", cursor: saving ? "wait" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}>{saving ? "Saving…" : isEdit ? "Update Family" : "Create Family"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────

export default function Families() {
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const [families, setFamilies] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState("all");   // all | active | inactive
  const [modal,    setModal]    = useState(null);     // null | "create" | familyObj
  const searchRef              = useRef(null);
  const debounceRef            = useRef(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { families: data } = await familyService.getAll();
      setFamilies(data || []);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Failed to load families.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Search with debounce
  function handleSearch(val) {
    setSearch(val);
    clearTimeout(debounceRef.current);
    if (!val.trim()) return;
    debounceRef.current = setTimeout(async () => {
      try {
        const { families: data } = await familyService.search(val);
        setFamilies(data || []);
      } catch { /* ignore */ }
    }, 350);
  }

  function clearSearch() {
    setSearch("");
    load();
    searchRef.current?.focus();
  }

  const displayed = families.filter(f => {
    if (filter === "active")   return f.active !== false;
    if (filter === "inactive") return f.active === false;
    return true;
  });

  const activeCount   = families.filter(f => f.active !== false).length;
  const inactiveCount = families.filter(f => f.active === false).length;

  return (
    <MainLayout>
      <div style={{ padding: "28px 28px 60px", maxWidth: 1100, margin: "0 auto" }}>

        {/* ── Header ──────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.text }}>Families</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13.5, color: T.textMuted }}>
              Manage family units, sibling links, and shared parent details.
            </p>
          </div>
          <button
            onClick={() => setModal("create")}
            style={{
              padding: "9px 20px", borderRadius: 10, fontSize: 13.5, fontWeight: 600,
              background: T.gold, color: T.goldDark, border: "none", cursor: "pointer",
              boxShadow: "0 2px 8px rgba(244,196,0,0.30)",
            }}
          >+ Add Family</button>
        </div>

        {/* ── Search + filters ─────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
          {/* Search box */}
          <div style={{ position: "relative", flex: "1 1 260px", minWidth: 200 }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: T.textMuted }}>🔍</span>
            <input
              ref={searchRef}
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search by name, contact, family code…"
              style={{
                width: "100%", padding: "8px 32px 8px 32px", fontSize: 13.5,
                border: `1px solid ${T.border}`, borderRadius: 10,
                background: T.surfaceWarm, color: T.text, outline: "none",
                boxSizing: "border-box",
              }}
            />
            {search && (
              <button onClick={clearSearch} style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", fontSize: 14, color: T.textMuted, lineHeight: 1,
              }}>✕</button>
            )}
          </div>

          {/* Filter chips */}
          <div style={{ display: "flex", gap: 6 }}>
            <Chip label="All" active={filter === "all"} onClick={() => setFilter("all")} />
            <Chip label={<>Active<Badge count={activeCount} /></>} active={filter === "active"} onClick={() => setFilter("active")} />
            <Chip label={<>Inactive<Badge count={inactiveCount} /></>} active={filter === "inactive"} onClick={() => setFilter("inactive")} />
          </div>
        </div>

        {/* ── Table ────────────────────────────────────────────────── */}
        <div style={{ background: T.surface, borderRadius: 14, border: `1px solid ${T.border}`, boxShadow: T.shadow, overflow: "hidden" }}>

          {/* Table header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 120px 140px 80px 100px",
            gap: 12,
            padding: "10px 20px",
            borderBottom: `1px solid ${T.border}`,
            background: T.surfaceWarm,
          }}>
            {["Family", "Code", "Children", "Contact", "Center", "Actions"].map(h => (
              <span key={h} style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
            ))}
          </div>

          {/* Rows */}
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontSize: 13.5 }}>
              Loading families…
            </div>
          ) : error ? (
            <div style={{ padding: 40, textAlign: "center", color: T.red, fontSize: 13.5 }}>
              {error}
              <div style={{ marginTop: 10 }}>
                <button onClick={load} style={{ fontSize: 12.5, color: T.textSoft, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                  Retry
                </button>
              </div>
            </div>
          ) : displayed.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>👨‍👩‍👧‍👦</div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.text }}>
                {search ? "No families match your search." : "No families yet."}
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: T.textMuted }}>
                {search ? "Try a different name or contact number." : "Create your first family to link siblings together."}
              </p>
              {!search && (
                <button onClick={() => setModal("create")} style={{
                  marginTop: 16, padding: "8px 20px", borderRadius: 8, fontSize: 13,
                  background: T.gold, color: T.goldDark, border: "none", cursor: "pointer", fontWeight: 600,
                }}>Add First Family</button>
              )}
            </div>
          ) : (
            displayed.map(f => (
              <FamilyRow
                key={f.familyId}
                family={f}
                onEdit={fam => setModal(fam)}
                onView={id => navigate(`/family/${id}`)}
              />
            ))
          )}

          {/* Footer count */}
          {!loading && !error && displayed.length > 0 && (
            <div style={{ padding: "10px 20px", borderTop: `1px solid ${T.border}`, background: T.surfaceWarm }}>
              <span style={{ fontSize: 12, color: T.textMuted }}>
                Showing {displayed.length} of {families.length} {families.length === 1 ? "family" : "families"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal ─────────────────────────────────────────────────── */}
      {modal && (
        <FamilyModal
          initial={modal === "create" ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </MainLayout>
  );
}
