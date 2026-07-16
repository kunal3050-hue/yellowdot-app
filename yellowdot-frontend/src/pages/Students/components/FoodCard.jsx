/**
 * FoodCard — same endpoint as the original (/api/food-consumption?studentId=).
 * Kept (not in the Phase 2.2 requested tab list, but preserving existing
 * functionality per the "do not remove features" rule). Shared component
 * -- used by the profile shell for both /students and /student-profile/:id.
 */
import { useState, useEffect, useRef } from "react";
import { Button, Badge, EmptyState, Skeleton } from "../../../components/ui";
import { get } from "../shared";

export default function FoodCard({ student }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    get(`/api/food-consumption?studentId=${encodeURIComponent(student.Student_ID)}`)
      .then(d => { if (mountedRef.current) setRecords(d.entries || d || []); })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false); });
    return () => { mountedRef.current = false; };
  }, [student.Student_ID]);

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: "var(--yd-charcoal)" }}>Food Consumption</h3>
        <Button as="a" href="/food-consumption" size="xs" variant="primary">+ Log Food</Button>
      </div>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={40} />)}</div>
      ) : records.length === 0 ? (
        <EmptyState size="sm" title="No food records" description="Meal logs will appear here." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto" }}>
          {records.slice(0, 40).map((r, i) => {
            const mealType = r.mealType || r.Meal_Type || "";
            const foodItem = r.foodItem || r.Food_Item || "";
            const qty = parseFloat(r.quantity || r.Quantity || 0);
            const didntEat = qty === 0 || (r.status || r.Status) === "Didn't Eat";
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 10, padding: "8px 12px", border: `1px solid ${didntEat ? "var(--yd-danger-border)" : "var(--yd-border-light)"}`, background: didntEat ? "var(--yd-danger-soft)" : "var(--yd-surface)" }}>
                <Badge variant="neutral">{mealType}</Badge>
                <span style={{ fontSize: 12, fontWeight: 600, color: didntEat ? "var(--yd-danger)" : "var(--yd-text-soft)", flex: 1 }}>{foodItem || "—"}</span>
                {didntEat ? <span style={{ fontSize: 10, fontWeight: 700, color: "var(--yd-danger)" }}>Didn't eat</span> : <span style={{ fontSize: 10, color: "var(--yd-text-muted)" }}>{r.quantity || r.Quantity} {r.unit || r.Unit}</span>}
                <span style={{ fontSize: 10, color: "var(--yd-text-muted)" }}>{r.date || r.Date}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
