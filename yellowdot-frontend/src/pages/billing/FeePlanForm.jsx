/**
 * FeePlanForm.jsx — add or edit a fee plan, as a page
 * ─────────────────────────────────────────────────────────────────────────────
 * Serves both /billing/plans/new and /billing/plans/:planId/edit. One component
 * rather than two, because the only differences are where the initial values
 * come from and which verb the save button uses — a second file would be the
 * same form twice, and the two copies would drift.
 *
 * ── Why this is a page and not a dialog ───────────────────────────────────────
 * It started as a Modal, which was the wrong call: the form has two sections
 * and a four-field grid, so it overflowed and scrolled inside its own dialog,
 * hiding the save button until you scrolled. The app already puts forms this
 * size on their own route — /certificates/issue and /staff/employees/new are
 * both pages — so the dialog was the odd one out rather than the norm.
 *
 * Short confirmations elsewhere in Billing (void, credit note, reverse a
 * payment) stay as dialogs on purpose. They are one or two fields attached to
 * a decision you have already made on the screen behind them, and sending
 * someone to a different route to type a reason would lose that context.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { X } from "lucide-react";
import {
  PageShell, PageHeader, Button, Select, Input,
  FormSection, Field, FormGrid, LoadingPage, PageError, useToast,
} from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import billingService from "../../services/billingService";
import studentService from "../../services/studentService";
import { FEE_TYPES, CADENCES, inr, todayLocal } from "./billingMeta";

const BLANK = {
  name: "", feeType: "tuition", amount: "", cadence: "monthly",
  classes: "", studentIds: [], effectiveFrom: todayLocal(), effectiveTo: "", notes: "",
};

export default function FeePlanForm() {
  const { planId } = useParams();
  const navigate   = useNavigate();
  const { canDo }  = useAuth();
  const { show: toast } = useToast();

  const isEdit = Boolean(planId);
  const canEdit = canDo("billing", "edit");

  const [form,     setForm]     = useState(isEdit ? null : { ...BLANK });
  const [students, setStudents] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      // Children are needed either way, to offer the picker.
      const [stu, res] = await Promise.all([
        studentService.getStudents({ status: "Active" }).catch(() => []),
        // listPlans rather than a by-id fetch: the API has no GET /plans/:id,
        // and adding one for a screen always reached from the list would be a
        // route nothing else needs.
        isEdit ? billingService.listPlans() : Promise.resolve(null),
      ]);
      setStudents(stu || []);

      if (!isEdit) return;
      const plan = (res?.plans || []).find(p => p.planId === planId);
      if (!plan) { setLoadError("That fee plan could not be found."); return; }
      setForm({
        name:          plan.name,
        feeType:       plan.feeType,
        amount:        String(plan.amount),
        cadence:       plan.cadence,
        classes:       (plan.classes || []).join(", "),
        studentIds:    plan.studentIds || [],
        effectiveFrom: plan.effectiveFrom || "",
        effectiveTo:   plan.effectiveTo || "",
        notes:         plan.notes || "",
      });
    } catch (err) {
      setLoadError(err.response?.data?.error || err.message || "Could not load the fee plan.");
    } finally {
      setLoading(false);
    }
  }, [isEdit, planId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const set = (patch) => setForm(f => ({ ...f, ...patch }));

  // ── Derived values for the child picker ────────────────────────────────────
  // Above the early returns below: hooks must run in the same order on every
  // render, and `form` is null while an edit is still loading.
  // Read straight off `form` rather than defaulted into a new array: `?? []`
  // would mint a fresh array every render, and the React Compiler rejects a
  // memo whose written dependencies do not match the ones it infers.
  const picked = form?.studentIds;
  const namedChildren = (picked?.length ?? 0) > 0;

  const studentById = useMemo(
    () => Object.fromEntries(students.map(s => [s.studentId, s])),
    [students],
  );

  const unpicked = useMemo(
    () => students
      .filter(s => !(picked || []).includes(s.studentId))
      .sort((a, b) => (a.studentName || "").localeCompare(b.studentName || "")),
    [students, picked],
  );

  const addChild = (studentId) => {
    if (!studentId) return;
    setForm(f => ({ ...f, studentIds: [...f.studentIds, studentId] }));
  };
  const removeChild = (studentId) =>
    setForm(f => ({ ...f, studentIds: f.studentIds.filter(id => id !== studentId) }));

  async function save() {
    setSaving(true);
    setError("");
    const payload = {
      name:          form.name,
      feeType:       form.feeType,
      amount:        form.amount,
      cadence:       form.cadence,
      classes:       form.classes.split(",").map(c => c.trim()).filter(Boolean),
      studentIds:    form.studentIds,
      effectiveFrom: form.effectiveFrom,
      effectiveTo:   form.effectiveTo,
      notes:         form.notes,
    };
    try {
      if (isEdit) {
        await billingService.updatePlan(planId, payload);
        toast(`"${payload.name}" updated. Invoices already raised are unchanged.`, "success");
      } else {
        await billingService.createPlan(payload);
        toast(`"${payload.name}" added to the catalogue.`, "success");
      }
      navigate("/billing/plans");
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not save the plan.");
      setSaving(false);   // stay on the page so the typed values survive the error
    }
  }

  if (loading) return <LoadingPage message="Loading the fee plan…" />;

  if (loadError || !form) {
    return (
      <PageShell header={<PageHeader title="Fee plan" tag="Billing & Payments" />}>
        <PageError
          message={loadError || "That fee plan could not be found."}
          onRetry={isEdit ? load : undefined}
          onBack={() => navigate("/billing/plans")}
        />
      </PageShell>
    );
  }

  if (!canEdit) {
    return (
      <PageShell header={<PageHeader title="Fee plan" tag="Billing & Payments" />}>
        <PageError
          message="You do not have permission to change the fee catalogue."
          onBack={() => navigate("/billing/plans")}
        />
      </PageShell>
    );
  }

  // A start date is required by the API on create. Edit leaves it alone, so a
  // plan written before that rule can still be edited without inventing one.
  const valid = form.name.trim() && Number(form.amount) > 0 && (isEdit || form.effectiveFrom);

  return (
    <PageShell
      header={
        <PageHeader
          title={isEdit ? "Edit fee plan" : "Add a fee plan"}
          tag="Billing & Payments"
          subtitle={isEdit ? form.name : "What the school charges for"}
          backLabel="Fee Plans"
          onBack={() => navigate("/billing/plans")}
        />
      }
    >
      <div className="yd-form-page">
        <FormSection title="What is charged">
          <FormGrid>
            <Field label="Name" required hint="What a parent will read on the bill">
              <Input
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="Monthly tuition"
                maxLength={80}
                autoFocus
              />
            </Field>
            <Field label="Amount" required>
              <Input
                type="number" min="0" step="0.01"
                value={form.amount}
                onChange={(e) => set({ amount: e.target.value })}
                placeholder="0.00"
              />
            </Field>
            <Field label="Type" required>
              <Select
                value={form.feeType}
                onChange={(e) => set({ feeType: e.target.value })}
                options={FEE_TYPES}
              />
            </Field>
            <Field label="How often" required hint="Only monthly plans are picked up by the monthly run">
              <Select
                value={form.cadence}
                onChange={(e) => set({ cadence: e.target.value })}
                options={CADENCES}
              />
            </Field>
          </FormGrid>
        </FormSection>

        <FormSection
          title="Who it applies to"
          description="Leave both blank to charge every child."
        >
          <Field
            label="Classes"
            hint="Comma separated — Playgroup, Nursery"
          >
            <Input
              value={form.classes}
              onChange={(e) => set({ classes: e.target.value })}
              placeholder="Playgroup, Nursery"
              disabled={namedChildren}
            />
          </Field>

          <Field
            label="Or specific children"
            hint={namedChildren
              ? "This plan applies to exactly these children — the classes above are ignored, and it follows them if they change class."
              : "For a negotiated rate, a sibling arrangement, or one child on transport."}
          >
            <Select
              value=""
              onChange={(e) => addChild(e.target.value)}
              options={unpicked.map(s => ({
                value: s.studentId,
                label: `${s.studentName}${s.class ? ` — ${s.class}` : ""}`,
              }))}
              placeholder={unpicked.length ? "Add a child…" : "No other children to add"}
              disabled={unpicked.length === 0}
            />
          </Field>

          {namedChildren && (
            <ul className="yd-chip-list">
              {(picked || []).map(id => (
                <li key={id} className="yd-chip">
                  <span>
                    {studentById[id]?.studentName || id}
                    {studentById[id]?.class ? ` · ${studentById[id].class}` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeChild(id)}
                    aria-label={`Remove ${studentById[id]?.studentName || id}`}
                  >
                    <X size={12} strokeWidth={2.5} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <FormGrid>
            <Field label="In effect from" required={!isEdit} hint="When this fee starts being charged">
              <Input
                type="date"
                value={form.effectiveFrom}
                onChange={(e) => set({ effectiveFrom: e.target.value })}
              />
            </Field>
            <Field label="Until" hint="Optional — leave blank for an open-ended plan">
              <Input
                type="date"
                min={form.effectiveFrom || undefined}
                value={form.effectiveTo}
                onChange={(e) => set({ effectiveTo: e.target.value })}
              />
            </Field>
          </FormGrid>
        </FormSection>

        <FormSection title="Anything else" optional>
          <Field label="Note for staff" hint="Not shown to families">
            <Input value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </FormSection>

        {isEdit && (
          <p className="yd-form-page__note">
            Invoices already raised from this plan keep the amount they were raised at.
            A change here applies to the next billing run.
          </p>
        )}

        {error && <div className="yd-inline-error">{error}</div>}

        <div className="yd-form-page__actions">
          <Button variant="ghost" onClick={() => navigate("/billing/plans")} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={saving} disabled={saving || !valid}>
            {isEdit ? "Save changes" : `Add the plan${Number(form.amount) > 0 ? ` — ${inr(form.amount)}` : ""}`}
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
