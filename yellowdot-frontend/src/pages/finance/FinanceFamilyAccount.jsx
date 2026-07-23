/**
 * FinanceFamilyAccount.jsx — Family Account (Finance Platform facet)
 * ─────────────────────────────────────────────────────────────────────────
 * Design System v2: PageShell -> PageHeader -> FinanceSubNav -> family-ID
 * search -> yd-fin-balance-card -> DataTable (payment history). No KpiRow
 * here — there is exactly one dominant number to show (Credit Balance),
 * which is what `.yd-fin-balance-card` (styles/finance.css) exists for.
 * Matches the sibling Finance screens (FinanceLedger/FinancePayments/
 * FinanceInvoices/FinanceRefunds.jsx): FinanceSubNav sits right under
 * PageHeader as the first body element, local `formatMoney` helper,
 * shared error-banner styling.
 *
 * Data sources actually available (see financeApi.js / familyAccountService.js
 * on the backend — read directly to confirm field names, not guessed):
 *   - financeApi.familyAccount.get/ensure(familyId) -> { success, account }
 *     account = { familyId, creditBalance, paymentAllocationPreference,
 *                 createdAt, updatedAt, studentIds }
 *     Note: there is no `schoolId` or `outstandingAmount` field on this
 *     object — schoolId is resolved server-side from the auth context, and
 *     "outstanding balance" would require aggregating every linked
 *     student's ledger, which no endpoint exposes yet. We do NOT fabricate
 *     that number (see report to caller for the explicit deviation).
 *   - financeApi.payments.listForFamily(familyId) -> { success, payments, total }
 *   - financeApi.familyAccount.list() -> { success, accounts } (added after
 *     this screen was originally specced) -- used below purely as an
 *     optional quick-pick so staff can browse known families instead of
 *     needing to already know a family ID; the manual ID search box remains
 *     the primary, always-correct lookup path.
 *
 * "Linked students": the account response does include `studentIds` (raw
 * IDs from the family document), so it's not fully fabricated -- but there
 * is no student-name-lookup endpoint wired into this client yet. We show
 * friendly names for any linked student we can resolve from that family's
 * own payment history (which already carries `studentName`), and fall back
 * to the bare ID otherwise -- real data only, no placeholder text.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, PiggyBank } from "lucide-react";
import financeApi from "../../services/financeApi";
import FinanceSubNav from "./components/FinanceSubNav";
import FinancePlatformDisabled from "./components/FinancePlatformDisabled";
import useFinancePlatformStatus from "./hooks/useFinancePlatformStatus";
import {
  PageShell, PageHeader, DataTable, Button, Drawer,
  Input, Select, Field, EmptyState,
} from "../../components/ui";

function formatMoney(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function FinanceFamilyAccount() {
  const { enabled: financeEnabled } = useFinancePlatformStatus();
  const [familyIdInput, setFamilyIdInput] = useState("");
  const [familyId, setFamilyId] = useState("");
  const [account, setAccount] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  // Optional quick-pick list, populated from the new school-wide browse
  // endpoint. Failure here is silent -- the manual ID search box still
  // works even if this list can't be fetched (e.g. older backend deploy).
  const [familyOptions, setFamilyOptions] = useState([]);

  const [creditDrawerOpen, setCreditDrawerOpen] = useState(false);
  const [creditDelta, setCreditDelta] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [creditSubmitting, setCreditSubmitting] = useState(false);
  const [creditError, setCreditError] = useState("");
  const [creditSuccess, setCreditSuccess] = useState("");

  useEffect(() => {
    if (!financeEnabled) return; // false while checking or disabled — skip the optional quick-pick fetch
    let cancelled = false;
    financeApi.familyAccount.list()
      .then(res => { if (!cancelled && res?.success) setFamilyOptions(res.accounts || []); })
      .catch(() => { /* optional quick-pick only -- search box remains the primary path */ });
    return () => { cancelled = true; };
  }, [financeEnabled]);

  const load = useCallback(async (idOverride) => {
    const targetId = (idOverride ?? familyIdInput).trim();
    if (!targetId || !financeEnabled) return;
    setLoading(true);
    setError("");
    try {
      // ensure() is idempotent -- initializes the finance facet the first
      // time a staff member looks up a family, same response shape as get().
      const [acctRes, payRes] = await Promise.all([
        financeApi.familyAccount.ensure(targetId),
        financeApi.payments.listForFamily(targetId),
      ]);
      if (acctRes?.success) setAccount(acctRes.account);
      if (payRes?.success) setPayments(payRes.payments || []);
      setFamilyId(targetId);
      setFamilyIdInput(targetId);
      setLoaded(true);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to load family account.");
      setAccount(null);
      setPayments([]);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [familyIdInput, financeEnabled]);

  // Best-effort studentId -> studentName map, built only from already-fetched
  // payment history -- no new lookup endpoint invented for this page.
  const studentNameById = useMemo(() => {
    const map = {};
    payments.forEach(p => { if (p.studentId && p.studentName) map[p.studentId] = p.studentName; });
    return map;
  }, [payments]);

  const linkedStudents = account?.studentIds || [];

  const familySelectOptions = useMemo(() => familyOptions.map(a => ({
    value: a.familyId,
    label: `${a.familyId}${Number(a.creditBalance) > 0 ? ` — ${formatMoney(a.creditBalance)} credit` : ""}`,
  })), [familyOptions]);

  async function submitCreditAdjustment() {
    const delta = Number(creditDelta);
    setCreditError("");
    if (!isFinite(delta) || delta === 0) {
      setCreditError("Enter a non-zero amount.");
      return;
    }
    setCreditSubmitting(true);
    try {
      const res = await financeApi.familyAccount.adjustCredit(familyId, delta, creditReason.trim());
      if (res?.success) {
        setAccount(a => ({ ...a, creditBalance: res.creditBalance }));
        setCreditDrawerOpen(false);
        setCreditDelta("");
        setCreditReason("");
        setCreditSuccess("Credit adjustment applied.");
        setTimeout(() => setCreditSuccess(""), 4000);
      }
    } catch (err) {
      setCreditError(err.response?.data?.error || err.message || "Failed to adjust credit.");
    } finally {
      setCreditSubmitting(false);
    }
  }

  const columns = useMemo(() => [
    { key: "receiptNumber", label: "Receipt Number", sortable: true, filterable: true, width: 160 },
    {
      key: "studentName", label: "Student", sortable: true, width: 170,
      render: (v, row) => v || studentNameById[row.studentId] || row.studentId || "—",
    },
    {
      key: "amount", label: "Amount", sortable: true, width: 120,
      render: (v) => <span className="yd-fin-money">{formatMoney(v)}</span>,
    },
    { key: "paymentMode", label: "Mode", width: 120 },
    { key: "status", label: "Status", type: "badge", sortable: true, filterable: true,
      filterType: "select", filterOptions: ["Recorded", "Allocated", "PartiallyAllocated", "Refunded", "PartiallyRefunded", "Reversed"], width: 150 },
    { key: "paymentDate", label: "Date", sortable: true, width: 120 },
  ], [studentNameById]);

  const creditBalance = Number(account?.creditBalance || 0);

  return (
    <PageShell
      header={<PageHeader title="Family Accounts" subtitle={account ? `Family ${account.familyId}` : "Look up a family to view its finance account"} />}
    >
      <FinanceSubNav active="family-account" />

      {financeEnabled === false ? (
        <FinancePlatformDisabled />
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 12, flexWrap: "wrap", maxWidth: 640 }}>
            <div style={{ minWidth: 220 }}>
              <Input
                label="Family ID"
                placeholder="Enter family ID…"
                value={familyIdInput}
                onChange={(e) => setFamilyIdInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") load(); }}
                leftIcon={<Search size={14} strokeWidth={2} />}
              />
            </div>
            <Button variant="primary" onClick={() => load()} loading={loading} disabled={!familyIdInput.trim()}>
              Load
            </Button>
            {familySelectOptions.length > 0 && (
              <div style={{ minWidth: 240 }}>
                <Select
                  label="Or choose an existing family"
                  placeholder="Select a family…"
                  options={familySelectOptions}
                  value=""
                  onChange={(e) => { if (e.target.value) load(e.target.value); }}
                />
              </div>
            )}
          </div>

          {error && (
            <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
              {error}
            </div>
          )}

          {!loaded && !loading && (
            <EmptyState
              variant="first-time"
              title="Look up a family"
              description="Enter a family ID above to view its credit balance and payment history."
            />
          )}

          {loaded && !account && !loading && !error && (
            <EmptyState
              variant="default"
              title="Family not found"
              description="No family account exists for that ID in this school."
            />
          )}

          {account && (
            <>
              <div className="yd-fin-balance-card" style={{ marginBottom: 20, maxWidth: 420 }}>
                <div className="yd-fin-balance-label">Credit Balance</div>
                <div className={`yd-fin-balance-value ${creditBalance > 0 ? "yd-fin-money--credit" : ""}`}>
                  {formatMoney(creditBalance)}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 12 }}>
                  {linkedStudents.length > 0 ? (
                    <span style={{ fontSize: 12, color: "var(--yd-text-muted)" }}>
                      {linkedStudents.length} linked student{linkedStudents.length === 1 ? "" : "s"}:{" "}
                      {linkedStudents.map(sid => studentNameById[sid] || sid).join(", ")}
                    </span>
                  ) : <span />}
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<PiggyBank size={13} strokeWidth={2} />}
                    onClick={() => setCreditDrawerOpen(true)}
                  >
                    Apply Credit Adjustment
                  </Button>
                </div>
              </div>

              <DataTable
                tableId="finance-family-payments"
                columns={columns}
                data={payments}
                loading={loading}
                entityLabel="payments"
                searchPlaceholder="Search receipt number, student, mode…"
                exportFilename={`family-${familyId}-payments`}
                exportTitle="Family Payment History"
                empty={{
                  title: "No payments recorded yet",
                  description: "Record the family's first payment to begin.",
                }}
              />
            </>
          )}
        </>
      )}

      <Drawer
        isOpen={creditDrawerOpen}
        onClose={() => setCreditDrawerOpen(false)}
        title="Apply Credit Adjustment"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreditDrawerOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={creditSubmitting} onClick={submitCreditAdjustment}>Apply</Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {creditError && (
            <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
              {creditError}
            </div>
          )}
          {creditSuccess && (
            <div style={{ background: "var(--yd-success-soft)", color: "var(--yd-success)", border: "1px solid var(--yd-success-border)", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
              {creditSuccess}
            </div>
          )}
          <p style={{ fontSize: 12.5, color: "var(--yd-text-muted)", lineHeight: 1.55, margin: 0 }}>
            This is a direct manual adjustment to the family's shared credit balance
            (positive = issue credit, negative = deduct credit). It does not consume
            credit against a specific invoice or ledger entry — that happens
            automatically at payment time via the credit-consumption flow.
          </p>
          <Field label="Delta Amount (₹)" hint="Positive to add credit, negative to deduct." required>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="e.g. 500 or -500"
              value={creditDelta}
              onChange={(e) => setCreditDelta(e.target.value)}
            />
          </Field>
          <Field label="Reason" required>
            <Input
              placeholder="Why is this adjustment being made?"
              value={creditReason}
              onChange={(e) => setCreditReason(e.target.value)}
            />
          </Field>
        </div>
      </Drawer>
    </PageShell>
  );
}
