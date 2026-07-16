/**
 * FeesCard — adds a KpiCard summary + payment-history LineChart above
 * the existing <ParentLedger> (completely unchanged), now backed by the
 * shared useStudentFinance hook. Shared component -- used by the
 * profile shell for both /students and /student-profile/:id.
 */
import { KpiCard, LineChart, Button } from "../../../components/ui";
import ParentLedger from "../../../components/ParentLedger";
import useStudentFinance from "../hooks/useStudentFinance";

function inr(n) {
  const v = Number(n) || 0;
  if (v >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`;
  if (v >= 1_000)    return `₹${(v / 1_000).toFixed(1)}k`;
  return `₹${v.toLocaleString("en-IN")}`;
}

export default function FeesCard({ student }) {
  const { loading, summary, upcoming, paymentHistory } = useStudentFinance(student.Student_ID);

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: "var(--yd-charcoal)" }}>Fees</h3>
        <Button as="a" href="/generate-invoice" size="xs" variant="primary">+ Invoice</Button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
        <KpiCard label="Total Due" value={inr(summary.totalBilled)} loading={loading} />
        <KpiCard label="Paid" value={inr(summary.totalPaid)} loading={loading} />
        <KpiCard label="Overdue" value={inr(summary.overdue)} loading={loading} />
        <KpiCard label="Upcoming" value={inr(upcoming)} loading={loading} />
      </div>

      {!loading && paymentHistory.length > 1 && (
        <LineChart
          title="Payment History" subtitle="Last 6 months"
          data={paymentHistory} xKey="month"
          series={[{ key: "amount", label: "Amount" }]}
          valueFormatter={(v) => inr(v)}
          showLegend={false}
          height={200}
        />
      )}

      <ParentLedger student={student} />
    </div>
  );
}
