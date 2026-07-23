/**
 * FinanceLedger.jsx — Student Ledger screen
 * ─────────────────────────────────────────────────────────────────────────
 * Design System v2 / Platform Layout Standard: PageShell -> PageHeader ->
 * FinanceSubNav -> balance card -> DataTable (own toolbar handles Entry
 * Type filter/search/sort/export; a date-range pair lives in toolbarExtra
 * since DataTable's own toolbar has no built-in date-range filter type).
 * Ledger entries are immutable — no edit/delete action anywhere on this
 * page, only "View" for the source reference.
 */
import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import financeApi from "../../services/financeApi";
import FinanceSubNav from "./components/FinanceSubNav";
import FinancePlatformDisabled from "./components/FinancePlatformDisabled";
import useFinancePlatformStatus from "./hooks/useFinancePlatformStatus";
import {
  PageShell, PageHeader, DataTable, StatusBadge, Button, Input, Drawer, EmptyState,
} from "../../components/ui";

function formatMoney(n) {
  const v = Number(n || 0);
  return `₹${Math.abs(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const ENTRY_TYPE_OPTIONS = [
  { value: "charge",        label: "Charge" },
  { value: "payment",       label: "Payment" },
  { value: "discount",      label: "Discount" },
  { value: "scholarship",   label: "Scholarship" },
  { value: "creditApplied", label: "Credit Applied" },
  { value: "refund",        label: "Refund" },
  { value: "lateFee",       label: "Late Fee" },
  { value: "adjustment",    label: "Adjustment" },
];

export default function FinanceLedger() {
  const { enabled: financeEnabled } = useFinancePlatformStatus();
  const [studentIdInput, setStudentIdInput] = useState("");
  const [studentId, setStudentId] = useState("");
  const [ledger, setLedger] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedEntry, setSelectedEntry] = useState(null);

  const load = useCallback(async (id) => {
    if (!id || !financeEnabled) return; // financeEnabled is false while checking or disabled
    setLoading(true);
    setError("");
    try {
      const [ledgerRes, entriesRes] = await Promise.all([
        financeApi.ledger.get(id),
        financeApi.ledger.listEntries(id, 200),
      ]);
      setLedger(ledgerRes.ledger || null);
      setEntries(entriesRes.entries || []);
    } catch (err) {
      setLedger(null);
      setEntries([]);
      setError(err.response?.data?.error || err.message || "Failed to load ledger.");
    } finally {
      setLoading(false);
    }
  }, [financeEnabled]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (studentId) load(studentId); }, [studentId, load]);

  function handleLoadStudent() {
    setStudentId(studentIdInput.trim());
  }

  const filteredEntries = entries.filter(e => {
    if (dateFrom && (e.createdAt || "") < dateFrom) return false;
    if (dateTo && (e.createdAt || "") > `${dateTo}T23:59:59`) return false;
    return true;
  });

  const columns = [
    { key: "createdAt", label: "Date", sortable: true, width: 160,
      render: (v) => v ? new Date(v).toLocaleString("en-IN") : "—" },
    { key: "type", label: "Type", type: "badge", sortable: true, filterable: true,
      filterType: "select", filterOptions: ENTRY_TYPE_OPTIONS, width: 130 },
    { key: "description", label: "Description", width: 260 },
    { key: "signedAmount", label: "Amount", sortable: true, width: 140,
      render: (v) => (
        <span className={`yd-fin-money ${Number(v) > 0 ? "yd-fin-money--owed" : "yd-fin-money--credit"}`}>
          {Number(v) > 0 ? "+" : "−"}{formatMoney(v)}
        </span>
      ) },
    { key: "sourceType", label: "Source", width: 120 },
    { key: "entryId", label: "", type: "actions", width: 80,
      actions: (row) => (
        <Button variant="outline" size="xs" onClick={() => setSelectedEntry(row)}>View</Button>
      ) },
  ];

  return (
    <PageShell
      header={
        <PageHeader
          title="Student Ledger"
          subtitle={ledger ? `Ledger for student ${ledger.studentId}` : "Look up a student to view their ledger"}
        />
      }
    >
      <FinanceSubNav active="ledger" />

      {financeEnabled === false ? (
        <FinancePlatformDisabled />
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 20, maxWidth: 420 }}>
            <Input
              label="Student ID"
              placeholder="e.g. YD019"
              value={studentIdInput}
              onChange={(e) => setStudentIdInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleLoadStudent(); }}
            />
            <Button variant="primary" leftIcon={<Search size={14} strokeWidth={2} />} onClick={handleLoadStudent}>
              Load
            </Button>
          </div>

          {error && (
            <div style={{ background: "var(--yd-danger-soft)", color: "var(--yd-danger)", border: "1px solid var(--yd-danger-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
              {error}
            </div>
          )}

          {!studentId && !loading && (
            <EmptyState
              variant="first-time"
              title="Enter a student ID to view their ledger"
              description="The Student Ledger shows the running balance, every charge, payment, credit, refund and adjustment for one student."
            />
          )}

          {studentId && ledger && (
            <>
              <div className="yd-fin-balance-card" style={{ marginBottom: 20, maxWidth: 320 }}>
                <div className="yd-fin-balance-label">Current Balance</div>
                <div
                  className="yd-fin-balance-value"
                  style={{ color: ledger.currentBalance > 0 ? "var(--yd-danger)" : "var(--yd-success)" }}
                >
                  {ledger.currentBalance > 0 ? formatMoney(ledger.currentBalance) : formatMoney(ledger.currentBalance)}
                </div>
                <div style={{ fontSize: 12, color: "var(--yd-text-muted)" }}>
                  {ledger.currentBalance > 0 ? "Amount owed" : ledger.currentBalance < 0 ? "Credit balance" : "Settled"}
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <Input type="date" label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                <Input type="date" label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>

              <DataTable
                tableId="finance-ledger-entries"
                columns={columns}
                data={filteredEntries}
                loading={loading}
                entityLabel="ledger entries"
                searchPlaceholder="Search description…"
                exportFilename={`ledger-${studentId}`}
                exportTitle="Student Ledger"
                empty={{
                  title: "No ledger entries yet",
                  description: "Charges will appear here once a billing plan generates an invoice.",
                }}
              />
            </>
          )}
        </>
      )}

      <Drawer
        isOpen={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
        title="Ledger Entry"
      >
        {selectedEntry && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div><strong>Type:</strong> <StatusBadge status={selectedEntry.type} /></div>
            <div><strong>Amount:</strong> {selectedEntry.signedAmount > 0 ? "+" : "−"}{formatMoney(selectedEntry.signedAmount)}</div>
            <div><strong>Description:</strong> {selectedEntry.description || "—"}</div>
            <div><strong>Source:</strong> {selectedEntry.sourceType} {selectedEntry.sourceId ? `(${selectedEntry.sourceId})` : ""}</div>
            <div><strong>Created:</strong> {selectedEntry.createdAt ? new Date(selectedEntry.createdAt).toLocaleString("en-IN") : "—"}</div>
            <div><strong>Created By:</strong> {selectedEntry.createdBy || "—"}</div>
            <div style={{ fontSize: 12, color: "var(--yd-text-muted)", marginTop: 8 }}>
              Ledger entries are immutable — corrections are always made via a new offsetting entry, never an edit to this one.
            </div>
          </div>
        )}
      </Drawer>
    </PageShell>
  );
}
