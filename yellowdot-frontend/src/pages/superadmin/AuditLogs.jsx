import { useState, useEffect } from "react";
import { tenantService } from "../../services/tenantService";

export default function AuditLogs() {
  const [logs, setLogs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    tenantService.auditLogs(null, 100)
      .then(({ logs: l }) => setLogs(l || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1C1917", margin: "0 0 6px" }}>Audit Logs</h1>
      <p style={{ color: "#78716C", margin: "0 0 24px", fontSize: 14 }}>All platform-level tenant actions (last 100)</p>

      {error && <div style={{ color: "#DC2626", marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#A8906A" }}>Loading…</div>
      ) : logs.length === 0 ? (
        <div style={{ color: "#A8906A", textAlign: "center", padding: 60 }}>No audit entries yet.</div>
      ) : (
        <div style={{ border: "1.5px solid #F5F0E8", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#FAFAF9" }}>
                {["Action", "Tenant", "Actor", "Time"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#78716C", borderBottom: "1.5px solid #F5F0E8", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((l, i) => (
                <tr key={l.id} style={{ borderBottom: i < logs.length - 1 ? "1px solid #F5F0E8" : "none" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: "#1C1917" }}>{l.action}</td>
                  <td style={{ padding: "12px 16px", color: "#57534E", fontFamily: "monospace", fontSize: 12 }}>{l.tenantId}</td>
                  <td style={{ padding: "12px 16px", color: "#78716C" }}>{l.actorEmail || l.actorUserId}</td>
                  <td style={{ padding: "12px 16px", color: "#A8906A", fontSize: 12 }}>
                    {l.createdAt ? new Date(l.createdAt).toLocaleString() : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
