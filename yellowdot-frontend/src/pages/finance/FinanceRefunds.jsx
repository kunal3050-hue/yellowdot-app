/**
 * FinanceRefunds.jsx — Refunds & Reversals screen
 * ─────────────────────────────────────────────────────────────────────────
 * Design System v2: PageShell -> PageHeader -> FinanceSubNav -> Tabs
 * (Refunds / Reversed Payments) -> DataTable. The Approve action is only
 * ever rendered for users holding the narrower "finance-refund-approval"
 * permission — never rendered-but-disabled for everyone else, matching the
 * platform's hide-don't-reveal RBAC convention (the backend independently
 * enforces this server-side regardless of what the UI shows).
 */
import { useCallback, useEffect, useState } from "react";
import { Undo2 } from "lucide-react";
import financeApi from "../../services/financeApi";
import { useAuth } from "../../contexts/AuthContext";
import { ROUTES } from "../../config/permissions";
import FinanceSubNav from "./components/FinanceSubNav";
import FinancePlatformDisabled from "./components/FinancePlatformDisabled";
import useFinancePlatformStatus from "./hooks/useFinancePlatformStatus";
import {
  PageShell, PageHeader, DataTable, StatusBadge, Button, Input, Drawer, Tabs,
} from "../../components/ui";

function formatMoney(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const EMPTY_REQUEST_FORM = { paymentId: "", amount: "", reason: "" };

export default function FinanceRefunds() {
  const { can } = useAuth();
  const canApprove = can(ROUTES.FINANCE_REFUND_APPROVAL);
  const { enabled: financeEnabled } = useFinancePlatformStatus();

  const [tab, setTab] = useState("refunds");
  const [refunds, setRefunds] = useState([]);
  const [reversedPayments, setReversedPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] = useState(EMPTY_REQUEST_FORM);
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [selected, setSelected] = useState(null);
  const [actionError, setActionError] = useState("");
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (financeEnabled === null) return; // still checking platform status
    if (financeEnabled === false) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const [refundsRes, reversedRes] = await Promise.all([
        financeApi.refunds.list(),
        financeApi.payments.list({ status: "Reversed" }),
      ]);
      setRefunds(refundsRes.refunds || []);
      setReversedPayments(reversedRes.payments || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to load refunds.");
    } finally {
      setLoading(false);
    }
  }, [financeEnabled]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function handleRequest() {
    if (!requestForm.paymentId || !requestForm.amount) return;
    setRequesting(true);
    setRequestError("");
    try {
      await financeApi.refunds.request(requestForm.paymentId, Number(requestForm.amount), requestForm.reason);
      setRequestOpen(false);
      setRequestForm(EMPTY_REQUEST_FORM);
      await load();
    } catch (err) {
      setRequestError(err.response?.data?.error || err.message || "Failed to request refund.");
    } finally {
      setRequesting(false);
    }
  }

  async function handleApprove(refund) {
    setActing(true);
    setActionError("");
    try {
      await financeApi.refunds.approve(refund.refundId);
      await load();
      setSelected(null);
    } catch (err) {
      setActionError(err.response?.data?.error || err.message || "Failed to approve refund.");
    } finally {
      setActing(false);
    }
  }

  async function handleReject(refund) {
    const reason = window.prompt("Reason for rejecting this refund?") || "";
    setActing(true);
    setActionError("");
    try {
      await financeApi.refunds.reject(refund.refundId, reason);
      await load();
      setSelected(null);
    } catch (err) {
      setActionError(err.response?.data?.error || err.message || "Failed to reject refund.");
    } finally {
      setActing(false);
    }
  }

  const refundColumns = [
    { key: "refundId", label: "Refund ID", sortable: true, filterable: true, width: 140 },
    { key: "paymentId", label: "Payment", width: 130 },
    { key: "familyId", label: "Family", width: 100 },
    { key: "studentId", label: "Student", width: 100 },
    { key: "amount", label: "Amount", sortable: true, width: 120,
      render: (v) => <span className="yd-fin-money yd-fin-money--owed">{formatMoney(v)}</span> },
    { key: "status", label: "Status", type: "badge", sortable: true, filterable: true,
      filterType: "select", filterOptions: ["Requested", "Approved", "Rejected", "Processed"], width: 130 },
    { key: "createdAt", label: "Requested", sortable: true, width: 160,
      render: (v) => v ? new Date(v).toLocaleString("en-IN") : "—" },
    { key: "actions", label: "", type: "actions", width: 80,
      actions: (row) => (
        <Button variant="outline" size="xs" onClick={() => setSelected(row)}>View</Button>
      ) },
  ];

  const reversedColumns = [
    { key: "receiptNumber", label: "Receipt #", sortable: true, width: 170 },
    { key: "familyId", label: "Family", width: 100 },
    { key: "studentId", label: "Student", width: 100 },
    { key: "amount", label: "Original Amount", sortable: true, width: 140,
      render: (v) => <span className="yd-fin-money">{formatMoney(v)}</span> },
    { key: "status", label: "Status", type: "badge", width: 110 },
    { key: "updatedAt", label: "Reversed", sortable: true, width: 160,
      render: (v) => v ? new Date(v).toLocaleString("en-IN") : "—" },
  ];

  return (
    <PageShell
      header={
        <PageHeader
          title="Refunds & Reversals"
          subtitle={`${refunds.length} refund${refunds.length === 1 ? "" : "s"} · ${reversedPayments.length} reversed payment${reversedPayments.length === 1 ? "" : "s"}`}
          primaryAction={financeEnabled === false ? undefined : { label: "Request Refund", icon: <Undo2 size={14} strokeWidth={2} />, onClick: () => setRequestOpen(true) }}
        />
      }
    >
      <FinanceSubNav active="refunds" />

      {financeEnabled === false ? (
        <FinancePlatformDisabled />
      ) : (
        <>
          {error && (
            <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
              {error}
            </div>
          )}

          <Tabs
            tabs={[
              { id: "refunds", label: "Refund Requests", count: refunds.length },
              { id: "reversed", label: "Reversal History", count: reversedPayments.length },
            ]}
            activeTab={tab}
            onChange={setTab}
          />

          <div style={{ marginTop: 16 }}>
            {tab === "refunds" ? (
              <DataTable
                tableId="finance-refunds"
                columns={refundColumns}
                data={refunds}
                loading={loading}
                entityLabel="refunds"
                searchPlaceholder="Search refund ID, payment, family…"
                exportFilename="finance-refunds"
                exportTitle="Refunds"
                empty={{
                  title: "No refund requests",
                  description: "Refund requests will appear here once submitted.",
                  action: { label: "Request Refund", onClick: () => setRequestOpen(true) },
                }}
              />
            ) : (
              <DataTable
                tableId="finance-reversed-payments"
                columns={reversedColumns}
                data={reversedPayments}
                loading={loading}
                entityLabel="reversed payments"
                searchPlaceholder="Search receipt number, family…"
                empty={{ title: "No reversed payments", description: "Payments that are reversed will appear here." }}
              />
            )}
          </div>
        </>
      )}

      <Drawer
        isOpen={requestOpen}
        onClose={() => setRequestOpen(false)}
        title="Request Refund"
        footer={
          <>
            <Button variant="outline" onClick={() => setRequestOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={requesting} onClick={handleRequest}>Submit Request</Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {requestError && (
            <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
              {requestError}
            </div>
          )}
          <Input label="Payment ID" required value={requestForm.paymentId} onChange={(e) => setRequestForm(f => ({ ...f, paymentId: e.target.value }))} hint="Find this on the Payments screen" />
          <Input label="Refund Amount" type="number" required value={requestForm.amount} onChange={(e) => setRequestForm(f => ({ ...f, amount: e.target.value }))} />
          <Input label="Reason" value={requestForm.reason} onChange={(e) => setRequestForm(f => ({ ...f, reason: e.target.value }))} />
          <div style={{ fontSize: 12, color: "var(--yd-text-muted)" }}>
            Refunds below the school's configured approval threshold are processed automatically; larger refunds require a manager's approval on this screen.
          </div>
        </div>
      </Drawer>

      <Drawer
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title="Refund Detail"
        footer={selected && selected.status === "Requested" && (
          canApprove ? (
            <>
              <Button variant="outline" loading={acting} onClick={() => handleReject(selected)}>Reject</Button>
              <Button variant="primary" loading={acting} onClick={() => handleApprove(selected)}>Approve</Button>
            </>
          ) : (
            <span style={{ fontSize: 12, color: "var(--yd-text-muted)" }}>Awaiting approval from a manager/accountant.</span>
          )
        )}
      >
        {selected && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {actionError && (
              <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
                {actionError}
              </div>
            )}
            <div><strong>Refund ID:</strong> {selected.refundId}</div>
            <div><strong>Payment:</strong> {selected.paymentId}</div>
            <div><strong>Family:</strong> {selected.familyId}</div>
            <div><strong>Student:</strong> {selected.studentId || "—"}</div>
            <div><strong>Amount:</strong> {formatMoney(selected.amount)}</div>
            <div><strong>Status:</strong> <StatusBadge status={selected.status} /></div>
            <div><strong>Reason:</strong> {selected.reason || "—"}</div>
            <div><strong>Requested By:</strong> {selected.requestedBy || "—"}</div>
            <div><strong>Approved By:</strong> {selected.approvedBy || "—"}</div>
          </div>
        )}
      </Drawer>
    </PageShell>
  );
}
