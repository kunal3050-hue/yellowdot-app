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
import { Play } from "lucide-react";
import {
  PageShell, PageHeader, DataTable, StatusBadge, Badge, Button, Modal,
  Select, Input, Field, FormGrid, EmptyState, useToast,
} from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import billingService from "../../services/billingService";
import {
  inr, prettyDate, prettyPeriod, currentPeriod, recentPeriods,
  labelFor, INVOICE_STATUS_OPTIONS, SKIP_REASONS,
} from "./billingMeta";

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
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  // The monthly run, two-phase: preview then confirm.
  const [runOpen, setRunOpen]   = useState(false);
  const [runPeriod, setRunPeriod] = useState(currentPeriod());
  const [runDueDate, setRunDueDate] = useState("");
  const [preview, setPreview]   = useState(null);
  const [runBusy, setRunBusy]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const inv = await billingService.listInvoices(
        studentFilter ? { studentId: studentFilter } : {},
      );
      if (inv?.success) setInvoices(inv.invoices || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not load invoices.");
    } finally {
      setLoading(false);
    }
  }, [studentFilter]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  /** Children are only needed by the one-off form, so they load with it. */

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
            { key: "one-off", label: "One-off invoice", onClick: () => navigate("/billing/invoices/new") },
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
        size={preview ? "wide" : "default"}
        footer={null}
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
