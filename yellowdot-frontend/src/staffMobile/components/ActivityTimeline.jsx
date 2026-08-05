/**
 * ActivityTimeline.jsx — Staff Home "what just happened" list
 * ─────────────────────────────────────────────────────────────────────
 * Staff Home Phase 2 (2026-08-05).
 *
 * Parent-Home-style Today/Yesterday/Earlier grouped activity list, but
 * deliberately narrow in its data sources: only Attendance, Care &
 * Hygiene and Incidents — the three that already have a `history`/`list`
 * read reused elsewhere in this codebase (desktop Attendance/CareHygiene
 * pages, Incidents dashboard). No new backend route: each source calls
 * the exact same service method its own desktop page already calls.
 * Nap Tracker / Food Consumption / Child Journey have zero such reads
 * today and are deliberately left out rather than adding new wiring for
 * this pass — a future phase can add them once each has its own history
 * read.
 *
 * Per-source failures (missing capability, network error) simply drop
 * that source's rows — never an error state for the whole list, so one
 * role's narrower access never looks like a bug.
 */
import { useEffect, useState } from "react";
import { CalendarCheck, Heart, AlertTriangle } from "lucide-react";
import { colors, spacing, radius, typography } from "../../theme/staffMobile";
import { useAuth } from "../../contexts/AuthContext";
import attendanceService from "../../services/attendanceService";
import { getCareHistory } from "../../services/careService";
import { getIncidents } from "../../services/incidentService";

const todayISO = () => new Date().toISOString().slice(0, 10);
const yesterdayISO = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);

function fmtTime(iso) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function dayBucket(iso) {
  const day = (iso || "").slice(0, 10);
  if (day === todayISO()) return "Today";
  if (day === yesterdayISO()) return "Yesterday";
  return "Earlier this week";
}

async function loadAttendance(can) {
  if (!can("attendance")) return [];
  try {
    const res = await attendanceService.getAttendance({ date: todayISO() });
    return (res?.entries || []).map(e => ({
      id: `att-${e.studentId}-${e.checkIn || e.date}`,
      icon: CalendarCheck,
      tone: "good",
      title: `${e.studentName} marked ${e.status}`,
      subtitle: e.class,
      timestamp: e.checkIn ? `${e.date}T${e.checkIn}` : `${e.date}T00:00`,
    }));
  } catch {
    return [];
  }
}

async function loadCare(can) {
  if (!can("care-hygiene")) return [];
  try {
    const res = await getCareHistory({ date: todayISO(), limit: 20 });
    return (res?.records || []).map(r => ({
      id: `care-${r.logId}`,
      icon: Heart,
      tone: "neutral",
      title: `${r.studentName} — ${r.type}`,
      subtitle: r.notes,
      timestamp: r.loggedAt,
    }));
  } catch {
    return [];
  }
}

async function loadIncidents(can) {
  if (!can("incidents")) return [];
  try {
    const res = await getIncidents({ limit: 20 });
    const list = Array.isArray(res) ? res : res?.incidents || [];
    return list.map(i => ({
      id: `inc-${i.id}`,
      icon: AlertTriangle,
      tone: "bad",
      title: i.title || `Incident — ${i.studentName || "student"}`,
      subtitle: i.status,
      timestamp: i.createdAt || i.date,
    }));
  } catch {
    return [];
  }
}

const TONE_COLOR = {
  good: colors.successStrong,
  bad: colors.dangerStrong,
  neutral: colors.yellow700,
};

function Row({ item }) {
  const Icon = item.icon;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: spacing.md, padding: `${spacing.sm}px 0` }}>
      <span style={{
        width: 32, height: 32, borderRadius: radius.md, flexShrink: 0,
        background: colors.surface.raised,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: TONE_COLOR[item.tone] || TONE_COLOR.neutral,
      }}>
        <Icon size={15} strokeWidth={1.8} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ ...typography.caption, fontWeight: typography.weight.semibold, color: colors.text.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.title}
        </div>
        {item.subtitle && (
          <div style={{ ...typography.meta, color: colors.text.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.subtitle}
          </div>
        )}
      </div>
      <span style={{ ...typography.meta, color: colors.text.faint, flexShrink: 0 }}>{fmtTime(item.timestamp)}</span>
    </div>
  );
}

export default function ActivityTimeline() {
  const { can } = useAuth();
  const [items, setItems] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadAttendance(can), loadCare(can), loadIncidents(can)])
      .then(([a, c, i]) => {
        if (cancelled) return;
        const merged = [...a, ...c, ...i]
          .filter(x => x.timestamp)
          .sort((x, y) => new Date(y.timestamp) - new Date(x.timestamp));
        setItems(merged);
      })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, [can]);

  if (items === null || items.length === 0) return null;

  const groups = new Map();
  for (const item of items) {
    const bucket = dayBucket(item.timestamp);
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket).push(item);
  }

  return (
    <div style={{ marginTop: spacing.lg }}>
      <div style={{ ...typography.caption, fontWeight: typography.weight.semibold, color: colors.text.muted, marginBottom: spacing.sm }}>
        RECENT ACTIVITY
      </div>
      <div style={{ background: colors.surface.card, borderRadius: radius.card, padding: `0 ${spacing.lg}px`, boxShadow: "0 1px 3px rgba(31,29,24,0.06)" }}>
        {[...groups.entries()].map(([bucket, rows], gi) => (
          <div key={bucket}>
            {gi > 0 && <div style={{ height: 1, background: colors.surface.border, margin: `${spacing.xs}px 0` }} />}
            <div style={{ ...typography.meta, color: colors.text.faint, fontWeight: typography.weight.bold, paddingTop: spacing.sm }}>
              {bucket.toUpperCase()}
            </div>
            {rows.map(item => <Row key={item.id} item={item} />)}
          </div>
        ))}
      </div>
    </div>
  );
}
