/**
 * DashboardMetrics — "Today at a Glance" KPI row above the module grid.
 * Five of the seven stats are real, derived from the same endpoints
 * LiveDashboard.jsx already calls (see useDashboardStats.js). Two —
 * Staff Present and New Admissions — have no reliable backend source
 * yet (LiveDashboard itself shows "not tracked" for staff presence), so
 * they're realistic sample values, clearly labeled as such rather than
 * presented as live numbers.
 */
import { CalendarCheck, Users, UserCheck, Car, Wallet, UserPlus, Cake } from "lucide-react";
import { KpiRow, KpiCard } from "../../../components/ui";
import useDashboardStats from "../useDashboardStats";

function inr(n) {
  if (n == null) return "—";
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export default function DashboardMetrics() {
  const { attendancePct, presentToday, pendingPickups, outstandingFees, birthdaysToday, loading } = useDashboardStats();

  return (
    <section className="qnd-section">
      <h2 className="qnd-section-title">Today at a Glance</h2>
      <KpiRow>
        <KpiCard
          icon={<CalendarCheck size={16} strokeWidth={1.75} />}
          label="Today's Attendance"
          value={attendancePct ?? "—"}
          trendLabel="of enrolled students"
          loading={loading}
        />
        <KpiCard
          icon={<Users size={16} strokeWidth={1.75} />}
          label="Students Present"
          value={presentToday ?? "—"}
          trendLabel="checked in today"
          loading={loading}
        />
        <KpiCard
          icon={<UserCheck size={16} strokeWidth={1.75} />}
          label="Staff Present"
          value="—"
          trendLabel="sample · not tracked yet"
          loading={false}
        />
        <KpiCard
          icon={<Car size={16} strokeWidth={1.75} />}
          label="Pending Pickups"
          value={pendingPickups ?? "—"}
          trendLabel="awaiting collection"
          loading={loading}
        />
        <KpiCard
          icon={<Wallet size={16} strokeWidth={1.75} />}
          label="Outstanding Fees"
          value={inr(outstandingFees)}
          trendLabel="pending + overdue balance"
          loading={loading}
        />
        <KpiCard
          icon={<UserPlus size={16} strokeWidth={1.75} />}
          label="New Admissions"
          value="3"
          trendLabel="sample · this week"
          loading={false}
        />
        <KpiCard
          icon={<Cake size={16} strokeWidth={1.75} />}
          label="Birthdays"
          value={birthdaysToday ?? "—"}
          trendLabel="today"
          loading={loading}
        />
      </KpiRow>
    </section>
  );
}
