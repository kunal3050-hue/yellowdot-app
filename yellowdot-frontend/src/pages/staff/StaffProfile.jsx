/**
 * StaffProfile.jsx — Employee Profile (create + view + edit)
 * ────────────────────────────────────────────────────────────
 * Tabs: Overview · Employment · Documents · Emergency · Salary · Login · Timeline
 *
 * Phase 1.1 additions:
 *   • Profile photo upload + crop (Firebase Storage)
 *   • Multi-classroom (assignedClassrooms[])
 *   • Designation pulls Employee Category from master data
 *   • Login tab: invite, link, unlink, disable, copy reset link
 *   • Delete is a soft-delete with confirm
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import staffService, {
  STAFF_ENUMS, EMPLOYMENT_STATUS_META, LOGIN_STATUS_META,
} from "../../services/staffService";
import departmentService from "../../services/departmentService";
import designationService from "../../services/designationService";
import PhotoUploader from "../../components/staff/PhotoUploader";

const T = {
  bg:          "#FFFDF7",
  surface:     "#FFFFFF",
  surfaceWarm: "#FDFAF5",
  border:      "rgba(0,0,0,0.08)",
  borderGold:  "rgba(244,196,0,0.35)",
  shadow:      "0 1px 4px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)",
  text:        "#2A2A2A",
  textMuted:   "#8C8880",
  textSoft:    "#6A6560",
  gold:        "#F4C400",
  goldMid:     "#B45309",
  goldLight:   "rgba(244,196,0,0.10)",
  green:       "#059669",
  red:         "#DC2626",
  redLight:    "rgba(220,38,38,0.09)",
};

const TABS = [
  { id: "overview",   label: "Overview" },
  { id: "employment", label: "Employment" },
  { id: "documents",  label: "Documents" },
  { id: "emergency",  label: "Emergency" },
  { id: "salary",     label: "Salary" },
  { id: "login",      label: "Login" },
  { id: "timeline",   label: "Timeline" },
];

const EMPTY = {
  firstName: "", lastName: "", displayName: "",
  gender: "", dob: "", bloodGroup: "", maritalStatus: "",
  mobile: "", email: "", address: "", city: "", state: "", pincode: "",
  joiningDate: "", confirmationDate: "",
  departmentId: "", departmentName: "",
  designationId: "", designationName: "", category: "",
  role: "", reportingManager: "", reportingManagerId: "",
  assignedClassrooms: [],
  branch: "", centerId: "",
  employmentType: "full_time", employmentStatus: "draft",
  photoUrl: "", photoStoragePath: "",
  linkedUserId: "", loginStatus: "not_linked", invitedAt: "", lastInviteEmail: "",
  emergencyContact: { name: "", relation: "", mobile: "" },
  salary:           { monthlyCtc: 0, currency: "INR", paymentMode: "", bankAccountLast4: "" },
};

// ── Page ─────────────────────────────────────────────────────────────

export default function StaffProfile() {
  const { staffId }     = useParams();
  const navigate        = useNavigate();
  const { user, role }  = useAuth();

  const isCreating   = !staffId || staffId === "new";
  const canEditSalary= ["developer", "super_admin", "admin", "center_owner"].includes(role);
  const canManage    = ["developer", "super_admin", "admin", "center_owner", "center_admin"].includes(role);

  const [tab, setTab]                 = useState("overview");
  const [data, setData]               = useState(EMPTY);
  const [original, setOriginal]       = useState(EMPTY);
  const [loading, setLoading]         = useState(!isCreating);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [timeline, setTimeline]       = useState([]);

  const load = useCallback(async () => {
    setError("");
    try {
      const [d, g] = await Promise.all([
        departmentService.getAll({ active: true }),
        designationService.getAll({ active: true }),
      ]);
      if (d?.success) setDepartments(d.departments || []);
      if (g?.success) setDesignations(g.designations || []);

      if (!isCreating) {
        setLoading(true);
        const res = await staffService.getOne(staffId);
        if (res?.success && res.staff) {
          const s = res.staff;
          const filled = { ...EMPTY, ...s,
            assignedClassrooms: Array.isArray(s.assignedClassrooms) ? s.assignedClassrooms : [],
            emergencyContact: { ...EMPTY.emergencyContact, ...(s.emergencyContact || {}) },
            salary:           { ...EMPTY.salary,           ...(s.salary           || {}) },
          };
          setData(filled);
          setOriginal(filled);
        } else {
          setError("Staff member not found.");
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [isCreating, staffId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isCreating || tab !== "timeline") return;
    staffService.getTimeline(staffId, 50)
      .then((res) => { if (res?.success) setTimeline(res.events || []); })
      .catch(() => { /* non-fatal */ });
  }, [tab, isCreating, staffId]);

  const dirty = useMemo(
    () => JSON.stringify(data) !== JSON.stringify(original),
    [data, original],
  );

  function setField(name, value) {
    setData(prev => ({ ...prev, [name]: value }));
  }
  function setNested(group, name, value) {
    setData(prev => ({ ...prev, [group]: { ...prev[group], [name]: value } }));
  }
  function selectDepartment(deptId) {
    const d = departments.find(x => x.deptId === deptId);
    setData(prev => ({ ...prev, departmentId: deptId, departmentName: d?.name || "" }));
  }
  function selectDesignation(desigId) {
    const d = designations.find(x => x.designationId === desigId);
    setData(prev => ({
      ...prev,
      designationId:   desigId,
      designationName: d?.name || "",
      category:        d?.category || prev.category,
    }));
  }

  async function handleSave() {
    setError("");
    if (!data.firstName.trim() || !data.lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }
    setSaving(true);
    try {
      if (isCreating) {
        const res = await staffService.create(data);
        if (res?.success) {
          navigate(`/staff/employees/${res.staffId}`, { replace: true });
        }
      } else {
        const res = await staffService.update(staffId, data);
        if (res?.success) setOriginal(data);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Mark ${data.displayName || "this employee"} as inactive? (Soft delete — record is preserved.)`)) return;
    try {
      await staffService.remove(staffId);
      navigate("/staff/employees", { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Delete failed.");
    }
  }

  function handleDiscard() {
    setData(original);
    setError("");
  }

  function handlePhotoChange({ url, path }) {
    setData(prev => ({ ...prev, photoUrl: url, photoStoragePath: path || "" }));
  }

  return (
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <button
            onClick={() => navigate("/staff/employees")}
            style={{ background: "none", border: "none", color: T.goldMid, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 4 }}
          >‹ Back to Directory</button>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.text, letterSpacing: "-0.02em", margin: 0 }}>
            {isCreating
              ? "New Employee"
              : (data.displayName || `${data.firstName} ${data.lastName}`.trim() || "Loading…")}
          </h1>
          {!isCreating && (
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 6, color: T.textSoft, fontSize: 13, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "ui-monospace, Cascadia Code, monospace", fontSize: 12 }}>
                {data.employeeCode}
              </span>
              <Dot />
              <span>{data.designationName || "—"}</span>
              <Dot />
              <StatusPill status={data.employmentStatus} />
              <Dot />
              <LoginPill status={data.loginStatus} />
              {data.deletedAt && (<>
                <Dot />
                <span style={{ color: T.red, fontWeight: 600 }}>Soft-deleted</span>
              </>)}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {!isCreating && canManage && !data.deletedAt && (
            <button onClick={handleDelete} style={{ background: T.surface, color: T.red, border: `1px solid ${T.red}55`, borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              Mark Inactive
            </button>
          )}
          {dirty && (
            <button onClick={handleDiscard} disabled={saving} style={{ background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              Discard
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || (!dirty && !isCreating)}
            style={{
              background: T.gold, color: "#1E1E1E",
              border: "none", borderRadius: 10,
              padding: "10px 22px", fontWeight: 700, fontSize: 13,
              cursor: saving || (!dirty && !isCreating) ? "not-allowed" : "pointer",
              opacity:  saving || (!dirty && !isCreating) ? 0.5 : 1,
              boxShadow: T.shadow,
            }}
          >
            {saving ? "Saving…" : isCreating ? "Create Employee" : "Save Changes"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: T.redLight, color: T.red, border: `1px solid ${T.red}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 40, textAlign: "center", color: T.textMuted }}>
          Loading employee…
        </div>
      ) : (
        <>
          {!isCreating && (
            <div style={{ display: "flex", gap: 4, marginBottom: 14, borderBottom: `1px solid ${T.border}`, overflowX: "auto" }}>
              {TABS.map(t => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    style={{
                      background: "none", border: "none",
                      padding: "10px 16px", cursor: "pointer",
                      fontSize: 13, fontWeight: active ? 700 : 500,
                      color: active ? T.text : T.textSoft,
                      borderBottom: `2px solid ${active ? T.gold : "transparent"}`,
                      marginBottom: -1, whiteSpace: "nowrap",
                    }}
                  >{t.label}</button>
                );
              })}
            </div>
          )}

          {(isCreating || tab === "overview") && (
            <OverviewTab
              data={data}
              setField={setField}
              onPhotoChange={handlePhotoChange}
              user={user}
              isCreating={isCreating}
            />
          )}
          {(isCreating || tab === "employment") && (
            <EmploymentTab
              data={data}
              setField={setField}
              selectDepartment={selectDepartment}
              selectDesignation={selectDesignation}
              departments={departments}
              designations={designations}
            />
          )}
          {!isCreating && tab === "documents"  && <DocumentsTab />}
          {(isCreating || tab === "emergency") && <EmergencyTab data={data} setNested={setNested} />}
          {!isCreating && tab === "salary"     && <SalaryTab data={data} setNested={setNested} canEditSalary={canEditSalary} />}
          {!isCreating && tab === "login"      && (
            <LoginTab
              staffId={staffId}
              data={data}
              onChange={(patch) => setData(prev => ({ ...prev, ...patch }))}
              canManage={canManage}
            />
          )}
          {!isCreating && tab === "timeline"   && <TimelineTab events={timeline} />}
        </>
      )}
    </div>
  );
}

// ── Tab: Overview ────────────────────────────────────────────────────

function OverviewTab({ data, setField, onPhotoChange, user, isCreating }) {
  return (
    <Card>
      <Section title="Profile Photo">
        <PhotoUploader
          schoolId={user?.schoolId}
          staffId={isCreating ? null : data.staffId}
          displayName={data.displayName || `${data.firstName} ${data.lastName}`.trim()}
          photoUrl={data.photoUrl}
          photoStoragePath={data.photoStoragePath}
          onChange={onPhotoChange}
        />
        {isCreating && (
          <div style={{ marginTop: 8, fontSize: 11, color: T.textMuted }}>
            Save the employee first, then return here to upload a photo to Firebase Storage.
          </div>
        )}
      </Section>

      <Section title="Basic Information">
        <Grid>
          <ReadOnly label="Employee ID" value={data.employeeCode || "Auto-assigned (EMP000001) on save"} mono />
          <Field label="First Name *">
            <Input value={data.firstName} onChange={(v) => setField("firstName", v)} />
          </Field>
          <Field label="Last Name *">
            <Input value={data.lastName} onChange={(v) => setField("lastName", v)} />
          </Field>
          <Field label="Display Name">
            <Input value={data.displayName} onChange={(v) => setField("displayName", v)} placeholder="Optional — defaults to First Last" />
          </Field>
          <Field label="Gender">
            <Select value={data.gender} onChange={(v) => setField("gender", v)} options={STAFF_ENUMS.genders} placeholder="Select…" />
          </Field>
          <Field label="Date of Birth">
            <Input type="date" value={data.dob} onChange={(v) => setField("dob", v)} />
          </Field>
          <Field label="Blood Group">
            <Select
              value={data.bloodGroup}
              onChange={(v) => setField("bloodGroup", v)}
              options={STAFF_ENUMS.bloodGroups.map(b => ({ value: b, label: b }))}
              placeholder="Select…"
            />
          </Field>
          <Field label="Marital Status">
            <Select value={data.maritalStatus} onChange={(v) => setField("maritalStatus", v)} options={STAFF_ENUMS.maritalStatus} placeholder="Select…" />
          </Field>
        </Grid>
      </Section>

      <Section title="Contact">
        <Grid>
          <Field label="Mobile">
            <Input value={data.mobile} onChange={(v) => setField("mobile", v)} placeholder="+91 …" />
          </Field>
          <Field label="Email">
            <Input type="email" value={data.email} onChange={(v) => setField("email", v)} placeholder="name@school.com" />
          </Field>
          <Field label="Address" span={2}>
            <Input value={data.address} onChange={(v) => setField("address", v)} />
          </Field>
          <Field label="City">
            <Input value={data.city} onChange={(v) => setField("city", v)} />
          </Field>
          <Field label="State">
            <Input value={data.state} onChange={(v) => setField("state", v)} />
          </Field>
          <Field label="Pincode">
            <Input value={data.pincode} onChange={(v) => setField("pincode", v)} />
          </Field>
        </Grid>
      </Section>
    </Card>
  );
}

// ── Tab: Employment ─────────────────────────────────────────────────

function EmploymentTab({ data, setField, selectDepartment, selectDesignation, departments, designations }) {
  // Available designations are filtered by department if selected
  const desigOptions = designations
    .filter(d => !data.departmentId || !d.departmentId || d.departmentId === data.departmentId)
    .map(d => ({
      value: d.designationId,
      label: d.category ? `${d.name} · ${labelForCategory(d.category)}` : d.name,
    }));

  return (
    <Card>
      <Section title="Employment">
        <Grid>
          <Field label="Joining Date">
            <Input type="date" value={data.joiningDate} onChange={(v) => setField("joiningDate", v)} />
          </Field>
          <Field label="Confirmation Date">
            <Input type="date" value={data.confirmationDate} onChange={(v) => setField("confirmationDate", v)} />
          </Field>
          <Field label="Branch">
            <Input value={data.branch} onChange={(v) => setField("branch", v)} placeholder="e.g. Seawoods Main" />
          </Field>
          <Field label="Center ID">
            <Input value={data.centerId} onChange={(v) => setField("centerId", v)} placeholder="e.g. seawoods-main" />
          </Field>
          <Field label="Department">
            <Select
              value={data.departmentId}
              onChange={(v) => selectDepartment(v)}
              options={departments.map(d => ({ value: d.deptId, label: d.name }))}
              placeholder="Select department"
            />
          </Field>
          <Field label="Designation">
            <Select
              value={data.designationId}
              onChange={(v) => selectDesignation(v)}
              options={desigOptions}
              placeholder="Select designation"
            />
          </Field>
          <ReadOnly label="Employee Category" value={data.category ? labelForCategory(data.category) : "(set by designation)"} />
          <Field label="Role (system)">
            <Input value={data.role} onChange={(v) => setField("role", v)} placeholder="e.g. teacher, accountant" />
          </Field>
          <Field label="Reporting Manager">
            <Input value={data.reportingManager} onChange={(v) => setField("reportingManager", v)} placeholder="Manager's name" />
          </Field>
          <Field label="Employment Type">
            <Select value={data.employmentType} onChange={(v) => setField("employmentType", v)} options={STAFF_ENUMS.employmentTypes} />
          </Field>
          <Field label="Employment Status">
            <Select value={data.employmentStatus} onChange={(v) => setField("employmentStatus", v)} options={STAFF_ENUMS.employmentStatuses} />
          </Field>
          <Field label="Assigned Classrooms" span={2}>
            <ClassroomChips
              value={data.assignedClassrooms}
              onChange={(v) => setField("assignedClassrooms", v)}
            />
          </Field>
        </Grid>
      </Section>
    </Card>
  );
}

// ── Multi-classroom chips input ────────────────────────────────────

function ClassroomChips({ value = [], onChange }) {
  const [draft, setDraft] = useState("");

  function addOne() {
    const v = draft.trim();
    if (!v) return;
    if (value.includes(v)) { setDraft(""); return; }
    onChange([...value, v]);
    setDraft("");
  }
  function removeAt(idx) {
    const next = value.slice();
    next.splice(idx, 1);
    onChange(next);
  }

  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center",
      border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 8px",
      background: "#FFFFFF",
    }}>
      {value.map((c, i) => (
        <span key={`${c}-${i}`} style={{
          background: T.goldLight,
          color: T.goldMid,
          border: `1px solid ${T.borderGold}`,
          borderRadius: 999, padding: "3px 10px",
          fontSize: 12, fontWeight: 600,
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          {c}
          <button
            type="button"
            onClick={() => removeAt(i)}
            style={{ background: "none", border: "none", color: T.goldMid, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}
          >×</button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addOne(); }
          if (e.key === "Backspace" && !draft && value.length) removeAt(value.length - 1);
        }}
        onBlur={addOne}
        placeholder={value.length ? "Add another…" : "e.g. Nursery A, Pre-K B"}
        style={{ flex: 1, minWidth: 120, border: "none", outline: "none", padding: "4px", fontSize: 13, background: "transparent" }}
      />
    </div>
  );
}

// ── Tab: Documents (Phase 2 placeholder) ────────────────────────────

function DocumentsTab() {
  const PLACEHOLDERS = [
    { label: "Aadhaar / National ID",   hint: "Government-issued identity proof" },
    { label: "PAN / Tax ID",            hint: "Tax identification document" },
    { label: "Educational Certificates",hint: "Highest qualification proof" },
    { label: "Employment Contract",     hint: "Signed offer / appointment letter" },
    { label: "Background Check",        hint: "Police verification report" },
    { label: "Resume",                  hint: "Latest CV / résumé" },
  ];
  return (
    <Card>
      <Section title="Documents">
        <div style={{ fontSize: 13, color: T.textSoft, marginBottom: 14, padding: "10px 14px", background: "#FFF7E0", border: `1px solid ${T.borderGold}`, borderRadius: 10 }}>
          Document upload is coming in <strong>Phase 2</strong>.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {PLACEHOLDERS.map(p => (
            <div key={p.label} style={{
              border: `1px dashed ${T.border}`,
              borderRadius: 12, padding: 16,
              background: T.surfaceWarm, opacity: 0.85,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{p.label}</div>
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{p.hint}</div>
              <button disabled style={{
                marginTop: 12, background: T.surface, color: T.textMuted,
                border: `1px solid ${T.border}`, borderRadius: 8,
                padding: "6px 12px", fontSize: 12, fontWeight: 600,
                cursor: "not-allowed",
              }}>Upload (soon)</button>
            </div>
          ))}
        </div>
      </Section>
    </Card>
  );
}

// ── Tab: Emergency ─────────────────────────────────────────────────

function EmergencyTab({ data, setNested }) {
  return (
    <Card>
      <Section title="Emergency Contact">
        <Grid>
          <Field label="Name">
            <Input value={data.emergencyContact.name} onChange={(v) => setNested("emergencyContact", "name", v)} />
          </Field>
          <Field label="Relation">
            <Input value={data.emergencyContact.relation} onChange={(v) => setNested("emergencyContact", "relation", v)} placeholder="Spouse / Parent / Sibling" />
          </Field>
          <Field label="Mobile">
            <Input value={data.emergencyContact.mobile} onChange={(v) => setNested("emergencyContact", "mobile", v)} />
          </Field>
        </Grid>
      </Section>
    </Card>
  );
}

// ── Tab: Salary ────────────────────────────────────────────────────

function SalaryTab({ data, setNested, canEditSalary }) {
  return (
    <Card>
      <Section title="Salary">
        {!canEditSalary && (
          <div style={{ fontSize: 12, color: T.textSoft, marginBottom: 14, padding: "8px 12px", background: T.surfaceWarm, border: `1px solid ${T.border}`, borderRadius: 8 }}>
            Salary details are read-only for your role. Contact an Admin or Center Owner to update.
          </div>
        )}
        <Grid>
          <Field label="Monthly CTC">
            <Input type="number" value={data.salary.monthlyCtc} onChange={(v) => setNested("salary", "monthlyCtc", Number(v) || 0)} disabled={!canEditSalary} />
          </Field>
          <Field label="Currency">
            <Input value={data.salary.currency} onChange={(v) => setNested("salary", "currency", v)} disabled={!canEditSalary} />
          </Field>
          <Field label="Payment Mode">
            <Input value={data.salary.paymentMode} onChange={(v) => setNested("salary", "paymentMode", v)} placeholder="Bank Transfer / Cheque / UPI" disabled={!canEditSalary} />
          </Field>
          <Field label="Bank A/C (last 4)">
            <Input value={data.salary.bankAccountLast4} onChange={(v) => setNested("salary", "bankAccountLast4", v)} placeholder="1234" maxLength={4} disabled={!canEditSalary} />
          </Field>
        </Grid>
      </Section>
    </Card>
  );
}

// ── Tab: Login ──────────────────────────────────────────────────────

function LoginTab({ staffId, data, onChange, canManage }) {
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState("");
  const [resetLink, setResetLink] = useState("");
  const [linkUid, setLinkUid]     = useState("");

  async function doInvite() {
    if (!data.email) { setError("Set the employee's email on the Overview tab first."); return; }
    setBusy(true); setError(""); setResetLink("");
    try {
      const res = await staffService.invite(staffId);
      if (res?.success) {
        onChange({
          linkedUserId: res.staff.linkedUserId,
          loginStatus:  res.staff.loginStatus,
          invitedAt:    res.staff.invitedAt,
          lastInviteEmail: res.staff.lastInviteEmail,
        });
        if (res.resetLink) setResetLink(res.resetLink);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Invite failed.");
    } finally { setBusy(false); }
  }

  async function doLink() {
    const uid = linkUid.trim();
    if (!uid) { setError("Enter a Firebase UID."); return; }
    setBusy(true); setError("");
    try {
      const res = await staffService.linkUser(staffId, uid);
      if (res?.success) {
        onChange({
          linkedUserId: res.staff.linkedUserId,
          loginStatus:  res.staff.loginStatus,
        });
        setLinkUid("");
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Link failed.");
    } finally { setBusy(false); }
  }

  async function doUnlink() {
    if (!window.confirm("Unlink this employee from their login account? The Firebase user is left untouched.")) return;
    setBusy(true); setError("");
    try {
      const res = await staffService.unlinkUser(staffId);
      if (res?.success) {
        onChange({ linkedUserId: "", loginStatus: "not_linked" });
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Unlink failed.");
    } finally { setBusy(false); }
  }

  async function toggleDisabled() {
    const disable = data.loginStatus !== "disabled";
    if (!window.confirm(disable ? "Disable this login account?" : "Re-enable this login account?")) return;
    setBusy(true); setError("");
    try {
      const res = await staffService.setUserDisabled(staffId, disable);
      if (res?.success) onChange({ loginStatus: res.staff.loginStatus });
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Update failed.");
    } finally { setBusy(false); }
  }

  return (
    <Card>
      <Section title="Login Account">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", marginBottom: 18 }}>
          <LoginPill status={data.loginStatus} />
          {data.linkedUserId && (
            <span style={{ fontSize: 12, color: T.textSoft, fontFamily: "ui-monospace, Cascadia Code, monospace" }}>
              UID: {data.linkedUserId}
            </span>
          )}
          {data.invitedAt && (
            <span style={{ fontSize: 12, color: T.textMuted }}>
              Invited {new Date(data.invitedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          )}
        </div>

        {error && (
          <div style={{ background: T.redLight, color: T.red, border: `1px solid ${T.red}33`, borderRadius: 10, padding: "8px 12px", marginBottom: 14, fontSize: 13 }}>
            {error}
          </div>
        )}

        {resetLink && (
          <div style={{ background: "#FFF7E0", border: `1px solid ${T.borderGold}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Password set-up link generated</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                readOnly
                value={resetLink}
                style={{ flex: 1, border: `1px solid ${T.border}`, borderRadius: 6, padding: "5px 8px", fontSize: 12, background: T.surface, fontFamily: "ui-monospace, Cascadia Code, monospace" }}
              />
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(resetLink)}
                style={miniBtn()}
              >Copy</button>
            </div>
            <div style={{ marginTop: 6, color: T.textSoft }}>
              Send this link to the employee. They'll set their own password and sign in.
            </div>
          </div>
        )}

        {!canManage && (
          <div style={{ fontSize: 12, color: T.textSoft, padding: "8px 12px", background: T.surfaceWarm, border: `1px solid ${T.border}`, borderRadius: 8 }}>
            Login account actions require admin / center-owner / center-admin privileges.
          </div>
        )}

        {canManage && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {data.loginStatus === "not_linked" && (
              <>
                <button onClick={doInvite} disabled={busy} style={primaryBtn(busy)}>
                  {busy ? "Inviting…" : "Invite Employee"}
                </button>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    value={linkUid}
                    onChange={(e) => setLinkUid(e.target.value)}
                    placeholder="Firebase UID to link"
                    style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, background: T.surface, minWidth: 240 }}
                  />
                  <button onClick={doLink} disabled={busy} style={ghostBtn(busy)}>Link Existing</button>
                </div>
              </>
            )}
            {data.loginStatus === "invitation_sent" && (
              <>
                <button onClick={doInvite} disabled={busy} style={primaryBtn(busy)}>Resend Invite</button>
                <button onClick={doUnlink} disabled={busy} style={ghostBtn(busy, T.red)}>Cancel Invite</button>
              </>
            )}
            {(data.loginStatus === "active" || data.loginStatus === "disabled") && (
              <>
                <button onClick={toggleDisabled} disabled={busy} style={ghostBtn(busy, data.loginStatus === "active" ? T.red : T.green)}>
                  {data.loginStatus === "active" ? "Disable Login" : "Re-enable Login"}
                </button>
                <button onClick={doUnlink} disabled={busy} style={ghostBtn(busy)}>Unlink</button>
              </>
            )}
          </div>
        )}
      </Section>
    </Card>
  );
}

// ── Tab: Timeline ───────────────────────────────────────────────────

function TimelineTab({ events }) {
  if (!events.length) {
    return (
      <Card>
        <Section title="Activity Timeline">
          <div style={{ color: T.textMuted, fontSize: 13, padding: "8px 4px" }}>
            No events yet.
          </div>
        </Section>
      </Card>
    );
  }
  return (
    <Card>
      <Section title="Activity Timeline">
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {events.map((ev) => (
            <div key={ev.eventId || ev.createdAt} style={{
              display: "grid", gridTemplateColumns: "140px 1fr",
              gap: 14, padding: "12px 0", borderBottom: `1px solid ${T.border}`,
            }}>
              <div style={{ fontSize: 12, color: T.textMuted }}>
                {new Date(ev.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </div>
              <div>
                <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{prettyEventType(ev.type)}</div>
                <div style={{ fontSize: 13, color: T.textSoft, marginTop: 2 }}>{ev.description}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </Card>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

function labelForCategory(id) {
  return STAFF_ENUMS.categories.find(c => c.value === id)?.label || id;
}

function prettyEventType(type) {
  const map = {
    STAFF_CREATED:        "Employee created",
    STAFF_UPDATED:        "Profile updated",
    STAFF_DELETED:        "Marked inactive",
    STAFF_RESTORED:       "Restored",
    DEPARTMENT_CHANGED:   "Department changed",
    DESIGNATION_CHANGED:  "Designation changed",
    STATUS_CHANGED:       "Status changed",
    PHOTO_UPDATED:        "Photo updated",
    PHOTO_REMOVED:        "Photo removed",
    USER_INVITED:         "Login invitation sent",
    USER_ACCOUNT_LINKED:  "Login account linked",
    USER_UNLINKED:        "Login account unlinked",
    USER_DISABLED:        "Login account disabled",
  };
  return map[type] || type;
}

// ── Atoms ────────────────────────────────────────────────────────────

function Card({ children }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.shadow, padding: 24 }}>
      {children}
    </div>
  );
}
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid, marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </div>
  );
}
function Grid({ children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
      {children}
    </div>
  );
}
function Field({ label, span = 1, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: `span ${span}` }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: T.textSoft }}>{label}</span>
      {children}
    </label>
  );
}
function ReadOnly({ label, value, mono }) {
  return (
    <Field label={label}>
      <div style={{
        background: T.surfaceWarm,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        padding: "9px 12px",
        fontSize: 13,
        color: T.textSoft,
        fontFamily: mono ? "ui-monospace, Cascadia Code, monospace" : undefined,
      }}>{value}</div>
    </Field>
  );
}
function Input({ type = "text", value, onChange, placeholder, disabled, maxLength }) {
  return (
    <input
      type={type}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      maxLength={maxLength}
      style={{
        border: `1px solid ${T.border}`, borderRadius: 8,
        padding: "9px 12px", fontSize: 13,
        background: disabled ? T.surfaceWarm : "#FFFFFF",
        color: T.text, outline: "none",
        opacity: disabled ? 0.7 : 1,
      }}
    />
  );
}
function Select({ value, onChange, options = [], placeholder, disabled }) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{
        border: `1px solid ${T.border}`, borderRadius: 8,
        padding: "9px 12px", fontSize: 13,
        background: disabled ? T.surfaceWarm : "#FFFFFF",
        color: T.text, outline: "none",
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
function StatusPill({ status }) {
  const meta = EMPLOYMENT_STATUS_META[status] || EMPLOYMENT_STATUS_META.inactive;
  return (
    <span style={{
      display: "inline-block", padding: "3px 9px", borderRadius: 999,
      fontSize: 11, fontWeight: 600,
      background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`,
    }}>{meta.label}</span>
  );
}
function LoginPill({ status }) {
  const meta = LOGIN_STATUS_META[status] || LOGIN_STATUS_META.not_linked;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600,
      background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: meta.dot }} />
      Login · {meta.label}
    </span>
  );
}
function Dot() {
  return <span style={{ width: 3, height: 3, borderRadius: "50%", background: T.textMuted }} />;
}
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
    borderRadius: 10, padding: "8px 14px",
    fontWeight: 600, fontSize: 13,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity:  disabled ? 0.5 : 1,
  };
}
function miniBtn() {
  return {
    background: T.surface, color: T.text,
    border: `1px solid ${T.border}`,
    borderRadius: 6, padding: "4px 10px",
    fontSize: 11, fontWeight: 600, cursor: "pointer",
  };
}
