import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { tenantService } from "../../services/tenantService";

const STATUS_COLORS = {
  active:    { bg: "#DCFCE7", text: "#15803D" },
  trial:     { bg: "#FEF9C3", text: "#A16207" },
  suspended: { bg: "#FEE2E2", text: "#DC2626" },
  cancelled: { bg: "#F3F4F6", text: "#6B7280" },
};

const PLAN_LABELS = {
  trial:        "Trial",
  starter:      "Starter",
  professional: "Professional",
  enterprise:   "Enterprise",
};

function StatusBadge({ status }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.cancelled;
  return (
    <span style={{
      background: colors.bg, color: colors.text,
      padding: "2px 10px", borderRadius: 20,
      fontSize: 12, fontWeight: 600, textTransform: "capitalize",
    }}>
      {status}
    </span>
  );
}

export default function TenantList() {
  const navigate = useNavigate();
  const [tenants, setTenants]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [search, setSearch]     = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPlan, setFilterPlan]     = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterPlan)   params.plan   = filterPlan;
      if (search)       params.search = search;
      const { tenants: list } = await tenantService.list(params);
      setTenants(list || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, filterPlan]);

  useEffect(() => { load(); }, [load]);

  async function handleStatusChange(tenantId, newStatus) {
    const reason = newStatus === "suspended"
      ? window.prompt("Reason for suspension (optional):")
      : undefined;
    try {
      await tenantService.setStatus(tenantId, newStatus, reason);
      load();
    } catch (e) {
      alert("Failed: " + e.message);
    }
  }

  async function handleImpersonate(tenantId, schoolName) {
    if (!window.confirm(`Impersonate admin of "${schoolName}"? This will be audit-logged.`)) return;
    try {
      const { customToken } = await tenantService.impersonate(tenantId);
      // Open impersonation in a new tab via a special URL
      const url = `/impersonate?token=${encodeURIComponent(customToken)}&tenantId=${tenantId}`;
      window.open(url, "_blank");
    } catch (e) {
      alert("Failed: " + e.message);
    }
  }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1C1917", margin: 0 }}>Preschools</h1>
          <p style={{ color: "#78716C", margin: "4px 0 0", fontSize: 14 }}>
            Manage all preschool tenants on the platform
          </p>
        </div>
        <button
          onClick={() => navigate("/super-admin/tenants/new")}
          style={{
            background: "#F5C518", color: "#1C1917",
            border: "none", borderRadius: 8,
            padding: "10px 20px", fontWeight: 700,
            cursor: "pointer", fontSize: 14,
          }}
        >
          + New Preschool
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          placeholder="Search schools…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 200, padding: "8px 14px",
            border: "1.5px solid #E7E2D9", borderRadius: 8,
            fontSize: 14, outline: "none",
          }}
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: "8px 14px", border: "1.5px solid #E7E2D9", borderRadius: 8, fontSize: 14 }}
        >
          <option value="">All statuses</option>
          <option value="trial">Trial</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={filterPlan}
          onChange={e => setFilterPlan(e.target.value)}
          style={{ padding: "8px 14px", border: "1.5px solid #E7E2D9", borderRadius: 8, fontSize: 14 }}
        >
          <option value="">All plans</option>
          <option value="trial">Trial</option>
          <option value="starter">Starter</option>
          <option value="professional">Professional</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: "#FEF2F2", color: "#DC2626", padding: 14, borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#A8906A" }}>Loading…</div>
      ) : tenants.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#78716C" }}>
          No preschools found.{" "}
          <button
            onClick={() => navigate("/super-admin/tenants/new")}
            style={{ background: "none", border: "none", color: "#F5C518", fontWeight: 700, cursor: "pointer" }}
          >
            Create one
          </button>
        </div>
      ) : (
        <div style={{ border: "1.5px solid #F5F0E8", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#FAFAF9" }}>
                {["School", "Tenant ID", "Plan", "Status", "Branches", "Actions"].map(h => (
                  <th key={h} style={{
                    padding: "11px 16px", textAlign: "left",
                    fontWeight: 600, color: "#78716C",
                    borderBottom: "1.5px solid #F5F0E8", fontSize: 12,
                    textTransform: "uppercase", letterSpacing: "0.04em",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenants.map((t, i) => (
                <tr
                  key={t.tenantId}
                  style={{
                    borderBottom: i < tenants.length - 1 ? "1px solid #F5F0E8" : "none",
                    cursor: "pointer",
                  }}
                  onClick={() => navigate(`/super-admin/tenants/${t.tenantId}`)}
                >
                  <td style={{ padding: "14px 16px", fontWeight: 600, color: "#1C1917" }}>
                    <div>{t.schoolName}</div>
                    <div style={{ fontSize: 12, color: "#A8906A", marginTop: 2 }}>{t.contactEmail}</div>
                  </td>
                  <td style={{ padding: "14px 16px", color: "#78716C", fontFamily: "monospace", fontSize: 13 }}>
                    {t.tenantId}
                  </td>
                  <td style={{ padding: "14px 16px", color: "#57534E" }}>
                    {PLAN_LABELS[t.subscriptionPlan] || t.subscriptionPlan}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <StatusBadge status={t.status} />
                  </td>
                  <td style={{ padding: "14px 16px", color: "#57534E" }}>
                    {(t.branches || []).length}
                  </td>
                  <td style={{ padding: "14px 16px" }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: 6 }}>
                      {t.status !== "active" && (
                        <ActionBtn
                          label="Activate"
                          color="#15803D"
                          bg="#DCFCE7"
                          onClick={() => handleStatusChange(t.tenantId, "active")}
                        />
                      )}
                      {t.status === "active" && (
                        <ActionBtn
                          label="Suspend"
                          color="#DC2626"
                          bg="#FEE2E2"
                          onClick={() => handleStatusChange(t.tenantId, "suspended")}
                        />
                      )}
                      <ActionBtn
                        label="Impersonate"
                        color="#1D4ED8"
                        bg="#DBEAFE"
                        onClick={() => handleImpersonate(t.tenantId, t.schoolName)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ color: "#A8906A", fontSize: 12, marginTop: 12 }}>
        {tenants.length} preschool{tenants.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

function ActionBtn({ label, color, bg, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: bg, color, border: "none", borderRadius: 6,
        padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
