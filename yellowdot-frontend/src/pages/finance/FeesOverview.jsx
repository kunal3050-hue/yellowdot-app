/**
 * FeesOverview.jsx — who owes what
 * ─────────────────────────────────────────────────────────────────
 * One row per student: billed, paid, outstanding, status. This is the
 * screen a school actually opens to answer "who hasn't paid?".
 *
 * Also hosts monthly generation, behind a dry-run preview — the button
 * shows exactly how many invoices it will raise, and for whom, before
 * anything is written.
 */

import { useCallback, useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { PageHeader, StatsCard, Table, StatusBadge, Button, Modal } from "../../components/ui";
import { INR } from "../../utils/currency";
import financeApi from "../../services/financeApi";
import FinanceNav from "./FinanceNav";

export default function FeesOverview() {
  const [rows,    setRows]    = useState([]);
  const [totals,  setTotals]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  // Generation is two-phase: preview (dry run) then confirm.
  const [preview,    setPreview]    = useState(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await financeApi.summary();
      setRows(r.rows || []);
      setTotals(r.totals || null);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Couldn't load fees.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runPreview() {
    setGenerating(true);
    try {
      setPreview(await financeApi.generate({ dryRun: true }));
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function confirmGenerate() {
    setGenerating(true);
    try {
      await financeApi.generate({});
      setPreview(null);
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setGenerating(false);
    }
  }

  const columns = [
    { key: "studentName", label: "Student",
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v || "—"}</div>
          <div style={{ fontSize: 11, color: "var(--yd-text-3)" }}>{r.studentId} · {r.class || "—"}</div>
        </div>
      ) },
    { key: "invoiceCount", label: "Invoices", align: "center" },
    { key: "billed",  label: "Billed",      align: "right", render: v => INR(v) },
    { key: "paid",    label: "Paid",        align: "right",
      render: v => <span style={{ color: "var(--yd-success)" }}>{INR(v)}</span> },
    { key: "balance", label: "Outstanding", align: "right",
      render: v => <span style={{ fontWeight: 700, color: v > 0 ? "var(--yd-danger)" : "var(--yd-text-3)" }}>{INR(v)}</span> },
    { key: "status",  label: "Status",
      render: v => <StatusBadge status={v} /> },
  ];

  return (
    <div className="yd-page">
      <Sidebar />
      <div className="yd-content" style={{ padding: 24, overflow: "auto" }}>
        <PageHeader
          title="Fees"
          subtitle={totals ? `${totals.students} students · ${INR(totals.balance)} outstanding` : "Loading…"}
          actions={
            <Button variant="primary" onClick={runPreview} disabled={generating || loading}>
              Generate this month
            </Button>
          }
        />
        <FinanceNav />

        {error && (
          <div style={{
            background: "var(--yd-danger-soft)", border: "1px solid var(--yd-danger-border)",
            color: "var(--yd-danger)", borderRadius: 10, padding: "10px 14px",
            fontSize: 13, marginBottom: 16,
          }}>{error}</div>
        )}

        {totals && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 20 }}>
            <StatsCard label="Students"    value={totals.students} />
            <StatsCard label="Billed"      value={INR(totals.billed)} />
            <StatsCard label="Collected"   value={INR(totals.paid)}    color="var(--yd-success)" />
            <StatsCard label="Outstanding" value={INR(totals.balance)} color="var(--yd-danger)" />
          </div>
        )}

        <Table
          columns={columns}
          data={rows}
          loading={loading}
          empty={{ icon: "💳", title: "No students yet",
                   description: "Add students, create a fee template, then generate the month's invoices." }}
        />

        {/* Dry run first — nothing is written until this is confirmed. */}
        <Modal isOpen={!!preview} onClose={() => setPreview(null)} title="Generate this month's invoices">
          {preview && (
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
              <p>
                This will raise <strong>{preview.createdCount}</strong> invoice
                {preview.createdCount === 1 ? "" : "s"} for <strong>{preview.period}</strong>.
              </p>
              {preview.skipped?.length > 0 && (
                <p style={{ color: "var(--yd-text-3)" }}>
                  {preview.skipped.length} skipped — already invoiced this period, or inactive.
                </p>
              )}
              {preview.unmatched?.length > 0 && (
                <p style={{ color: "var(--yd-warn)" }}>
                  {preview.unmatched.length} student{preview.unmatched.length === 1 ? "" : "s"} have no
                  matching fee template and will not be billed.
                </p>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "flex-end" }}>
                <Button variant="outline" onClick={() => setPreview(null)}>Cancel</Button>
                <Button variant="primary" onClick={confirmGenerate}
                        disabled={generating || preview.createdCount === 0}>
                  {generating ? "Generating…" : `Create ${preview.createdCount} invoice${preview.createdCount === 1 ? "" : "s"}`}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}
