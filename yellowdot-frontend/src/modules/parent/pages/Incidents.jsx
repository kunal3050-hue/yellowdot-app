// ─────────────────────────────────────────────────────────────────────────────
// Parent Incidents — view & acknowledge incident reports for your children
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useIncidents } from "../hooks/useIncidents";
import { acknowledgeIncident } from "../services/parentService";

const SEVERITY_META = {
  low:      { label: "Low",      color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0", dot: "#22c55e" },
  medium:   { label: "Medium",   color: "#b45309", bg: "#fffbeb", border: "#fde68a", dot: "#f59e0b" },
  high:     { label: "High",     color: "#c2410c", bg: "#fff7ed", border: "#fed7aa", dot: "#f97316" },
  critical: { label: "Critical", color: "#dc2626", bg: "#fef2f2", border: "#fecaca", dot: "#ef4444" },
};

const STATUS_META = {
  open:         { label: "Open",         color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  under_review: { label: "Under Review", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  resolved:     { label: "Resolved",     color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
  closed:       { label: "Closed",       color: "#6b7280", bg: "#F1F1F1", border: "#e5e7eb" },
};

function sev(v) { return SEVERITY_META[v] || SEVERITY_META.low; }
function sts(v) { return STATUS_META[v]   || STATUS_META.open; }

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2,"0")} ${h >= 12 ? "PM" : "AM"}`;
}

// ── Acknowledge modal ─────────────────────────────────────────────────────────

function AcknowledgeModal({ incident, onDone, onClose }) {
  const [notes, setNotes]     = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  const handleAck = async () => {
    setSaving(true);
    setError("");
    try {
      await acknowledgeIncident(incident.id, notes);
      onDone();
      onClose();
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to acknowledge.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ padding: "0 0 env(safe-area-inset-bottom)" }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-t-3xl bg-white pb-6 overflow-hidden">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#e5dfc0]" />
        </div>

        {/* Header */}
        <div className="px-6 pt-3 pb-4"
          style={{ background: "linear-gradient(160deg,#fff7d6 0%,#f8ebbf 50%,#f5e4a8 100%)" }}>
          <p className="text-[9px] font-black text-[#9a7a18] tracking-[0.2em] uppercase mb-1">ACKNOWLEDGE REPORT</p>
          <h2 className="text-lg font-black text-[#2a1c06]">{incident.incidentType}</h2>
          <p className="text-xs text-[#9a7a18]">{incident.studentName} · {fmtDate(incident.incidentDate)}</p>
        </div>

        <div className="px-6 pt-5">
          <p className="text-[12px] text-[#5a4d40] mb-4 leading-relaxed">
            By acknowledging this report, you confirm that you have read and understood the incident details.
            You may optionally add a note.
          </p>

          <label className="block text-[10px] font-bold text-[#9a7a18] uppercase tracking-[0.1em] mb-1.5">
            Your note (optional)
          </label>
          <textarea rows={3} className="w-full px-4 py-3 rounded-2xl border border-[#e5dfc0] bg-white text-[#3a2a06] text-sm placeholder:text-[#a39070] focus:outline-none focus:ring-2 focus:ring-[#f4c430]/35 resize-none"
            placeholder="I have read this report…"
            value={notes} onChange={e => setNotes(e.target.value)} />

          {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 mt-4">
            <button onClick={onClose}
              className="flex-1 py-3.5 rounded-2xl border border-[#e5dfc0] text-[#9a7228] font-semibold text-sm">
              Cancel
            </button>
            <button onClick={handleAck} disabled={saving}
              className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-[#5a4010] disabled:opacity-50"
              style={{ background: "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)", boxShadow: "0 4px 14px rgba(212,170,31,0.30)" }}>
              {saving ? "Confirming…" : "I Acknowledge"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Incident detail card ──────────────────────────────────────────────────────

function IncidentDetailModal({ incident, onAcknowledge, onClose }) {
  const s = sev(incident.severity);
  const st = sts(incident.status);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-t-3xl bg-white overflow-hidden"
        style={{ maxHeight: "90vh", display: "flex", flexDirection: "column" }}>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-[#e5dfc0]" />
        </div>

        {/* Header */}
        <div className="px-6 pt-3 pb-4 flex-shrink-0" style={{ borderLeft: `4px solid ${s.dot}` }}>
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border"
              style={{ color: s.color, background: s.bg, borderColor: s.border }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} /> {s.label}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border"
              style={{ color: st.color, background: st.bg, borderColor: st.border }}>
              {st.label}
            </span>
          </div>
          <h2 className="text-xl font-black text-[#2a1c06]">{incident.incidentType}</h2>
          <p className="text-sm text-[#9a7a18] font-semibold">{incident.studentName}</p>
          <p className="text-xs text-[#7a6640] mt-0.5">
            {fmtDate(incident.incidentDate)} {incident.incidentTime && `· ${fmtTime(incident.incidentTime)}`}
            {incident.location && ` · ${incident.location === "Other" ? incident.locationOther : incident.location}`}
          </p>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-6 pb-6 flex-1">
          <Section title="What Happened">
            <p className="text-sm text-[#3a2a06] leading-relaxed">{incident.description}</p>
          </Section>

          <Section title="Immediate Response">
            <p className="text-sm text-[#3a2a06] leading-relaxed">{incident.immediateResponse}</p>
          </Section>

          <Section title="Action Taken">
            <p className="text-sm text-[#3a2a06] leading-relaxed">{incident.actionTaken}</p>
          </Section>

          {incident.reportedByName && (
            <Section title="Reported By">
              <p className="text-sm text-[#3a2a06] font-semibold">{incident.reportedByName}</p>
            </Section>
          )}

          {(incident.photoUrls || []).length > 0 && (
            <Section title={`Photos (${incident.photoUrls.length})`}>
              <div className="flex flex-wrap gap-2">
                {incident.photoUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt="" className="w-20 h-20 rounded-xl object-cover border border-[#e5dfc0] hover:opacity-90 transition-opacity" />
                  </a>
                ))}
              </div>
            </Section>
          )}

          {/* Acknowledgement section */}
          {incident.acknowledgementRequired && (
            <div className="mt-5 p-4 rounded-2xl border-2"
              style={incident.acknowledged
                ? { background: "#f0fdf4", borderColor: "#bbf7d0" }
                : { background: "#fffbeb", borderColor: "#fde68a" }}>
              {incident.acknowledged ? (
                <div>
                  <p className="text-sm font-bold text-[#15803d]">✓ You have acknowledged this report</p>
                  {incident.acknowledgementNotes && (
                    <p className="text-xs text-[#3a7a28] mt-1">"{incident.acknowledgementNotes}"</p>
                  )}
                  {incident.acknowledgedAt && (
                    <p className="text-[10px] text-[#5a9060] mt-1">{new Date(incident.acknowledgedAt).toLocaleString()}</p>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-sm font-bold text-[#d97706] mb-1">⏳ Acknowledgement Required</p>
                  <p className="text-xs text-[#7a5a28] mb-3">The school requires you to confirm you have read this report.</p>
                  <button onClick={onAcknowledge}
                    className="w-full py-3 rounded-2xl font-bold text-sm text-[#5a4010]"
                    style={{ background: "linear-gradient(160deg,#f9dc5a 0%,#f0c930 100%)", boxShadow: "0 4px 14px rgba(212,170,31,0.25)" }}>
                    Acknowledge Report
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mt-4">
      <p className="text-[10px] font-black text-[#9a7a18] uppercase tracking-[0.15em] mb-1.5">{title}</p>
      {children}
    </div>
  );
}

// ── Incident summary card ─────────────────────────────────────────────────────

function IncidentCard({ incident, onView }) {
  const s = sev(incident.severity);
  const st = sts(incident.status);

  return (
    <button onClick={onView}
      className="w-full text-left bg-white rounded-2xl border border-[#F1F1F1] overflow-hidden flex transition-all hover:shadow-md active:scale-[0.99]"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
      {/* Severity bar */}
      <div className="w-1 flex-shrink-0" style={{ background: s.dot }} />

      <div className="flex-1 p-4">
        <div className="flex items-start gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border"
                style={{ color: s.color, background: s.bg, borderColor: s.border }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} /> {s.label}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border"
                style={{ color: st.color, background: st.bg, borderColor: st.border }}>
                {st.label}
              </span>
              {incident.acknowledgementRequired && !incident.acknowledged && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#fffbeb] border border-[#fde68a] text-[#d97706]">
                  ⏳ Ack needed
                </span>
              )}
            </div>
            <p className="text-[14px] font-bold text-[#2a1c06] leading-tight">{incident.incidentType}</p>
            <p className="text-[11px] text-[#9a7a18] font-semibold">{incident.studentName}</p>
          </div>
          <svg className="w-4 h-4 text-[#c0b090] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[#7a6640]">
          <span>📅 {fmtDate(incident.incidentDate)}</span>
          {incident.location && <span>📍 {incident.location === "Other" ? incident.locationOther : incident.location}</span>}
          {(incident.photoUrls || []).length > 0 && <span>📷 {incident.photoUrls.length} photo{incident.photoUrls.length !== 1 ? "s" : ""}</span>}
        </div>
      </div>
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ParentIncidents() {
  const { data, loading, error, reload } = useIncidents();
  const [selected,      setSelected]     = useState(null);
  const [ackTarget,     setAckTarget]    = useState(null);

  const incidents = data?.incidents || [];

  // Separate pending ack vs rest
  const pendingAck = incidents.filter(i => i.acknowledgementRequired && !i.acknowledged);
  const rest       = incidents.filter(i => !(i.acknowledgementRequired && !i.acknowledged));

  const handleAcknowledged = () => {
    reload();
    setSelected(prev => prev ? { ...prev, acknowledged: true } : null);
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-3 px-4 pt-4">
        {[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl bg-[#f8f4e8] animate-pulse" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <p className="text-[#c04030] text-sm mb-4">{error}</p>
        <button onClick={reload} className="px-6 py-2.5 rounded-xl bg-[#f9dc5a] font-bold text-sm text-[#5a4010]">Retry</button>
      </div>
    );
  }

  if (incidents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
          style={{ background: "linear-gradient(160deg,#fff7d6 0%,#f5e4a8 100%)" }}>
          <svg className="w-8 h-8" fill="none" stroke="#c79b12" strokeWidth={1.75} viewBox="0 0 24 24">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <h2 className="text-lg font-black text-[#2a1c06] mb-1">No Incidents</h2>
        <p className="text-sm text-[#a39070]">No incident reports have been filed for your children.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-8">

      {/* Header */}
      <div>
        <p className="text-[9px] font-black text-[#9a7a18] tracking-[0.2em] uppercase mb-0.5">SAFETY</p>
        <h1 className="text-2xl font-black text-[#2a1c06]">Incident Reports</h1>
        <p className="text-xs text-[#a08040] mt-0.5">{incidents.length} report{incidents.length !== 1 ? "s" : ""} on file</p>
      </div>

      {/* Pending acknowledgements callout */}
      {pendingAck.length > 0 && (
        <div className="p-4 rounded-2xl border-2 border-[#fde68a] bg-[#fffbeb]">
          <p className="text-sm font-bold text-[#d97706] mb-1">⏳ {pendingAck.length} report{pendingAck.length > 1 ? "s need" : " needs"} your acknowledgement</p>
          <p className="text-xs text-[#7a5a28]">Tap each report below to read the details and acknowledge.</p>
        </div>
      )}

      {/* Pending ack incidents */}
      {pendingAck.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-black text-[#d97706] uppercase tracking-[0.15em]">Awaiting Acknowledgement</p>
          {pendingAck.map(inc => (
            <IncidentCard key={inc.id} incident={inc} onView={() => setSelected(inc)} />
          ))}
        </div>
      )}

      {/* All other incidents */}
      {rest.length > 0 && (
        <div className="flex flex-col gap-2">
          {pendingAck.length > 0 && (
            <p className="text-[10px] font-black text-[#9a7a18] uppercase tracking-[0.15em]">All Reports</p>
          )}
          {rest.map(inc => (
            <IncidentCard key={inc.id} incident={inc} onView={() => setSelected(inc)} />
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && !ackTarget && (
        <IncidentDetailModal
          incident={selected}
          onAcknowledge={() => setAckTarget(selected)}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Acknowledge modal */}
      {ackTarget && (
        <AcknowledgeModal
          incident={ackTarget}
          onDone={handleAcknowledged}
          onClose={() => setAckTarget(null)}
        />
      )}
    </div>
  );
}
