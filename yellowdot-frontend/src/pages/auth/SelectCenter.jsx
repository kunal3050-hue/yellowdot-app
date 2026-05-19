import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const MOCK_CENTER_META = {
  "center-1": { students: 48, logo: "🏫", lastActive: "Today" },
  "center-2": { students: 32, logo: "🌟", lastActive: "Yesterday" },
  "center-3": { students: 61, logo: "🎨", lastActive: "Today" },
};

export default function SelectCenter() {
  const { user, selectCenter, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = location.state?.from?.pathname || "/";
  const [selected, setSelected]  = useState(null);
  const [loading,  setLoading]   = useState(false);

  const centers = user?.centers || [];

  async function handleSelect(centerId) {
    if (loading) return;
    setSelected(centerId);
    setLoading(true);
    try {
      await selectCenter(centerId);
      navigate(from, { replace: true });
    } catch {
      setLoading(false);
      setSelected(null);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logoRow}>
            <div style={styles.logoMark}>
              <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="14" fill="var(--yd-black)" />
                <circle cx="14" cy="14" r="6" fill="var(--yd-yellow)" />
              </svg>
            </div>
            <span style={styles.logoText}>Yellow Dot</span>
          </div>
          <div style={styles.headerText}>
            <h1 style={styles.title}>Choose your center</h1>
            <p style={styles.sub}>
              Welcome back, <strong>{user?.name}</strong>. You have access to {centers.length} centers.
            </p>
          </div>
        </div>

        {/* Center cards grid */}
        <div style={styles.grid}>
          {centers.map(centerId => {
            const meta = MOCK_CENTER_META[centerId] || { students: "—", logo: "🏫", lastActive: "—" };
            const isSelecting = selected === centerId && loading;
            return (
              <button
                key={centerId}
                style={{
                  ...styles.centerCard,
                  ...(isSelecting ? styles.centerCardActive : {}),
                }}
                onClick={() => handleSelect(centerId)}
                disabled={loading}
              >
                {isSelecting && <div style={styles.cardLoading}><LoadingDots /></div>}

                <div style={styles.centerLogo}>{meta.logo}</div>
                <div style={styles.centerName}>{formatCenterName(centerId)}</div>

                <div style={styles.centerMeta}>
                  <div style={styles.metaItem}>
                    <span style={styles.metaIcon}>👦</span>
                    <span>{meta.students} Students</span>
                  </div>
                  <div style={styles.metaItem}>
                    <span style={styles.metaIcon}>🕐</span>
                    <span>{meta.lastActive}</span>
                  </div>
                </div>

                <div style={styles.selectIndicator}>
                  {isSelecting ? "Entering…" : "Select Center →"}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <p style={styles.footerText}>
            Logged in as <strong>{user?.email}</strong> · {formatRole(user?.role)}
          </p>
          <button onClick={() => logout()} style={styles.logoutBtn}>Sign Out</button>
        </div>
      </div>

      <style>{`
        @keyframes dotPulse {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; }
          40% { transform: scale(1.1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function formatCenterName(id) {
  return id.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function formatRole(role) {
  if (!role) return "";
  return role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function LoadingDots() {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 8, height: 8, borderRadius: "50%", background: "var(--yd-yellow)",
          display: "inline-block",
          animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(160deg, var(--yd-bg) 0%, var(--yd-yellow-pale) 50%, var(--yd-bg) 100%)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "40px 24px",
    fontFamily: "var(--yd-font)",
  },
  container: { width: "100%", maxWidth: 720 },
  header: { marginBottom: 40 },
  logoRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 28 },
  logoMark: {
    width: 36, height: 36, borderRadius: "var(--yd-radius-sm)",
    background: "var(--yd-surface)", border: "1px solid var(--yd-border)",
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 2px 8px rgba(244,196,0,0.12)",
  },
  logoText: { fontSize: "var(--yd-font-size-lg)", fontWeight: "var(--yd-weight-extra)", color: "var(--yd-black)", letterSpacing: "-0.02em" },
  headerText: {},
  title: { fontSize: "var(--yd-font-size-2xl)", fontWeight: "var(--yd-weight-black)", color: "var(--yd-black)", letterSpacing: "-0.025em", marginBottom: 8 },
  sub: { fontSize: "var(--yd-font-size-md)", color: "var(--yd-text-soft)", fontWeight: "var(--yd-weight-medium)" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 16,
    marginBottom: 40,
  },
  centerCard: {
    background: "var(--yd-surface)",
    borderRadius: "var(--yd-radius-xl)",
    border: "1.5px solid var(--yd-border)",
    boxShadow: "var(--yd-shadow)",
    padding: "28px 24px 22px",
    cursor: "pointer",
    textAlign: "left",
    transition: "var(--yd-transition)",
    position: "relative",
    overflow: "hidden",
    fontFamily: "var(--yd-font)",
  },
  centerCardActive: {
    borderColor: "var(--yd-yellow)",
    boxShadow: "var(--yd-shadow-yellow), 0 0 0 2px rgba(244,196,0,0.3)",
    transform: "translateY(-2px)",
  },
  cardLoading: {
    position: "absolute", top: 12, right: 12,
  },
  centerLogo: { fontSize: 36, marginBottom: 14 },
  centerName: { fontSize: "var(--yd-font-size-lg)", fontWeight: "var(--yd-weight-extra)", color: "var(--yd-black)", marginBottom: 14, lineHeight: 1.2 },
  centerMeta: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 },
  metaItem: { display: "flex", alignItems: "center", gap: 6, fontSize: "var(--yd-font-size-sm)", color: "var(--yd-text-soft)", fontWeight: "var(--yd-weight-medium)" },
  metaIcon: { fontSize: 12 },
  selectIndicator: {
    fontSize: "var(--yd-font-size-sm)", fontWeight: "var(--yd-weight-bold)", color: "var(--yd-black)",
    background: "var(--yd-yellow-light)", borderRadius: "var(--yd-radius-sm)", padding: "6px 10px",
    width: "fit-content",
  },
  footer: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "20px 24px",
    background: "var(--yd-surface)", borderRadius: "var(--yd-radius-md)",
    border: "1px solid var(--yd-border)",
  },
  footerText: { fontSize: "var(--yd-font-size-sm)", color: "var(--yd-text-soft)", fontWeight: "var(--yd-weight-medium)" },
  logoutBtn: {
    background: "none", border: "1.5px solid var(--yd-border)",
    borderRadius: "var(--yd-radius-sm)", padding: "8px 16px",
    fontSize: "var(--yd-font-size-sm)", fontWeight: "var(--yd-weight-semi)", color: "var(--yd-text-soft)",
    cursor: "pointer", transition: "var(--yd-transition)",
    fontFamily: "var(--yd-font)",
  },
};
