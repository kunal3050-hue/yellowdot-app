/**
 * PerformanceDashboard.jsx — KPI tiles + jump links + recent awards/promotions
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import performanceService from "../../../services/performanceService";
import { T } from "./_shared";

function Stat({ label, value, sub, accent = T.gold, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px",
      cursor: onClick ? "pointer" : "default", boxShadow: T.shadow, position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 3, background: accent }} />
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textMuted }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 26, fontWeight: 700, color: T.text }}>{value}</div>
      {sub && <div style={{ marginTop: 4, fontSize: 12, color: T.textSoft }}>{sub}</div>}
    </div>
  );
}

export default function PerformanceDashboard() {
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await performanceService.dashboard();
      if (r?.success) setData(r);
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ background: T.bg, minHeight: "100%", padding: "24px 28px 48px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.goldMid }}>Performance Management</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "4px 0 0" }}>Dashboard</h1>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => navigate("/staff/performance/reviews")}  style={btn(T.gold, "#1E1E1E")}>Reviews</button>
          <button onClick={() => navigate("/staff/performance/goals")}    style={btn(T.surface, T.text, T.border)}>Goals</button>
          <button onClick={() => navigate("/staff/performance/feedback")} style={btn(T.surface, T.text, T.border)}>Parent Feedback</button>
          <button onClick={() => navigate("/staff/performance/awards")}   style={btn(T.surface, T.text, T.border)}>Awards & Promotions</button>
          <button onClick={() => navigate("/staff/performance/kpis")}     style={btn(T.surface, T.text, T.border)}>KPIs</button>
        </div>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
        <Stat label="Total Staff"        value={data?.totalStaff ?? 0}                                              />
        <Stat label="Reviews Pending"    value={data?.reviewsPending ?? 0}     accent={T.goldMid} onClick={() => navigate("/staff/performance/reviews")} />
        <Stat label="Parent Rating (MTD)"value={(data?.avgParentRatingMTD ?? 0) + " ★"} sub={`${data?.feedbackMTDCount ?? 0} feedback rows`} accent={T.green} />
        <Stat label="Goals Active"       value={data?.goalsActive ?? 0}        accent={T.gold}    />
        <Stat label="Goals Overdue"      value={data?.goalsOverdue ?? 0}       accent={T.red}     onClick={() => navigate("/staff/performance/goals")} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 14 }}>
        <Panel title="Recent Awards" empty="No awards recorded yet.">
          {(data?.recentAwards || []).map(a => (
            <Row key={a.awardId} title={a.title} subtitle={a.displayName} right={a.awardedOn} />
          ))}
        </Panel>
        <Panel title="Recent Promotions" empty="No promotions recorded yet.">
          {(data?.recentPromotions || []).map(p => (
            <Row key={p.promotionId} title={`${p.displayName} → ${p.toDesignation}`} subtitle={p.citation} right={p.effectiveDate} />
          ))}
        </Panel>
      </div>

      {loading && <div style={{ marginTop: 16, color: T.textMuted }}>Loading…</div>}
    </div>
  );
}

function Panel({ title, children, empty }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 18, boxShadow: T.shadow }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.text, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{title}</div>
      {hasChildren ? children : <div style={{ color: T.textMuted, fontSize: 13 }}>{empty}</div>}
    </div>
  );
}
function Row({ title, subtitle, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: T.text }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: T.textSoft, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right && <div style={{ fontSize: 11, color: T.textMuted, whiteSpace: "nowrap" }}>{right}</div>}
    </div>
  );
}

const errorBox = { background: T.redLight, color: T.red, border: `1px solid ${T.red}33`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 };
function btn(bg, color, border) { return { background: bg, color, border: border ? `1px solid ${border}` : "none", borderRadius: 10, padding: "10px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }; }
