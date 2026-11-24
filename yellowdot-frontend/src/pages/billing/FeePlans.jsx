/**
 * FeePlans.jsx — the fee catalogue, and the payee details
 * ─────────────────────────────────────────────────────────────────────────────
 * What the school can charge for, defined once per class. This is the screen
 * that makes the monthly run possible: every active monthly plan whose classes
 * match a child becomes a LINE on that child's one invoice.
 *
 * Two things are deliberate here:
 *
 *   - A plan is deactivated, never deleted. Invoice lines carry the planId they
 *     were raised from, and a parent may reprint a bill years later. The row
 *     stays; it just stops being picked up.
 *   - Changing an amount does not touch invoices already raised. A fee revision
 *     applies to the next run, which is why a plan carries effective dates
 *     rather than retrospectively repricing bills a family may have paid.
 *
 * The payee panel is admin-tier and holds the school's own UPI ID. It is the
 * only configuration this module has, and it is two fields: the audit's
 * complaint about the deleted implementation was eleven collections and a
 * 577-line settings screen for one domain.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Wallet } from "lucide-react";
import {
  PageShell, PageHeader, DataTable, Badge, Button, Modal, Select, Input,
  FormGrid, Field, FormSection, Card, useToast,
} from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import billingService from "../../services/billingService";
import { inr, prettyDate, labelFor, FEE_TYPES, CADENCES } from "./billingMeta";

const BLANK_PLAN = {
  name: "", feeType: "tuition", amount: "", cadence: "monthly",
  classes: "", effectiveFrom: "", effectiveTo: "", notes: "",
};

export default function FeePlans() {
  const navigate = useNavigate();
  const { canDo } = useAuth();
  const { show: toast } = useToast();

  const canEdit     = canDo("billing", "edit");
  const canEditPayee = canDo("billing", "delete");   // admin tier, as on the server

  const [plans,   setPlans]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const [editing, setEditing] = useState(null);      // null | { planId?, ...fields }
  const [saving,  setSaving]  = useState(false);
  const [formError, setFormError] = useState("");

  const [settings, setSettings] = useState(null);
  const [payee, setPayee]       = useState(null);    // null | { upiId, upiName, ... }
  const [payeeBusy, setPayeeBusy]   = useState(false);
  const [payeeError, setPayeeError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [pl, set] = await Promise.all([
        billingService.listPlans(),
        billingService.getSettings().catch(() => null),
      ]);
      if (pl?.success)  setPlans(pl.plans || []);
      if (set?.success) setSettings(set.settings);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not load fee plans.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function openNew() {
    setFormError("");
    setEditing({ ...BLANK_PLAN });
  }

  function openEdit(plan) {
    setFormError("");
    setEditing({
      planId:        plan.planId,
      name:          plan.name,
      feeType:       plan.feeType,
      amount:        String(plan.amount),
      cadence:       plan.cadence,
      classes:       (plan.classes || []).join(", "),
      effectiveFrom: plan.effectiveFrom || "",
      effectiveTo:   plan.effectiveTo || "",
      notes:         plan.notes || "",
    });
  }

  async function savePlan() {
    setSaving(true);
    setFormError("");
    const payload = {
      name:    editing.name,
      feeType: editing.feeType,
      amount:  editing.amount,
      cadence: editing.cadence,
      classes: editing.classes.split(",").map(c => c.trim()).filter(Boolean),
      effectiveFrom: editing.effectiveFrom,
      effectiveTo:   editing.effectiveTo,
      notes:   editing.notes,
    };
    try {
      if (editing.planId) {
        await billingService.updatePlan(editing.planId, payload);
        toast(`"${payload.name}" updated. Invoices already raised are unchanged.`, "success");
      } else {
        await billingService.createPlan(payload);
        toast(`"${payload.name}" added to the catalogue.`, "success");
      }
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(err.response?.data?.error || err.message || "Could not save the plan.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(plan) {
    try {
      if (plan.active) {
        if (!window.confirm(
          `Stop using "${plan.name}"?\n\nIt will no longer be picked up by the monthly run. ` +
          "Invoices already raised from it are untouched, and it can be switched back on.",
        )) return;
        await billingService.deactivatePlan(plan.planId);
        toast(`"${plan.name}" will no longer be billed.`, "success");
      } else {
        await billingService.updatePlan(plan.planId, { active: true });
        toast(`"${plan.name}" is back in the monthly run.`, "success");
      }
      await load();
    } catch (err) {
      toast(err.response?.data?.error || err.message || "Could not change the plan.", "error");
    }
  }

  async function savePayee() {
    setPayeeBusy(true);
    setPayeeError("");
    try {
      const res = await billingService.updateSettings(payee);
      setSettings(res.settings);
      setPayee(null);
      toast("Payee details saved.", "success");
    } catch (err) {
      setPayeeError(err.response?.data?.error || err.message || "Could not save the payee details.");
    } finally {
      setPayeeBusy(false);
    }
  }

  const classOptions = useMemo(
    () => [...new Set(plans.flatMap(p => p.classes || []))].map(c => ({ value: c, label: c })),
    [plans],
  );

  const columns = useMemo(() => [
    { key: "name", label: "Fee plan", width: 200, sortable: true, filterable: true },
    {
      key: "feeType", label: "Type", width: 130, sortable: true, filterable: true,
      filterType: "select", filterOptions: FEE_TYPES,
      render: (v) => <Badge variant="neutral">{labelFor(v)}</Badge>,
    },
    {
      key: "amount", label: "Amount", width: 120, sortable: true,
      render: (v) => <strong>{inr(v)}</strong>,
    },
    {
      key: "cadence", label: "Billed", width: 130, sortable: true, filterable: true,
      filterType: "select", filterOptions: CADENCES,
      render: (v) => labelFor(v),
    },
    {
      key: "classes", label: "Applies to", width: 200, sortable: false,
      filterable: true, filterType: "multiselect", filterOptions: classOptions,
      render: (v) => (
        v?.length
          ? (
            <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }} title={v.join(", ")}>
              {v.slice(0, 2).map(c => <Badge key={c} variant="neutral">{c}</Badge>)}
              {v.length > 2 && (
                <span style={{ fontSize: 11, color: "var(--yd-text-muted)" }}>+{v.length - 2}</span>
              )}
            </span>
          )
          : <span style={{ color: "var(--yd-text-muted)" }}>Every class</span>
      ),
    },
    {
      key: "effectiveFrom", hidden: true, label: "From", width: 120, sortable: true,
      render: (v) => (v ? prettyDate(v) : "—"),
    },
    {
      key: "effectiveTo", hidden: true, label: "Until", width: 120, sortable: true,
      render: (v) => (v ? prettyDate(v) : "—"),
    },
    {
      key: "active", label: "Status", width: 110, sortable: true, filterable: true,
      filterType: "select",
      filterOptions: [{ value: true, label: "In use" }, { value: false, label: "Not in use" }],
      render: (v) => <Badge variant={v ? "success" : "neutral"}>{v ? "In use" : "Not in use"}</Badge>,
    },
    ...(canEdit ? [{
      key: "_actions", label: "", width: 160, sortable: false,
      render: (_v, row) => (
        <span style={{ display: "inline-flex", gap: 6 }}>
          <Button variant="outline" size="xs" onClick={(e) => { e.stopPropagation(); openEdit(row); }}>
            Edit
          </Button>
          <Button variant="ghost" size="xs" onClick={(e) => { e.stopPropagation(); toggleActive(row); }}>
            {row.active ? "Stop" : "Resume"}
          </Button>
        </span>
      ),
    }] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [classOptions, canEdit]);

  return (
    <PageShell
      header={
        <PageHeader
          title="Fee Plans"
          tag="Billing & Payments"
          subtitle={`${plans.length} plan${plans.length === 1 ? "" : "s"} · ${plans.filter(p => p.active).length} in use`}
          backLabel="Billing"
          onBack={() => navigate("/billing")}
          onRefresh={load}
          primaryAction={canEdit ? {
            label: "Add a fee plan",
            icon: <Plus size={14} strokeWidth={2} />,
            onClick: openNew,
          } : undefined}
          secondaryActions={canEditPayee && settings ? [{
            key: "payee",
            label: "Payee details",
            onClick: () => {
              setPayeeError("");
              setPayee({
                schoolName:    settings.schoolName || "",
                upiId:         settings.upiId || "",
                upiName:       settings.upiName || "",
                receiptFooter: settings.receiptFooter || "",
              });
            },
          }] : undefined}
        />
      }
    >
      {error && <div className="yd-inline-error">{error}</div>}

      {canEditPayee && settings && !settings.upiId && !loading && (
        <Card className="yd-payee-nudge">
          <Wallet size={16} strokeWidth={2} aria-hidden="true" />
          <div>
            <strong>No UPI ID set.</strong> Families will not see a QR code to scan on
            their bills until the school's UPI ID is added.
          </div>
          <Button
            variant="primary" size="sm"
            onClick={() => {
              setPayeeError("");
              setPayee({
                schoolName: settings.schoolName || "", upiId: "",
                upiName: "", receiptFooter: settings.receiptFooter || "",
              });
            }}
          >
            Add it
          </Button>
        </Card>
      )}

      <DataTable
        tableId="billing-fee-plans"
        columns={columns}
        data={plans}
        loading={loading}
        entityLabel="fee plans"
        searchPlaceholder="Search fee plans…"
        exportFilename="fee-plans"
        exportTitle="Fee plans"
        empty={{
          title: "No fee plans yet",
          description: canEdit
            ? "Add what the school charges — tuition, daycare, transport. The monthly run puts every plan a child matches onto one invoice."
            : "Fee plans set up by your administrator will appear here.",
          action: canEdit ? { label: "Add a fee plan", onClick: openNew } : undefined,
        }}
      />

      {/* ── Add or edit a plan ─────────────────────────────────────────── */}
      <Modal
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.planId ? "Edit this fee plan" : "Add a fee plan"}
        size="default"
        footer={null}
      >
        {editing && (
          <>
            <FormSection title="What is charged">
              <FormGrid>
                <Field label="Name" required hint="What a parent will read on the bill">
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing(p => ({ ...p, name: e.target.value }))}
                    placeholder="Monthly tuition"
                    maxLength={80}
                  />
                </Field>
                <Field label="Amount" required>
                  <Input
                    type="number" min="0" step="0.01"
                    value={editing.amount}
                    onChange={(e) => setEditing(p => ({ ...p, amount: e.target.value }))}
                    placeholder="0.00"
                  />
                </Field>
                <Field label="Type" required>
                  <Select
                    value={editing.feeType}
                    onChange={(e) => setEditing(p => ({ ...p, feeType: e.target.value }))}
                    options={FEE_TYPES}
                  />
                </Field>
                <Field
                  label="How often"
                  required
                  hint="Only monthly plans are picked up by the monthly run"
                >
                  <Select
                    value={editing.cadence}
                    onChange={(e) => setEditing(p => ({ ...p, cadence: e.target.value }))}
                    options={CADENCES}
                  />
                </Field>
              </FormGrid>
            </FormSection>

            <FormSection
              title="Who it applies to"
              description="Leave the classes blank to charge every child."
            >
              <Field label="Classes" hint="Comma separated — Playgroup, Nursery">
                <Input
                  value={editing.classes}
                  onChange={(e) => setEditing(p => ({ ...p, classes: e.target.value }))}
                  placeholder="Playgroup, Nursery"
                />
              </Field>
              <FormGrid>
                <Field label="In effect from" hint="Optional">
                  <Input
                    type="date"
                    value={editing.effectiveFrom}
                    onChange={(e) => setEditing(p => ({ ...p, effectiveFrom: e.target.value }))}
                  />
                </Field>
                <Field label="Until" hint="Optional">
                  <Input
                    type="date"
                    value={editing.effectiveTo}
                    onChange={(e) => setEditing(p => ({ ...p, effectiveTo: e.target.value }))}
                  />
                </Field>
              </FormGrid>
            </FormSection>

            <Field label="Note for staff" hint="Not shown to families">
              <Input
                value={editing.notes}
                onChange={(e) => setEditing(p => ({ ...p, notes: e.target.value }))}
              />
            </Field>

            {editing.planId && (
              <p className="yd-modal-note">
                Invoices already raised from this plan keep the amount they were raised
                at. A change here applies to the next billing run.
              </p>
            )}

            {formError && <div className="yd-inline-error">{formError}</div>}

            <div className="yd-modal-actions">
              <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={saving}
                disabled={saving || !editing.name.trim() || !(Number(editing.amount) > 0)}
                onClick={savePlan}
              >
                {editing.planId ? "Save changes" : "Add the plan"}
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* ── Payee details ──────────────────────────────────────────────── */}
      <Modal
        isOpen={Boolean(payee)}
        onClose={() => setPayee(null)}
        title="Payee details"
        size="default"
        footer={null}
      >
        {payee && (
          <>
            <p className="yd-modal-lede">
              The school's own UPI ID, used to build the QR code a family scans on their
              bill. They confirm the payment in their own app, and staff record it once
              it arrives — nothing here moves money, and no payment provider is involved.
            </p>

            <FormGrid>
              <Field label="School name" hint="Printed on receipts">
                <Input
                  value={payee.schoolName}
                  onChange={(e) => setPayee(p => ({ ...p, schoolName: e.target.value }))}
                  maxLength={120}
                />
              </Field>
              <Field label="UPI ID" hint="Looks like name@bank">
                <Input
                  value={payee.upiId}
                  onChange={(e) => setPayee(p => ({ ...p, upiId: e.target.value }))}
                  placeholder="school@bank"
                />
              </Field>
              <Field label="Payee name" hint="What the family sees in their UPI app">
                <Input
                  value={payee.upiName}
                  onChange={(e) => setPayee(p => ({ ...p, upiName: e.target.value }))}
                  maxLength={120}
                />
              </Field>
              <Field label="Receipt footer" hint="Optional line at the foot of a receipt">
                <Input
                  value={payee.receiptFooter}
                  onChange={(e) => setPayee(p => ({ ...p, receiptFooter: e.target.value }))}
                  maxLength={300}
                />
              </Field>
            </FormGrid>

            {payeeError && <div className="yd-inline-error">{payeeError}</div>}

            <div className="yd-modal-actions">
              <Button variant="ghost" onClick={() => setPayee(null)} disabled={payeeBusy}>
                Cancel
              </Button>
              <Button variant="primary" loading={payeeBusy} onClick={savePayee}>
                Save
              </Button>
            </div>
          </>
        )}
      </Modal>
    </PageShell>
  );
}
