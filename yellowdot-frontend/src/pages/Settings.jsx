/**
 * Settings.jsx — Yellow Dot full settings module
 * ───────────────────────────────────────────────
 * Sections: School Profile · Academic Year · Fee Settings ·
 * Attendance Rules · User Management · Role Permissions ·
 * Branding · Notifications · Parent App · Payment ·
 * Gate Config · Release & Build (developer only)
 *
 * Developer role has unrestricted access to every section.
 * Admin/Center Admin can access all except Role Permissions and Release & Build.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Modal, useToast } from "../components/ui";
import settingsService, { DEFAULT_SETTINGS } from "../services/settingsService";
import QRManagement from "./QRManagement";
import {
  ROUTES, ROLE_LABELS, ROLE_HIERARCHY, ROLE_PERMISSIONS,
  isBypassRole,
} from "../config/permissions";
import { APP_ENV, APP_NAME, APP_VERSION, PLATFORM_NAME, currentEnvMeta } from "../config/environment";
import { FLAGS, FLAG_GROUPS } from "../config/featureFlags";
import { RELEASE_NOTES, CHANGE_TYPE_META } from "../config/releaseNotes";
import ReleasesDashboard from "./releases/ReleasesDashboard";
import InstallAppButton from "../components/InstallAppButton";

// ══════════════════════════════════════════════════════════════════
// ICONS  (Lucide-style SVG, 16×16)
// ══════════════════════════════════════════════════════════════════

const IC = { w: 16, h: 16, fill: "none", stroke: "currentColor", sw: "1.75", lc: "round", lj: "round" };
const svg = (paths) => (
  <svg width={IC.w} height={IC.h} viewBox="0 0 24 24" fill={IC.fill}
    stroke={IC.stroke} strokeWidth={IC.sw} strokeLinecap={IC.lc} strokeLinejoin={IC.lj}>
    {paths}
  </svg>
);

const Icons = {
  Building:    () => svg(<><path d="M3 9h18v11a1 1 0 01-1 1H4a1 1 0 01-1-1V9z"/><path d="M3 9V5a2 2 0 012-2h14a2 2 0 012 2v4"/><line x1="9" y1="21" x2="9" y2="13"/><line x1="15" y1="21" x2="15" y2="13"/><line x1="9" y1="13" x2="15" y2="13"/></>),
  Calendar:    () => svg(<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>),
  CreditCard:  () => svg(<><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></>),
  Clock:       () => svg(<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>),
  Camera:      () => svg(<><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></>),
  Users:       () => svg(<><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/><path d="M16 3.13a4 4 0 010 7.75"/><path d="M21 21v-2a4 4 0 00-3-3.85"/></>),
  Shield:      () => svg(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>),
  Palette:     () => svg(<><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></>),
  Bell:        () => svg(<><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></>),
  Smartphone:  () => svg(<><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></>),
  Wallet:      () => svg(<><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M16 10h2a2 2 0 010 4h-2"/><circle cx="16" cy="12" r="1"/></>),
  Settings:    () => svg(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></>),
  Plus:        () => svg(<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>),
  Trash:       () => svg(<><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></>),
  Check:       () => svg(<><polyline points="20 6 9 17 4 12"/></>),
  Info:        () => svg(<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>),
  Mail:        () => svg(<><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>),
  Save:        () => svg(<><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></>),
  UserPlus:    () => svg(<><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></>),
  AlertTriangle: () => svg(<><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>),
  QrCode:        () => svg(<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><line x1="14" y1="14" x2="14.01" y2="14"/><line x1="18" y1="14" x2="18.01" y2="14"/><line x1="14" y1="18" x2="14" y2="21"/><line x1="21" y1="18" x2="21" y2="21"/></>),
  GitBranch:     () => svg(<><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M18 9a9 9 0 01-9 9"/></>),
  Rocket:        () => svg(<><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2l5.5-5.5-8-3L4.5 16.5z"/><path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></>),
};

// ══════════════════════════════════════════════════════════════════
// SECTIONS CONFIG
// ══════════════════════════════════════════════════════════════════

const SECTIONS = [
  { id: "school",        label: "School Profile",   icon: "Building",   desc: "Basic info, contact details, logo" },
  { id: "academic",      label: "Academic Year",    icon: "Calendar",   desc: "Year label, dates, and terms" },
  { id: "fees",          label: "Fee Settings",     icon: "CreditCard", desc: "GST, late fees, payment modes" },
  { id: "attendance",    label: "Attendance Rules", icon: "Clock",      desc: "Check-in windows and thresholds" },
  { id: "users",         label: "User Management",  icon: "Users",      desc: "Staff accounts and roles" },
  { id: "permissions",   label: "Role Permissions", icon: "Shield",     desc: "Access control matrix" },
  { id: "branding",      label: "Branding",         icon: "Palette",    desc: "Logo, colors, report styles" },
  { id: "notifications", label: "Notifications",    icon: "Bell",       desc: "Alerts and delivery channels" },
  { id: "parent",        label: "Parent App",       icon: "Smartphone", desc: "What parents can see and do" },
  { id: "payment",       label: "Payment Settings", icon: "Wallet",     desc: "UPI ID, bank details, payment options" },
  { id: "gate_config",  label: "Gate Configuration", icon: "QrCode",      desc: "QR codes for gate entry and check-in" },
  { id: "about",        label: "About",              icon: "Info",        desc: "App version and install options" },
  { id: "releases",     label: "Staged Releases",    icon: "Rocket",      desc: "Module pipeline: Development → Testing → Production", developerOnly: true },
  { id: "release",      label: "Release & Build",    icon: "GitBranch",   desc: "Environment, version, feature flags", developerOnly: true },
];

// ══════════════════════════════════════════════════════════════════
// PARSE HELPERS  (sheets sends everything as strings)
// ══════════════════════════════════════════════════════════════════

const toBool = (v) => v === true || v === "true";
const toNum  = (v, def = 0) => { const n = Number(v); return isNaN(n) ? def : n; };
const toArr  = (v) => (typeof v === "string" && v ? v.split(",") : Array.isArray(v) ? v : []);
const toJSON = (v, def = []) => { try { return JSON.parse(v); } catch { return def; } };
const fromArr= (arr) => arr.join(",");

// ══════════════════════════════════════════════════════════════════
// SHARED SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════════

/** Animated toggle switch */
function Toggle({ checked, onChange, disabled }) {
  return (
    <label className="yd-switch">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="yd-switch-track" />
      <span className="yd-switch-thumb" />
    </label>
  );
}

/** Single toggle row with label + optional subtitle */
function ToggleRow({ label, sub, checked, onChange, disabled }) {
  return (
    <div className="yd-toggle-row">
      <div className="yd-toggle-info">
        <div className="yd-toggle-label">{label}</div>
        {sub && <div className="yd-toggle-sub">{sub}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

/** Labelled text/select/textarea input */
function Field({ label, hint, children, span2 }) {
  return (
    <div className={`yd-stg-field${span2 ? " yd-stg-span2" : ""}`}>
      <label className="yd-stg-label">{label}</label>
      {children}
      {hint && <span className="yd-stg-hint">{hint}</span>}
    </div>
  );
}

/** Section wrapper card */
function Card({ title, icon, children }) {
  const I = icon ? Icons[icon] : null;
  return (
    <div className="yd-stg-card">
      {title && (
        <div className="yd-stg-card-hd">
          {I && <span className="yd-stg-card-hd-icon"><I /></span>}
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

/** Section page header with save button */
function SectionHeader({ title, desc, dirty, saving, onSave, children }) {
  return (
    <div className="yd-stg-sec-hd">
      <div className="yd-stg-sec-info">
        <div className="yd-stg-sec-title">{title}</div>
        <div className="yd-stg-sec-desc">{desc}</div>
      </div>
      <div className="yd-stg-sec-actions">
        {children}
        {dirty && !saving && (
          <span className="yd-stg-dirty">● Unsaved</span>
        )}
        {onSave && (
          <button
            className="btn btn-primary btn-sm"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECTION 1 — SCHOOL PROFILE
// ══════════════════════════════════════════════════════════════════

function SchoolSection({ data, onSave, saving }) {
  const [d, setD] = useState(() => ({ ...DEFAULT_SETTINGS.school, ...data }));
  const dirty = JSON.stringify(d) !== JSON.stringify({ ...DEFAULT_SETTINGS.school, ...data });
  const set = (k) => (e) => setD((p) => ({ ...p, [k]: e.target.value }));

  return (
    <>
      <SectionHeader
        title="School Profile"
        desc="Public-facing information about your school — shown on invoices and reports."
        dirty={dirty}
        saving={saving}
        onSave={() => onSave("school", d)}
      />

      <Card title="Identity" icon="Building">
        <div className="yd-stg-grid">
          <Field label="School Name" span2>
            <input className="yd-input" value={d.name} onChange={set("name")} placeholder="e.g. Sunshine Preschool" />
          </Field>
          <Field label="Tagline / Motto">
            <input className="yd-input" value={d.tagline} onChange={set("tagline")} placeholder="Where Little Minds Grow" />
          </Field>
          <Field label="Established Year">
            <input className="yd-input" type="number" value={d.establishedYear} onChange={set("establishedYear")} placeholder="2010" min="1900" max="2030" />
          </Field>
          <Field label="Principal Name">
            <input className="yd-input" value={d.principalName} onChange={set("principalName")} placeholder="Dr. Anita Sharma" />
          </Field>
          <Field label="Affiliation / Reg. Number">
            <input className="yd-input" value={d.affiliationNumber} onChange={set("affiliationNumber")} placeholder="CBSE / State Board number" />
          </Field>
          <Field label="Address" span2>
            <textarea
              className="yd-input"
              value={d.address}
              onChange={set("address")}
              rows={3}
              placeholder="123 MG Road, Bengaluru, Karnataka 560001"
              style={{ resize: "vertical" }}
            />
          </Field>
        </div>
      </Card>

      <Card title="Contact" icon="Mail">
        <div className="yd-stg-grid">
          <Field label="Phone">
            <input className="yd-input" type="tel" value={d.phone} onChange={set("phone")} placeholder="+91 98765 43210" />
          </Field>
          <Field label="Email">
            <input className="yd-input" type="email" value={d.email} onChange={set("email")} placeholder="admin@yellowdot.school" />
          </Field>
          <Field label="Website" span2>
            <input className="yd-input" type="url" value={d.website} onChange={set("website")} placeholder="https://yellowdot.school" />
          </Field>
        </div>
      </Card>

      <Card title="Logo" icon="Palette">
        <Field label="Logo URL" hint="Paste a direct image URL. Used on invoices and reports.">
          <input className="yd-input" type="url" value={d.logoUrl} onChange={set("logoUrl")} placeholder="https://cdn.example.com/logo.png" />
        </Field>
        {d.logoUrl ? (
          <div className="yd-stg-logo-preview">
            <img src={d.logoUrl} alt="Logo" className="yd-stg-logo-img" onError={(e) => { e.target.style.display = "none"; }} />
            <span className="yd-stg-logo-label">Logo preview — will be used on invoices and report headers.</span>
          </div>
        ) : (
          <div className="yd-stg-logo-preview">
            <div className="yd-stg-logo-placeholder">{(d.name || "S").charAt(0)}</div>
            <span className="yd-stg-logo-label">No logo uploaded — a generic placeholder mark will be used.</span>
          </div>
        )}
      </Card>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECTION 2 — ACADEMIC YEAR
// ══════════════════════════════════════════════════════════════════

function AcademicSection({ data, onSave, saving }) {
  const [d, setD] = useState(() => ({ ...DEFAULT_SETTINGS.academic, ...data }));
  const dirty = JSON.stringify(d) !== JSON.stringify({ ...DEFAULT_SETTINGS.academic, ...data });
  const set = (k) => (e) => setD((p) => ({ ...p, [k]: e.target.value }));
  const terms = toNum(d.termCount, 2);

  return (
    <>
      <SectionHeader
        title="Academic Year"
        desc="Define the current year, its dates, and how it is divided into terms."
        dirty={dirty}
        saving={saving}
        onSave={() => onSave("academic", d)}
      />

      <Card title="Year" icon="Calendar">
        <div className="yd-stg-grid">
          <Field label="Year Label" hint='e.g. "2024-25"'>
            <input className="yd-input" value={d.yearLabel} onChange={set("yearLabel")} placeholder="2024-25" />
          </Field>
          <Field label="Number of Terms">
            <select className="yd-input" value={d.termCount} onChange={set("termCount")}>
              <option value="1">1 Term</option>
              <option value="2">2 Terms</option>
              <option value="3">3 Terms</option>
            </select>
          </Field>
          <Field label="Year Start Date">
            <input className="yd-input" type="date" value={d.startDate} onChange={set("startDate")} />
          </Field>
          <Field label="Year End Date">
            <input className="yd-input" type="date" value={d.endDate} onChange={set("endDate")} />
          </Field>
        </div>
      </Card>

      <Card title="Term Dates" icon="Calendar">
        <div className="yd-stg-grid">
          {[1, 2, 3].filter((t) => t <= terms).map((t) => (
            <div key={t} className="yd-stg-span2 yd-stg-grid" style={{ gridTemplateColumns: "auto 1fr 1fr", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--yd-text-muted)", whiteSpace: "nowrap", paddingTop: 20 }}>Term {t}</span>
              <Field label={`Term ${t} Start`}>
                <input className="yd-input" type="date" value={d[`term${t}Start`]} onChange={set(`term${t}Start`)} />
              </Field>
              <Field label={`Term ${t} End`}>
                <input className="yd-input" type="date" value={d[`term${t}End`]} onChange={set(`term${t}End`)} />
              </Field>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECTION 3 — FEE SETTINGS
// ══════════════════════════════════════════════════════════════════

const PAYMENT_OPTIONS = [
  { id: "cash",          label: "Cash" },
  { id: "upi",           label: "UPI" },
  { id: "bank_transfer", label: "Bank Transfer" },
  { id: "cheque",        label: "Cheque" },
  { id: "card",          label: "Card" },
];

function FeeSection({ data, onSave, saving }) {
  const [d, setD] = useState(() => ({ ...DEFAULT_SETTINGS.fees, ...data }));
  const dirty = JSON.stringify(d) !== JSON.stringify({ ...DEFAULT_SETTINGS.fees, ...data });
  const set    = (k) => (e) => setD((p) => ({ ...p, [k]: e.target.value }));
  const toggle = (k) => (v) => setD((p) => ({ ...p, [k]: String(v) }));

  const methods = toArr(d.paymentMethods);
  const toggleMethod = (id) => {
    const next = methods.includes(id) ? methods.filter((m) => m !== id) : [...methods, id];
    setD((p) => ({ ...p, paymentMethods: fromArr(next) }));
  };

  return (
    <>
      <SectionHeader
        title="Fee Settings"
        desc="Configure GST, late fees, due dates, and accepted payment methods."
        dirty={dirty}
        saving={saving}
        onSave={() => onSave("fees", d)}
      />

      <Card title="Taxation" icon="CreditCard">
        <ToggleRow
          label="GST Applicable"
          sub="Adds GST to all invoices"
          checked={toBool(d.gstEnabled)}
          onChange={toggle("gstEnabled")}
        />
        {toBool(d.gstEnabled) && (
          <div style={{ marginTop: 14 }}>
            <Field label="GST Rate">
              <select className="yd-input" value={d.gstRate} onChange={set("gstRate")}>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </Field>
          </div>
        )}
      </Card>

      <Card title="Late Fees" icon="Clock">
        <ToggleRow
          label="Charge Late Fee"
          sub="Applied when payment is received after the due date + grace period"
          checked={toBool(d.lateFeeEnabled)}
          onChange={toggle("lateFeeEnabled")}
        />
        {toBool(d.lateFeeEnabled) && (
          <div className="yd-stg-grid" style={{ marginTop: 14 }}>
            <Field label="Late Fee Type">
              <select className="yd-input" value={d.lateFeeType} onChange={set("lateFeeType")}>
                <option value="percentage">Percentage of outstanding</option>
                <option value="fixed">Fixed amount (₹)</option>
              </select>
            </Field>
            <Field label={d.lateFeeType === "percentage" ? "Rate (%)" : "Amount (₹)"}>
              <input className="yd-input" type="number" value={d.lateFeeValue} onChange={set("lateFeeValue")} min="0" step={d.lateFeeType === "percentage" ? "0.5" : "1"} />
            </Field>
          </div>
        )}
      </Card>

      <Card title="Invoice & Reminders" icon="Bell">
        <div className="yd-stg-grid">
          <Field label="Due Day of Month" hint="Day invoices are due each month (1–28)">
            <input className="yd-input" type="number" value={d.dueDayOfMonth} onChange={set("dueDayOfMonth")} min="1" max="28" />
          </Field>
          <Field label="Grace Period (days)" hint="Extra days before late fee kicks in">
            <input className="yd-input" type="number" value={d.gracePeriodDays} onChange={set("gracePeriodDays")} min="0" max="30" />
          </Field>
          <Field label="Remind Before Due (days)" hint="Send reminder N days before due date">
            <input className="yd-input" type="number" value={d.remindDaysBefore} onChange={set("remindDaysBefore")} min="0" max="14" />
          </Field>
        </div>
      </Card>

      <Card title="Accepted Payment Methods">
        <label className="yd-stg-label" style={{ display: "block", marginBottom: 8 }}>Select all methods you accept</label>
        <div className="yd-check-grid">
          {PAYMENT_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`yd-check-pill${methods.includes(id) ? " on" : ""}`}
              onClick={() => toggleMethod(id)}
            >
              {methods.includes(id) && <Icons.Check />}
              {label}
            </button>
          ))}
        </div>
      </Card>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECTION 4 — ATTENDANCE RULES
// ══════════════════════════════════════════════════════════════════

const DAYS = [
  { id: "mon", label: "Mo" },
  { id: "tue", label: "Tu" },
  { id: "wed", label: "We" },
  { id: "thu", label: "Th" },
  { id: "fri", label: "Fr" },
  { id: "sat", label: "Sa" },
  { id: "sun", label: "Su" },
];

function AttendanceSection({ data, onSave, saving }) {
  const [d, setD] = useState(() => ({ ...DEFAULT_SETTINGS.attendance, ...data }));
  const dirty = JSON.stringify(d) !== JSON.stringify({ ...DEFAULT_SETTINGS.attendance, ...data });
  const set = (k) => (e) => setD((p) => ({ ...p, [k]: e.target.value }));

  const workingDays = toArr(d.workingDays);
  const toggleDay = (id) => {
    const next = workingDays.includes(id) ? workingDays.filter((x) => x !== id) : [...workingDays, id];
    setD((p) => ({ ...p, workingDays: fromArr(next) }));
  };

  const pct = toNum(d.minAttendancePercent, 75);

  return (
    <>
      <SectionHeader
        title="Attendance Rules"
        desc="Define working days, check-in windows, late thresholds, and minimum attendance."
        dirty={dirty}
        saving={saving}
        onSave={() => onSave("attendance", d)}
      />

      <Card title="Working Days" icon="Calendar">
        <label className="yd-stg-label" style={{ display: "block", marginBottom: 10 }}>Select school working days</label>
        <div className="yd-days-row">
          {DAYS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`yd-day-pill${workingDays.includes(id) ? " on" : ""}`}
              onClick={() => toggleDay(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Check-In Windows" icon="Clock">
        <div className="yd-stg-grid">
          <Field label="Check-In Opens" hint="QR scanner and manual mark enabled from this time">
            <input className="yd-input" type="time" value={d.checkinOpens} onChange={set("checkinOpens")} />
          </Field>
          <Field label="Late Arrival After" hint="Students arriving after this time are marked Late">
            <input className="yd-input" type="time" value={d.lateAfter} onChange={set("lateAfter")} />
          </Field>
          <Field label="Absent After" hint="No check-in after this time counts as Absent">
            <input className="yd-input" type="time" value={d.absentAfter} onChange={set("absentAfter")} />
          </Field>
          <Field label="Early Leave Before" hint="Check-out before this time is flagged as Early Leave">
            <input className="yd-input" type="time" value={d.earlyLeaveBefore} onChange={set("earlyLeaveBefore")} />
          </Field>
        </div>
      </Card>

      <Card title="Attendance Threshold" icon="Check">
        <Field label="Minimum Attendance %" hint="Students below this level get a low-attendance alert">
          <div className="yd-stg-range-row" style={{ marginTop: 6 }}>
            <input
              className="yd-stg-range"
              type="range"
              min="50"
              max="100"
              step="5"
              value={pct}
              onChange={(e) => setD((p) => ({ ...p, minAttendancePercent: e.target.value }))}
            />
            <span className="yd-stg-range-val">{pct}%</span>
          </div>
        </Field>
      </Card>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECTION 6 — USER MANAGEMENT
// ══════════════════════════════════════════════════════════════════

const MANAGEABLE_ROLES = ROLE_HIERARCHY.filter((r) => !["developer", "super_admin"].includes(r));

function UserRow({ user, onRoleChange, onDeactivate }) {
  const initials = (user.name || user.email || "?")
    .split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  return (
    <tr>
      <td>
        <div className="yd-usr-name-cell">
          {user.photoUrl
            ? <img src={user.photoUrl} style={{ width: 28, height: 28, borderRadius: 7, objectFit: "cover" }} alt="" onError={(e) => { e.target.style.display = "none"; }} />
            : <span className="yd-usr-avatar">{initials}</span>
          }
          <div>
            <div className="yd-usr-name">{user.name || "—"}</div>
            <div className="yd-usr-email">{user.email}</div>
          </div>
        </div>
      </td>
      <td>
        <select
          className="yd-usr-role-sel"
          value={user.role}
          onChange={(e) => onRoleChange(user.userId || user.id, e.target.value)}
        >
          {MANAGEABLE_ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      </td>
      <td style={{ color: "var(--yd-text-muted)", fontSize: 12 }}>
        {user.center || user.centers?.[0] || "—"}
      </td>
      <td>
        <span className={`yd-usr-status ${user.status === "inactive" ? "inactive" : "active"}`}>
          {user.status === "inactive" ? "Inactive" : "Active"}
        </span>
      </td>
      <td>
        <button
          className={`yd-usr-action-btn${user.status === "inactive" ? " restore" : ""}`}
          onClick={() => onDeactivate(user.userId || user.id, user.status)}
        >
          {user.status === "inactive" ? "Restore" : "Deactivate"}
        </button>
      </td>
    </tr>
  );
}

function UsersSection({ isBypass }) {
  const { show: toast } = useToast();
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting]   = useState(false);
  const [form, setForm]           = useState({ name: "", email: "", role: "teacher", center: "" });

  useEffect(() => {
    settingsService.getUsers()
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleRoleChange(userId, newRole) {
    try {
      await settingsService.updateUser(userId, { role: newRole });
      setUsers((prev) => prev.map((u) => (u.userId === userId || u.id === userId) ? { ...u, role: newRole } : u));
      toast("Role updated", "success");
    } catch { toast("Failed to update role", "error"); }
  }

  async function handleDeactivate(userId, currentStatus) {
    const action = currentStatus === "inactive" ? "restore" : "deactivate";
    try {
      await settingsService.updateUser(userId, { status: currentStatus === "inactive" ? "active" : "inactive" });
      setUsers((prev) => prev.map((u) =>
        (u.userId === userId || u.id === userId)
          ? { ...u, status: currentStatus === "inactive" ? "active" : "inactive" }
          : u
      ));
      toast(`User ${action}d`, "success");
    } catch { toast(`Failed to ${action} user`, "error"); }
  }

  async function handleInvite(e) {
    e.preventDefault();
    if (!form.email || !form.role) return;
    setInviting(true);
    try {
      const newUser = await settingsService.inviteUser(form);
      setUsers((prev) => [...prev, newUser.user || newUser]);
      setInviteOpen(false);
      setForm({ name: "", email: "", role: "teacher", center: "" });
      toast("User invited successfully", "success");
    } catch (err) {
      toast(err.message || "Failed to invite user", "error");
    }
    setInviting(false);
  }

  return (
    <>
      <SectionHeader
        title="User Management"
        desc="Manage staff accounts, roles, and access for your school."
        dirty={false}
        saving={false}
      >
        {isBypass && (
          <button className="btn btn-primary btn-sm" onClick={() => setInviteOpen(true)}>
            <Icons.UserPlus /> Invite User
          </button>
        )}
      </SectionHeader>

      <Card>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1, 2, 3].map((i) => <div key={i} className="yd-stg-skeleton" style={{ height: 48 }} />)}
          </div>
        ) : users.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--yd-text-muted)", fontSize: 13 }}>
            No staff users found. <br />
            <span style={{ fontSize: 11 }}>Backend /api/settings/users must be configured.</span>
          </div>
        ) : (
          <div className="yd-usr-table-wrap">
            <table className="yd-usr-table">
              <thead>
                <tr>
                  <th>Name / Email</th>
                  <th>Role</th>
                  <th>Center</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <UserRow
                    key={u.userId || u.id || i}
                    user={u}
                    onRoleChange={handleRoleChange}
                    onDeactivate={handleDeactivate}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Invite User Modal */}
      <Modal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite New User"
        footer={
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setInviteOpen(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleInvite} disabled={inviting}>
              {inviting ? "Inviting…" : "Send Invite"}
            </button>
          </div>
        }
      >
        <form onSubmit={handleInvite}>
          <div className="yd-invite-grid">
            <Field label="Full Name">
              <input className="yd-input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Priya Sharma" required />
            </Field>
            <Field label="Email Address">
              <input className="yd-input" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="priya@school.com" required />
            </Field>
            <Field label="Role">
              <select className="yd-input" value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
                {MANAGEABLE_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </Field>
            <Field label="Center">
              <input className="yd-input" value={form.center} onChange={(e) => setForm((p) => ({ ...p, center: e.target.value }))} placeholder="Main Branch" />
            </Field>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECTION 7 — ROLE PERMISSIONS
// ══════════════════════════════════════════════════════════════════

// Human-readable route labels
const ROUTE_LABELS = {
  [ROUTES.DASHBOARD]:            "Dashboard",
  [ROUTES.STUDENTS]:             "Students",
  [ROUTES.ATTENDANCE]:           "Attendance",
  [ROUTES.FEES]:                 "Fees",
  [ROUTES.INVOICE]:              "Invoices",
  [ROUTES.ANALYTICS]:            "Analytics",
  [ROUTES.NAP_TRACKER]:          "Nap Tracker",
  [ROUTES.FOOD_MENU]:            "Food Menu",
  [ROUTES.FOOD_CONSUMPTION]:     "Food Log",
  [ROUTES.PARENT_CHECKIN]:       "Parent Check-In",
  [ROUTES.PICKUP_AUTHORIZATION]: "Pickup Auth",
  [ROUTES.PICKUP_HISTORY]:       "Pickup History",
  [ROUTES.SETTINGS]:             "Settings",
};

const VISIBLE_ROUTES = Object.keys(ROUTE_LABELS);

function PermissionsSection({ isBypass }) {
  const { show: toast } = useToast();
  // Build mutable state from ROLE_PERMISSIONS
  const [matrix, setMatrix] = useState(() => {
    const m = {};
    ROLE_HIERARCHY.forEach((role) => {
      m[role] = {};
      VISIBLE_ROUTES.forEach((route) => {
        const perms = ROLE_PERMISSIONS[role] || [];
        m[role][route] = perms.includes("*") || perms.includes(route);
      });
    });
    return m;
  });

  const [saving, setSaving] = useState(false);

  const toggle = (role, route) => {
    if (isBypassRole(role)) return; // bypass roles are immutable
    setMatrix((prev) => ({
      ...prev,
      [role]: { ...prev[role], [route]: !prev[role][route] },
    }));
  };

  async function handleSave() {
    setSaving(true);
    // Convert matrix back to arrays for storage
    const data = {};
    ROLE_HIERARCHY.forEach((role) => {
      if (isBypassRole(role)) return;
      data[role] = VISIBLE_ROUTES.filter((r) => matrix[role][r]);
    });
    try {
      await settingsService.save("permissions", data);
      toast("Permissions saved — backend restart may be required to apply changes", "success", 6000);
    } catch {
      toast("Failed to save permissions", "error");
    }
    setSaving(false);
  }

  return (
    <>
      <SectionHeader
        title="Role Permissions"
        desc="Control which features each staff role can access."
        dirty={false}
        saving={saving}
        onSave={isBypass ? handleSave : undefined}
      />

      {!isBypass && (
        <div className="yd-stg-warn-banner">
          <Icons.AlertTriangle />
          <span>Only <strong>Developer</strong> and <strong>Super Admin</strong> accounts can modify role permissions.</span>
        </div>
      )}

      <div className="yd-stg-info-banner">
        <Icons.Info />
        <span>
          <strong>Developer</strong> and <strong>Super Admin</strong> roles always have full access and cannot be restricted. Changes here are saved to the Settings sheet and require a backend sync to take effect.
        </span>
      </div>

      <Card>
        <div className="yd-perm-wrap">
          <table className="yd-perm-table">
            <thead>
              <tr>
                <th>Role</th>
                {VISIBLE_ROUTES.map((r) => (
                  <th key={r}>{ROUTE_LABELS[r]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLE_HIERARCHY.map((role) => {
                const bypass = isBypassRole(role);
                return (
                  <tr key={role} className={bypass ? "bypass-row" : ""}>
                    <td>
                      {ROLE_LABELS[role]}
                      {bypass && (
                        <span style={{ fontSize: 10, color: "var(--yd-yellow-dark)", marginLeft: 4, fontWeight: 700 }}>●</span>
                      )}
                    </td>
                    {VISIBLE_ROUTES.map((route) => (
                      <td key={route}>
                        <input
                          type="checkbox"
                          className="yd-perm-cb"
                          checked={bypass ? true : (matrix[role]?.[route] ?? false)}
                          onChange={() => toggle(role, route)}
                          disabled={bypass || !isBypass}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECTION 8 — BRANDING
// ══════════════════════════════════════════════════════════════════

const ACCENT_COLORS = [
  { hex: "#F4C400", label: "Default Yellow" },
  { hex: "#F97316", label: "Warm Orange" },
  { hex: "#22C55E", label: "Success Green" },
  { hex: "#3B82F6", label: "Blue" },
  { hex: "#8B5CF6", label: "Purple" },
  { hex: "#EC4899", label: "Pink" },
  { hex: "#1E1E1E", label: "Charcoal" },
];

function BrandingSection({ data, onSave, saving }) {
  const [d, setD] = useState(() => ({ ...DEFAULT_SETTINGS.branding, ...data }));
  const dirty = JSON.stringify(d) !== JSON.stringify({ ...DEFAULT_SETTINGS.branding, ...data });
  const set = (k) => (e) => setD((p) => ({ ...p, [k]: e.target.value }));

  return (
    <>
      <SectionHeader
        title="Branding"
        desc="Customize your logo, accent color, and report styles."
        dirty={dirty}
        saving={saving}
        onSave={() => onSave("branding", d)}
      />

      <Card title="Logo & Favicon" icon="Palette">
        <div className="yd-stg-grid">
          <Field label="Logo URL" hint="Used on invoice headers and reports">
            <input className="yd-input" type="url" value={d.logoUrl} onChange={set("logoUrl")} placeholder="https://cdn.example.com/logo.png" />
          </Field>
          <Field label="Favicon URL" hint="Browser tab icon">
            <input className="yd-input" type="url" value={d.faviconUrl} onChange={set("faviconUrl")} placeholder="https://cdn.example.com/favicon.ico" />
          </Field>
        </div>
        {d.logoUrl && (
          <div className="yd-stg-logo-preview" style={{ marginTop: 12 }}>
            <img src={d.logoUrl} alt="Logo" className="yd-stg-logo-img" onError={(e) => { e.target.style.display = "none"; }} />
            <span className="yd-stg-logo-label">Logo preview</span>
          </div>
        )}
      </Card>

      <Card title="Accent Color" icon="Palette">
        <div className="yd-stg-info-banner" style={{ marginBottom: 14 }}>
          <Icons.Info />
          <span>Accent color is applied to buttons, highlights, and report headings. Full theme customization will be in a future update.</span>
        </div>
        <label className="yd-stg-label" style={{ display: "block", marginBottom: 10 }}>Choose accent color</label>
        <div className="yd-color-swatch">
          {ACCENT_COLORS.map(({ hex, label }) => (
            <button
              key={hex}
              type="button"
              className={`yd-color-chip${d.accentColor === hex ? " selected" : ""}`}
              style={{ background: hex }}
              title={label}
              onClick={() => setD((p) => ({ ...p, accentColor: hex }))}
            />
          ))}
        </div>
      </Card>

      <Card title="Report Text" icon="Settings">
        <div className="yd-stg-grid yd-stg-grid-1">
          <Field label="Report Header" hint="Appears at the top of PDF reports and invoices">
            <input className="yd-input" value={d.reportHeader} onChange={set("reportHeader")} placeholder="e.g. Sunshine Preschool" />
          </Field>
          <Field label="School Motto" hint="Displayed below header on formal documents">
            <input className="yd-input" value={d.motto} onChange={set("motto")} placeholder="Where Little Minds Grow" />
          </Field>
          <Field label="Report Footer" hint="Appears at the bottom of each invoice">
            <textarea
              className="yd-input"
              value={d.reportFooter}
              onChange={set("reportFooter")}
              rows={2}
              style={{ resize: "vertical" }}
              placeholder="Thank you for trusting us with your child's education."
            />
          </Field>
        </div>
      </Card>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECTION 9 — NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════

const NOTIF_EVENTS = [
  { id: "attendance",    label: "Attendance Marked",       sub: "When a student is checked in or out" },
  { id: "feeReminder",   label: "Fee Reminder",            sub: "N days before invoice due date" },
  { id: "invoice",       label: "Invoice Generated",       sub: "When a new invoice is created" },
  { id: "pickup",        label: "Pickup Notification",     sub: "When a student is picked up" },
  { id: "lowAttendance", label: "Low Attendance Alert",    sub: `When attendance drops below threshold` },
];

const CHANNELS = [
  { id: "Email",     label: "Email" },
  { id: "Whatsapp",  label: "WhatsApp" },
  { id: "Sms",       label: "SMS" },
];

function NotifSection({ data, onSave, saving }) {
  const [d, setD] = useState(() => ({ ...DEFAULT_SETTINGS.notifications, ...data }));
  const dirty = JSON.stringify(d) !== JSON.stringify({ ...DEFAULT_SETTINGS.notifications, ...data });
  const key = (event, ch) => `${event}${ch}`;
  const toggle = (k) => (v) => setD((p) => ({ ...p, [k]: String(v) }));

  return (
    <>
      <SectionHeader
        title="Notification Settings"
        desc="Choose which events trigger notifications and through which channels."
        dirty={dirty}
        saving={saving}
        onSave={() => onSave("notifications", d)}
      />

      <div className="yd-stg-info-banner">
        <Icons.Info />
        <span>Channel delivery requires backend configuration of SMS/WhatsApp provider. Email uses the configured SMTP server.</span>
      </div>

      <Card>
        <div className="yd-notif-matrix">
          {/* Header row */}
          <div className="yd-notif-matrix-hd" style={{ textAlign: "left" }}>Event</div>
          {CHANNELS.map((ch) => (
            <div key={ch.id} className="yd-notif-matrix-hd">{ch.label}</div>
          ))}

          {/* Event rows */}
          {NOTIF_EVENTS.map((ev) => (
            <>
              <div key={ev.id + "_label"} className="yd-notif-event">
                <div>
                  <div style={{ fontWeight: 500, color: "var(--yd-text)" }}>{ev.label}</div>
                  <div style={{ fontSize: 11, color: "var(--yd-text-muted)", marginTop: 1 }}>{ev.sub}</div>
                </div>
              </div>
              {CHANNELS.map((ch) => (
                <div key={ev.id + ch.id} className="yd-notif-cell">
                  <Toggle
                    checked={toBool(d[key(ev.id, ch.id)])}
                    onChange={toggle(key(ev.id, ch.id))}
                  />
                </div>
              ))}
            </>
          ))}
        </div>
      </Card>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECTION 10 — PARENT APP CONTROLS
// ══════════════════════════════════════════════════════════════════

const PARENT_TOGGLES = [
  { key: "showAttendance",     label: "Attendance History",    sub: "Parents can view their child's daily attendance record" },
  { key: "showFees",           label: "Fee Details",           sub: "Show outstanding balance and invoice history" },
  { key: "showFoodMenu",       label: "Food Menu",             sub: "Display today's and weekly food menu" },
  { key: "showNapLog",         label: "Nap Log",               sub: "Show nap times and durations for the day" },
  { key: "showSiblingInfo",    label: "Sibling Information",   sub: "Show enrolled siblings on the parent portal" },
  { key: "allowCheckinSelfie", label: "Check-In Selfie",       sub: "Require parent selfie photo during check-in" },
  { key: "showPickupHistory",  label: "Pickup History",        sub: "Show pickup log with timestamps and authorizer" },
  { key: "parentNotifications","label": "Push Notifications",  sub: "Enable real-time push notifications for parents" },
];

function ParentSection({ data, onSave, saving }) {
  const [d, setD] = useState(() => ({ ...DEFAULT_SETTINGS.parent, ...data }));
  const dirty = JSON.stringify(d) !== JSON.stringify({ ...DEFAULT_SETTINGS.parent, ...data });
  const toggle = (k) => (v) => setD((p) => ({ ...p, [k]: String(v) }));

  return (
    <>
      <SectionHeader
        title="Parent App Controls"
        desc="Manage what parents can see and do through the parent portal."
        dirty={dirty}
        saving={saving}
        onSave={() => onSave("parent", d)}
      />

      <Card title="Visibility & Permissions" icon="Smartphone">
        {PARENT_TOGGLES.map(({ key: k, label, sub }) => (
          <ToggleRow
            key={k}
            label={label}
            sub={sub}
            checked={toBool(d[k])}
            onChange={toggle(k)}
          />
        ))}
      </Card>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECTION 11 — PAYMENT SETTINGS
// ══════════════════════════════════════════════════════════════════

function PaymentSection({ data, onSave, saving }) {
  const [d, setD] = useState(() => ({ ...DEFAULT_SETTINGS.payment, ...data }));
  const dirty = JSON.stringify(d) !== JSON.stringify({ ...DEFAULT_SETTINGS.payment, ...data });
  const set    = (k) => (e) => setD((p) => ({ ...p, [k]: e.target.value }));
  const toggle = (k) => (v) => setD((p) => ({ ...p, [k]: String(v) }));

  /* Build UPI preview link */
  const upiPreview = d.upiId
    ? `upi://pay?pa=${encodeURIComponent(d.upiId)}&pn=${encodeURIComponent(d.accountName || "School")}&cu=INR`
    : "";

  return (
    <>
      <SectionHeader
        title="Payment Settings"
        desc="Configure UPI ID, bank details, and payment instructions shown on every invoice."
        dirty={dirty}
        saving={saving}
        onSave={() => onSave("payment", d)}
      />

      {/* UPI */}
      <Card title="UPI / QR Code" icon="Wallet">
        <div className="yd-stg-grid">
          <Field label="UPI ID" hint="e.g. school@hdfcbank or school@upi" span2>
            <input
              className="yd-input"
              value={d.upiId}
              onChange={set("upiId")}
              placeholder="yourschool@upi"
            />
          </Field>
          {d.upiId && (
            <Field label="QR Preview" span2>
              <div style={{
                padding: "12px", background: "#FFFBEA",
                borderRadius: 8, border: "1px solid #F0D94A",
                display: "inline-flex", flexDirection: "column",
                alignItems: "center", gap: 8,
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 600,
                  color: "#92400E", fontFamily: "monospace",
                  wordBreak: "break-all", maxWidth: 340, textAlign: "center",
                }}>{upiPreview}</div>
                <div style={{ fontSize: 11, color: "#6B7280" }}>
                  A QR code for the exact invoice amount will be generated automatically on each invoice.
                </div>
              </div>
            </Field>
          )}
        </div>
        <div style={{ marginTop: 16 }}>
          <label className="yd-stg-label" style={{ display: "block", marginBottom: 8 }}>
            Accepted Payment Methods
          </label>
          <div className="yd-check-grid">
            {[
              { k: "acceptUpi",    label: "UPI / QR" },
              { k: "acceptBank",   label: "Bank Transfer" },
              { k: "acceptCash",   label: "Cash" },
              { k: "acceptCheque", label: "Cheque" },
            ].map(({ k, label }) => (
              <button
                key={k}
                type="button"
                className={`yd-check-pill${toBool(d[k]) ? " on" : ""}`}
                onClick={() => toggle(k)(!toBool(d[k]))}
              >
                {toBool(d[k]) && <Icons.Check />}
                {label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Bank Transfer */}
      <Card title="Bank Account Details" icon="CreditCard">
        <div className="yd-stg-grid">
          <Field label="Bank Name">
            <input className="yd-input" value={d.bankName} onChange={set("bankName")} placeholder="HDFC Bank" />
          </Field>
          <Field label="Account Holder Name">
            <input className="yd-input" value={d.accountName} onChange={set("accountName")} placeholder="e.g. Sunshine Preschool Pvt Ltd" />
          </Field>
          <Field label="Account Number" hint="Will appear on invoices with a copy button">
            <input className="yd-input" value={d.accountNumber} onChange={set("accountNumber")} placeholder="0001234567890" />
          </Field>
          <Field label="IFSC Code">
            <input className="yd-input" value={d.ifscCode} onChange={set("ifscCode")} placeholder="HDFC0001234" />
          </Field>
          <Field label="Branch">
            <input className="yd-input" value={d.branch} onChange={set("branch")} placeholder="Seawoods, Navi Mumbai" />
          </Field>
          <Field label="GST Number (GSTIN)" hint="Leave blank if not GST registered">
            <input className="yd-input" value={d.gstNumber} onChange={set("gstNumber")} placeholder="27AADCB2230M1ZT" />
          </Field>
        </div>
      </Card>

      {/* Cash / Cheque */}
      <Card title="Cash & Cheque Instructions">
        <div className="yd-stg-grid">
          <Field label="Office Hours" hint="Shown on invoice payment section">
            <input className="yd-input" value={d.officeHours} onChange={set("officeHours")} placeholder="Mon – Sat: 8:00 AM – 6:00 PM" />
          </Field>
          <Field label="Cash Instructions" span2>
            <textarea
              className="yd-input"
              rows={3}
              value={d.cashInstructions}
              onChange={set("cashInstructions")}
              placeholder="Pay at the school front desk during office hours."
            />
          </Field>
          <Field label="Billing Notes" hint="Shown at bottom of every invoice" span2>
            <textarea
              className="yd-input"
              rows={3}
              value={d.billingNotes}
              onChange={set("billingNotes")}
              placeholder="Fees once paid are non-refundable except under exceptional circumstances..."
            />
          </Field>
        </div>
      </Card>

      {/* Future integrations */}
      <Card title="Online Payment Gateways">
        <div className="yd-stg-info-banner" style={{ margin: 0 }}>
          <Icons.Info />
          <span>
            Razorpay, Cashfree, and Stripe integration is coming soon. Once configured, parents
            will be able to pay directly from the invoice link — no app switching required.
          </span>
        </div>
      </Card>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECTION 12 — GATE CONFIGURATION
// ══════════════════════════════════════════════════════════════════

function GateConfigSection() {
  return (
    <>
      <SectionHeader
        title="Gate Configuration"
        desc="Generate and manage QR codes for your school gates."
      />
      <QRManagement embedded />
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECTION — ABOUT  (all roles)
// ══════════════════════════════════════════════════════════════════

function AboutSection() {
  return (
    <>
      <SectionHeader
        title="About"
        desc={`Version info and install options for ${PLATFORM_NAME}.`}
      />

      <Card title={PLATFORM_NAME} icon="Info">
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <img
            src="/icons/pwa-192x192.png"
            alt=""
            style={{ width: 56, height: 56, borderRadius: 14, boxShadow: "var(--yd-shadow-sm)" }}
          />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--yd-charcoal)" }}>
              {PLATFORM_NAME}
            </div>
            <div style={{ fontSize: 12, color: "var(--yd-text-muted)" }}>
              Version {APP_VERSION}
            </div>
          </div>
        </div>

        <InstallAppButton variant="card" showInstalledStatus />
      </Card>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// SECTION 13 — RELEASE & BUILD  (developer role only)
// ══════════════════════════════════════════════════════════════════

function ReleaseSection() {
  const [backendBuildInfo, setBackendBuildInfo] = useState(null);
  const [frontendBuildInfo, setFrontendBuildInfo] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/version`)
      .then((r) => r.json())
      .then(setBackendBuildInfo)
      .catch(() => setBackendBuildInfo({ error: true }));

    // Generated at build time by scripts/genBuildInfo.cjs, served as a
    // static file at the frontend's own origin (dist root) — reports this
    // build's own commit/branch, not the backend's.
    fetch("/build-info.json")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setFrontendBuildInfo)
      .catch(() => setFrontendBuildInfo({ error: true }));
  }, []);

  // Use explicit scope groups so the display is correct regardless of env
  const enabledInAll = FLAG_GROUPS.production;
  const stagingOnly  = FLAG_GROUPS.staging;
  const disabled     = FLAG_GROUPS.planned;

  return (
    <>
      <SectionHeader
        title="Release & Build"
        desc="Environment identity, build metadata, feature flags, and release history."
      />

      {/* ── Environment Identity ──────────────────────────────────── */}
      <Card title="Environment" icon="GitBranch">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 12px", borderRadius: 20,
            background: currentEnvMeta.bg,
            border: `1px solid ${currentEnvMeta.border}`,
            color: currentEnvMeta.color,
            fontWeight: 700, fontSize: 13, letterSpacing: "0.02em",
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: currentEnvMeta.color, display: "inline-block" }} />
            {currentEnvMeta.label.toUpperCase()}
          </span>
          <span style={{ color: "var(--yd-text-muted)", fontSize: 13 }}>
            {APP_NAME} · v{APP_VERSION}
          </span>
        </div>

        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
          {[
            { label: "App Name",    value: APP_NAME },
            { label: "Environment", value: currentEnvMeta.label },
            { label: "Frontend Version",   value: `v${APP_VERSION}` },
            frontendBuildInfo && !frontendBuildInfo.error && { label: "Frontend Commit",  value: frontendBuildInfo.commitShort || "—" },
            frontendBuildInfo && !frontendBuildInfo.error && { label: "Frontend Branch",  value: frontendBuildInfo.branch || "—" },
            frontendBuildInfo && !frontendBuildInfo.error && { label: "Frontend Built At", value: frontendBuildInfo.builtAt ? new Date(frontendBuildInfo.builtAt).toLocaleString() : "—" },
            backendBuildInfo && !backendBuildInfo.error && { label: "Backend Version", value: `v${backendBuildInfo.version}` },
            backendBuildInfo && !backendBuildInfo.error && { label: "Backend Commit",  value: backendBuildInfo.commitShort || "—" },
            backendBuildInfo && !backendBuildInfo.error && { label: "Backend Branch",  value: backendBuildInfo.branch || "—" },
            backendBuildInfo && !backendBuildInfo.error && { label: "Backend Built At", value: backendBuildInfo.buildTimestamp && backendBuildInfo.buildTimestamp !== "unknown" ? new Date(backendBuildInfo.buildTimestamp).toLocaleString() : "—" },
            backendBuildInfo && !backendBuildInfo.error && { label: "Server Uptime",   value: backendBuildInfo.uptime || "—" },
          ].filter(Boolean).map(({ label, value }) => (
            <div key={label} style={{ background: "var(--yd-surface)", borderRadius: 8, padding: "8px 12px" }}>
              <div style={{ fontSize: 10, color: "var(--yd-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--yd-text)", fontFamily: "monospace" }}>{value}</div>
            </div>
          ))}
          {frontendBuildInfo?.error && (
            <div style={{ fontSize: 12, color: "var(--yd-text-muted)", gridColumn: "1 / -1" }}>Frontend build-info.json not found — this build predates the traceability change, or wasn't built via npm run build:production/staging.</div>
          )}
          {backendBuildInfo === null && (
            <div style={{ fontSize: 12, color: "var(--yd-text-muted)", gridColumn: "1 / -1" }}>Fetching backend build info…</div>
          )}
          {backendBuildInfo?.error && (
            <div style={{ fontSize: 12, color: "var(--yd-text-muted)", gridColumn: "1 / -1" }}>Backend unreachable — backend build info unavailable.</div>
          )}
        </div>
      </Card>

      {/* ── Feature Flags ─────────────────────────────────────────── */}
      <Card title="Feature Flags" icon="Shield">
        <div style={{ marginBottom: 8, fontSize: 12, color: "var(--yd-text-muted)" }}>
          Flags control which modules ship in each environment. Flip a flag in
          <code style={{ margin: "0 4px", fontSize: 11, background: "var(--yd-surface)", padding: "1px 5px", borderRadius: 4 }}>src/config/featureFlags.js</code>
          to promote a module from Yellow Dot (Development) → KUE BOXS Care (Production).
        </div>

        {[
          { group: "KUE BOXS Care (Production)", items: enabledInAll, color: "#059669", bg: "#ECFDF5" },
          { group: "Yellow Dot (Development) — pending promotion", items: stagingOnly,  color: "#D97706", bg: "#FFFBEB" },
          { group: "Coming soon — not yet built",          items: disabled,     color: "#9CA3AF", bg: "var(--yd-surface)" },
        ].map(({ group, items, color, bg }) => items.length > 0 && (
          <div key={group} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{group}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {items.map((flag) => (
                <span key={flag} style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 4,
                  background: bg, color, border: `1px solid ${color}30`,
                  fontFamily: "monospace", fontWeight: 500,
                }}>
                  {flag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </Card>

      {/* ── Release Notes ─────────────────────────────────────────── */}
      <Card title="Release History" icon="Bell">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {RELEASE_NOTES.map((rel) => (
            <div key={rel.version} style={{
              borderLeft: "3px solid",
              borderColor: rel.environment === "production" ? "#059669" : "#D97706",
              paddingLeft: 14,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: "var(--yd-text)" }}>v{rel.version}</span>
                <span style={{
                  fontSize: 10, padding: "1px 7px", borderRadius: 10, fontWeight: 600, textTransform: "uppercase",
                  background: rel.environment === "production" ? "#ECFDF5" : "#FFFBEB",
                  color:      rel.environment === "production" ? "#059669" : "#D97706",
                }}>
                  {rel.environment}
                </span>
                <span style={{ fontSize: 12, color: "var(--yd-text-muted)" }}>{rel.date}</span>
                <span style={{ fontSize: 13, color: "var(--yd-text)", fontWeight: 500 }}>{rel.title}</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 3 }}>
                {rel.changes.map((ch, i) => {
                  const meta = CHANGE_TYPE_META[ch.type] || CHANGE_TYPE_META.feature;
                  return (
                    <li key={i} style={{ display: "flex", alignItems: "baseline", gap: 7, fontSize: 12, color: "var(--yd-text-muted)" }}>
                      <span style={{
                        fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 700,
                        textTransform: "uppercase", background: meta.color + "18", color: meta.color,
                        flexShrink: 0,
                      }}>
                        {meta.label}
                      </span>
                      {ch.text}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// LOADING SKELETON
// ══════════════════════════════════════════════════════════════════

function SettingsSkeleton() {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, paddingBottom: 18, borderBottom: "1px solid var(--yd-border-light)" }}>
        <div>
          <div className="yd-stg-skeleton" style={{ height: 22, width: 180, marginBottom: 8 }} />
          <div className="yd-stg-skeleton" style={{ height: 14, width: 280 }} />
        </div>
        <div className="yd-stg-skeleton" style={{ height: 32, width: 110 }} />
      </div>
      {[1, 2].map((i) => (
        <div key={i} className="yd-stg-card" style={{ marginBottom: 14 }}>
          <div className="yd-stg-skeleton" style={{ height: 16, width: 120, marginBottom: 16 }} />
          <div className="yd-stg-grid">
            {[1, 2, 3, 4].map((j) => (
              <div key={j}>
                <div className="yd-stg-skeleton" style={{ height: 10, width: 80, marginBottom: 6 }} />
                <div className="yd-stg-skeleton" style={{ height: 36 }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// MAIN SETTINGS PAGE
// ══════════════════════════════════════════════════════════════════

export default function Settings() {
  const { role, devRole, isDeveloper, canDo } = useAuth();
  const { show: toast } = useToast();

  const effectiveRole = devRole || role;
  // Allow edit if bypass role OR if the role matrix grants settings.edit
  const isFullAccess  = isBypassRole(effectiveRole) || isDeveloper || canDo("settings", "edit");

  const [activeId,  setActiveId]  = useState("school");
  const [settings,  setSettings]  = useState(null);   // null = loading
  const [saving,    setSaving]    = useState(false);

  // Load all settings on mount
  useEffect(() => {
    settingsService.getAll().then(setSettings);
  }, []);

  // Save a single section
  const handleSave = useCallback(async (section, data) => {
    setSaving(true);
    try {
      await settingsService.save(section, data);
      setSettings((prev) => ({ ...prev, [section]: data }));
      toast("Settings saved successfully", "success");
    } catch (err) {
      toast(err.message || "Failed to save — check backend connectivity", "error");
    }
    setSaving(false);
  }, [toast]);

  // Render the active section component
  const renderSection = () => {
    if (!settings) return <SettingsSkeleton />;
    const props = { data: settings[activeId] || {}, onSave: handleSave, saving, isBypass: isFullAccess };
    switch (activeId) {
      case "school":        return <SchoolSection      {...props} />;
      case "academic":      return <AcademicSection    {...props} />;
      case "fees":          return <FeeSection         {...props} />;
      case "attendance":    return <AttendanceSection  {...props} />;
      case "users":         return <UsersSection       isBypass={isFullAccess} />;
      case "permissions":   return <PermissionsSection isBypass={isFullAccess} />;
      case "branding":      return <BrandingSection    {...props} />;
      case "notifications": return <NotifSection       {...props} />;
      case "parent":        return <ParentSection      {...props} />;
      case "payment":       return <PaymentSection     {...props} />;
      case "gate_config":   return <GateConfigSection />;
      case "about":         return <AboutSection />;
      case "releases":      return <ReleasesDashboard />;
      case "release":       return <ReleaseSection />;
      default:              return null;
    }
  };

  return (
    <div className="yd-stg-shell">

      {/* ── Left sidebar nav ─────────────────────────────────────── */}
      <nav className="yd-stg-nav">
        <div className="yd-stg-nav-hd">
          <div className="yd-stg-nav-title">Settings</div>
          <div className="yd-stg-nav-sub" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            System configuration
            {isDeveloper && (
              <span style={{
                fontSize: 9, padding: "1px 6px", borderRadius: 10, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.05em",
                background: currentEnvMeta.bg, color: currentEnvMeta.color,
                border: `1px solid ${currentEnvMeta.border}`,
              }}>
                {currentEnvMeta.label}
              </span>
            )}
          </div>
        </div>

        <div className="yd-stg-nav-list">
          {SECTIONS.filter((sec) => !sec.developerOnly || isDeveloper).map((sec, idx) => {
            const I = Icons[sec.icon];
            // Separator before User Management group
            const needsSep = idx === 5;
            return (
              <div key={sec.id} style={{ display: "contents" }}>
                {needsSep && <div className="yd-stg-nav-sep" />}
                <button
                  className={`yd-stg-nav-btn${activeId === sec.id ? " active" : ""}`}
                  onClick={() => setActiveId(sec.id)}
                >
                  <span className="yd-stg-nav-icon">{I && <I />}</span>
                  {sec.label}
                </button>
              </div>
            );
          })}
        </div>
      </nav>

      {/* ── Right content pane ───────────────────────────────────── */}
      <div className="yd-stg-content">
        <div className="yd-stg-inner">
          {renderSection()}
        </div>
      </div>

    </div>
  );
}
