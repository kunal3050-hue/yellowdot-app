import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { api } from "../services/authService";

const get  = url      => api.get(url).then(r => r.data);
const post = (url, d) => api.post(url, d).then(r => r.data);

const INR = n => `₹${(Number(n) || 0).toLocaleString("en-IN")}`;

const BILLING_CYCLES = ["Monthly", "Quarterly", "Half-Yearly", "Annual", "One-Time"];
const FEE_TYPES = [
  "Tuition Fee", "Daycare Fees", "Playgroup Fees", "Nursery Fees",
  "Transport Fee", "Meal Plan", "Annual Charges", "Activity Fee",
  "Admission Fee", "Registration Fee", "Other",
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function inp(err) {
  return `yd-input${err ? " border-yd-danger bg-yd-danger-soft" : ""}`;
}

function Field({ label, error, children, hint }) {
  return (
    <div>
      <label className="yd-text-label block mb-1">{label}</label>
      {children}
      {hint  && !error && <p className="text-[10px] text-yd-text-3 mt-0.5">{hint}</p>}
      {error && <p className="text-[10px] text-yd-danger mt-0.5">{error}</p>}
    </div>
  );
}

function StudentPicker({ students, value, onChange, error }) {
  const [query, setQuery] = useState(value?.name || "");
  const [open, setOpen]   = useState(false);
  const ref               = useRef(null);

  useEffect(() => {
    if (value?.name && query !== value.name) setQuery(value.name);
  }, [value?.name]);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return students.slice(0, 30);
    return students
      .filter(s => s.Student_Name?.toLowerCase().includes(q) || s.Student_ID?.toLowerCase().includes(q))
      .slice(0, 20);
  }, [students, query]);

  function select(s) {
    onChange({
      id:             s.Student_ID,
      name:           s.Student_Name,
      class:          s.Class,
      fatherWhatsApp: s.Father_WhatsApp,
      motherWhatsApp: s.Mother_WhatsApp,
    });
    setQuery(s.Student_Name);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <input
        className={`${inp(error)} text-sm`}
        placeholder="Search by name or student ID..."
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); onChange(null); }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-yd-border rounded-xl shadow-2xl z-50 max-h-52 overflow-y-auto">
          {filtered.map(s => (
            <button
              key={s.Student_ID}
              type="button"
              onClick={() => select(s)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-yd-yellow-pale text-left transition-colors">
              <div className="w-8 h-8 rounded-lg bg-yd-yellow-soft flex items-center justify-center text-xs font-black text-yd-navy flex-shrink-0">
                {s.Student_Name?.[0] || "?"}
              </div>
              <div>
                <div className="text-sm font-semibold text-yd-navy">{s.Student_Name}</div>
                <div className="text-[10px] text-yd-text-3">{s.Class} &middot; {s.Student_ID}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NewInvoice() {
  const navigate = useNavigate();

  const [students,  setStudents]  = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [errors,    setErrors]    = useState({});
  const [saved,     setSaved]     = useState(null); // holds created invoice

  const [student, setStudent] = useState(null);
  const [selectedTpl, setSelectedTpl] = useState(null);
  const [form, setForm] = useState({
    feeType:      "",
    billingCycle: "Monthly",
    durationFrom: "",
    durationTo:   "",
    invoiceDate:  todayISO(),
    dueDate:      "",
    amount:       "",
    gst:          "0",
    discount:     "0",
    notes:        "",
  });

  const setF = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: "" }));
  };

  useEffect(() => {
    async function load() {
      try {
        const [stuRes, tplRes] = await Promise.allSettled([get("/students"), get("/api/fee-templates")]);
        if (stuRes.status === "fulfilled") setStudents(stuRes.value || []);
        if (tplRes.status === "fulfilled" && tplRes.value.success)
          setTemplates(tplRes.value.templates || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function applyTemplate(tpl) {
    setSelectedTpl(tpl);
    setF("feeType",      tpl.feeType);
    setF("billingCycle", tpl.billingCycle);
    setF("amount",       String(tpl.amount));
    setErrors({});
  }

  function clearTemplate() {
    setSelectedTpl(null);
  }

  const amount      = Number(form.amount)   || 0;
  const gst         = Number(form.gst)      || 0;
  const discount    = Number(form.discount) || 0;
  const totalAmount = amount + gst - discount;

  function validate() {
    const e = {};
    if (!student)                                 e.student     = "Select a student.";
    if (!form.feeType)                            e.feeType     = "Required.";
    if (!form.amount || Number(form.amount) <= 0) e.amount      = "Enter a valid amount.";
    if (!form.invoiceDate)                        e.invoiceDate = "Required.";
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await post("/api/invoices", {
        studentId:      student.id,
        studentName:    student.name,
        class:          student.class,
        fatherWhatsApp: student.fatherWhatsApp,
        motherWhatsApp: student.motherWhatsApp,
        feeType:        form.feeType,
        billingCycle:   form.billingCycle,
        durationFrom:   form.durationFrom,
        durationTo:     form.durationTo,
        invoiceDate:    form.invoiceDate,
        dueDate:        form.dueDate,
        amount:         Number(form.amount),
        gst:            Number(form.gst)      || 0,
        discount:       Number(form.discount) || 0,
        notes:          form.notes,
      });
      if (!res.success) throw new Error(res.error || "Failed to create invoice.");
      setSaved(res.invoice || { invoiceNumber: "Created" });
    } catch (e) {
      setErrors(prev => ({ ...prev, _submit: e.message }));
    } finally {
      setSaving(false);
    }
  }

  // Success screen
  if (saved) {
    return (
      <div className="flex h-screen overflow-hidden bg-yd-bg">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl border border-yd-border-light p-10 max-w-md w-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-yd-success-soft flex items-center justify-center mx-auto mb-4 border border-yd-success-border">
              <span className="text-2xl font-black text-yd-success">✓</span>
            </div>
            <h2 className="text-xl font-black text-yd-charcoal mb-1">Invoice Created!</h2>
            <p className="text-sm text-yd-text-2 mb-1">
              {saved.invoiceNumber && <span className="font-mono font-bold">{saved.invoiceNumber}</span>}
            </p>
            <p className="text-xs text-yd-text-3 mb-6">
              Total: <span className="font-black text-yd-navy">{INR(totalAmount)}</span> for {student?.name}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => navigate("/invoice")}
                className="btn btn-ghost flex-1">
                Back to Invoices
              </button>
              <button
                onClick={() => {
                  setSaved(null);
                  setStudent(null);
                  setSelectedTpl(null);
                  setForm({ feeType: "", billingCycle: "Monthly", durationFrom: "", durationTo: "", invoiceDate: todayISO(), dueDate: "", amount: "", gst: "0", discount: "0", notes: "" });
                  setErrors({});
                }}
                className="btn btn-dark flex-1">
                + Another Invoice
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-yd-bg">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Page header */}
        <div className="flex-shrink-0 bg-white border-b border-yd-border-light px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/invoice")}
              className="w-8 h-8 rounded-lg bg-yd-bg border border-yd-border flex items-center justify-center text-yd-text-2 hover:text-yd-navy hover:border-yd-navy hover:bg-yd-yellow-pale transition-colors text-sm font-bold">
              &larr;
            </button>
            <div>
              <h1 className="text-[15px] font-black text-yd-charcoal leading-none">New Invoice</h1>
              <p className="text-[10px] text-yd-text-3 mt-0.5">Create a fee invoice for a student</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {errors._submit && (
              <p className="text-xs text-yd-danger font-semibold">{errors._submit}</p>
            )}
            <button onClick={() => navigate("/invoice")} className="btn btn-ghost btn-sm">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={saving} className="btn btn-dark btn-sm">
              {saving ? "Creating..." : "Create Invoice"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[900px] mx-auto px-6 py-6 grid grid-cols-[1fr_340px] gap-6">

            {/* Left column — main form */}
            <div className="space-y-5">

              {/* Student section */}
              <div className="bg-white rounded-2xl border border-yd-border-light p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-full bg-yd-yellow flex items-center justify-center flex-shrink-0">
                    <span className="text-yd-black font-black text-[10px]">1</span>
                  </div>
                  <h3 className="text-sm font-black text-yd-charcoal">Select Student</h3>
                </div>

                {student ? (
                  <div className="flex items-center gap-3 bg-yd-yellow-pale border border-yd-yellow rounded-xl px-4 py-3">
                    <div className="w-10 h-10 rounded-xl bg-yd-yellow flex items-center justify-center text-yd-navy font-black text-sm flex-shrink-0">
                      {student.name[0]}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-black text-yd-navy">{student.name}</div>
                      <div className="text-[10px] text-yd-text-2">{student.class} &middot; {student.id}</div>
                    </div>
                    <button
                      onClick={() => { setStudent(null); setErrors(e => ({ ...e, student: "" })); }}
                      className="text-[10px] text-yd-text-3 hover:text-yd-danger transition-colors font-semibold">
                      Change
                    </button>
                  </div>
                ) : (
                  <StudentPicker
                    students={students}
                    value={student}
                    onChange={s => { setStudent(s); setErrors(e => ({ ...e, student: "" })); }}
                    error={errors.student}
                  />
                )}
                {errors.student && <p className="text-[10px] text-yd-danger mt-1">{errors.student}</p>}
              </div>

              {/* Fee details section */}
              <div className="bg-white rounded-2xl border border-yd-border-light p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-full bg-yd-yellow flex items-center justify-center flex-shrink-0">
                    <span className="text-yd-black font-black text-[10px]">2</span>
                  </div>
                  <h3 className="text-sm font-black text-yd-charcoal">Fee Details</h3>
                </div>

                {selectedTpl && (
                  <div className="flex items-center gap-2 bg-yd-yellow-soft border border-yd-yellow rounded-xl px-3 py-2 mb-4">
                    <span className="text-[10px] font-bold text-yd-navy">Template: {selectedTpl.templateName}</span>
                    <button onClick={clearTemplate} className="ml-auto text-[10px] text-yd-text-3 hover:text-yd-danger font-semibold transition-colors">Clear</button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Fee Type *" error={errors.feeType}>
                    <select value={form.feeType} onChange={e => setF("feeType", e.target.value)} className={inp(errors.feeType)}>
                      <option value="">Select fee type...</option>
                      {FEE_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </Field>

                  <Field label="Billing Cycle">
                    <select value={form.billingCycle} onChange={e => setF("billingCycle", e.target.value)} className={inp()}>
                      {BILLING_CYCLES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>

                  <Field label="Duration From">
                    <input type="date" value={form.durationFrom} onChange={e => setF("durationFrom", e.target.value)} className={inp()} />
                  </Field>

                  <Field label="Duration To">
                    <input type="date" value={form.durationTo} onChange={e => setF("durationTo", e.target.value)} className={inp()} />
                  </Field>

                  <Field label="Invoice Date *" error={errors.invoiceDate}>
                    <input type="date" value={form.invoiceDate} onChange={e => setF("invoiceDate", e.target.value)} className={inp(errors.invoiceDate)} />
                  </Field>

                  <Field label="Due Date">
                    <input type="date" value={form.dueDate} onChange={e => setF("dueDate", e.target.value)} className={inp()}
                      hint="Leave blank if no due date" />
                  </Field>
                </div>
              </div>

              {/* Amount section */}
              <div className="bg-white rounded-2xl border border-yd-border-light p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-full bg-yd-yellow flex items-center justify-center flex-shrink-0">
                    <span className="text-yd-black font-black text-[10px]">3</span>
                  </div>
                  <h3 className="text-sm font-black text-yd-charcoal">Amount</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <Field label="Base Amount (₹) *" error={errors.amount}>
                    <input type="number" min="0" value={form.amount}
                      onChange={e => setF("amount", e.target.value)}
                      className={`${inp(errors.amount)} text-base font-bold`}
                      placeholder="0" />
                  </Field>
                  <Field label="GST (₹)">
                    <input type="number" min="0" value={form.gst}
                      onChange={e => setF("gst", e.target.value)}
                      className={inp()} placeholder="0" />
                  </Field>
                  <Field label="Discount (₹)">
                    <input type="number" min="0" value={form.discount}
                      onChange={e => setF("discount", e.target.value)}
                      className={inp()} placeholder="0" />
                  </Field>
                </div>

                {/* Breakdown row */}
                <div className="flex items-center gap-2 text-xs text-yd-text-2 flex-wrap">
                  <span className="font-semibold text-yd-text">{INR(amount)}</span>
                  {gst > 0   && <><span className="text-yd-text-3">+</span><span>{INR(gst)} GST</span></>}
                  {discount > 0 && <><span className="text-yd-text-3">-</span><span className="text-yd-success">{INR(discount)} discount</span></>}
                  <span className="text-yd-text-3">=</span>
                  <span className="font-black text-yd-charcoal text-base">{INR(totalAmount)}</span>
                </div>
              </div>

              {/* Notes */}
              <div className="bg-white rounded-2xl border border-yd-border-light p-5">
                <Field label="Notes (optional)">
                  <textarea rows={3} value={form.notes} onChange={e => setF("notes", e.target.value)}
                    className={`${inp()} resize-none`} placeholder="Any additional notes for this invoice..." />
                </Field>
              </div>
            </div>

            {/* Right column — template picker + summary */}
            <div className="space-y-4">

              {/* Template picker */}
              <div className="bg-white rounded-2xl border border-yd-border-light overflow-hidden">
                <div className="px-4 py-3 border-b border-yd-border-light flex items-center justify-between">
                  <h3 className="text-xs font-black text-yd-charcoal uppercase tracking-wider">Fee Templates</h3>
                  <button
                    onClick={() => navigate("/invoice/templates")}
                    className="text-[10px] text-yd-text-3 hover:text-yd-navy transition-colors font-semibold">
                    Manage &rarr;
                  </button>
                </div>
                {loading ? (
                  <div className="flex items-center justify-center h-20">
                    <div className="yd-spinner" />
                  </div>
                ) : templates.filter(t => t.active !== false).length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <div className="text-[10px] text-yd-text-3 mb-2">No active templates yet.</div>
                    <button onClick={() => navigate("/invoice/templates")} className="btn btn-ghost btn-xs">
                      Create Template
                    </button>
                  </div>
                ) : (
                  <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                    {templates.filter(t => t.active !== false).map(tpl => {
                      const active = selectedTpl?.templateId === tpl.templateId;
                      return (
                        <button
                          key={tpl.templateId}
                          onClick={() => applyTemplate(tpl)}
                          className={`w-full flex items-start gap-2 p-3 rounded-xl border text-left transition-all
                            ${active
                              ? "border-yd-yellow bg-yd-yellow-soft shadow-sm"
                              : "border-yd-border-light hover:border-yd-yellow hover:bg-yd-yellow-pale"}`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${active ? "bg-yd-yellow" : "bg-yd-yellow-soft"}`}>
                            <span className="text-[9px] font-black text-yd-black">FT</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-[11px] font-bold truncate ${active ? "text-yd-charcoal" : "text-yd-charcoal"}`}>{tpl.templateName}</div>
                            <div className={`text-[9px] ${active ? "text-yd-text-2" : "text-yd-text-3"}`}>{tpl.feeType}</div>
                          </div>
                          <div className={`text-xs font-black flex-shrink-0 ${active ? "text-yd-charcoal" : "text-yd-charcoal"}`}>{INR(tpl.amount)}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Invoice summary */}
              <div className="bg-yd-navy rounded-2xl p-5">
                <h3 className="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-4">Invoice Summary</h3>
                <div className="space-y-2 text-xs mb-4">
                  <div className="flex justify-between">
                    <span className="text-white/60">Student</span>
                    <span className="font-semibold text-white truncate max-w-[140px] text-right">{student?.name || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Class</span>
                    <span className="font-semibold text-white">{student?.class || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Fee Type</span>
                    <span className="font-semibold text-white truncate max-w-[140px] text-right">{form.feeType || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Billing</span>
                    <span className="font-semibold text-white">{form.billingCycle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Invoice Date</span>
                    <span className="font-semibold text-white">{form.invoiceDate || "—"}</span>
                  </div>
                  {form.dueDate && (
                    <div className="flex justify-between">
                      <span className="text-white/60">Due Date</span>
                      <span className="font-semibold text-white">{form.dueDate}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-white/10 pt-3 space-y-1 text-xs">
                  <div className="flex justify-between text-white/60">
                    <span>Base</span><span>{INR(amount)}</span>
                  </div>
                  {gst > 0 && (
                    <div className="flex justify-between text-white/60">
                      <span>GST</span><span>+{INR(gst)}</span>
                    </div>
                  )}
                  {discount > 0 && (
                    <div className="flex justify-between text-white/60">
                      <span>Discount</span><span className="text-yd-success-soft">-{INR(discount)}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-center">
                  <span className="text-white/60 text-xs">Total</span>
                  <span className="text-2xl font-black text-yd-yellow">{INR(totalAmount)}</span>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="w-full mt-4 btn btn-primary btn-lg">
                  {saving ? "Creating..." : "Create Invoice"}
                </button>
                {errors._submit && (
                  <p className="text-[10px] text-yd-danger-soft mt-2 text-center">{errors._submit}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
