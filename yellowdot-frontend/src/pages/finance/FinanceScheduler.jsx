/**
 * FinanceScheduler.jsx — Recurring Billing Engine admin screen (M3.5 / M3.5.1)
 * ─────────────────────────────────────────────────────────────────────────
 * Design System v2: PageShell -> PageHeader -> FinanceSubNav -> KpiRow
 * (dashboard) -> info banner -> DataTable (run history) -> Drawer (per-plan
 * results for one run, real or preview).
 *
 * Platform-wide, bypass-role-only screen (see routes/financeSchedulerRoutes.js
 * on the backend and permissions.js's FINANCE_SCHEDULER key on the frontend —
 * deliberately never granted to admin/center_admin/accountant, only reachable
 * by developer/super_admin via their existing "*" wildcard). This is the one
 * Finance Platform screen that shows data spanning multiple schools at once,
 * which is exactly why it isn't a per-school staff screen.
 *
 * "Run Now (Preview)" starts a dry run exactly like a real one (async,
 * returns a runId immediately), then polls that run's own status until it
 * finishes and opens its results in the same Drawer a real run uses —
 * nothing about the preview flow is a separate code path from viewing any
 * other run's detail.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { PlayCircle, Eye } from "lucide-react";
import financeApi from "../../services/financeApi";
import FinanceSubNav from "./components/FinanceSubNav";
import FinancePlatformDisabled from "./components/FinancePlatformDisabled";
import useFinancePlatformStatus from "./hooks/useFinancePlatformStatus";
import {
  PageShell, PageHeader, KpiRow, KpiCard, DataTable, StatusBadge, Button, Drawer,
} from "../../components/ui";

function formatDateTime(v) {
  return v ? new Date(v).toLocaleString("en-IN") : "—";
}

function formatDuration(ms) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

const OUTCOME_FILTER_OPTIONS = [
  { value: "generated", label: "Generated" },
  { value: "duplicate", label: "Duplicate" },
  { value: "requiresApproval", label: "Requires Approval" },
  { value: "wouldGenerate", label: "Would Generate (Preview)" },
  { value: "wouldSkipDuplicate", label: "Would Skip — Duplicate (Preview)" },
  { value: "wouldRequireApproval", label: "Would Require Approval (Preview)" },
  { value: "skipped", label: "Skipped" },
  { value: "error", label: "Error" },
];

const MODE_FILTER_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "scheduled", label: "Scheduled" },
  { value: "preview", label: "Preview" },
];

// How long to poll a just-started run (real or preview) waiting for it to
// finish before auto-opening its detail Drawer — capped so a genuinely
// stuck run doesn't poll forever; the run still shows up in history either way.
const POLL_INTERVAL_MS = 1200;
const POLL_MAX_ATTEMPTS = 30; // ~36s

export default function FinanceScheduler() {
  const { enabled: financeEnabled } = useFinancePlatformStatus();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [previewRunning, setPreviewRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [runSuccess, setRunSuccess] = useState("");

  const [dashboard, setDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  const [selectedRunId, setSelectedRunId] = useState(null);
  const [runDetail, setRunDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const pollTimer = useRef(null);
  useEffect(() => () => { if (pollTimer.current) clearTimeout(pollTimer.current); }, []);

  const load = useCallback(async () => {
    if (financeEnabled === null) return; // still checking platform status
    if (financeEnabled === false) { setLoading(false); setDashboardLoading(false); return; }
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

  const loadDashboard = useCallback(async () => {
    if (financeEnabled !== true) { setDashboardLoading(false); return; }
    setDashboardLoading(true);
    try {
      const res = await financeApi.scheduler.getDashboard();
      setDashboard(res);
    } catch {
      setDashboard(null); // dashboard tiles are supplementary — a failure here shouldn't block the run history table below
    } finally {
      setDashboardLoading(false);
    }
  }, [financeEnabled]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadDashboard(); }, [loadDashboard]);

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

  // Polls a freshly-started run until it leaves "running", then opens its
  // detail Drawer automatically — used by both Run Now and Run Now (Preview)
  // so a preview's results appear without staff needing to guess when it's done.
  function pollUntilDone(runId, attempt = 0) {
    financeApi.scheduler.getRun(runId).then(res => {
      if (res.run?.status && res.run.status !== "running") {
        setSelectedRunId(runId);
        setRunDetail(res.run);
        load();
        loadDashboard();
        return;
      }
      if (attempt >= POLL_MAX_ATTEMPTS) { load(); return; } // give up polling; it'll show in history once it finishes
      pollTimer.current = setTimeout(() => pollUntilDone(runId, attempt + 1), POLL_INTERVAL_MS);
    }).catch(() => load());
  }

  async function handleRunNow() {
    setRunning(true);
    setRunError("");
    setRunSuccess("");
    try {
      const res = await financeApi.scheduler.runNow();
      setRunSuccess(`Run ${res.runId} started.`);
      setTimeout(() => setRunSuccess(""), 6000);
      await load();
      pollUntilDone(res.runId);
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

  async function handleRunPreview() {
    setPreviewRunning(true);
    setRunError("");
    setRunSuccess("");
    try {
      const res = await financeApi.scheduler.runPreview();
      setRunSuccess(`Preview ${res.runId} started — results will open automatically.`);
      setTimeout(() => setRunSuccess(""), 6000);
      await load();
      pollUntilDone(res.runId);
    } catch (err) {
      if (err.response?.status === 409) {
        setRunError("A scheduler run is already in progress — try again once it finishes.");
      } else {
        setRunError(err.response?.data?.error || err.message || "Failed to start a preview.");
      }
    } finally {
      setPreviewRunning(false);
    }
  }

  const runColumns = [
    { key: "runId", label: "Run ID", sortable: true, filterable: true, width: 170 },
    { key: "mode", label: "Mode", type: "badge", sortable: true, filterable: true,
      filterType: "select", filterOptions: MODE_FILTER_OPTIONS, width: 110,
      render: (v) => <StatusBadge status={v || "scheduled"} /> },
    { key: "status", label: "Status", type: "badge", sortable: true, filterable: true,
      filterType: "select", filterOptions: ["running", "completed", "completed_with_errors", "failed"], width: 150 },
    { key: "startedAt", label: "Started", sortable: true, width: 165, render: formatDateTime },
    { key: "durationMs", label: "Duration", sortable: true, width: 100, render: formatDuration },
    { key: "schoolsProcessed", label: "Schools", width: 85 },
    { key: "plansEvaluated", label: "Plans", width: 75 },
    { key: "invoicesGenerated", label: "Invoices", width: 85 },
    { key: "duplicatesSkipped", label: "Duplicates", width: 95 },
    { key: "plansSkipped", label: "Skipped", width: 85 },
    { key: "plansFailed", label: "Failed", width: 75 },
    { key: "actions", label: "", type: "actions", width: 80,
      actions: (row) => (
        <Button variant="outline" size="xs" onClick={() => openRun(row.runId)}>View</Button>
      ) },
  ];

  const planResultColumns = [
    { key: "schoolId", label: "School", width: 110 },
    { key: "planId", label: "Billing Plan", width: 120, render: (v) => v || "—" },
    { key: "studentLedgerId", label: "Student", width: 100, render: (v) => v || "—" },
    { key: "outcome", label: "Outcome", type: "badge", filterable: true, filterType: "select", filterOptions: OUTCOME_FILTER_OPTIONS, width: 170 },
    { key: "invoiceId", label: "Invoice", width: 130, render: (v) => v || "—" },
    { key: "totalAmount", label: "Amount", width: 100, render: (v) => v != null ? `₹${Number(v).toLocaleString("en-IN")}` : "—" },
    { key: "reason", label: "Reason / Error", width: 200, render: (v, row) => v || row.error || "—" },
  ];

  return (
    <PageShell
      header={
        <PageHeader
          title="Recurring Billing"
          tag="Finance Platform"
          subtitle="Recurring invoice generation across every school — platform-wide, developer/super_admin only"
          primaryAction={financeEnabled === false ? undefined : { label: "Run Now", icon: <PlayCircle size={14} strokeWidth={2} />, onClick: handleRunNow, disabled: running || previewRunning }}
        />
      }
      kpis={
        financeEnabled !== true ? undefined : (
          <KpiRow>
            <KpiCard label="Last Successful Run" value={dashboard?.lastSuccessfulRun ? formatDateTime(dashboard.lastSuccessfulRun.startedAt) : "None yet"} loading={dashboardLoading} />
            <KpiCard label="Next Scheduled Run" value={dashboard?.nextScheduledRun ? formatDateTime(dashboard.nextScheduledRun) : "—"} loading={dashboardLoading} />
            <KpiCard label="Total Invoices Generated" value={dashboard?.totalInvoicesGenerated ?? 0} loading={dashboardLoading} />
            <KpiCard label="Last Failure" value={dashboard?.lastFailure ? formatDateTime(dashboard.lastFailure.startedAt) : "None"} loading={dashboardLoading} />
            <KpiCard label="Scheduler Health" value={<StatusBadge status={dashboard?.health || "unknown"} />} loading={dashboardLoading} />
          </KpiRow>
        )
      }
    >
      <FinanceSubNav active="scheduler" />

      {financeEnabled === false ? (
        <FinancePlatformDisabled />
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <Button variant="outline" size="sm" leftIcon={<Eye size={14} strokeWidth={2} />} loading={previewRunning} disabled={running} onClick={handleRunPreview}>
              Run Now (Preview)
            </Button>
          </div>

          <div style={{ background: "var(--yd-info-soft)", color: "var(--yd-info)", border: "1px solid var(--yd-info-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12.5, lineHeight: 1.6 }}>
            Runs automatically for every active Billing Plan with a Monthly, Quarterly, Half-Yearly or Yearly cadence, on each
            school's own schedule (configurable from Finance Settings). Termly and one-time plans are always generated manually
            from the Billing Plans screen — the scheduler does not touch them. <strong>Run Now (Preview)</strong> shows exactly
            what a real run would do — invoices that would be created, skipped and already-billed plans, and any errors —
            without writing anything. A crashed or interrupted run recovers automatically the next time the server starts, and
            never runs twice for the same school on the same day.
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
            exportTitle="Recurring Billing Runs"
            empty={{
              title: "No scheduler runs yet",
              description: "Runs will appear here once a school's configured schedule fires, or you can start one manually with Run Now.",
            }}
          />
        </>
      )}

      <Drawer
        isOpen={!!selectedRunId}
        onClose={() => setSelectedRunId(null)}
        title={`Run Detail — ${selectedRunId || ""}`}
        width={760}
      >
        {detailLoading && <div style={{ fontSize: 13, color: "var(--yd-text-muted)" }}>Loading…</div>}
        {!detailLoading && runDetail?.error && (
          <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
            {runDetail.error}
          </div>
        )}
        {!detailLoading && runDetail && !runDetail.error && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {runDetail.mode === "preview" && (
              <div style={{ background: "var(--yd-warning-soft)", color: "var(--yd-warning)", border: "1px solid var(--yd-warning-border)", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600 }}>
                Preview only — nothing below was saved. No invoices, ledger entries or audit records were created.
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 13 }}>
              <div><strong>Mode:</strong> <StatusBadge status={runDetail.mode || "scheduled"} /></div>
              <div><strong>Status:</strong> <StatusBadge status={runDetail.status} /></div>
              <div><strong>Triggered By:</strong> {runDetail.triggeredBy}</div>
              <div><strong>Started:</strong> {formatDateTime(runDetail.startedAt)}</div>
              <div><strong>Completed:</strong> {formatDateTime(runDetail.completedAt)}</div>
              <div><strong>Duration:</strong> {formatDuration(runDetail.durationMs)}</div>
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
