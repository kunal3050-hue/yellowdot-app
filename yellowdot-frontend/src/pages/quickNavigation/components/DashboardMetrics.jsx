/**
 * DashboardMetrics — "Today's Overview" KPI row above the module grid.
 *
 * Staff review findings C1/C2 (2026-07-30):
 *   - "Staff Present" had no backend source at all (LiveDashboard shows the
 *     same "not tracked" gap) and is REMOVED rather than shipped as a fake
 *     number. Wiring it needs /api/staff-attendance/today, which needs the
 *     staff-attendance capability — currently unreachable for every
 *     non-bypass role pending the HR scope-aware backend work, so wiring it
 *     today would just show "—" everywhere, including to admins. Revisit
 *     once that capability is actually grantable.
 *   - "Admissions" was a literal hardcoded "3". Now wired to real data —
 *     see admissionsThisWeek in useDashboardStats.js — the same
 *     derive-from-already-fetched-students pattern birthdaysToday already used.
 *   - Every card is now capability-gated, the same discipline the new
 *     Dashboard/Care pages already had and this page didn't (C2: Outstanding
 *     Fees was showing to Teacher and Reception, neither of whom can see a
 *     single invoice anywhere else in the app).
 */
import { CalendarCheck, Users, Car, Wallet, UserPlus, Cake } from "lucide-react";
import { KpiRow, KpiCard } from "../../../components/ui";
import { useAuth } from "../../../contexts/AuthContext";
import useDashboardStats from "../useDashboardStats";

function inr(n) {
  if (n == null) return "—";
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export default function DashboardMetrics() {
  const { canDo } = useAuth();
  const {
    attendancePct, presentToday, pendingPickups, outstandingFees,
    birthdaysToday, admissionsThisWeek, loading,
  } = useDashboardStats();

  const CARDS = [
    {
      id: "attendance", capability: ["attendance", "view"],
      icon: CalendarCheck, label: "Today's Attendance",
      value: attendancePct ?? "—", trendLabel: "of enrolled students",
    },
    {
      id: "present", capability: ["attendance", "view"],
      icon: Users, label: "Students Present",
      value: presentToday ?? "—", trendLabel: "checked in today",
    },
    {
      // W3, workflow-optimization review 2026-07-30: this counts only
      // pickup_auth requests still awaiting the PARENT's own approval —
      // nothing here is a staff action yet. Gate Register's "Pending
      // Approval" filter is a different, larger number (it also includes
      // already-approved-but-not-yet-released children, which IS a staff
      // action). "Pending Pickups" read as the same concept as both and
      // undercounted the one that's actually actionable. Renamed to say
      // exactly what this number is.
      id: "pickups", capability: ["pickup_auth", "view"],
      icon: Car, label: "Awaiting Parent",
      value: pendingPickups ?? "—", trendLabel: "pickup requests not yet approved",
    },
    {
      id: "fees", capability: ["invoices", "view"],
      icon: Wallet, label: "Outstanding Fees",
      value: inr(outstandingFees), trendLabel: "pending + overdue balance",
    },
    {
      id: "birthdays", capability: ["students", "view"],
      icon: Cake, label: "Birthdays",
      value: birthdaysToday ?? "—", trendLabel: "today",
    },
    {
      id: "admissions", capability: ["students", "view"],
      icon: UserPlus, label: "Admissions",
      value: admissionsThisWeek ?? "—", trendLabel: "this week",
    },
  ];

  const visible = CARDS.filter(c => canDo(...c.capability));
  if (visible.length === 0) return null;

  return (
    <section className="qnd-section">
      <h2 className="qnd-section-title">Today's Overview</h2>
      <KpiRow>
        {visible.map(c => (
          <KpiCard
            key={c.id}
            icon={<c.icon size={16} strokeWidth={1.75} />}
            label={c.label}
            value={c.value}
            trendLabel={c.trendLabel}
            loading={loading}
          />
        ))}
      </KpiRow>
    </section>
  );
}
