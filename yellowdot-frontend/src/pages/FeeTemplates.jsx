import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { api } from "../services/authService";

const get  = url      => api.get(url).then(r => r.data);
const post = (url, d) => api.post(url, d).then(r => r.data);
const put  = (url, d) => api.put(url, d).then(r => r.data);
const del  = url      => api.delete(url).then(r => r.data);

const INR = n => `₹${(Number(n) || 0).toLocaleString("en-IN")}`;

const BILLING_CYCLES = ["Monthly", "Quarterly", "Half-Yearly", "Annual", "One-Time"];
const FEE_TYPES = [
  "Tuition Fee", "Daycare Fees", "Playgroup Fees", "Nursery Fees",
  "Transport Fee", "Meal Plan", "Annual Charges", "Activity Fee",
  "Admission Fee", "Registration Fee", "Other",
];
const CLASSES = ["Daycare", "Playgroup", "Nursery", "LKG", "UKG",
                 "Class 1", "Class 2", "Class 3", "Class 4", "Class 5"];

const CYCLE_COLORS = {
  Monthly:      "badge badge-info",
  Quarterly:    "badge badge-warn",
  "Half-Yearly":"badge badge-neutral",
  Annual:       "badge badge-yellow",
  "One-Time":   "badge badge-neutral",
};

const EMPTY_FORM = {
  templateName:      "",
  feeType:           "",
  amount:            "",
  billingCycle:      "Monthly",
  description:       "",
  applicableClasses: [],
  active:            true,
  autoGenerate:      false,
};

function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((type, msg) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, type, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);
  return {
    toasts,
    success: useCallback(m => add("success", m), [add]),
    error:   useCallback(m => add("error",   m), [add]),
  };
}

function Toasts({ toasts }) {
  return (
    <div className="fixed bottom-4 right-4 z-[500] flex flex-col gap-1.5 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`yd-toast pointer-events-auto ${t.type === "success" ? "yd-toast-success" : "yd-toast-error"}`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

function inp(err) {
  return `yd-input${err ? " border-yd-danger bg-yd-danger-soft" : ""}`;
}

function Field({ label, error, children, span2 }) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <label className="yd-text-label block mb-1">{label}</label>
      {children}
      {error && <p className="text-[10px] text-yd-danger mt-0.5">{error}</p>}
    </div>
  );
}

export default function FeeTemplates() {
  const navigate = useNavigate();
  const toast    = useToast();

  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const [editTarget, setEditTarget] = useState(null);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [errors,     setErrors]     = useState({});

  const setF = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: "" }));
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await get("/api/fee-templates");
      if (r.success) setTemplates(r.templates || []);
    } catch {
      toast.error("Failed to load templates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function startEdit(tpl) {
    setEditTarget(tpl);
    setForm({
      templateName:      tpl.templateName || "",
      feeType:           tpl.feeType      || "",
      amount:            String(tpl.amount || ""),
      billingCycle:      tpl.billingCycle  || "Monthly",
      description:       tpl.description  || "",
      applicableClasses: tpl.applicableClasses || [],
      active:            tpl.active !== false,
      autoGenerate:      tpl.autoGenerate || false,
    });
    setErrors({});
  }

  function startCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setErrors({});
  }

  function handleDuplicate(tpl) {
    setEditTarget(null);
    setForm({
      templateName:      `${tpl.templateName} (Copy)`,
      feeType:           tpl.feeType      || "",
      amount:            String(tpl.amount || ""),
      billingCycle:      tpl.billingCycle  || "Monthly",
      description:       tpl.description  || "",
      applicableClasses: tpl.applicableClasses || [],
      active:            tpl.active !== false,
      autoGenerate:      tpl.autoGenerate || false,
    });
    setErrors({});
    toast.success("Template copied — review and save.");
  }

  function validate() {
    const e = {};
    if (!form.templateName.trim()) e.templateName = "Required.";
    if (!form.feeType)             e.feeType      = "Required.";
    if (!form.amount || Number(form.amount) <= 0) e.amount = "Enter a valid amount.";
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { ...form, amount: Number(form.amount) };
      if (editTarget) {
        const r = await put(`/api/fee-templates/${editTarget.templateId}`, payload);
        if (!r.success) throw new Error(r.error || "Failed to update template.");
        setTemplates(prev => prev.map(t =>
          t.templateId === editTarget.templateId ? { ...t, ...payload, templateId: t.templateId } : t
        ));
        toast.success("Template updated.");
      } else {
        const r = await post("/api/fee-templates", payload);
        if (!r.success) throw new Error(r.error || "Failed to create template.");
        if (r.template) setTemplates(prev => [...prev, r.template]);
        else await load();
        toast.success("Template created.");
      }
      startCreate();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(tpl) {
    setDeleting(tpl.templateId);
    setConfirmDel(null);
    try {
      const r = await del(`/api/fee-templates/${tpl.templateId}`);
      if (!r.success) throw new Error(r.error || "Failed to delete.");
      setTemplates(prev => prev.filter(t => t.templateId !== tpl.templateId));
      if (editTarget?.templateId === tpl.templateId) startCreate();
      toast.success("Template deleted.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDeleting(null);
    }
  }

  async function toggleActive(tpl) {
    try {
      await put(`/api/fee-templates/${tpl.templateId}`, { active: !tpl.active });
      setTemplates(prev => prev.map(t => t.templateId === tpl.templateId ? { ...t, active: !tpl.active } : t));
    } catch {
      toast.error("Failed to update status.");
    }
  }

  const isEdit = !!editTarget;
  const activeCount = templates.filter(t => t.active !== false).length;

  return (
    <div className="flex h-screen overflow-hidden bg-yd-bg">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Page header */}
        <div className="flex-shrink-0 bg-white border-b border-yd-border px-5 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/invoice")}
              className="w-8 h-8 rounded-lg bg-yd-bg border border-yd-border flex items-center justify-center text-yd-text-2 hover:text-yd-charcoal hover:border-yd-yellow hover:bg-yd-yellow-soft transition-all text-sm font-bold">
              &larr;
            </button>
            <div>
              <h1 className="text-[15px] font-black text-yd-charcoal leading-none">Fee Templates</h1>
              <p className="text-[10px] text-yd-text-3 mt-0.5">
                {templates.length} template{templates.length !== 1 ? "s" : ""} &middot; {activeCount} active
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/invoice/new")} className="btn btn-ghost btn-sm">
              Create Invoice
            </button>
            <button onClick={startCreate} className="btn btn-primary btn-sm">
              + New Template
            </button>
          </div>
        </div>

        {/* Auto-billing notice */}
        <div className="flex-shrink-0 mx-4 mt-3 px-4 py-2.5 bg-yd-info-soft border border-yd-info-border rounded-xl flex items-start gap-2.5">
          <div className="w-4 h-4 rounded-full bg-yd-info flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white font-black text-[9px]">i</span>
          </div>
          <div>
            <span className="text-xs font-bold text-yd-info">Billing Cycles — </span>
            <span className="text-xs text-yd-text-2">Templates store the billing frequency. Automatic monthly invoice generation requires a backend scheduler — currently invoices are created manually using these templates.</span>
          </div>
        </div>

        {/* Main two-panel layout */}
        <div className="flex-1 flex overflow-hidden mt-3">

          {/* Left panel — template list */}
          <div className="w-[340px] flex-shrink-0 border-r border-yd-border bg-yd-cream flex flex-col overflow-hidden">
            <div className="px-4 py-2.5 border-b border-yd-border flex items-center justify-between">
              <p className="text-[10px] font-bold text-yd-text-3 uppercase tracking-wider">
                Templates ({templates.length})
              </p>
              <button onClick={startCreate}
                className="text-[10px] font-bold text-yd-yellow hover:text-yd-yellow-dark transition-colors">
                + New
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-24 gap-2 text-yd-text-3">
                  <div className="yd-spinner" />
                  <span className="text-xs">Loading...</span>
                </div>
              ) : templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-yd-yellow-soft border border-yd-yellow flex items-center justify-center mb-3">
                    <span className="text-yd-charcoal font-black text-sm">FT</span>
                  </div>
                  <div className="text-xs font-black text-yd-charcoal mb-1">No templates yet</div>
                  <div className="text-[10px] text-yd-text-3">Create your first fee template using the form.</div>
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {templates.map(tpl => {
                    const isSelected = editTarget?.templateId === tpl.templateId;
                    const isDel = deleting === tpl.templateId;
                    return (
                      <div
                        key={tpl.templateId}
                        className={`rounded-xl border transition-all cursor-pointer
                          ${isSelected
                            ? "border-yd-yellow bg-yd-yellow-soft shadow-yd-warm"
                            : "border-yd-border bg-white hover:border-yd-yellow hover:shadow-sm"}`}
                        onClick={() => startEdit(tpl)}>

                        {/* Card header */}
                        <div className="px-3 pt-3 pb-2">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex-1 min-w-0">
                              <div className={`text-xs font-black truncate ${isSelected ? "text-yd-charcoal" : "text-yd-charcoal"}`}>
                                {tpl.templateName}
                              </div>
                              <div className="text-[10px] text-yd-text-3 truncate mt-0.5">{tpl.feeType}</div>
                            </div>
                            <div className={`text-sm font-black flex-shrink-0 ${isSelected ? "text-yd-charcoal" : "text-yd-charcoal"}`}>
                              {INR(tpl.amount)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={CYCLE_COLORS[tpl.billingCycle] || "badge badge-neutral"}>
                              {tpl.billingCycle}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border
                              ${tpl.active !== false
                                ? "bg-yd-success-soft text-yd-success border-yd-success-border"
                                : "bg-yd-soft text-yd-text-3 border-yd-border"}`}>
                              {tpl.active !== false ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </div>

                        {/* Card actions */}
                        <div className="flex items-center gap-0 border-t border-yd-border-light">
                          <button
                            onClick={e => { e.stopPropagation(); startEdit(tpl); }}
                            className="flex-1 py-1.5 text-[10px] font-semibold text-yd-text-2 hover:text-yd-charcoal hover:bg-yd-yellow-soft transition-colors rounded-bl-xl">
                            ✏️ Edit
                          </button>
                          <div className="w-px h-4 bg-yd-border-light" />
                          <button
                            onClick={e => { e.stopPropagation(); handleDuplicate(tpl); }}
                            className="flex-1 py-1.5 text-[10px] font-semibold text-yd-text-2 hover:text-yd-charcoal hover:bg-yd-yellow-soft transition-colors">
                            📋 Copy
                          </button>
                          <div className="w-px h-4 bg-yd-border-light" />
                          <button
                            onClick={e => { e.stopPropagation(); toggleActive(tpl); }}
                            className="flex-1 py-1.5 text-[10px] font-semibold text-yd-text-2 hover:text-yd-charcoal hover:bg-yd-yellow-soft transition-colors">
                            {tpl.active !== false ? "⏸ Pause" : "▶ Activate"}
                          </button>
                          <div className="w-px h-4 bg-yd-border-light" />
                          <button
                            onClick={e => { e.stopPropagation(); setConfirmDel(tpl); }}
                            disabled={isDel}
                            className="flex-1 py-1.5 text-[10px] font-semibold text-yd-danger hover:bg-yd-danger-soft transition-colors rounded-br-xl">
                            {isDel ? "..." : "🗑 Delete"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right panel — create/edit form */}
          <div className="flex-1 overflow-y-auto bg-yd-bg">
            <div className="max-w-[580px] mx-auto px-8 py-6">

              {/* Form header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-xl font-black text-yd-charcoal leading-none">
                    {isEdit ? "Edit Template" : "New Template"}
                  </h2>
                  <p className="text-xs text-yd-text-3 mt-1">
                    {isEdit
                      ? `Editing: ${editTarget.templateName}`
                      : "Create a reusable fee preset for quick invoice generation."}
                  </p>
                </div>
                {isEdit && (
                  <button onClick={startCreate} className="btn btn-ghost btn-sm">
                    + New Template
                  </button>
                )}
              </div>

              <div className="h-1 w-12 bg-yd-yellow rounded-full mb-5" />

              {/* Form fields */}
              <div className="grid grid-cols-2 gap-4">

                <Field label="Template Name *" error={errors.templateName} span2>
                  <input
                    className={inp(errors.templateName)}
                    value={form.templateName}
                    onChange={e => setF("templateName", e.target.value)}
                    placeholder="e.g. Daycare Monthly Fee"
                  />
                </Field>

                <Field label="Fee Type *" error={errors.feeType}>
                  <select className={inp(errors.feeType)} value={form.feeType} onChange={e => setF("feeType", e.target.value)}>
                    <option value="">Select fee type...</option>
                    {FEE_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </Field>

                <Field label="Billing Cycle">
                  <select className={inp()} value={form.billingCycle} onChange={e => setF("billingCycle", e.target.value)}>
                    {BILLING_CYCLES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>

                <Field label="Amount (₹) *" error={errors.amount} span2>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="0"
                      className={`${inp(errors.amount)} text-lg font-black`}
                      value={form.amount}
                      onChange={e => setF("amount", e.target.value)}
                      placeholder="0"
                    />
                    {form.amount && Number(form.amount) > 0 && (
                      <div className="bg-yd-charcoal rounded-xl px-4 py-2 flex-shrink-0 text-center min-w-[120px]">
                        <div className="text-[9px] text-white/50 font-bold uppercase tracking-wider mb-0.5">Preview</div>
                        <div className="text-base font-black text-white">{INR(form.amount)}</div>
                        <div className="text-[9px] text-white/40">{form.billingCycle}</div>
                      </div>
                    )}
                  </div>
                </Field>

                <Field label="Description" span2>
                  <textarea
                    rows={2}
                    className={`${inp()} resize-none`}
                    value={form.description}
                    onChange={e => setF("description", e.target.value)}
                    placeholder="Optional: describe when this fee applies..."
                  />
                </Field>

                {/* Applicable Classes */}
                <Field label="Applicable Classes" span2>
                  <div className="flex flex-wrap gap-2 mt-0.5">
                    {CLASSES.map(cls => {
                      const selected = form.applicableClasses.includes(cls);
                      return (
                        <button
                          key={cls}
                          type="button"
                          onClick={() => {
                            setF("applicableClasses", selected
                              ? form.applicableClasses.filter(c => c !== cls)
                              : [...form.applicableClasses, cls]);
                          }}
                          className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-all
                            ${selected
                              ? "bg-yd-yellow text-yd-black border-yd-yellow shadow-sm"
                              : "bg-white text-yd-text-2 border-yd-border hover:border-yd-yellow hover:bg-yd-yellow-soft"}`}>
                          {cls}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-yd-text-3 mt-1">Leave empty to apply to all classes.</p>
                </Field>

                {/* Status toggle */}
                <Field label="Status" span2>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setF("active", !form.active)}
                      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${form.active ? "bg-yd-success" : "bg-yd-border"}`}>
                      <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                        style={{ left: form.active ? "calc(100% - 18px)" : "2px" }} />
                    </button>
                    <span className="text-xs font-semibold text-yd-text">
                      {form.active ? "Active — visible when creating invoices" : "Inactive — hidden from invoice creation"}
                    </span>
                  </div>
                </Field>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 mt-8 pt-5 border-t border-yd-border">
                {isEdit && (
                  <button onClick={startCreate} className="btn btn-ghost">
                    Cancel
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn btn-primary btn-lg flex-1">
                  {saving
                    ? (isEdit ? "Saving..." : "Creating...")
                    : (isEdit ? "Save Changes" : "Create Template")}
                </button>
              </div>

              {/* Live preview card */}
              {form.templateName && form.feeType && Number(form.amount) > 0 && (
                <div className="mt-6 border border-yd-border rounded-xl p-4 bg-white shadow-yd-card">
                  <div className="yd-text-label mb-3">Card Preview</div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-yd-yellow-soft border border-yd-yellow flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-black text-yd-charcoal">FT</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-black text-yd-charcoal">{form.templateName}</div>
                      <div className="text-[10px] text-yd-text-3">{form.feeType}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-base font-black text-yd-charcoal">{INR(form.amount)}</div>
                      <div className={CYCLE_COLORS[form.billingCycle] || "badge badge-neutral"}>{form.billingCycle}</div>
                    </div>
                  </div>
                  {form.applicableClasses.length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {form.applicableClasses.map(c => (
                        <span key={c} className="badge badge-yellow">{c}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {confirmDel && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setConfirmDel(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-yd-border">
            <div className="w-12 h-12 rounded-2xl bg-yd-danger-soft border border-yd-danger-border flex items-center justify-center mx-auto mb-3">
              <span className="text-yd-danger font-black text-xl">!</span>
            </div>
            <h3 className="text-sm font-black text-yd-charcoal text-center mb-1">Delete Template?</h3>
            <p className="text-xs text-yd-text-2 text-center mb-4">
              Delete <strong>{confirmDel.templateName}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDel(null)} className="btn btn-ghost flex-1">Cancel</button>
              <button onClick={() => handleDelete(confirmDel)} className="btn btn-danger flex-1">Delete</button>
            </div>
          </div>
        </div>
      )}

      <Toasts toasts={toast.toasts} />
    </div>
  );
}
