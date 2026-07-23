/**
 * FinanceSettings.jsx — Finance Settings screen
 * ─────────────────────────────────────────────────────────────────────────
 * Design System v2 / Platform Layout Standard: PageShell -> PageHeader ->
 * FinanceSubNav -> a form built from FormSection/Field/FormGrid (no
 * DataTable, no pagination/search/sort — this page is a settings form
 * only, per design doc §10). Local error/success banners (not useToast) to
 * match the already-implemented sibling Finance screens in this folder
 * (FinanceLedger.jsx, FinanceInvoices.jsx), which use the same pattern.
 */
import { useCallback, useEffect, useState } from "react";
import financeApi from "../../services/financeApi";
import FinanceSubNav from "./components/FinanceSubNav";
import {
  PageShell, PageHeader, FormSection, Field, FormGrid, Input, Select,
  Button, LoadingPage, PageError,
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
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  const load = useCallback(async () => {
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
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

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

  if (loading) return <LoadingPage message="Loading finance settings…" />;
  if (loadError) return <PageError message={loadError} onRetry={load} />;

  return (
    <PageShell
      header={
        <PageHeader
          title="Finance Settings"
          tag="Finance Platform"
          subtitle="Defaults, late fees and approval thresholds for this school"
        />
      }
    >
      <FinanceSubNav active="settings" />

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
    </PageShell>
  );
}
