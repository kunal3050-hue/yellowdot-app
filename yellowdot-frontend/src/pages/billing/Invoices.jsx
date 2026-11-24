/**
 * Invoices.jsx — the invoice register, and where the month gets billed
 * ─────────────────────────────────────────────────────────────────────────────
 * Two jobs: list every bill the school has raised, and run the month.
 *
 * The monthly run is two-phase on purpose. "Run this month" always asks the
 * server for a DRY RUN first and shows exactly what it would do — the count,
 * the total, which children are skipped and which matched no plan — before
 * anything is written. Nobody should discover what a billing run did by
 * reading the register afterwards.
 *
 * Raising a one-off invoice is itemised: several lines on one bill, which is
 * the whole point of the rebuild. A child on tuition plus daycare plus
 * transport gets one bill with three lines, not three bills.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Play, Trash2 } from "lucide-react";
import {
  PageShell, PageHeader, DataTable, StatusBadge, Badge, Button, Modal,
  Select, Input, FormSection, Field, FormGrid, EmptyState, useToast,
} from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import billingService from "../../services/billingService";
import studentService from "../../services/studentService";
import {
  inr, prettyDate, prettyPeriod, currentPeriod, todayLocal, recentPeriods,
  labelFor, FEE_TYPES, INVOICE_STATUS_OPTIONS, SKIP_REASONS,
} from "./billingMeta";

const BLANK_LINE = { planId: "", label: "", feeType: "tuition", amount: "" };

/**
 * The dry-run preview. Deliberately shows the three outcomes side by side:
 * what will be billed, who is skipped and why, and who matched no plan at all.
 * The last of those is the one a school needs to see — a child with no
 * matching plan is silently unbilled every month until somebody notices.
 */
function RunPreview({ preview, onConfirm, onCancel, busy }) {
  const nothingToDo = preview.plannedCount === 0;

  return (
    <div className="yd-run-preview">
      <div className="yd-run-preview__headline">
        <div>
          <div className="yd-run-preview__count">{preview.plannedCount}</div>
          <div className="yd-run-preview__count-label">
            invoice{preview.plannedCount === 1 ? "" : "s"} to raise
          </div>
        </div>
        <div>
          <div className="yd-run-preview__count">{inr(preview.totalAmount)}</div>
          <div className="yd-run-preview__count-label">total</div>
        </div>
      </div>

      <p className="yd-run-preview__meta">
        For {prettyPeriod(preview.period)}, due {prettyDate(preview.dueDate)}.
        {" "}Nothing has been written yet.
      </p>

      {preview.planned.length > 0 && (
        <section className="yd-run-preview__section">
          <h4>Will be billed</h4>
          <ul className="yd-run-preview__list">
            {preview.planned.map(p => (
              <li key={p.studentId}>
                <span className="yd-run-preview__name">{p.studentName || p.studentId}</span>
                <span className="yd-run-preview__lines">
                  {p.lines.map(l => l.label).join(" + ")}
                </span>
                <span className="yd-run-preview__amount">{inr(p.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {preview.unmatched.length > 0 && (
        <section className="yd-run-preview__section yd-run-preview__section--warn">
          <h4>No matching fee plan — these children will not be billed</h4>
          <ul className="yd-run-preview__list">
            {preview.unmatched.map(u => (
              <li key={u.studentId}>
                <span className="yd-run-preview__name">{u.studentName || u.studentId}</span>
                <span className="yd-run-preview__lines">{u.class || "no class set"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {preview.skipped.length > 0 && (
        <section className="yd-run-preview__section">
          <h4>Skipped</h4>
          <ul className="yd-run-preview__list">
            {preview.skipped.map(s => (
              <li key={`${s.studentId}-${s.reason}`}>
                <span className="yd-run-preview__name">{s.studentName || s.studentId}</span>
                <span className="yd-run-preview__lines">
                  {SKIP_REASONS[s.reason] || s.reason}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="yd-run-preview__actions">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button
          variant="primary"
          onClick={onConfirm}
          loading={busy}
          disabled={busy || nothingToDo}
        >
          {nothingToDo
            ? "Nothing to raise"
            : `Raise ${preview.plannedCount} invoice${preview.plannedCount === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}

export default function Invoices() {
  const navigate = useNavigate();
  const { canDo } = useAuth();
  const { show: toast } = useToast();
  const [searchParams] = useSearchParams();
  const studentFilter = searchParams.get("studentId") || "";

  const canBill = canDo("billing", "create");

  const [invoices, setInvoices] = useState([]);
  const [plans,    setPlans]    = useState([]);
  const [students, setStudents] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  // The monthly run, two-phase: preview then confirm.
  const [runOpen, setRunOpen]   = useState(false);
  const [runPeriod, setRunPeriod] = useState(currentPeriod());
  const [runDueDate, setRunDueDate] = useState("");
  const [preview, setPreview]   = useState(null);
  const [runBusy, setRunBusy]   = useState(false);

  // One-off invoice.
  const [newOpen, setNewOpen]   = useState(false);
  const [form, setForm]         = useState(null);
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [inv, pl] = await Promise.all([
        billingService.listInvoices(studentFilter ? { studentId: studentFilter } : {}),
        billingService.listPlans({ activeOnly: "true" }),
      ]);
      if (inv?.success) setInvoices(inv.invoices || []);
      if (pl?.success)  setPlans(pl.plans || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not load invoices.");
    } finally {
      setLoading(false);
    }
  }, [studentFilter]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  /** Children are only needed by the one-off form, so they load with it. */
  const openNewInvoice = useCallback(async () => {
    setFormError("");
    setForm({
      studentId: "", period: currentPeriod(), invoiceDate: todayLocal(),
      dueDate: "", notes: "", lines: [{ ...BLANK_LINE }],
    });
    setNewOpen(true);
    if (students.length === 0) {
      try {
        setStudents(await studentService.getStudents({ status: "Active" }));
      } catch {
        // Not fatal: the id can still be typed, and the server validates it.
        setStudents([]);
      }
    }
  }, [students.length]);

  async function runPreviewNow() {
    setRunBusy(true);
    setError("");
    try {
      const res = await billingService.generateInvoices({
        period: runPeriod, dueDate: runDueDate || undefined, dryRun: true,
      });
      setPreview(res);
    } catch (err) {
      toast(err.response?.data?.error || err.message || "Could not preview the run.", "error");
    } finally {
      setRunBusy(false);
    }
  }

  async function confirmRun() {
    setRunBusy(true);
    try {
      const res = await billingService.generateInvoices({
        period: runPeriod, dueDate: runDueDate || undefined,
      });
      setPreview(null);
      setRunOpen(false);
      toast(
        `Raised ${res.createdCount} invoice${res.createdCount === 1 ? "" : "s"} for ${prettyPeriod(runPeriod)}.`,
        "success",
      );
      await load();
    } catch (err) {
      toast(err.response?.data?.error || err.message || "Could not raise the invoices.", "error");
    } finally {
      setRunBusy(false);
    }
  }

  function setLine(index, patch) {
    setForm(f => ({
      ...f,
      lines: f.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    }));
  }

  /** Picking a plan fills the line from it; the amount stays editable. */
  function pickPlan(index, planId) {
    const plan = plans.find(p => p.planId === planId);
    setLine(index, plan
      ? { planId, label: plan.name, feeType: plan.feeType, amount: String(plan.amount) }
      : { planId: "", label: "", feeType: "tuition", amount: "" });
  }

  const formTotal = useMemo(
    () => (form?.lines || []).reduce((t, l) => t + (Number(l.amount) || 0), 0),
    [form],
  );

  async function saveInvoice() {
    setSaving(true);
    setFormError("");
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
      setNewOpen(false);
      toast(`Invoice ${res.invoice.invoiceNumber} raised.`, "success");
      navigate(`/billing/invoices/${res.invoice.invoiceId}`);
    } catch (err) {
      setFormError(err.response?.data?.error || err.message || "Could not raise the invoice.");
    } finally {
      setSaving(false);
    }
  }

  const classOptions = useMemo(
    () => [...new Set(invoices.map(i => i.class).filter(Boolean))].map(c => ({ value: c, label: c })),
    [invoices],
  );

  const columns = useMemo(() => [
    { key: "invoiceNumber", label: "Invoice", width: 150, sortable: true, filterable: true },
    { key: "studentName",   label: "Child",   width: 180, sortable: true, filterable: true },
    {
      key: "class", label: "Class", width: 120, sortable: true, filterable: true,
      filterType: "select", filterOptions: classOptions,
    },
    {
      key: "period", label: "For", width: 130, sortable: true,
      render: (v) => prettyPeriod(v),
    },
    {
      key: "lines", label: "Charged for", width: 220, sortable: false,
      render: (v) => (
        v?.length
          ? (
            <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}
                  title={v.map(l => `${l.label} — ${inr(l.amount)}`).join("\n")}>
              {v.slice(0, 2).map(l => (
                <Badge key={l.lineId} variant="neutral">{labelFor(l.feeType)}</Badge>
              ))}
              {v.length > 2 && (
                <span style={{ fontSize: 11, color: "var(--yd-text-muted)" }}>+{v.length - 2}</span>
              )}
            </span>
          )
          : "—"
      ),
    },
    {
      key: "totalAmount", label: "Total", width: 110, sortable: true, render: (v) => inr(v),
    },
    { key: "paidAmount", hidden: true, label: "Paid", width: 110, sortable: true, render: (v) => inr(v) },
    {
      key: "balance", label: "Balance", width: 110, sortable: true,
      render: (v, row) => (
        <strong style={{ color: v > 0 && row.status === "Overdue" ? "var(--yd-danger)" : "inherit" }}>
          {inr(v)}
        </strong>
      ),
    },
    {
      key: "dueDate", label: "Due", width: 120, sortable: true, render: (v) => prettyDate(v),
    },
    {
      key: "status", label: "Status", width: 110, sortable: true, filterable: true,
      filterType: "select", filterOptions: INVOICE_STATUS_OPTIONS,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: "generatedBy", hidden: true, label: "Raised by", width: 110, sortable: true,
      render: (v) => (v === "plan" ? "Fee plan" : "By hand"),
    },
  ], [classOptions]);

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

  return (
    <PageShell
      header={
        <PageHeader
          title="Invoices"
          tag="Billing & Payments"
          subtitle={
            studentFilter
              ? `Filtered to one child · ${invoices.length} invoice${invoices.length === 1 ? "" : "s"}`
              : `${invoices.length} invoice${invoices.length === 1 ? "" : "s"}`
          }
          backLabel="Billing"
          onBack={() => navigate("/billing")}
          onRefresh={load}
          primaryAction={canBill ? {
            label: "Run this month",
            icon: <Play size={14} strokeWidth={2} />,
            onClick: () => { setPreview(null); setRunOpen(true); },
          } : undefined}
          secondaryActions={canBill ? [
            { key: "one-off", label: "One-off invoice", onClick: openNewInvoice },
          ] : undefined}
        />
      }
    >
      {error && <div className="yd-inline-error">{error}</div>}

      <DataTable
        tableId="billing-invoices"
        columns={columns}
        data={invoices}
        loading={loading}
        entityLabel="invoices"
        searchPlaceholder="Search by invoice number or child…"
        exportFilename="invoices"
        exportTitle="Invoices"
        onRowClick={(row) => navigate(`/billing/invoices/${row.invoiceId}`)}
        empty={{
          title: "No invoices yet",
          description: canBill
            ? "Run the month to raise invoices from your fee plans, or raise a one-off invoice."
            : "Invoices raised by your administrator will appear here.",
          action: canBill
            ? { label: "Run this month", onClick: () => { setPreview(null); setRunOpen(true); } }
            : undefined,
        }}
      />

      {/* ── The monthly run ─────────────────────────────────────────────── */}
      <Modal
        isOpen={runOpen}
        onClose={() => { setRunOpen(false); setPreview(null); }}
        title={preview ? "Confirm this billing run" : "Run this month's billing"}
        size={preview ? "lg" : "md"}
      >
        {preview ? (
          <RunPreview
            preview={preview}
            busy={runBusy}
            onCancel={() => setPreview(null)}
            onConfirm={confirmRun}
          />
        ) : (
          <>
            <p className="yd-modal-lede">
              Every active child whose class matches an active monthly fee plan gets one
              itemised invoice. A child already invoiced for the month is skipped, so
              running this twice never double-bills.
            </p>
            <FormGrid>
              <Field label="Bill for">
                <Select
                  value={runPeriod}
                  onChange={(e) => setRunPeriod(e.target.value)}
                  options={recentPeriods(12)}
                />
              </Field>
              <Field label="Due date" hint="Defaults to the last day of the month">
                <Input
                  type="date"
                  value={runDueDate}
                  onChange={(e) => setRunDueDate(e.target.value)}
                />
              </Field>
            </FormGrid>
            <div className="yd-modal-actions">
              <Button variant="ghost" onClick={() => setRunOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={runPreviewNow} loading={runBusy}>
                Preview the run
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* ── A one-off itemised invoice ──────────────────────────────────── */}
      <Modal
        isOpen={newOpen}
        onClose={() => setNewOpen(false)}
        title="Raise an invoice"
        size="lg"
      >
        {form && (
          <>
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
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={line.amount}
                    onChange={(e) => setLine(i, { amount: e.target.value })}
                  />
                  <button
                    type="button"
                    className="yd-close-btn"
                    aria-label={`Remove line ${i + 1}`}
                    disabled={form.lines.length === 1}
                    onClick={() => setForm(f => ({
                      ...f, lines: f.lines.filter((_, j) => j !== i),
                    }))}
                  >
                    <Trash2 size={13} strokeWidth={2} />
                  </button>
                </div>
              ))}

              <div className="yd-invoice-line__footer">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Plus size={13} strokeWidth={2} />}
                  disabled={form.lines.length >= 20}
                  onClick={() => setForm(f => ({ ...f, lines: [...f.lines, { ...BLANK_LINE }] }))}
                >
                  Add a line
                </Button>
                <div className="yd-invoice-line__total">
                  Total <strong>{inr(formTotal)}</strong>
                </div>
              </div>
            </FormSection>

            <FormSection title="Anything else">
              <Field label="Note on the invoice">
                <Input
                  value={form.notes}
                  onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional — shown to the family"
                />
              </Field>
            </FormSection>

            {formError && <div className="yd-inline-error">{formError}</div>}

            <div className="yd-modal-actions">
              <Button variant="ghost" onClick={() => setNewOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={saveInvoice}
                loading={saving}
                disabled={saving || !form.studentId || formTotal <= 0}
              >
                Raise invoice for {inr(formTotal)}
              </Button>
            </div>
          </>
        )}
      </Modal>

      {!loading && invoices.length === 0 && !canBill && (
        <EmptyState
          size="sm"
          title="Nothing to show"
          description="You can see invoices here once your administrator raises them."
        />
      )}
    </PageShell>
  );
}
