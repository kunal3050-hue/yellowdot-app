import { useState, useEffect } from "react";
import { tenantService } from "../../services/tenantService";

const STATUS_COLORS = {
  active:    "#15803D",
  trial:     "#A16207",
  suspended: "#DC2626",
  cancelled: "#6B7280",
};

const PLAN_COLORS = {
  trial:        "#A16207",
  starter:      "#0369A1",
  professional: "#7C3AED",
  enterprise:   "#059669",
};

export default function PlatformAnalytics() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    tenantService.analytics()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: "#A8906A" }}>Loading…</div>;
  if (error)   return <div style={{ padding: 40, color: "#DC2626" }}>{error}</div>;

  const { total, byStatus, byPlan, newest } = data;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1C1917", margin: "0 0 6px" }}>Platform Analytics</h1>
      <p style={{ color: "#78716C", margin: "0 0 28px", fontSize: 14 }}>Overview of all preschools on the platform</p>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16, marginBottom: 32 }}>
        <KpiCard label="Total Schools" value={total} color="#1C1917" />
        {Object.entries(byStatus).map(([status, count]) => (
          <KpiCard key={status} label={status.charAt(0).toUpperCase() + status.slice(1)} value={count} color={STATUS_COLORS[status] || "#78716C"} />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
        {/* By plan */}
        <ChartCard title="By Subscription Plan">
          {Object.entries(byPlan).map(([plan, count]) => (
            <BarRow key={plan} label={plan} count={count} total={total} color={PLAN_COLORS[plan] || "#78716C"} />
          ))}
        </ChartCard>

        {/* By status */}
        <ChartCard title="By Status">
          {Object.entries(byStatus).map(([status, count]) => (
            <BarRow key={status} label={status} count={count} total={total} color={STATUS_COLORS[status] || "#78716C"} />
          ))}
        </ChartCard>
      </div>

      {/* Newest tenants */}
      <div style={{ border: "1.5px solid #F5F0E8", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1.5px solid #F5F0E8", fontWeight: 700, color: "#1C1917", fontSize: 14 }}>
          Recent Preschools
        </div>
        {(newest || []).map((t, i) => (
          <div key={t.tenantId} style={{
            padding: "13px 20px", borderBottom: i < newest.length - 1 ? "1px solid #F5F0E8" : "none",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <div style={{ fontWeight: 600, color: "#1C1917", fontSize: 14 }}>{t.schoolName}</div>
              <div style={{ fontSize: 12, color: "#A8906A", fontFamily: "monospace" }}>{t.tenantId}</div>
            </div>
            <div style={{ fontSize: 12, color: "#78716C" }}>
              {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiCard({ label, value, color }) {
  return (
    <div style={{ background: "#FAFAF9", border: "1.5px solid #F5F0E8", borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#78716C", marginTop: 6, fontWeight: 600, textTransform: "capitalize" }}>{label}</div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div style={{ border: "1.5px solid #F5F0E8", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "12px 18px", borderBottom: "1.5px solid #F5F0E8", fontWeight: 700, fontSize: 13, color: "#57534E" }}>{title}</div>
      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </div>
  );
}

function BarRow({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
        <span style={{ fontWeight: 600, color: "#57534E", textTransform: "capitalize" }}>{label}</span>
        <span style={{ color: "#78716C" }}>{count} ({pct}%)</span>
      </div>
      <div style={{ background: "#F5F0E8", borderRadius: 4, height: 8 }}>
        <div style={{ width: `${pct}%`, background: color, height: 8, borderRadius: 4, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}
