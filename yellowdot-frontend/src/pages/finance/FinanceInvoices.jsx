/**
 * FinanceInvoices.jsx — Invoice Management screen (Finance Foundation invoices)
 * ─────────────────────────────────────────────────────────────────────────
 * Design System v2: PageShell -> PageHeader -> FinanceSubNav -> DataTable
 * (own toolbar). Generation is manual-only, from an already-active Billing
 * Plan — there is deliberately no recurring/automatic generation anywhere
 * in this screen, matching the backend's own M3.5-deferred scope.
 */
import { useCallback, useEffect, useState } from "react";
import { FilePlus2 } from "lucide-react";
import financeApi from "../../services/financeApi";
import FinanceSubNav from "./components/FinanceSubNav";
import FinancePlatformDisabled from "./components/FinancePlatformDisabled";
import useFinancePlatformStatus from "./hooks/useFinancePlatformStatus";
import {
  PageShell, PageHeader, DataTable, StatusBadge, Button, Input, Drawer,
} from "../../components/ui";

function formatMoney(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function currentPeriod() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return { periodStart: `${y}-${m}-01`, periodEnd: `${y}-${m}-${lastDay}` };
}

export default function FinanceInvoices() {
  const { enabled: financeEnabled } = useFinancePlatformStatus();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [genForm, setGenForm] = useState({ planId: "", ...currentPeriod() });
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [genSuccess, setGenSuccess] = useState("");

  const load = useCallback(async () => {
    if (financeEnabled === null) return; // still checking platform status
    if (financeEnabled === false) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const res = await financeApi.invoices.list();
      setInvoices(res.invoices || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to load invoices.");
    } finally {
      setLoading(false);
    }
  }, [financeEnabled]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function handleGenerate() {
    if (!genForm.planId) return;
    setGenerating(true);
    setGenError("");
    try {
      await financeApi.billingPlans.generateInvoice(genForm.planId, genForm.periodStart, genForm.periodEnd);
      setGenerateOpen(false);
      setGenForm({ planId: "", ...currentPeriod() });
      setGenSuccess("Invoice generated.");
      setTimeout(() => setGenSuccess(""), 4000);
      await load();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Failed to generate invoice.";
      setGenError(
        err.response?.status === 409
          ? `This invoice needs manager approval before it can be generated: ${msg}`
          : msg
      );
    } finally {
      setGenerating(false);
    }
  }

  const columns = [
    { key: "invoiceNumber", label: "Invoice #", sortable: true, filterable: true, width: 160 },
    { key: "studentId", label: "Student", sortable: true, filterable: true, width: 110 },
    { key: "invoiceDate", label: "Invoice Date", sortable: true, width: 130 },
    { key: "dueDate", label: "Due Date", sortable: true, width: 130 },
    { key: "totalAmount", label: "Total", sortable: true, width: 120,
      render: (v) => <span className="yd-fin-money">{formatMoney(v)}</span> },
    { key: "balance", label: "Balance", sortable: true, width: 120,
      render: (v) => <span className={`yd-fin-money ${Number(v) > 0 ? "yd-fin-money--owed" : "yd-fin-money--credit"}`}>{formatMoney(v)}</span> },
    { key: "status", label: "Status", type: "badge", sortable: true, filterable: true,
      filterType: "select", filterOptions: ["Pending", "Paid", "Partial", "Overdue", "Cancelled"], width: 120 },
    { key: "invoiceId", label: "", type: "actions", width: 80,
      actions: (row) => (
        <Button variant="outline" size="xs" onClick={() => setSelectedInvoice(row)}>View</Button>
      ) },
  ];

  return (
    <PageShell
      header={
        <PageHeader
          title="Invoices"
          subtitle={`${invoices.length} invoice${invoices.length === 1 ? "" : "s"}`}
          primaryAction={financeEnabled === false ? undefined : { label: "Generate Invoice", icon: <FilePlus2 size={14} strokeWidth={2} />, onClick: () => setGenerateOpen(true) }}
        />
      }
    >
      <FinanceSubNav active="invoices" />

      {financeEnabled === false ? (
        <FinancePlatformDisabled />
      ) : (
        <>
          {error && (
            <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
              {error}
            </div>
          )}
          {genSuccess && (
            <div style={{ background: "var(--yd-success-soft)", color: "var(--yd-success)", border: "1px solid var(--yd-success-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
              {genSuccess}
            </div>
          )}

          <DataTable
            tableId="finance-invoices"
            columns={columns}
            data={invoices}
            loading={loading}
            entityLabel="invoices"
            searchPlaceholder="Search invoice number, student…"
            exportFilename="finance-invoices"
            exportTitle="Invoices"
            empty={{
              title: "No invoices generated yet",
              description: "Generate one from an active billing plan.",
              action: { label: "Generate Invoice", onClick: () => setGenerateOpen(true) },
            }}
          />
        </>
      )}

      <Drawer
        isOpen={generateOpen}
        onClose={() => setGenerateOpen(false)}
        title="Generate Invoice"
        footer={
          <>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={generating} onClick={handleGenerate}>Generate</Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {genError && (
            <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
              {genError}
            </div>
          )}
          <Input
            label="Billing Plan ID"
            placeholder="e.g. BPL000001"
            value={genForm.planId}
            onChange={(e) => setGenForm(f => ({ ...f, planId: e.target.value }))}
            hint="The plan must be Active. Find its ID on the Billing Plans screen."
          />
          <Input
            type="date" label="Period Start"
            value={genForm.periodStart}
            onChange={(e) => setGenForm(f => ({ ...f, periodStart: e.target.value }))}
          />
          <Input
            type="date" label="Period End"
            value={genForm.periodEnd}
            onChange={(e) => setGenForm(f => ({ ...f, periodEnd: e.target.value }))}
          />
        </div>
      </Drawer>

      <Drawer
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        title="Invoice Detail"
      >
        {selectedInvoice && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div><strong>Invoice #:</strong> {selectedInvoice.invoiceNumber}</div>
            <div><strong>Student:</strong> {selectedInvoice.studentId}</div>
            <div><strong>Status:</strong> <StatusBadge status={selectedInvoice.status} /></div>
            <div><strong>Period:</strong> {selectedInvoice.periodStart} – {selectedInvoice.periodEnd}</div>
            <div><strong>Total:</strong> {formatMoney(selectedInvoice.totalAmount)}</div>
            <div><strong>Paid:</strong> {formatMoney(selectedInvoice.paidAmount)}</div>
            <div><strong>Balance:</strong> {formatMoney(selectedInvoice.balance)}</div>
            {Array.isArray(selectedInvoice.lines) && selectedInvoice.lines.length > 0 && (
              <div>
                <strong>Lines:</strong>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {selectedInvoice.lines.map((l, i) => (
                    <li key={i} style={{ fontSize: 13 }}>{l.description || l.label || "Line item"} — {formatMoney(l.amount)}</li>
                  ))}
                </ul>
              </div>
            )}
            <div style={{ fontSize: 12, color: "var(--yd-text-muted)", marginTop: 8 }}>
              Print/PDF download is not yet supported for Finance Platform invoices server-side — this is a known, existing gap tracked separately, not something this pass adds.
            </div>
          </div>
        )}
      </Drawer>
    </PageShell>
  );
}
