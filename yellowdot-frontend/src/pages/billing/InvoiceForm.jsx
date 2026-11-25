/**
 * InvoiceForm.jsx — raise a one-off itemised invoice, as a page
 * ─────────────────────────────────────────────────────────────────────────────
 * /billing/invoices/new. The monthly run covers the recurring case; this is for
 * the one that is not — a field trip, a prorated first month, a correction.
 *
 * ── Why this is a page and not a dialog ───────────────────────────────────────
 * This is the biggest form in the module: it grows a row per charge, and a
 * child on tuition plus daycare plus transport already needs three before the
 * totals are visible. In a dialog that scrolled internally, so the running
 * total and the submit button were below the fold exactly when the invoice got
 * complicated enough to want checking. /certificates/issue and
 * /staff/employees/new are pages for the same reason.
 *
 * The line editor is the point of the screen rather than a detail of it: one
 * invoice, several charges, one total — which is the thing the whole module
 * exists to make possible.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import {
  PageShell, PageHeader, Button, Select, Input,
  FormSection, Field, FormGrid, LoadingPage, PageError, useToast,
} from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import billingService from "../../services/billingService";
import studentService from "../../services/studentService";
import {
  inr, currentPeriod, todayLocal, recentPeriods, FEE_TYPES,
} from "./billingMeta";

const BLANK_LINE = { planId: "", label: "", feeType: "tuition", amount: "" };

export default function InvoiceForm() {
  const navigate = useNavigate();
  const { canDo } = useAuth();
  const { show: toast } = useToast();
  const [searchParams] = useSearchParams();

  const canBill = canDo("billing", "create");

  const [plans,    setPlans]    = useState([]);
  const [students, setStudents] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");

  const [form, setForm] = useState({
    // Pre-selects the child when arrived at from a filtered invoice list.
    studentId:   searchParams.get("studentId") || "",
    period:      currentPeriod(),
    invoiceDate: todayLocal(),
    dueDate:     "",
    notes:       "",
    lines:       [{ ...BLANK_LINE }],
  });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [pl, stu] = await Promise.all([
        billingService.listPlans({ activeOnly: "true" }),
        studentService.getStudents({ status: "Active" }).catch(() => []),
      ]);
      if (pl?.success) setPlans(pl.plans || []);
      setStudents(stu || []);
    } catch (err) {
      setLoadError(err.response?.data?.error || err.message || "Could not load the form.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function setLine(index, patch) {
    setForm(f => ({ ...f, lines: f.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)) }));
  }

  /** Picking a plan fills the line from it; the amount stays editable. */
  function pickPlan(index, planId) {
    const plan = plans.find(p => p.planId === planId);
    setLine(index, plan
      ? { planId, label: plan.name, feeType: plan.feeType, amount: String(plan.amount) }
      : { planId: "", label: "", feeType: "tuition", amount: "" });
  }

  const total = useMemo(
    () => form.lines.reduce((t, l) => t + (Number(l.amount) || 0), 0),
    [form.lines],
  );

  const studentOptions = useMemo(
    () => students.map(s => ({
      value: s.studentId,
      label: `${s.studentName}${s.class ? ` — ${s.class}` : ""}`,
    })),
    [students],
  );

  const planOptions = useMemo(
    () => [
      { value: "", label: "Custom line (not from a plan)" },
      ...plans.map(p => ({ value: p.planId, label: `${p.name} — ${inr(p.amount)}` })),
    ],
    [plans],
  );

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await billingService.createInvoice({
        studentId:   form.studentId,
        period:      form.period,
        invoiceDate: form.invoiceDate,
        dueDate:     form.dueDate || undefined,
        notes:       form.notes,
        lines: form.lines.map(l => ({
          planId:  l.planId || undefined,
          label:   l.label,
          feeType: l.feeType,
          amount:  l.amount,
        })),
      });
      toast(`Invoice ${res.invoice.invoiceNumber} raised.`, "success");
      navigate(`/billing/invoices/${res.invoice.invoiceId}`);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not raise the invoice.");
      setSaving(false);   // keep the typed lines on screen
    }
  }

  if (loading) return <LoadingPage message="Loading…" />;

  if (!canBill) {
    return (
      <PageShell header={<PageHeader title="Raise an invoice" tag="Billing & Payments" />}>
        <PageError
          message="You do not have permission to raise invoices."
          onBack={() => navigate("/billing/invoices")}
        />
      </PageShell>
    );
  }

  if (loadError) {
    return (
      <PageShell header={<PageHeader title="Raise an invoice" tag="Billing & Payments" />}>
        <PageError message={loadError} onRetry={load} onBack={() => navigate("/billing/invoices")} />
      </PageShell>
    );
  }

  const valid = form.studentId && total > 0;

  return (
    <PageShell
      header={
        <PageHeader
          title="Raise an invoice"
          tag="Billing & Payments"
          subtitle="A one-off bill — the monthly run handles the recurring ones"
          backLabel="Invoices"
          onBack={() => navigate("/billing/invoices")}
        />
      }
    >
      <div className="yd-form-page">
        <FormSection title="Who and when">
          <FormGrid>
            <Field label="Child" required>
              <Select
                value={form.studentId}
                onChange={(e) => setForm(f => ({ ...f, studentId: e.target.value }))}
                options={studentOptions}
                placeholder="Choose a child…"
              />
            </Field>
            <Field label="Bill for">
              <Select
                value={form.period}
                onChange={(e) => setForm(f => ({ ...f, period: e.target.value }))}
                options={recentPeriods(12)}
              />
            </Field>
            <Field label="Invoice date">
              <Input
                type="date"
                value={form.invoiceDate}
                onChange={(e) => setForm(f => ({ ...f, invoiceDate: e.target.value }))}
              />
            </Field>
            <Field label="Due date" hint="Defaults to the end of the month">
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm(f => ({ ...f, dueDate: e.target.value }))}
              />
            </Field>
          </FormGrid>
        </FormSection>

        <FormSection
          title="What is being charged"
          description="One line per thing. Tuition, daycare and transport belong on one bill."
        >
          <div className="yd-invoice-line yd-invoice-line--head" aria-hidden="true">
            <span>From a fee plan</span>
            <span>Description</span>
            <span>Type</span>
            <span>Amount</span>
            <span />
          </div>

          {form.lines.map((line, i) => (
            <div key={i} className="yd-invoice-line">
              <Select
                aria-label={`Line ${i + 1} fee plan`}
                value={line.planId}
                onChange={(e) => pickPlan(i, e.target.value)}
                options={planOptions}
              />
              <Input
                aria-label={`Line ${i + 1} description`}
                placeholder="Description"
                value={line.label}
                onChange={(e) => setLine(i, { label: e.target.value })}
              />
              <Select
                aria-label={`Line ${i + 1} fee type`}
                value={line.feeType}
                onChange={(e) => setLine(i, { feeType: e.target.value })}
                options={FEE_TYPES}
              />
              <Input
                aria-label={`Line ${i + 1} amount`}
                type="number" min="0" step="0.01" placeholder="0.00"
                value={line.amount}
                onChange={(e) => setLine(i, { amount: e.target.value })}
              />
              <button
                type="button"
                className="yd-close-btn"
                aria-label={`Remove line ${i + 1}`}
                disabled={form.lines.length === 1}
                onClick={() => setForm(f => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }))}
              >
                <Trash2 size={13} strokeWidth={2} />
              </button>
            </div>
          ))}

          <div className="yd-invoice-line__footer">
            <Button
              variant="outline" size="sm"
              leftIcon={<Plus size={13} strokeWidth={2} />}
              disabled={form.lines.length >= 20}
              onClick={() => setForm(f => ({ ...f, lines: [...f.lines, { ...BLANK_LINE }] }))}
            >
              Add a line
            </Button>
            <div className="yd-invoice-line__total">
              Total <strong>{inr(total)}</strong>
            </div>
          </div>
        </FormSection>

        <FormSection title="Anything else" optional>
          <Field label="Note on the invoice" hint="Shown to the family">
            <Input
              value={form.notes}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Optional"
            />
          </Field>
        </FormSection>

        {error && <div className="yd-inline-error">{error}</div>}

        <div className="yd-form-page__actions">
          <Button variant="ghost" onClick={() => navigate("/billing/invoices")} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={saving} disabled={saving || !valid}>
            Raise invoice for {inr(total)}
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
