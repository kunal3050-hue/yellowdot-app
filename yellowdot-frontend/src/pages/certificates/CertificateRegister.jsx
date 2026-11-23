/**
 * CertificateRegister.jsx — Certificates · the issuance register
 * ─────────────────────────────────────────────────────────────────────
 * Design System v2 / Platform Layout Standard:
 *   PageShell -> PageHeader -> KpiRow -> DataTable
 * Search, filters, sort, export, bulk actions and pagination all come from
 * DataTable's own toolbar — no hand-rolled table or toolbar here.
 *
 * This screen is the module's centre of gravity, not a list bolted onto an
 * issue form. The register answers the two questions the module exists for —
 * "did this child get her certificate?" and "reprint the one we handed over in
 * March" — so it is the landing route, and issuing is a destination off it.
 *
 * Printing goes through CertificatePrintPortal and the real print stylesheet,
 * which is also how a certificate becomes a PDF: every modern browser's print
 * dialog can save to one. That keeps exactly one renderer for the document, so
 * what staff preview is what comes out.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Award, Printer } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import certificateService from "../../services/certificateService";
import {
  PageShell, PageHeader, KpiRow, KpiCard, DataTable, Badge, Button, Modal, Input,
} from "../../components/ui";
import CertificateDocument, { CertificatePrintPortal } from "./CertificateDocument";
import {
  TYPE_BY_VALUE, TYPE_OPTIONS, STATUS_OPTIONS, STATUS_BADGE, formatAwardDate,
} from "./certificateMeta";

/** Two frames later the print portal is laid out; then the dialog can open. */
function printNow() {
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
}

export default function CertificateRegister() {
  const navigate = useNavigate();
  const { canDo } = useAuth();

  const [rows,     setRows]     = useState([]);
  const [summary,  setSummary]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  const [selected, setSelected] = useState(null);   // the previewed certificate
  const [printSet, setPrintSet] = useState([]);     // what the print portal holds

  const [revoking,     setRevoking]     = useState(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeBusy,   setRevokeBusy]   = useState(false);

  // Issuing and revoking are admin-tier; the register itself is readable by
  // any staff role, so a teacher sees the log without the write affordances.
  const canIssue  = canDo("certificates", "create");
  const canRevoke = canDo("certificates", "delete");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [list, sum] = await Promise.all([
        certificateService.listCertificates(),
        certificateService.getSummary(),
      ]);
      if (list?.success) setRows(list.certificates || []);
      if (sum?.success)  setSummary(sum.summary || null);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to load certificates.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function openPreview(row) {
    setSelected(row);
    setPrintSet([row]);        // so Print, and a bare Ctrl+P, both do the right thing
  }

  function closePreview() {
    setSelected(null);
    setPrintSet([]);
  }

  /** Print a set of certificates as one job, one page each. */
  function printRows(batch) {
    if (!batch.length) return;
    setPrintSet(batch);
    printNow();
  }

  async function confirmRevoke() {
    if (!revoking) return;
    setRevokeBusy(true);
    try {
      await certificateService.revokeCertificate(revoking.certificateId, revokeReason);
      setRevoking(null);
      setRevokeReason("");
      closePreview();
      await load();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not revoke the certificate.");
    } finally {
      setRevokeBusy(false);
    }
  }

  // DataTableToolbar reads `filterOptions` for select/multiselect filters and
  // renders an EMPTY dropdown without them, so the two data-driven filters
  // derive their options from the rows actually in the register.
  const classOptions = useMemo(() => {
    const names = [...new Set(rows.map(r => r.className).filter(Boolean))].sort();
    return names.map(n => ({ value: n, label: n }));
  }, [rows]);

  const yearOptions = useMemo(() => {
    const years = [...new Set(rows.map(r => r.academicYear).filter(Boolean))].sort().reverse();
    return years.map(y => ({ value: y, label: y }));
  }, [rows]);

  const columns = useMemo(() => [
    { key: "serialNumber", label: "Serial", sortable: true, width: 150 },
    {
      key: "studentName", label: "Child", type: "avatar", sortable: true, filterable: true, width: 200,
      avatarName: r => r.studentName,
    },
    {
      key: "className", label: "Class", sortable: true, filterable: true,
      filterType: "multiselect", filterOptions: classOptions, width: 130,
    },
    {
      key: "type", label: "Type", sortable: true, filterable: true, filterType: "select",
      filterOptions: TYPE_OPTIONS, width: 170,
      render: (v) => {
        const t = TYPE_BY_VALUE[v];
        return <Badge variant={t?.badge || "neutral"}>{t?.label || v}</Badge>;
      },
      exportValue: (v) => TYPE_BY_VALUE[v]?.label || v,
    },
    { key: "title", label: "Title", sortable: true, width: 220 },
    {
      key: "awardDate", label: "Awarded", sortable: true, width: 140,
      render: (v) => formatAwardDate(v) || "—",
    },
    {
      key: "academicYear", hidden: true, label: "Academic Year", sortable: true, filterable: true,
      filterType: "multiselect", filterOptions: yearOptions, width: 130,
    },
    {
      key: "status", label: "Status", sortable: true, filterable: true, filterType: "select",
      filterOptions: STATUS_OPTIONS, width: 120,
      render: (v) => <Badge variant={STATUS_BADGE[v] || "neutral"}>{v}</Badge>,
    },
  ], [classOptions, yearOptions]);

  // Reprinting a whole batch is the realistic second visit to this screen:
  // the certificates were printed on graduation day and three children were
  // absent. Selecting those three and printing once beats opening each.
  const bulkActions = [
    { key: "print", label: "Print Selected", onClick: printRows },
  ];

  const byType = summary?.byType || {};

  return (
    <PageShell
      header={
        <PageHeader
          title="Certificates"
          tag="Child Journey"
          subtitle={`${rows.length} certificate${rows.length === 1 ? "" : "s"} in the register`}
          onRefresh={load}
          primaryAction={canIssue ? {
            label: "Issue Certificates",
            icon: <Award size={14} strokeWidth={2} />,
            onClick: () => navigate("/certificates/issue"),
          } : undefined}
        />
      }
      kpis={
        // Four cards: .yd-kpi-row is repeat(auto-fit, minmax(180px, 1fr)) with a
        // 12px gap, so four need 4*180 + 3*12 = 756px before they wrap.
        <KpiRow maxWidth={960}>
          <KpiCard label="Issued"        value={summary?.issued  ?? 0} loading={loading} />
          <KpiCard label="Graduation"    value={byType.graduation ?? 0} loading={loading} />
          <KpiCard label="Achievements"  value={byType.achievement ?? 0} loading={loading} />
          <KpiCard label="Drafts"        value={summary?.drafts  ?? 0} loading={loading} />
        </KpiRow>
      }
    >
      {error && (
        <div style={{
          background: "var(--yd-danger-soft)", color: "var(--yd-danger)",
          border: "1px solid var(--yd-danger-border)", borderRadius: 10,
          padding: "10px 14px", marginBottom: 16, fontSize: 13,
        }}>
          {error}
        </div>
      )}

      <DataTable
        tableId="certificate-register"
        columns={columns}
        data={rows}
        loading={loading}
        selectable
        entityLabel="certificates"
        searchPlaceholder="Search by child, serial number or title…"
        exportFilename="certificate-register"
        exportTitle="Certificate Register"
        exportFormats={["csv", "excel", "pdf", "print"]}
        bulkActions={bulkActions}
        onRowClick={openPreview}
        empty={{
          title: "No certificates yet",
          description: canIssue
            ? "Issue a certificate to a child or a whole class and it will appear here."
            : "Certificates issued by your administrator will appear here.",
          action: canIssue
            ? { label: "+ Issue Certificates", onClick: () => navigate("/certificates/issue") }
            : undefined,
        }}
      />

      {/* ── Preview ─────────────────────────────────────────────────────── */}
      <Modal
        isOpen={!!selected}
        onClose={closePreview}
        title={selected ? `${selected.studentName} — ${selected.serialNumber}` : ""}
        size="xl"
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: 8 }}>
            <div>
              {canRevoke && selected?.status !== "revoked" && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => { setRevokeReason(""); setRevoking(selected); }}
                >
                  Revoke
                </Button>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="outline" size="sm" onClick={closePreview}>Close</Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Printer size={13} strokeWidth={2} />}
                onClick={printNow}
              >
                Print
              </Button>
            </div>
          </div>
        }
      >
        {selected && (
          <>
            <div className="yd-cert-stage">
              <CertificateDocument certificate={selected} />
            </div>
            <p style={{ marginTop: 12, marginBottom: 0, fontSize: 12, color: "var(--yd-text-muted)" }}>
              Printed at A4 landscape. To save a PDF instead, choose
              “Save as PDF” as the destination in the print dialog.
              {selected.status === "revoked" && " This certificate has been revoked and prints watermarked."}
            </p>
          </>
        )}
      </Modal>

      {/* ── Revoke, with a reason that goes onto the record ─────────────── */}
      <Modal
        isOpen={!!revoking}
        onClose={() => setRevoking(null)}
        title="Revoke this certificate?"
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, width: "100%" }}>
            <Button variant="outline" size="sm" onClick={() => setRevoking(null)}>Cancel</Button>
            <Button
              variant="danger"
              size="sm"
              loading={revokeBusy}
              disabled={!revokeReason.trim()}
              onClick={confirmRevoke}
            >
              Revoke Certificate
            </Button>
          </div>
        }
      >
        <p style={{ marginTop: 0, fontSize: 13, color: "var(--yd-charcoal)" }}>
          {revoking?.serialNumber} was issued to <strong>{revoking?.studentName}</strong>.
          Revoking keeps the row in the register — it is the record of what was handed
          to a parent — and marks it withdrawn. A graduation certificate can be
          reissued once the old one is revoked.
        </p>
        <Input
          label="Reason"
          placeholder="e.g. name misspelt, issued to the wrong child"
          value={revokeReason}
          onChange={(e) => setRevokeReason(e.target.value)}
          hint="Stored on the certificate so the register explains itself later."
        />
      </Modal>

      <CertificatePrintPortal certificates={printSet} />
    </PageShell>
  );
}
