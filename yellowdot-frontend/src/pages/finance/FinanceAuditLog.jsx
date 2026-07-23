/**
 * FinanceAuditLog.jsx — Finance Platform Audit Log (read-only)
 * ─────────────────────────────────────────────────────────────────────────
 * Design System v2 / docs/finance-design/13_FINANCE_UI_DESIGN_SYSTEM.md §3/§8:
 * PageShell -> PageHeader (no primary action, read-only screen) ->
 * FinanceSubNav -> FilterBar (cross-entity filters: User/Entity Type/Date
 * Range/Action -- explicitly NOT DataTable's own single-column toolbar,
 * per FilterBar's own header-comment rule that the two must never be
 * stacked on one page) -> DataTable (entries) -> Drawer (entry detail).
 *
 * Backend contract (financeApi.auditLog.list / financeAuditService.js,
 * read directly, not guessed):
 *   list({ actorUserId, entityType, entityId, action, dateFrom, dateTo, limit })
 *     -> { success, entries: [{ logId, schoolId, actorUserId, action,
 *          entityType, entityId, meta, createdAt }], total }
 *   entityType: studentLedger | ledgerEntry | billingPlan | familyAccount |
 *               financeSettings | invoice | payment | refund
 *   action: free-form string ("ledger.create", "billingPlan.pause", …) --
 *   there is no fixed enum server-side, so this screen exposes it as a
 *   plain text filter rather than a select.
 *
 * Immutability: financeAuditLogs is `allow write: if false` in Firestore
 * rules -- there is no edit/delete anywhere on this screen, only "View"
 * (opens a Drawer with the raw `meta` object) and CSV-only export, never
 * "excel"/"print" (an audit trail export as a formatted document invites
 * misrepresentation of raw log data).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
import financeApi from "../../services/financeApi";
import {
  PageShell, PageHeader, FilterBar, DataTable, Button, Drawer,
} from "../../components/ui";
import FinanceSubNav from "./components/FinanceSubNav";
import FinancePlatformDisabled from "./components/FinancePlatformDisabled";
import useFinancePlatformStatus from "./hooks/useFinancePlatformStatus";

const ENTITY_TYPE_OPTIONS = [
  { value: "studentLedger",   label: "Student Ledger" },
  { value: "ledgerEntry",     label: "Ledger Entry" },
  { value: "billingPlan",     label: "Billing Plan" },
  { value: "familyAccount",   label: "Family Account" },
  { value: "financeSettings", label: "Finance Settings" },
  { value: "invoice",         label: "Invoice" },
  { value: "payment",         label: "Payment" },
  { value: "refund",          label: "Refund" },
];

export default function FinanceAuditLog() {
  const { enabled: financeEnabled } = useFinancePlatformStatus();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [actorUserId, setActorUserId] = useState("");
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [dateRange, setDateRange] = useState({});

  const [selectedEntry, setSelectedEntry] = useState(null);

  const load = useCallback(async () => {
    if (financeEnabled === null) return; // still checking platform status
    if (financeEnabled === false) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const res = await financeApi.auditLog.list({
        actorUserId: actorUserId.trim() || undefined,
        entityType:  entityType || undefined,
        action:      action.trim() || undefined,
        dateFrom:    dateRange.from || undefined,
        dateTo:      dateRange.to || undefined,
        limit: 200,
      });
      if (res?.success) setEntries(res.entries || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to load audit log.");
    } finally {
      setLoading(false);
    }
  }, [financeEnabled, actorUserId, entityType, action, dateRange]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const filtersActive = !!(actorUserId.trim() || entityType || action.trim() || dateRange.from || dateRange.to);

  const columns = useMemo(() => [
    { key: "createdAt",   label: "Timestamp",  sortable: true, width: 180 },
    { key: "actorUserId", label: "Actor",      sortable: true, filterable: false, width: 180 },
    { key: "action",      label: "Action",     sortable: true, width: 200 },
    {
      key: "entityType", label: "Entity Type", sortable: true, width: 150,
      render: (v) => ENTITY_TYPE_OPTIONS.find(o => o.value === v)?.label || v || "—",
    },
    { key: "entityId", label: "Entity ID", width: 180 },
    {
      key: "logId", label: "", type: "actions", width: 80,
      actions: (row) => (
        <Button variant="outline" size="xs" leftIcon={<Eye size={12} strokeWidth={2} />} onClick={() => setSelectedEntry(row)}>
          View
        </Button>
      ),
    },
  ], []);

  return (
    <PageShell
      header={<PageHeader title="Finance Audit Log" subtitle="Read-only — every Finance Platform write is logged here." />}
      filters={
        <>
          <FinanceSubNav active="audit-log" />
          {financeEnabled !== false && (
            <FilterBar
              filters={[
                { key: "actorUserId", label: "User",   type: "text",      value: actorUserId, onChange: setActorUserId },
                { key: "entityType",  label: "Entity",  type: "select",    value: entityType || "All", options: [{ value: "All", label: "All Entities" }, ...ENTITY_TYPE_OPTIONS], onChange: (v) => setEntityType(v === "All" ? "" : v) },
                { key: "action",      label: "Action",  type: "text",      value: action, onChange: setAction },
                { key: "dateRange",   label: "Date",    type: "dateRange", value: dateRange, onChange: setDateRange },
              ]}
            />
          )}
        </>
      }
    >
      {financeEnabled === false ? (
        <FinancePlatformDisabled />
      ) : (
        <>
          {error && (
            <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
              {error}
            </div>
          )}

          <DataTable
            tableId="finance-audit-log"
            columns={columns}
            data={entries}
            loading={loading}
            showToolbar={false}
            entityLabel="audit entries"
            exportFilename="finance-audit-log"
            exportTitle="Finance Audit Log"
            exportFormats={["csv"]}
            empty={
              filtersActive
                ? { title: "No matching audit entries", description: "Try adjusting your filters." }
                : { title: "No audit entries yet", description: "Every write made through the Finance Platform will be logged here." }
            }
            emptyIllustration={filtersActive ? "🔍" : "📋"}
          />
        </>
      )}

      <Drawer
        isOpen={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
        title="Audit Entry Detail"
      >
        {selectedEntry && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <DetailRow label="Timestamp" value={selectedEntry.createdAt} />
            <DetailRow label="Actor" value={selectedEntry.actorUserId} />
            <DetailRow label="Action" value={selectedEntry.action} />
            <DetailRow label="Entity Type" value={selectedEntry.entityType} />
            <DetailRow label="Entity ID" value={selectedEntry.entityId} />
            <DetailRow label="Log ID" value={selectedEntry.logId} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--yd-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                Meta
              </div>
              <pre style={{
                background: "var(--yd-soft)", border: "1px solid var(--yd-border)", borderRadius: 8,
                padding: 12, fontSize: 12, lineHeight: 1.5, overflowX: "auto", margin: 0,
              }}>
                {JSON.stringify(selectedEntry.meta || {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Drawer>
    </PageShell>
  );
}

function DetailRow({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--yd-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: "var(--yd-charcoal)", wordBreak: "break-all" }}>
        {value || "—"}
      </div>
    </div>
  );
}
