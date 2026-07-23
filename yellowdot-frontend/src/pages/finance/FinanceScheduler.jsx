/**
 * FinanceScheduler.jsx — Recurring Billing Scheduler admin screen (M3.5)
 * ─────────────────────────────────────────────────────────────────────────
 * Design System v2: PageShell -> PageHeader -> FinanceSubNav -> info banner
 * -> DataTable (run history) -> Drawer (per-plan results for one run).
 *
 * Platform-wide, bypass-role-only screen (see routes/financeSchedulerRoutes.js
 * on the backend and permissions.js's FINANCE_SCHEDULER key on the frontend —
 * deliberately never granted to admin/center_admin/accountant, only reachable
 * by developer/super_admin via their existing "*" wildcard). This is the one
 * Finance Platform screen that shows data spanning multiple schools at once,
 * which is exactly why it isn't a per-school staff screen.
 */
import { useCallback, useEffect, useState } from "react";
import { PlayCircle } from "lucide-react";
import financeApi from "../../services/financeApi";
import FinanceSubNav from "./components/FinanceSubNav";
import FinancePlatformDisabled from "./components/FinancePlatformDisabled";
import useFinancePlatformStatus from "./hooks/useFinancePlatformStatus";
import {
  PageShell, PageHeader, DataTable, StatusBadge, Button, Drawer,
} from "../../components/ui";

function formatDateTime(v) {
  return v ? new Date(v).toLocaleString("en-IN") : "—";
}

const OUTCOME_FILTER_OPTIONS = [
  { value: "generated", label: "Generated" },
  { value: "duplicate", label: "Duplicate" },
  { value: "requiresApproval", label: "Requires Approval" },
  { value: "skipped", label: "Skipped" },
  { value: "error", label: "Error" },
];

export default function FinanceScheduler() {
  const { enabled: financeEnabled } = useFinancePlatformStatus();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [runSuccess, setRunSuccess] = useState("");

  const [selectedRunId, setSelectedRunId] = useState(null);
  const [runDetail, setRunDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    if (financeEnabled === null) return; // still checking platform status
    if (financeEnabled === false) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const res = await financeApi.scheduler.listRuns();
      setRuns(res.runs || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to load scheduler runs.");
    } finally {
      setLoading(false);
    }
  }, [financeEnabled]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function handleRunNow() {
    setRunning(true);
    setRunError("");
    setRunSuccess("");
    try {
      const res = await financeApi.scheduler.runNow();
      setRunSuccess(`Run ${res.runId} started.`);
      setTimeout(() => setRunSuccess(""), 6000);
      await load();
    } catch (err) {
      if (err.response?.status === 409) {
        setRunError("A scheduler run is already in progress — try again once it finishes.");
      } else {
        setRunError(err.response?.data?.error || err.message || "Failed to start a run.");
      }
    } finally {
      setRunning(false);
    }
  }

  async function openRun(runId) {
    setSelectedRunId(runId);
    setDetailLoading(true);
    setRunDetail(null);
    try {
      const res = await financeApi.scheduler.getRun(runId);
      setRunDetail(res.run);
    } catch (err) {
      setRunDetail({ error: err.response?.data?.error || err.message || "Failed to load run detail." });
    } finally {
      setDetailLoading(false);
    }
  }

  const runColumns = [
    { key: "runId", label: "Run ID", sortable: true, filterable: true, width: 180 },
    { key: "triggeredBy", label: "Triggered By", sortable: true, filterable: true,
      filterType: "select", filterOptions: ["cron", "manual", "startup-recovery"], width: 140 },
    { key: "status", label: "Status", type: "badge", sortable: true, filterable: true,
      filterType: "select", filterOptions: ["running", "completed", "completed_with_errors", "failed"], width: 160 },
    { key: "startedAt", label: "Started", sortable: true, width: 170, render: formatDateTime },
    { key: "completedAt", label: "Completed", sortable: true, width: 170, render: formatDateTime },
    { key: "schoolsProcessed", label: "Schools", width: 90 },
    { key: "plansEvaluated", label: "Plans Evaluated", width: 120 },
    { key: "invoicesGenerated", label: "Invoices", width: 90 },
    { key: "plansSkipped", label: "Skipped", width: 90 },
    { key: "plansFailed", label: "Failed", width: 90 },
    { key: "actions", label: "", type: "actions", width: 80,
      actions: (row) => (
        <Button variant="outline" size="xs" onClick={() => openRun(row.runId)}>View</Button>
      ) },
  ];

  const planResultColumns = [
    { key: "schoolId", label: "School", width: 110 },
    { key: "planId", label: "Billing Plan", width: 120, render: (v) => v || "—" },
    { key: "studentLedgerId", label: "Student", width: 100, render: (v) => v || "—" },
    { key: "outcome", label: "Outcome", type: "badge", filterable: true, filterType: "select", filterOptions: OUTCOME_FILTER_OPTIONS, width: 140 },
    { key: "invoiceId", label: "Invoice", width: 130, render: (v) => v || "—" },
    { key: "reason", label: "Reason / Error", width: 220, render: (v, row) => v || row.error || "—" },
  ];

  return (
    <PageShell
      header={
        <PageHeader
          title="Billing Scheduler"
          tag="Finance Platform"
          subtitle="Recurring invoice generation across every school — platform-wide, developer/super_admin only"
          primaryAction={financeEnabled === false ? undefined : { label: "Run Now", icon: <PlayCircle size={14} strokeWidth={2} />, onClick: handleRunNow, disabled: running }}
        />
      }
    >
      <FinanceSubNav active="scheduler" />

      {financeEnabled === false ? (
        <FinancePlatformDisabled />
      ) : (
        <>
          <div style={{ background: "var(--yd-info-soft)", color: "var(--yd-info)", border: "1px solid var(--yd-info-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12.5, lineHeight: 1.6 }}>
            Runs automatically once daily at 01:00 (Asia/Kolkata) for every active Billing Plan with <strong>Monthly</strong> cadence.
            Termly and one-time plans are always generated manually from the Billing Plans screen — the scheduler does not touch them.
            A crashed or interrupted run recovers automatically the next time the server starts, and never runs twice for the same day.
          </div>

          {error && (
            <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
              {error}
            </div>
          )}
          {runError && (
            <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
              {runError}
            </div>
          )}
          {runSuccess && (
            <div style={{ background: "var(--yd-success-soft)", color: "var(--yd-success)", border: "1px solid var(--yd-success-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
              {runSuccess}
            </div>
          )}

          <DataTable
            tableId="finance-scheduler-runs"
            columns={runColumns}
            data={runs}
            loading={loading}
            entityLabel="runs"
            searchPlaceholder="Search run ID…"
            exportFilename="finance-scheduler-runs"
            exportTitle="Billing Scheduler Runs"
            empty={{
              title: "No scheduler runs yet",
              description: "Runs will appear here once the daily cron trigger fires, or you can start one manually with Run Now.",
            }}
          />
        </>
      )}

      <Drawer
        isOpen={!!selectedRunId}
        onClose={() => setSelectedRunId(null)}
        title={`Run Detail — ${selectedRunId || ""}`}
        width={720}
      >
        {detailLoading && <div style={{ fontSize: 13, color: "var(--yd-text-muted)" }}>Loading…</div>}
        {!detailLoading && runDetail?.error && (
          <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
            {runDetail.error}
          </div>
        )}
        {!detailLoading && runDetail && !runDetail.error && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 13 }}>
              <div><strong>Status:</strong> <StatusBadge status={runDetail.status} /></div>
              <div><strong>Triggered By:</strong> {runDetail.triggeredBy}</div>
              <div><strong>Started:</strong> {formatDateTime(runDetail.startedAt)}</div>
              <div><strong>Completed:</strong> {formatDateTime(runDetail.completedAt)}</div>
            </div>
            {runDetail.errorSummary && (
              <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
                {runDetail.errorSummary}
              </div>
            )}
            <DataTable
              tableId="finance-scheduler-run-results"
              columns={planResultColumns}
              data={runDetail.planResults || []}
              entityLabel="plan results"
              searchPlaceholder="Search plan ID, student…"
              empty={{ title: "No plans were evaluated in this run" }}
            />
          </div>
        )}
      </Drawer>
    </PageShell>
  );
}
