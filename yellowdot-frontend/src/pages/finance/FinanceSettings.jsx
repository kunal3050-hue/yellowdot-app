/**
 * FinanceSettings.jsx — Finance Settings screen
 * ─────────────────────────────────────────────────────────────────────────
 * Design System v2 / Platform Layout Standard: PageShell -> PageHeader ->
 * FinanceSubNav -> Tabs ("General Settings" / "Fee Templates") -> a form
 * built from FormSection/Field/FormGrid, or a DataTable + Drawer CRUD panel.
 * Local error/success banners (not useToast) to match the already-implemented
 * sibling Finance screens in this folder (FinanceLedger.jsx,
 * FinanceInvoices.jsx), which use the same pattern.
 *
 * Fee Templates tab (navigation consolidation, see sidebarConfig.js's note
 * on the "Finance" group): "Fees" has no primary nav slot in the
 * consolidated Finance Platform — fee template/component management lives
 * here instead. No new backend or data model: this calls the exact same
 * `/api/fee-templates` REST surface (financeApi.feeTemplates.*) the legacy
 * Invoice module's FeeTemplates.jsx (/invoice/templates) already uses, and
 * the exact `feeTemplates` Firestore collection
 * financeBillingEngineService.js reads a Billing Plan's `feeTemplateId`
 * from — so a template created here is immediately usable when creating a
 * Billing Plan. Only the presentation is new (DataTable/Drawer, matching
 * every other Finance Platform screen), not the business logic.
 */
import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import financeApi from "../../services/financeApi";
import FinanceSubNav from "./components/FinanceSubNav";
import FinancePlatformDisabled from "./components/FinancePlatformDisabled";
import useFinancePlatformStatus from "./hooks/useFinancePlatformStatus";
import {
  PageShell, PageHeader, FormSection, Field, FormGrid, Input, Select,
  Button, LoadingPage, PageError, Tabs, DataTable, Drawer, Modal, StatusBadge,
} from "../../components/ui";

const JOINING_POLICY_OPTIONS = [
  { value: "fullMonth", label: "Full Month" },
  { value: "prorated",  label: "Prorated" },
  { value: "nextCycle", label: "Next Cycle" },
];

const ALLOCATION_POLICY_OPTIONS = [
  { value: "oldestDueFirst", label: "Oldest Due First" },
  { value: "manual",         label: "Manual" },
];

const LATE_FEE_TYPE_OPTIONS = [
  { value: "flat",       label: "Flat Amount" },
  { value: "percentage", label: "Percentage" },
];

const FEE_TYPE_OPTIONS = [
  "Tuition Fee", "Daycare Fees", "Playgroup Fees", "Nursery Fees",
  "Transport Fee", "Meal Plan", "Annual Charges", "Activity Fee",
  "Admission Fee", "Registration Fee", "Other",
].map(v => ({ value: v, label: v }));

const BILLING_CYCLE_OPTIONS = [
  "Monthly", "Quarterly", "Half-Yearly", "Annual", "One-Time",
].map(v => ({ value: v, label: v }));

const EMPTY_TEMPLATE_FORM = {
  templateName: "", feeType: "Tuition Fee", amount: "",
  billingCycle: "Monthly", description: "",
};

function templateFormFromRecord(t) {
  return {
    templateName: t?.templateName || "",
    feeType:      t?.feeType || "Tuition Fee",
    amount:       t?.amount ?? "",
    billingCycle: t?.billingCycle || "Monthly",
    description:  t?.description || "",
  };
}

function formatMoney(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// Only the editable fields — schoolId/createdAt/updatedAt/updatedBy are
// server-owned and must never be sent back on update().
const EMPTY_FORM = {
  defaultJoiningDatePolicy: "fullMonth",
  defaultAllocationPolicy: "oldestDueFirst",
  lateFeeEnabled: false,
  lateFeeType: "flat",
  lateFeeValue: 0,
  gracePeriodDays: 0,
  discountApprovalThreshold: 0,
  refundApprovalThreshold: 0,
  gstNumber: "",
};

function toFormState(settings) {
  return {
    defaultJoiningDatePolicy: settings?.defaultJoiningDatePolicy || "fullMonth",
    defaultAllocationPolicy:  settings?.defaultAllocationPolicy  || "oldestDueFirst",
    lateFeeEnabled:           !!settings?.lateFeeEnabled,
    lateFeeType:              settings?.lateFeeFormula?.type  || "flat",
    lateFeeValue:             settings?.lateFeeFormula?.value ?? 0,
    gracePeriodDays:          settings?.gracePeriodDays ?? 0,
    discountApprovalThreshold: settings?.discountApprovalThreshold ?? 0,
    refundApprovalThreshold:   settings?.refundApprovalThreshold ?? 0,
    gstNumber:                 settings?.gstNumber || "",
  };
}

export default function FinanceSettings() {
  const { enabled: financeEnabled } = useFinancePlatformStatus();
  const [tab, setTab] = useState("general");

  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  // Fee Templates tab
  const [templates, setTemplates] = useState([]);
  const [tplLoading, setTplLoading] = useState(true);
  const [tplError, setTplError] = useState("");
  const [tplSuccess, setTplSuccess] = useState("");
  const [tplDrawerOpen, setTplDrawerOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [tplForm, setTplForm] = useState(EMPTY_TEMPLATE_FORM);
  const [tplFormError, setTplFormError] = useState("");
  const [tplSaving, setTplSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (financeEnabled === null) return; // still checking platform status
    if (financeEnabled === false) { setLoading(false); return; }
    setLoading(true);
    setLoadError("");
    try {
      const res = await financeApi.settings.get();
      setForm(toFormState(res?.settings));
    } catch (err) {
      setLoadError(err.response?.data?.error || err.message || "Failed to load finance settings.");
    } finally {
      setLoading(false);
    }
  }, [financeEnabled]);

  const loadTemplates = useCallback(async () => {
    if (financeEnabled !== true) { setTplLoading(false); return; }
    setTplLoading(true);
    setTplError("");
    try {
      const res = await financeApi.feeTemplates.list();
      setTemplates(res?.templates || []);
    } catch (err) {
      setTplError(err.response?.data?.error || err.message || "Failed to load fee templates.");
    } finally {
      setTplLoading(false);
    }
  }, [financeEnabled]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function setTpl(k, v) { setTplForm(f => ({ ...f, [k]: v })); }

  function openCreateTemplate() {
    setEditingTemplate(null);
    setTplForm(EMPTY_TEMPLATE_FORM);
    setTplFormError("");
    setTplDrawerOpen(true);
  }

  function openEditTemplate(t) {
    setEditingTemplate(t);
    setTplForm(templateFormFromRecord(t));
    setTplFormError("");
    setTplDrawerOpen(true);
  }

  async function submitTemplate() {
    setTplFormError("");
    if (!tplForm.templateName.trim()) { setTplFormError("Template name is required."); return; }
    if (!(Number(tplForm.amount) > 0)) { setTplFormError("Amount must be greater than zero."); return; }

    setTplSaving(true);
    try {
      const payload = {
        templateName: tplForm.templateName.trim(),
        feeType:      tplForm.feeType,
        amount:       Number(tplForm.amount),
        billingCycle: tplForm.billingCycle,
        description:  tplForm.description.trim(),
      };
      if (editingTemplate) {
        await financeApi.feeTemplates.update(editingTemplate.templateId, payload);
        setTplSuccess("Fee template updated.");
      } else {
        await financeApi.feeTemplates.create(payload);
        setTplSuccess("Fee template created.");
      }
      setTimeout(() => setTplSuccess(""), 4000);
      setTplDrawerOpen(false);
      await loadTemplates();
    } catch (err) {
      setTplFormError(err.response?.data?.error || err.message || "Failed to save fee template.");
    } finally {
      setTplSaving(false);
    }
  }

  async function toggleTemplateActive(t) {
    try {
      await financeApi.feeTemplates.update(t.templateId, { active: !t.active });
      await loadTemplates();
    } catch (err) {
      setTplError(err.response?.data?.error || err.message || "Failed to update fee template.");
    }
  }

  async function confirmDeleteTemplate() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await financeApi.feeTemplates.remove(deleteTarget.templateId);
      setDeleteTarget(null);
      setTplSuccess("Fee template deleted.");
      setTimeout(() => setTplSuccess(""), 4000);
      await loadTemplates();
    } catch (err) {
      setTplError(err.response?.data?.error || err.message || "Failed to delete fee template.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const templateColumns = [
    { key: "templateId",   label: "Template ID", width: 130 },
    { key: "templateName", label: "Name", sortable: true, filterable: true, width: 180 },
    { key: "feeType",      label: "Fee Type", sortable: true, filterable: true, filterType: "select", filterOptions: FEE_TYPE_OPTIONS, width: 150 },
    { key: "amount",       label: "Amount", sortable: true, width: 120, render: (v) => <span className="yd-fin-money">{formatMoney(v)}</span> },
    { key: "billingCycle", label: "Billing Cycle", sortable: true, width: 130 },
    { key: "active",       label: "Status", width: 110, render: (v) => <StatusBadge status={v ? "Active" : "Paused"} /> },
    {
      key: "actions", label: "", type: "actions", width: 200,
      actions: (row) => (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Button variant="outline" size="xs" onClick={() => openEditTemplate(row)}>Edit</Button>
          <Button variant="outline" size="xs" onClick={() => toggleTemplateActive(row)}>{row.active ? "Deactivate" : "Activate"}</Button>
          <Button variant="danger" size="xs" onClick={() => setDeleteTarget(row)}>Delete</Button>
        </div>
      ),
    },
  ];

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    setSaveSuccess("");
    try {
      const payload = {
        defaultJoiningDatePolicy: form.defaultJoiningDatePolicy,
        defaultAllocationPolicy:  form.defaultAllocationPolicy,
        lateFeeEnabled:           form.lateFeeEnabled,
        lateFeeFormula: {
          type:  form.lateFeeType,
          value: Number(form.lateFeeValue) || 0,
        },
        gracePeriodDays:            Number(form.gracePeriodDays) || 0,
        discountApprovalThreshold:  Number(form.discountApprovalThreshold) || 0,
        refundApprovalThreshold:    Number(form.refundApprovalThreshold) || 0,
        gstNumber:                  form.gstNumber.trim(),
      };
      const res = await financeApi.settings.update(payload);
      setForm(toFormState(res?.settings));
      setSaveSuccess("Settings saved.");
      setTimeout(() => setSaveSuccess(""), 4000);
      // Re-fetch to confirm the update round-tripped through the server,
      // rather than trusting the update() response alone.
      await load();
    } catch (err) {
      setSaveError(err.response?.data?.error || err.message || "Failed to save finance settings.");
    } finally {
      setSaving(false);
    }
  }

  if (financeEnabled === false) {
    return (
      <PageShell
        header={<PageHeader title="Finance Settings" tag="Finance Platform" subtitle="Defaults, late fees and approval thresholds for this school" />}
      >
        <FinanceSubNav active="settings" />
        <FinancePlatformDisabled />
      </PageShell>
    );
  }

  return (
    <PageShell
      header={
        <PageHeader
          title="Finance Settings"
          tag="Finance Platform"
          subtitle="Defaults, late fees, approval thresholds and fee templates for this school"
          primaryAction={tab === "fee-templates" ? { label: "Create Fee Template", icon: <Plus size={14} strokeWidth={2} />, onClick: openCreateTemplate } : undefined}
        />
      }
    >
      <FinanceSubNav active="settings" />

      <Tabs
        tabs={[
          { id: "general",       label: "General Settings" },
          { id: "fee-templates", label: "Fee Templates" },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

      <div style={{ marginTop: 16 }}>
        {tab === "general" ? (
          loading ? <LoadingPage message="Loading finance settings…" size="sm" /> :
          loadError ? <PageError message={loadError} onRetry={load} /> :
          <>
            {saveError && (
              <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
                {saveError}
              </div>
            )}
            {saveSuccess && (
              <div style={{ background: "var(--yd-success-soft)", color: "var(--yd-success)", border: "1px solid var(--yd-success-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
                {saveSuccess}
              </div>
            )}

            <FormSection title="Billing Defaults" description="Applied to new billing plans unless overridden per plan">
              <FormGrid cols={2}>
                <Field label="Default Joining Date Policy">
                  <Select
                    value={form.defaultJoiningDatePolicy}
                    onChange={(e) => set("defaultJoiningDatePolicy", e.target.value)}
                    options={JOINING_POLICY_OPTIONS}
                  />
                </Field>
                <Field label="Default Allocation Policy">
                  <Select
                    value={form.defaultAllocationPolicy}
                    onChange={(e) => set("defaultAllocationPolicy", e.target.value)}
                    options={ALLOCATION_POLICY_OPTIONS}
                  />
                </Field>
              </FormGrid>
            </FormSection>

            <FormSection title="Late Fees" description="Automatic late fee behavior for overdue invoices">
              <FormGrid cols={2}>
                <Field label="Late Fee Enabled">
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, height: 38 }}>
                    <input
                      type="checkbox"
                      checked={form.lateFeeEnabled}
                      onChange={(e) => set("lateFeeEnabled", e.target.checked)}
                    />
                    Charge a late fee on overdue invoices
                  </label>
                </Field>
                <Field label="Grace Period (days)">
                  <Input
                    type="number" min="0" inputMode="numeric"
                    value={form.gracePeriodDays}
                    onChange={(e) => set("gracePeriodDays", e.target.value)}
                    disabled={!form.lateFeeEnabled}
                  />
                </Field>
                <Field label="Late Fee Type">
                  <Select
                    value={form.lateFeeType}
                    onChange={(e) => set("lateFeeType", e.target.value)}
                    options={LATE_FEE_TYPE_OPTIONS}
                    disabled={!form.lateFeeEnabled}
                  />
                </Field>
                <Field label="Late Fee Value" hint={form.lateFeeType === "percentage" ? "% of the overdue amount" : "₹ flat amount"}>
                  <Input
                    type="number" min="0" step="0.01" inputMode="decimal"
                    value={form.lateFeeValue}
                    onChange={(e) => set("lateFeeValue", e.target.value)}
                    disabled={!form.lateFeeEnabled}
                  />
                </Field>
              </FormGrid>
            </FormSection>

            <FormSection title="Approval Thresholds" description="Amounts above these require manager approval before they take effect">
              <FormGrid cols={2}>
                <Field label="Discount Approval Threshold" hint="0 = no threshold, every discount auto-applies">
                  <Input
                    type="number" min="0" step="0.01" inputMode="decimal"
                    value={form.discountApprovalThreshold}
                    onChange={(e) => set("discountApprovalThreshold", e.target.value)}
                  />
                </Field>
                <Field label="Refund Approval Threshold" hint="0 = no threshold, every refund auto-applies">
                  <Input
                    type="number" min="0" step="0.01" inputMode="decimal"
                    value={form.refundApprovalThreshold}
                    onChange={(e) => set("refundApprovalThreshold", e.target.value)}
                  />
                </Field>
              </FormGrid>
            </FormSection>

            <FormSection title="GST" description="Displayed on generated invoices and receipts" optional>
              <FormGrid cols={2}>
                <Field label="GST Number" hint="Optional">
                  <Input
                    value={form.gstNumber}
                    onChange={(e) => set("gstNumber", e.target.value)}
                    placeholder="e.g. 27AAAAA0000A1Z5"
                  />
                </Field>
              </FormGrid>
            </FormSection>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
              <Button variant="primary" loading={saving} onClick={handleSave}>
                Save Changes
              </Button>
            </div>
          </>
        ) : (
          <>
            {tplError && (
              <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
                {tplError}
              </div>
            )}
            {tplSuccess && (
              <div style={{ background: "var(--yd-success-soft)", color: "var(--yd-success)", border: "1px solid var(--yd-success-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
                {tplSuccess}
              </div>
            )}
            <p style={{ fontSize: 12.5, color: "var(--yd-text-muted)", lineHeight: 1.55, margin: "0 0 16px" }}>
              Fee templates define what a Billing Plan charges — name, fee type and amount. Create one here, then reference its
              Template ID when creating a Billing Plan.
            </p>
            <DataTable
              tableId="finance-settings-fee-templates"
              columns={templateColumns}
              data={templates}
              loading={tplLoading}
              entityLabel="fee templates"
              searchPlaceholder="Search template name…"
              exportFilename="fee-templates"
              exportTitle="Fee Templates"
              empty={{
                title: "No fee templates yet",
                description: "Create one to start building Billing Plans.",
                action: { label: "Create Fee Template", onClick: openCreateTemplate },
              }}
            />
          </>
        )}
      </div>

      {/* Create / Edit Fee Template */}
      <Drawer
        isOpen={tplDrawerOpen}
        onClose={() => setTplDrawerOpen(false)}
        title={editingTemplate ? "Edit Fee Template" : "Create Fee Template"}
        footer={
          <>
            <Button variant="outline" onClick={() => setTplDrawerOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={tplSaving} onClick={submitTemplate}>
              {editingTemplate ? "Save Changes" : "Create"}
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {tplFormError && (
            <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
              {tplFormError}
            </div>
          )}
          <Field label="Template Name" required>
            <Input
              placeholder="e.g. Monthly Tuition Fee"
              value={tplForm.templateName}
              onChange={(e) => setTpl("templateName", e.target.value)}
            />
          </Field>
          <FormGrid cols={2}>
            <Field label="Fee Type">
              <Select value={tplForm.feeType} onChange={(e) => setTpl("feeType", e.target.value)} options={FEE_TYPE_OPTIONS} />
            </Field>
            <Field label="Billing Cycle">
              <Select value={tplForm.billingCycle} onChange={(e) => setTpl("billingCycle", e.target.value)} options={BILLING_CYCLE_OPTIONS} />
            </Field>
          </FormGrid>
          <Field label="Amount (₹)" required>
            <Input
              type="number" min="0" step="0.01" inputMode="decimal"
              value={tplForm.amount}
              onChange={(e) => setTpl("amount", e.target.value)}
            />
          </Field>
          <Field label="Description" hint="Optional">
            <Input
              placeholder="Shown to staff when selecting a template"
              value={tplForm.description}
              onChange={(e) => setTpl("description", e.target.value)}
            />
          </Field>
        </div>
      </Drawer>

      {/* Delete confirmation */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Fee Template"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={deleting} onClick={confirmDeleteTemplate}>Delete</Button>
          </>
        }
      >
        <p style={{ fontSize: 13, lineHeight: 1.6 }}>
          Delete <strong>{deleteTarget?.templateName}</strong>? Billing Plans that already reference this template keep working
          off their last-generated invoices, but new invoices can no longer be generated from it. This cannot be undone —
          consider Deactivate instead if you might need it again.
        </p>
      </Modal>
    </PageShell>
  );
}
