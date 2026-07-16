/**
 * PickupTab — same endpoints as the original PickupAuthTab plus the
 * pickup-history feed already fetched elsewhere in this module (merged
 * timeline was previously only in the Timeline tab) -- authorized persons
 * list + Timeline of pickup history/emergency pickups. There is no OTP
 * verification field anywhere in the backend (checked pickupHistory/
 * pickupAuthorization controllers), so no OTP status is shown -- not
 * fabricated.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Lock, TriangleAlert } from "lucide-react";
import { Avatar, StatusBadge, Button, Timeline, EmptyState, Skeleton } from "../../../components/ui";
import { get, del } from "../shared";

export default function PickupTab({ student, toast }) {
  const [persons, setPersons] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const mountedRef = useRef(true);

  const load = useCallback(() => {
    setLoading(true);
    get(`/api/pickup-authorization?studentId=${encodeURIComponent(student.Student_ID)}`)
      .then(d => { if (mountedRef.current) setPersons(d.entries || []); })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false); });
  }, [student.Student_ID]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    get(`/api/pickup-history?studentId=${encodeURIComponent(student.Student_ID)}&limit=30`)
      .then(d => { if (mountedRef.current) setHistory(d.entries || []); })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setHistoryLoading(false); });
    return () => { mountedRef.current = false; };
  }, [load, student.Student_ID]);

  async function remove(id, name) {
    if (!window.confirm(`Remove ${name}?`)) return;
    try {
      const r = await del(`/api/pickup-authorization/${id}`);
      if (r.success) { toast.success(`${name} removed.`); load(); }
      else toast.error(r.error || "Failed.");
    } catch { toast.error("Error removing."); }
  }

  const historyItems = history.map((e, i) => ({
    id: e.id || i,
    type: e.approvalStatus === "Unauthorized" ? "incident" : "pickup",
    title: `Pickup ${(e.approvalStatus || "").replace(/_/g, " ")}`,
    description: [e.pickupName, e.relation].filter(Boolean).join(" · "),
    timestamp: e.timestamp || e.date || Date.now(),
  }));

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h3 style={{ fontSize: 13, fontWeight: 800, color: "var(--yd-charcoal)" }}>Authorized Pickup Persons</h3>
          <Button as="a" href="/pickup-authorization" size="xs" variant="outline" leftIcon={<Lock size={11} strokeWidth={2.5} />}>Manage</Button>
        </div>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} height={52} />)}
          </div>
        ) : persons.length === 0 ? (
          <EmptyState size="sm" title="No authorized persons" description="Add authorized pickup persons for this student." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {persons.map(p => (
              <div key={p.entryId} style={{ display: "flex", alignItems: "center", gap: 10, borderRadius: 12, padding: "10px 14px", border: `1px solid ${p.emergency ? "var(--yd-warning-border)" : "var(--yd-border-light)"}`, background: p.emergency ? "var(--yd-warning-soft)" : "var(--yd-surface)" }}>
                <Avatar name={p.pickupName} photoUrl={p.photoUrl} size={36} shape="square" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "var(--yd-charcoal)" }}>{p.pickupName}</p>
                    {p.emergency && <TriangleAlert size={12} strokeWidth={2.5} color="var(--yd-warning)" />}
                  </div>
                  <p style={{ fontSize: 11, color: "var(--yd-text-muted)" }}>{p.relation} · {p.mobile || "—"}</p>
                </div>
                <StatusBadge status={p.status} size="xs" />
                <Button size="xs" variant="ghost" onClick={() => remove(p.entryId, p.pickupName)}>✕</Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: "var(--yd-charcoal)", marginBottom: 10 }}>Pickup History</h3>
        <Timeline
          items={historyItems}
          loading={historyLoading}
          empty={{ title: "No pickup history", description: "Pickup events will appear here as they happen." }}
        />
      </div>
    </div>
  );
}
