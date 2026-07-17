/**
 * StaffProfile.jsx — Employee Profile (create + view + edit)
 * ────────────────────────────────────────────────────────────
 * Tabs: Overview · Employment · Documents · Emergency · Salary · Login · Timeline
 *
 * Design System v2 / Platform Layout Standard retrofit: PageHeader (with
 * breadcrumb-style back link + StatusBadge meta row) + FormSection/FormGrid/
 * Field/Input/Select/Button/Tabs/SkeletonForm replace the page's hand-rolled
 * tokens and atoms. This single component still serves create+view+edit --
 * unlike Students, the audit found no duplicate Add/Edit implementation to
 * consolidate here, so the tabbed single-page pattern is kept (mirrors
 * StudentProfile's shell, not StudentWizard, since there's no natural
 * multi-step boundary in employee onboarding to justify a Wizard).
 * All staffService/departmentService/designationService calls unchanged.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import staffService, { STAFF_ENUMS } from "../../services/staffService";
import departmentService from "../../services/departmentService";
import designationService from "../../services/designationService";
import PhotoUploader from "../../components/staff/PhotoUploader";
import {
  PageShell, PageHeader, StatusBadge, Button, Tabs,
  FormSection, Field, FormGrid, SkeletonForm,
  Input as SharedInput, Select as SharedSelect,
} from "../../components/ui";

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

// ── Local adapters over the shared Input/Select (keeps this file's many
//    value/onChange(v) call sites unchanged while rendering the design
//    system's actual markup/styling, not ad-hoc inline styles) ──────────
function Input({ value, onChange, ...rest }) {
  return <SharedInput value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...rest} />;
}
function Select({ value, onChange, options, placeholder, ...rest }) {
  return <SharedSelect value={value ?? ""} onChange={(e) => onChange(e.target.value)} options={options} placeholder={placeholder} {...rest} />;
}

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

  const secondaryActions = [];
  if (!isCreating && canManage && !data.deletedAt) {
    secondaryActions.push({ key: "delete", label: "Mark Inactive", variant: "outline", onClick: handleDelete });
  }
  if (dirty) {
    secondaryActions.push({ key: "discard", label: "Discard", variant: "outline", onClick: handleDiscard, disabled: saving });
  }

  return (
    <PageShell
      header={
        <PageHeader
          title={isCreating ? "New Employee" : (data.displayName || `${data.firstName} ${data.lastName}`.trim() || "Loading…")}
          tag="Staff Management"
          backLabel="Back to Directory"
          onBack={() => navigate("/staff/employees")}
          subtitle={!isCreating && (
            <span style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "ui-monospace, Cascadia Code, monospace", fontSize: 12 }}>{data.employeeCode}</span>
              <span>{data.designationName || "—"}</span>
              <StatusBadge status={data.employmentStatus} />
              <StatusBadge status={data.loginStatus} />
              {data.deletedAt && <span style={{ color: "var(--yd-danger)", fontWeight: 700, fontSize: 12 }}>Soft-deleted</span>}
            </span>
          )}
          secondaryActions={secondaryActions}
          primaryAction={{
            label: saving ? "Saving…" : isCreating ? "Create Employee" : "Save Changes",
            onClick: handleSave,
            disabled: saving || (!dirty && !isCreating),
          }}
        />
      }
    >
      {error && (
        <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading ? (
        <SkeletonForm fields={6} />
      ) : (
        <>
          {!isCreating && (
            <div style={{ marginBottom: 16 }}>
              <Tabs tabs={TABS} activeTab={tab} onChange={setTab} />
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
    </PageShell>
  );
}

// ── Tab: Overview ────────────────────────────────────────────────────

function OverviewTab({ data, setField, onPhotoChange, user, isCreating }) {
  return (
    <>
      <FormSection title="Profile Photo">
        <PhotoUploader
          schoolId={user?.schoolId}
          staffId={isCreating ? null : data.staffId}
          displayName={data.displayName || `${data.firstName} ${data.lastName}`.trim()}
          photoUrl={data.photoUrl}
          photoStoragePath={data.photoStoragePath}
          onChange={onPhotoChange}
        />
        {isCreating && (
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--yd-text-muted)" }}>
            Save the employee first, then return here to upload a photo to Firebase Storage.
          </div>
        )}
      </FormSection>

      <FormSection title="Basic Information">
        <FormGrid cols={2}>
          <Field label="Employee ID">
            <div className="yd-input" style={{ display: "flex", alignItems: "center", background: "var(--yd-soft)", color: "var(--yd-text-soft)", fontFamily: "ui-monospace, Cascadia Code, monospace" }}>
              {data.employeeCode || "Auto-assigned (EMP000001) on save"}
            </div>
          </Field>
          <Field label="First Name" required>
            <Input value={data.firstName} onChange={(v) => setField("firstName", v)} />
          </Field>
          <Field label="Last Name" required>
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
        </FormGrid>
      </FormSection>

      <FormSection title="Contact">
        <FormGrid cols={2}>
          <Field label="Mobile">
            <Input value={data.mobile} onChange={(v) => setField("mobile", v)} placeholder="+91 …" />
          </Field>
          <Field label="Email">
            <Input type="email" value={data.email} onChange={(v) => setField("email", v)} placeholder="name@school.com" />
          </Field>
          <Field label="Address">
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
        </FormGrid>
      </FormSection>
    </>
  );
}

// ── Tab: Employment ─────────────────────────────────────────────────

function EmploymentTab({ data, setField, selectDepartment, selectDesignation, departments, designations }) {
  const desigOptions = designations
    .filter(d => !data.departmentId || !d.departmentId || d.departmentId === data.departmentId)
    .map(d => ({
      value: d.designationId,
      label: d.category ? `${d.name} · ${labelForCategory(d.category)}` : d.name,
    }));

  return (
    <FormSection title="Employment">
      <FormGrid cols={2}>
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
        <Field label="Employee Category">
          <div className="yd-input" style={{ display: "flex", alignItems: "center", background: "var(--yd-soft)", color: "var(--yd-text-soft)" }}>
            {data.category ? labelForCategory(data.category) : "(set by designation)"}
          </div>
        </Field>
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
      </FormGrid>
      <div style={{ marginTop: 14 }}>
        <Field label="Assigned Classrooms">
          <ClassroomChips value={data.assignedClassrooms} onChange={(v) => setField("assignedClassrooms", v)} />
        </Field>
      </div>
    </FormSection>
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
      border: "1px solid var(--yd-border)", borderRadius: 8, padding: "6px 8px",
      background: "var(--yd-surface)",
    }}>
      {value.map((c, i) => (
        <span key={`${c}-${i}`} style={{
          background: "var(--yd-yellow-light, #FFF9E0)",
          color: "var(--yd-yellow-dark)",
          border: "1px solid var(--yd-yellow)",
          borderRadius: 999, padding: "3px 10px",
          fontSize: 12, fontWeight: 600,
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          {c}
          <button
            type="button"
            onClick={() => removeAt(i)}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}
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
    <FormSection title="Documents">
      <div style={{ fontSize: 13, color: "var(--yd-text-soft)", marginBottom: 14, padding: "10px 14px", background: "var(--yd-yellow-light, #FFF9E0)", border: "1px solid var(--yd-yellow)", borderRadius: 10 }}>
        Document upload is coming in <strong>Phase 2</strong>.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
        {PLACEHOLDERS.map(p => (
          <div key={p.label} style={{
            border: "1px dashed var(--yd-border)",
            borderRadius: 12, padding: 16,
            background: "var(--yd-bg-sunken)", opacity: 0.85,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--yd-charcoal)" }}>{p.label}</div>
            <div style={{ fontSize: 12, color: "var(--yd-text-muted)", marginTop: 4 }}>{p.hint}</div>
            <Button size="xs" variant="outline" disabled style={{ marginTop: 12 }}>Upload (soon)</Button>
          </div>
        ))}
      </div>
    </FormSection>
  );
}

// ── Tab: Emergency ─────────────────────────────────────────────────

function EmergencyTab({ data, setNested }) {
  return (
    <FormSection title="Emergency Contact">
      <FormGrid cols={2}>
        <Field label="Name">
          <Input value={data.emergencyContact.name} onChange={(v) => setNested("emergencyContact", "name", v)} />
        </Field>
        <Field label="Relation">
          <Input value={data.emergencyContact.relation} onChange={(v) => setNested("emergencyContact", "relation", v)} placeholder="Spouse / Parent / Sibling" />
        </Field>
        <Field label="Mobile">
          <Input value={data.emergencyContact.mobile} onChange={(v) => setNested("emergencyContact", "mobile", v)} />
        </Field>
      </FormGrid>
    </FormSection>
  );
}

// ── Tab: Salary ────────────────────────────────────────────────────

function SalaryTab({ data, setNested, canEditSalary }) {
  return (
    <FormSection title="Salary">
      {!canEditSalary && (
        <div style={{ fontSize: 12, color: "var(--yd-text-soft)", marginBottom: 14, padding: "8px 12px", background: "var(--yd-bg-sunken)", border: "1px solid var(--yd-border)", borderRadius: 8 }}>
          Salary details are read-only for your role. Contact an Admin or Center Owner to update.
        </div>
      )}
      <FormGrid cols={2}>
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
      </FormGrid>
    </FormSection>
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
    <FormSection title="Login Account">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", marginBottom: 18 }}>
        <StatusBadge status={data.loginStatus} />
        {data.linkedUserId && (
          <span style={{ fontSize: 12, color: "var(--yd-text-soft)", fontFamily: "ui-monospace, Cascadia Code, monospace" }}>
            UID: {data.linkedUserId}
          </span>
        )}
        {data.invitedAt && (
          <span style={{ fontSize: 12, color: "var(--yd-text-muted)" }}>
            Invited {new Date(data.invitedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        )}
      </div>

      {error && (
        <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "8px 12px", marginBottom: 14, fontSize: 13 }}>
          {error}
        </div>
      )}

      {resetLink && (
        <div style={{ background: "var(--yd-yellow-light, #FFF9E0)", border: "1px solid var(--yd-yellow)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Password set-up link generated</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              readOnly
              value={resetLink}
              style={{ flex: 1, border: "1px solid var(--yd-border)", borderRadius: 6, padding: "5px 8px", fontSize: 12, background: "var(--yd-surface)", fontFamily: "ui-monospace, Cascadia Code, monospace" }}
            />
            <Button size="xs" variant="outline" onClick={() => navigator.clipboard?.writeText(resetLink)}>Copy</Button>
          </div>
          <div style={{ marginTop: 6, color: "var(--yd-text-soft)" }}>
            Send this link to the employee. They'll set their own password and sign in.
          </div>
        </div>
      )}

      {!canManage && (
        <div style={{ fontSize: 12, color: "var(--yd-text-soft)", padding: "8px 12px", background: "var(--yd-bg-sunken)", border: "1px solid var(--yd-border)", borderRadius: 8 }}>
          Login account actions require admin / center-owner / center-admin privileges.
        </div>
      )}

      {canManage && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {data.loginStatus === "not_linked" && (
            <>
              <Button variant="primary" size="sm" onClick={doInvite} loading={busy}>Invite Employee</Button>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  value={linkUid}
                  onChange={(e) => setLinkUid(e.target.value)}
                  placeholder="Firebase UID to link"
                  className="yd-input"
                  style={{ minWidth: 240 }}
                />
                <Button variant="outline" size="sm" onClick={doLink} disabled={busy}>Link Existing</Button>
              </div>
            </>
          )}
          {data.loginStatus === "invitation_sent" && (
            <>
              <Button variant="primary" size="sm" onClick={doInvite} loading={busy}>Resend Invite</Button>
              <Button variant="outline" size="sm" onClick={doUnlink} disabled={busy}>Cancel Invite</Button>
            </>
          )}
          {(data.loginStatus === "active" || data.loginStatus === "disabled") && (
            <>
              <Button variant={data.loginStatus === "active" ? "danger" : "success"} size="sm" onClick={toggleDisabled} disabled={busy}>
                {data.loginStatus === "active" ? "Disable Login" : "Re-enable Login"}
              </Button>
              <Button variant="outline" size="sm" onClick={doUnlink} disabled={busy}>Unlink</Button>
            </>
          )}
        </div>
      )}
    </FormSection>
  );
}

// ── Tab: Timeline ───────────────────────────────────────────────────

function TimelineTab({ events }) {
  if (!events.length) {
    return (
      <FormSection title="Activity Timeline">
        <div style={{ color: "var(--yd-text-muted)", fontSize: 13, padding: "8px 4px" }}>
          No events yet.
        </div>
      </FormSection>
    );
  }
  return (
    <FormSection title="Activity Timeline">
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {events.map((ev) => (
          <div key={ev.eventId || ev.createdAt} style={{
            display: "grid", gridTemplateColumns: "140px 1fr",
            gap: 14, padding: "12px 0", borderBottom: "1px solid var(--yd-border-light)",
          }}>
            <div style={{ fontSize: 12, color: "var(--yd-text-muted)" }}>
              {new Date(ev.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </div>
            <div>
              <div style={{ fontSize: 13, color: "var(--yd-charcoal)", fontWeight: 600 }}>{prettyEventType(ev.type)}</div>
              <div style={{ fontSize: 13, color: "var(--yd-text-soft)", marginTop: 2 }}>{ev.description}</div>
            </div>
          </div>
        ))}
      </div>
    </FormSection>
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
