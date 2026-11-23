/**
 * IssueCertificates.jsx — Certificates · issue to one child or a whole class
 * ─────────────────────────────────────────────────────────────────────
 * One page rather than a wizard, because the four decisions (what kind, what
 * it says, who gets it, does it look right) are all visible at once and the
 * preview has to react to every one of them. A wizard would hide the preview
 * behind the step that changes it.
 *
 * Bulk is the default path, not an advanced option: graduation day is thirty
 * certificates, and an issue screen that does one at a time would be used
 * thirty times. Children are picked from a class, so the common case is two
 * clicks — choose the class, select all.
 *
 * For the attendance award the eligible children are computed from attendance
 * already recorded, so nobody tallies a register by hand.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Award, Printer, Search } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import certificateService from "../../services/certificateService";
import studentService from "../../services/studentService";
import academicsService from "../../services/academicsService";
import {
  PageShell, PageHeader, Card, SectionHeader, Button, Badge, Input, Select,
} from "../../components/ui";
import CertificateDocument, { CertificatePrintPortal } from "./CertificateDocument";
import {
  CERTIFICATE_TYPES, TYPE_BY_VALUE, TEMPLATES, ATTENDANCE_THRESHOLDS,
  todayISO, academicYearOf,
} from "./certificateMeta";

function printNow() {
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
}

/** First day of the academic year containing `dateISO` (June 1). */
function academicYearStart(dateISO) {
  const d = new Date(`${dateISO}T00:00:00`);
  const year = d.getMonth() + 1 >= 6 ? d.getFullYear() : d.getFullYear() - 1;
  return `${year}-06-01`;
}

export default function IssueCertificates() {
  const navigate = useNavigate();
  const { canDo, user } = useAuth();
  const canIssue = canDo("certificates", "create");

  // ── What kind ──
  const [type, setType] = useState("graduation");

  // ── What it says ──
  const [title,     setTitle]     = useState(TYPE_BY_VALUE.graduation.defaultTitle);
  const [citation,  setCitation]  = useState(TYPE_BY_VALUE.graduation.defaultCitation);
  const [awardDate, setAwardDate] = useState(todayISO());
  const [template,  setTemplate]  = useState("classic");
  const [signatoryName,        setSignatoryName]        = useState(user?.displayName || user?.name || "");
  const [signatoryDesignation, setSignatoryDesignation] = useState("Principal");

  // ── Who gets it ──
  const [classes,    setClasses]    = useState([]);
  const [students,   setStudents]   = useState([]);
  const [classFilter, setClassFilter] = useState("");
  const [picked,     setPicked]     = useState(() => new Set());
  const [search,     setSearch]     = useState("");

  // ── Attendance eligibility ──
  const [eligFrom,      setEligFrom]      = useState(() => academicYearStart(todayISO()));
  const [eligTo,        setEligTo]        = useState(todayISO());
  const [eligThreshold, setEligThreshold] = useState("100");
  const [eligBusy,      setEligBusy]      = useState(false);
  const [eligResult,    setEligResult]    = useState(null);

  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [busy,    setBusy]    = useState(false);
  const [result,  setResult]  = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [cls, studs] = await Promise.all([
        academicsService.getClasses(),
        studentService.getStudents(),
      ]);
      setClasses(cls || []);
      setStudents((studs || []).filter(s => (s.status || "Active") === "Active"));
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to load children.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  /** Switching type re-seeds the wording, but only the untouched defaults. */
  function changeType(next) {
    const prev = TYPE_BY_VALUE[type];
    const now  = TYPE_BY_VALUE[next];
    setType(next);
    if (title === prev.defaultTitle)       setTitle(now.defaultTitle);
    if (citation === prev.defaultCitation) setCitation(now.defaultCitation);
    setResult(null);
  }

  const classOptions = useMemo(
    () => [{ value: "", label: "All classes" }, ...classes.map(c => ({ value: c.name, label: c.name }))],
    [classes],
  );

  // Students carry their class as a NAME string throughout this app, so that
  // is what the filter compares and what gets frozen onto the certificate.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students
      .filter(s => !classFilter || s.class === classFilter)
      .filter(s => !q
        || (s.studentName || "").toLowerCase().includes(q)
        || (s.studentId   || "").toLowerCase().includes(q))
      .sort((a, b) => (a.studentName || "").localeCompare(b.studentName || ""));
  }, [students, classFilter, search]);

  const pickedStudents = useMemo(
    () => students.filter(s => picked.has(s.studentId)),
    [students, picked],
  );

  function toggle(studentId) {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId); else next.add(studentId);
      return next;
    });
    setResult(null);
  }

  function selectAllVisible() {
    setPicked(prev => new Set([...prev, ...visible.map(s => s.studentId)]));
    setResult(null);
  }

  function clearPicked() {
    setPicked(new Set());
    setResult(null);
  }

  async function findEligible() {
    setEligBusy(true);
    setError("");
    try {
      const res = await certificateService.getAttendanceEligibility({
        from: eligFrom, to: eligTo, threshold: eligThreshold, classId: classFilter || undefined,
      });
      setEligResult(res);
      // Select exactly the eligible children — the point is that staff do not
      // have to transcribe the list.
      const ids = new Set((res.eligible || []).map(e => e.studentId));
      setPicked(ids);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not work out eligibility.");
    } finally {
      setEligBusy(false);
    }
  }

  /** The draft the preview renders — the first picked child, or a placeholder. */
  const previewCertificate = useMemo(() => {
    const first = pickedStudents[0];
    return {
      type, title, citation, awardDate, template,
      signatoryName, signatoryDesignation,
      studentName: first?.studentName || "Child’s Name",
      className:   first?.class || classFilter || "",
      serialNumber: "",
      status: "issued",
    };
  }, [type, title, citation, awardDate, template, signatoryName,
      signatoryDesignation, pickedStudents, classFilter]);

  async function issue() {
    if (!pickedStudents.length) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await certificateService.issueBulk({
        type, title, citation, awardDate, template,
        signatoryName, signatoryDesignation,
        students: pickedStudents.map(s => ({
          studentId:   s.studentId,
          studentName: s.studentName,
          classId:     s.class || "",
          className:   s.class || "",
        })),
      });
      setResult(res);
      setPicked(new Set());
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not issue the certificates.");
    } finally {
      setBusy(false);
    }
  }

  const activeType = TYPE_BY_VALUE[type];
  const issued = result?.issued || [];

  const issueLabel = pickedStudents.length
    ? `Issue ${pickedStudents.length} Certificate${pickedStudents.length === 1 ? "" : "s"}`
    : "Issue Certificates";

  if (!canIssue) {
    return (
      <PageShell header={<PageHeader title="Issue Certificates" tag="Child Journey" />}>
        <Card>
          <p style={{ margin: 0, fontSize: 13, color: "var(--yd-text-muted)" }}>
            Issuing certificates is restricted to administrators. You can still
            view the register.
          </p>
          <div style={{ marginTop: 12 }}>
            <Button variant="outline" size="sm" onClick={() => navigate("/certificates")}>
              Back to the register
            </Button>
          </div>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      header={
        <PageHeader
          title="Issue Certificates"
          tag="Child Journey"
          subtitle="Issue to one child or a whole class at once"
          backLabel="Certificates"
          onBack={() => navigate("/certificates")}
          primaryAction={{
            label: busy ? "Issuing…" : issueLabel,
            icon: <Award size={14} strokeWidth={2} />,
            onClick: issue,
            disabled: busy || !pickedStudents.length,
          }}
        />
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

      {/* ── Result ─────────────────────────────────────────────────────── */}
      {result && (
        <Card style={{ marginBottom: 16, borderColor: "var(--yd-success-border)", background: "var(--yd-success-soft)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <strong style={{ fontSize: 14, color: "var(--yd-charcoal)" }}>
                {issued.length} certificate{issued.length === 1 ? "" : "s"} issued
              </strong>
              {issued.length > 0 && (
                <div style={{ fontSize: 12, color: "var(--yd-text-muted)", marginTop: 2 }}>
                  {issued[0].serialNumber}
                  {issued.length > 1 && ` — ${issued[issued.length - 1].serialNumber}`}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="outline" size="sm" onClick={() => navigate("/certificates")}>
                Open the register
              </Button>
              {issued.length > 0 && (
                <Button
                  variant="primary" size="sm"
                  leftIcon={<Printer size={13} strokeWidth={2} />}
                  onClick={printNow}
                >
                  Print all {issued.length}
                </Button>
              )}
            </div>
          </div>

          {result.skipped?.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--yd-success-border)" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--yd-charcoal)" }}>
                {result.skipped.length} skipped — already held one for this academic year:
              </div>
              <div style={{ fontSize: 12, color: "var(--yd-text-muted)", marginTop: 4 }}>
                {result.skipped.map(s => `${s.studentName}${s.serialNumber ? ` (${s.serialNumber})` : ""}`).join(", ")}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── 1. What kind ───────────────────────────────────────────────── */}
      <Card style={{ marginBottom: 16 }}>
        <SectionHeader title="Certificate type" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, marginTop: 12 }}>
          {CERTIFICATE_TYPES.map(t => {
            const active = t.value === type;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => changeType(t.value)}
                style={{
                  // Repeated, mutually-exclusive controls: yellow-light fill
                  // with a yellow border for the selected one, per the design
                  // system's rule that solid yellow is for the single primary
                  // action on the page (here: Issue, in the header).
                  textAlign: "left",
                  cursor: "pointer",
                  padding: "12px 14px",
                  borderRadius: "var(--yd-radius-md)",
                  border: `1px solid ${active ? "var(--yd-yellow)" : "var(--yd-border)"}`,
                  background: active ? "var(--yd-yellow-light)" : "var(--yd-surface)",
                  color: "var(--yd-charcoal)",
                  font: "inherit",
                }}
                aria-pressed={active}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{t.label}</span>
                  {t.oncePerYear && <Badge variant="neutral">once a year</Badge>}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--yd-text-muted)", marginTop: 4, lineHeight: 1.45 }}>
                  {t.blurb}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* ── 2. What it says ────────────────────────────────────────────── */}
      <Card style={{ marginBottom: 16 }}>
        <SectionHeader title="Wording and signature" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 12 }}>
          <Input
            label="Title" value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={activeType.defaultTitle}
          />
          <Input
            label="Award date" type="date" value={awardDate}
            onChange={(e) => setAwardDate(e.target.value)}
            hint={awardDate ? `Academic year ${academicYearOf(awardDate)}` : "Decides the academic year"}
          />
          <Input
            label="Signatory name" value={signatoryName}
            onChange={(e) => setSignatoryName(e.target.value)}
            placeholder="Printed above the signature line"
          />
          <Input
            label="Signatory designation" value={signatoryDesignation}
            onChange={(e) => setSignatoryDesignation(e.target.value)}
            placeholder="Principal"
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <label className="yd-label" htmlFor="cert-citation">Citation</label>
          <textarea
            id="cert-citation"
            className="yd-input"
            rows={2}
            value={citation}
            onChange={(e) => setCitation(e.target.value)}
            placeholder={activeType.defaultCitation}
            style={{ resize: "vertical", minHeight: 62 }}
          />
          <div style={{ fontSize: 11.5, color: "var(--yd-text-muted)", marginTop: 4 }}>
            Printed under the child’s name. The same line goes on every certificate in this batch.
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {TEMPLATES.map(t => {
            const active = t.value === template;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTemplate(t.value)}
                title={t.blurb}
                style={{
                  cursor: "pointer",
                  padding: "7px 14px",
                  borderRadius: "var(--yd-radius-button)",
                  border: `1px solid ${active ? "var(--yd-yellow)" : "var(--yd-border)"}`,
                  background: active ? "var(--yd-yellow-light)" : "var(--yd-surface)",
                  color: "var(--yd-charcoal)",
                  fontSize: 12.5,
                  fontWeight: active ? 600 : 500,
                }}
                aria-pressed={active}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </Card>

      {/* ── 3. Attendance eligibility (attendance type only) ───────────── */}
      {type === "attendance" && (
        <Card style={{ marginBottom: 16 }}>
          <SectionHeader
            title="Who qualifies"
            description="Worked out from attendance already recorded — nobody tallies a register by hand"
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginTop: 12, alignItems: "end" }}>
            <Input label="From" type="date" value={eligFrom} onChange={(e) => setEligFrom(e.target.value)} />
            <Input label="To"   type="date" value={eligTo}   onChange={(e) => setEligTo(e.target.value)} />
            <Select
              label="Threshold"
              value={eligThreshold}
              onChange={(e) => setEligThreshold(e.target.value)}
              options={ATTENDANCE_THRESHOLDS}
            />
            <Button
              variant="outline"
              leftIcon={<Search size={13} strokeWidth={2} />}
              loading={eligBusy}
              onClick={findEligible}
            >
              Find eligible children
            </Button>
          </div>

          {eligResult && (
            <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--yd-text-muted)" }}>
              {eligResult.eligible?.length || 0} of {eligResult.considered || 0} children meet{" "}
              {eligResult.threshold}%{classFilter ? ` in ${classFilter}` : ""}, and have been selected below.
              {eligResult.eligible?.length === 0 && " Try a lower threshold or a shorter range."}
            </div>
          )}
        </Card>
      )}

      {/* ── 4. Who gets it ─────────────────────────────────────────────── */}
      <Card style={{ marginBottom: 16 }}>
        <SectionHeader
          title="Children"
          description={`${pickedStudents.length} selected`}
          actions={
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="outline" size="sm" onClick={selectAllVisible} disabled={!visible.length}>
                Select all {classFilter ? `in ${classFilter}` : "shown"}
              </Button>
              <Button variant="outline" size="sm" onClick={clearPicked} disabled={!picked.size}>
                Clear
              </Button>
            </div>
          }
        />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, margin: "12px 0" }}>
          <Select
            label="Class"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            options={classOptions}
          />
          <Input
            label="Find a child"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or ID"
            leftIcon={<Search size={13} strokeWidth={2} />}
          />
        </div>

        {loading ? (
          <div style={{ fontSize: 13, color: "var(--yd-text-muted)" }}>Loading children…</div>
        ) : visible.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--yd-text-muted)" }}>
            No children match. Clear the class or search to see everyone.
          </div>
        ) : (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 8,
            maxHeight: 320, overflowY: "auto", paddingRight: 4,
          }}>
            {visible.map(s => {
              const on = picked.has(s.studentId);
              return (
                <label
                  key={s.studentId}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                    padding: "8px 10px",
                    borderRadius: "var(--yd-radius-sm)",
                    border: `1px solid ${on ? "var(--yd-yellow)" : "var(--yd-border-light)"}`,
                    background: on ? "var(--yd-yellow-light)" : "var(--yd-surface)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(s.studentId)}
                    style={{ accentColor: "var(--yd-yellow-dark)" }}
                  />
                  <span style={{ minWidth: 0 }}>
                    <span style={{
                      display: "block", fontSize: 13, fontWeight: 500, color: "var(--yd-charcoal)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {s.studentName}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--yd-text-muted)" }}>
                      {s.class || "—"}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── 5. Preview ─────────────────────────────────────────────────── */}
      <Card>
        <SectionHeader
          title="Preview"
          description={
            pickedStudents.length > 1
              ? `Showing ${pickedStudents[0].studentName} — the other ${pickedStudents.length - 1} are identical apart from the name, class and serial`
              : "Exactly what comes out of the printer, at A4 landscape"
          }
        />
        <div style={{ marginTop: 12 }}>
          <div className="yd-cert-stage">
            <CertificateDocument certificate={previewCertificate} />
          </div>
        </div>
      </Card>

      {/* Issued certificates stay in the print portal so "Print all" prints
          the whole batch as one job, one page per child. */}
      <CertificatePrintPortal certificates={issued} />
    </PageShell>
  );
}
