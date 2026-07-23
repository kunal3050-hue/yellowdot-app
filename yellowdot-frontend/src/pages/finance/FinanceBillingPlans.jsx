/**
 * FinanceBillingPlans.jsx — Billing Plans screen (school-wide browse)
 * ─────────────────────────────────────────────────────────────────────────
 * Design System v2 / Platform Layout Standard: PageShell -> PageHeader ->
 * FinanceSubNav -> DataTable (own toolbar handles search/filter/sort/
 * export/pagination — no separate FilterBar). Local error/success banners
 * (not useToast) to match the already-implemented sibling Finance screens
 * in this folder (FinanceLedger.jsx, FinanceInvoices.jsx) — neither of
 * them renders under a confirmed <ToastProvider> either, so this keeps the
 * whole module internally consistent rather than mixing feedback patterns
 * screen-to-screen.
 *
 * Row actions map directly to billingPlanService.js's state machine:
 * draft/paused -> active (Activate), active -> paused (Pause), any -> ended
 * (End, terminal, behind a confirm Modal), and Generate Invoice (active only,
 * delegates to the Manual Billing Engine for one period).
 */
import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import financeApi from "../../services/financeApi";
import FinanceSubNav from "./components/FinanceSubNav";
import {
  PageShell, PageHeader, DataTable, StatusBadge, Button, Drawer, Modal,
  Input, Select, Field, FormGrid,
} from "../../components/ui";

const CADENCE_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "termly",  label: "Termly" },
  { value: "oneTime", label: "One Time" },
];

const JOINING_POLICY_OPTIONS = [
  { value: "fullMonth",  label: "Full Month" },
  { value: "prorated",   label: "Prorated" },
  { value: "nextCycle",  label: "Next Cycle" },
];

const STATUS_FILTER_OPTIONS = [
  { value: "draft",  label: "Draft" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "ended",  label: "Ended" },
];

// StatusBadge's STATUS_LABEL_GROUP dictionary registers Billing Plan
// statuses in Title Case ("Draft"/"Active"/"Paused"/"Ended" — see the
// "Finance Platform — Billing Plan status" block in StatusBadge.jsx), but
// the backend contract returns lowercase wire values ("draft"|"active"|
// "paused"|"ended"). Passing the raw lowercase value straight through would
// still resolve for "draft"/"active" (both also exist lowercase, reused
// from the Staff employment-status entries, same colors) but would MISS
// the dictionary entirely for "paused"/"ended" (only the capitalized forms
// exist), silently falling back to a neutral grey pill with the raw
// lowercase string as its label. This map normalizes to the exact casing
// the dictionary actually keys on for all four values.
const STATUS_DISPLAY = { draft: "Draft", active: "Active", paused: "Paused", ended: "Ended" };

const CADENCE_LABEL = Object.fromEntries(CADENCE_OPTIONS.map(o => [o.value, o.label]));
const JOINING_POLICY_LABEL = Object.fromEntries(JOINING_POLICY_OPTIONS.map(o => [o.value, o.label]));

function formatDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("en-IN");
}

function currentMonthBounds() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return { periodStart: `${y}-${m}-01`, periodEnd: `${y}-${m}-${String(lastDay).padStart(2, "0")}` };
}

const EMPTY_FORM = {
  studentLedgerId: "", feeTemplateId: "", cadence: "monthly",
  joiningDatePolicy: "fullMonth", startDate: "", endDate: "", notes: "",
};

export default function FinanceBillingPlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Row-level busy indicator for Activate/Pause (kept separate from the
  // page-level `loading` so only the acted-on row's buttons show a spinner).
  const [actioningPlanId, setActioningPlanId] = useState("");

  // Create Billing Plan drawer
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // End confirmation modal
  const [endTarget, setEndTarget] = useState(null);
  const [ending, setEnding] = useState(false);

  // Generate Invoice modal
  const [invoiceTarget, setInvoiceTarget] = useState(null);
  const [invoiceForm, setInvoiceForm] = useState(currentMonthBounds());
  const [invoiceError, setInvoiceError] = useState("");
  const [generating, setGenerating] = useState(false);

  const flashSuccess = useCallback((msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 4000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await financeApi.billingPlans.list();
      setPlans(res?.plans || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to load billing plans.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError("");
    setCreateOpen(true);
  }

  async function submitCreate(e) {
    e?.preventDefault();
    setFormError("");
    if (!form.studentLedgerId.trim()) { setFormError("Student ID is required."); return; }
    if (!form.feeTemplateId.trim())   { setFormError("Fee template ID is required."); return; }
    if (!form.startDate)              { setFormError("Start date is required."); return; }
    if (form.endDate && form.endDate < form.startDate) { setFormError("End date must be on or after the start date."); return; }

    setSaving(true);
    try {
      const payload = {
        studentLedgerId:   form.studentLedgerId.trim(),
        feeTemplateId:     form.feeTemplateId.trim(),
        cadence:           form.cadence,
        joiningDatePolicy: form.joiningDatePolicy,
        startDate:         form.startDate,
      };
      if (form.endDate)      payload.endDate = form.endDate;
      if (form.notes.trim()) payload.notes = form.notes.trim();

      await financeApi.billingPlans.create(payload);
      setCreateOpen(false);
      flashSuccess("Billing plan created (draft).");
      await load();
    } catch (err) {
      setFormError(err.response?.data?.error || err.message || "Failed to create billing plan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetStatus(plan, status, successMsg) {
    setActioningPlanId(plan.planId);
    setError("");
    try {
      await financeApi.billingPlans.setStatus(plan.planId, status);
      flashSuccess(successMsg);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to update billing plan.");
    } finally {
      setActioningPlanId("");
    }
  }

  async function confirmEnd() {
    if (!endTarget) return;
    setEnding(true);
    setError("");
    try {
      await financeApi.billingPlans.setStatus(endTarget.planId, "ended");
      flashSuccess("Billing plan ended.");
      setEndTarget(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to end billing plan.");
      setEndTarget(null);
    } finally {
      setEnding(false);
    }
  }

  function openGenerateInvoice(plan) {
    setInvoiceForm(currentMonthBounds());
    setInvoiceError("");
    setInvoiceTarget(plan);
  }

  async function confirmGenerateInvoice() {
    if (!invoiceTarget) return;
    if (!invoiceForm.periodStart || !invoiceForm.periodEnd) { setInvoiceError("Both period start and end are required."); return; }
    if (invoiceForm.periodEnd < invoiceForm.periodStart)     { setInvoiceError("Period end must be on or after period start."); return; }

    setGenerating(true);
    setInvoiceError("");
    try {
      await financeApi.billingPlans.generateInvoice(invoiceTarget.planId, invoiceForm.periodStart, invoiceForm.periodEnd);
      setInvoiceTarget(null);
      flashSuccess("Invoice generated.");
      await load();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Failed to generate invoice.";
      // §14 of the design doc: REQUIRES_APPROVAL (HTTP 409 here — the
      // backend never serializes its internal err.code to JSON, only the
      // message and status) gets meaningful copy instead of the raw error.
      setInvoiceError(err.response?.status === 409 ? `This invoice needs manager approval before it can be generated. (${msg})` : msg);
    } finally {
      setGenerating(false);
    }
  }

  const columns = [
    { key: "studentLedgerId", label: "Student", sortable: true, filterable: true, width: 130 },
    { key: "feeTemplateId",   label: "Fee Template", sortable: true, filterable: true, width: 140 },
    { key: "cadence", label: "Cadence", sortable: true, width: 110,
      render: (v) => CADENCE_LABEL[v] || v || "—" },
    { key: "joiningDatePolicy", label: "Joining Policy", sortable: true, width: 130,
      render: (v) => JOINING_POLICY_LABEL[v] || v || "—" },
    { key: "status", label: "Status", sortable: true, filterable: true,
      filterType: "select", filterOptions: STATUS_FILTER_OPTIONS, width: 110,
      render: (v) => <StatusBadge status={STATUS_DISPLAY[v] || v} /> },
    { key: "startDate", label: "Start Date", sortable: true, width: 120, render: formatDate },
    { key: "endDate",   label: "End Date",   sortable: true, width: 120, render: formatDate },
    {
      key: "planId", label: "", type: "actions", sortable: false, width: 340,
      actions: (row) => {
        const busy = actioningPlanId === row.planId;
        return (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(row.status === "draft" || row.status === "paused") && (
              <Button variant="outline" size="xs" loading={busy} onClick={() => handleSetStatus(row, "active", "Billing plan activated.")}>
                Activate
              </Button>
            )}
            {row.status === "active" && (
              <Button variant="outline" size="xs" loading={busy} onClick={() => handleSetStatus(row, "paused", "Billing plan paused.")}>
                Pause
              </Button>
            )}
            {row.status === "active" && (
              <Button variant="outline" size="xs" onClick={() => openGenerateInvoice(row)}>
                Generate Invoice
              </Button>
            )}
            {row.status !== "ended" && (
              <Button variant="danger" size="xs" onClick={() => setEndTarget(row)}>
                End
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <PageShell
      header={
        <PageHeader
          title="Billing Plans"
          tag="Finance Platform"
          subtitle={`${plans.length} billing plan${plans.length === 1 ? "" : "s"}`}
          primaryAction={{ label: "Create Billing Plan", icon: <Plus size={14} strokeWidth={2} />, onClick: openCreate }}
        />
      }
    >
      <FinanceSubNav active="billing-plans" />

      {error && (
        <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ background: "var(--yd-success-soft)", color: "var(--yd-success)", border: "1px solid var(--yd-success-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          {success}
        </div>
      )}

      <DataTable
        tableId="finance-billing-plans"
        columns={columns}
        data={plans}
        loading={loading}
        entityLabel="billing plans"
        searchPlaceholder="Search student ID, fee template…"
        exportFilename="finance-billing-plans"
        exportTitle="Billing Plans"
        exportFormats={["csv", "excel", "print"]}
        empty={{
          title: "No billing plans yet",
          description: "Create one to start generating invoices for a student.",
          action: { label: "Create Billing Plan", onClick: openCreate },
        }}
      />

      {/* Create Billing Plan */}
      <Drawer
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Billing Plan"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={submitCreate}>Create</Button>
          </>
        }
      >
        <form onSubmit={submitCreate}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {formError && (
              <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
                {formError}
              </div>
            )}

            <Input
              label="Student ID" required
              placeholder="e.g. YD019"
              value={form.studentLedgerId}
              onChange={(e) => set("studentLedgerId", e.target.value)}
              hint="This is the student's ledger ID — the Finance Platform's Student Ledger is 1:1 with the student."
            />
            <Input
              label="Fee Template ID" required
              placeholder="e.g. FTP000001"
              value={form.feeTemplateId}
              onChange={(e) => set("feeTemplateId", e.target.value)}
            />

            <FormGrid cols={2}>
              <Field label="Cadence" required>
                <Select value={form.cadence} onChange={(e) => set("cadence", e.target.value)} options={CADENCE_OPTIONS} />
              </Field>
              <Field label="Joining Date Policy" required>
                <Select value={form.joiningDatePolicy} onChange={(e) => set("joiningDatePolicy", e.target.value)} options={JOINING_POLICY_OPTIONS} />
              </Field>
              <Field label="Start Date" required>
                <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
              </Field>
              <Field label="End Date" hint="Optional">
                <Input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
              </Field>
            </FormGrid>

            <Field label="Notes" hint="Optional">
              <textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={3}
                className="yd-input"
                style={{ fontFamily: "inherit" }}
              />
            </Field>

            <div style={{ fontSize: 12, color: "var(--yd-text-muted)" }}>
              New billing plans always start in <strong>Draft</strong> status — activate it from the table once you're ready to start generating invoices.
            </div>
          </div>
        </form>
      </Drawer>

      {/* End confirmation */}
      <Modal
        isOpen={!!endTarget}
        onClose={() => setEndTarget(null)}
        title="End Billing Plan"
        footer={
          <>
            <Button variant="outline" onClick={() => setEndTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={ending} onClick={confirmEnd}>End Plan</Button>
          </>
        }
      >
        <p style={{ fontSize: 13, lineHeight: 1.6 }}>
          Ending the billing plan for student <strong>{endTarget?.studentLedgerId}</strong> stops it from generating
          any further invoices. This is <strong>permanent</strong> — an ended plan cannot be reactivated.
        </p>
      </Modal>

      {/* Generate Invoice */}
      <Modal
        isOpen={!!invoiceTarget}
        onClose={() => setInvoiceTarget(null)}
        title="Generate Invoice"
        footer={
          <>
            <Button variant="outline" onClick={() => setInvoiceTarget(null)}>Cancel</Button>
            <Button variant="primary" loading={generating} onClick={confirmGenerateInvoice}>Generate</Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {invoiceError && (
            <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
              {invoiceError}
            </div>
          )}
          <p style={{ fontSize: 13, color: "var(--yd-text-muted)", margin: 0 }}>
            Generates one invoice for student <strong>{invoiceTarget?.studentLedgerId}</strong> covering the period below.
          </p>
          <FormGrid cols={2}>
            <Field label="Period Start" required>
              <Input type="date" value={invoiceForm.periodStart} onChange={(e) => setInvoiceForm(f => ({ ...f, periodStart: e.target.value }))} />
            </Field>
            <Field label="Period End" required>
              <Input type="date" value={invoiceForm.periodEnd} onChange={(e) => setInvoiceForm(f => ({ ...f, periodEnd: e.target.value }))} />
            </Field>
          </FormGrid>
        </div>
      </Modal>
    </PageShell>
  );
}
