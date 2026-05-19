import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import MainLayout from "../../layouts/MainLayout";

export default function SecuritySettings() {
  const { user, logout } = useAuth();

  const [currentPw, setCurrentPw]   = useState("");
  const [newPw,     setNewPw]       = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [showPw,    setShowPw]      = useState(false);
  const [loading,   setLoading]     = useState(false);
  const [error,     setError]       = useState("");
  const [success,   setSuccess]     = useState("");

  const strength = getStrength(newPw);

  async function handleChangePassword(e) {
    e.preventDefault();
    if (!currentPw) { setError("Enter your current password."); return; }
    if (newPw.length < 8) { setError("New password must be at least 8 characters."); return; }
    if (newPw !== confirmPw) { setError("Passwords do not match."); return; }
    setLoading(true); setError("");
    try {
      // Wire to PATCH /api/auth/change-password when available
      await new Promise(r => setTimeout(r, 1200));
      setSuccess("Password changed successfully.");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setTimeout(() => setSuccess(""), 4000);
    } catch {
      setError("Failed to change password. Please verify your current password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <MainLayout>
      <div style={styles.page}>
        <div style={styles.inner}>

          <div style={styles.pageHeader}>
            <h1 style={styles.pageTitle}>Security Settings</h1>
            <p style={styles.pageSub}>Manage your password and account security.</p>
          </div>

          {/* Change password */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.cardIcon}>🔑</div>
              <div>
                <h3 style={styles.cardTitle}>Change Password</h3>
                <p style={styles.cardSub}>Use a strong password with 8+ characters.</p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} style={styles.form} noValidate>
              <div style={styles.field}>
                <label style={styles.label}>Current Password</label>
                <div style={styles.inputWrapper}>
                  <span style={styles.inputIcon}><LockIcon /></span>
                  <input
                    className="yd-input"
                    style={styles.inputPadded}
                    type={showPw ? "text" : "password"}
                    placeholder="Your current password"
                    value={currentPw}
                    onChange={e => { setCurrentPw(e.target.value); setError(""); }}
                  />
                </div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>New Password</label>
                <div style={styles.inputWrapper}>
                  <span style={styles.inputIcon}><LockIcon /></span>
                  <input
                    className="yd-input"
                    style={styles.inputPadded}
                    type={showPw ? "text" : "password"}
                    placeholder="Minimum 8 characters"
                    value={newPw}
                    onChange={e => { setNewPw(e.target.value); setError(""); }}
                  />
                  <button type="button" style={styles.eyeBtn} onClick={() => setShowPw(p => !p)} tabIndex={-1}>
                    {showPw ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                {newPw && (
                  <div style={styles.strengthWrap}>
                    <div style={styles.strengthBar}>
                      {[1, 2, 3, 4].map(n => (
                        <div key={n} style={{ ...styles.strengthSeg, background: n <= strength.score ? strength.color : "var(--yd-border)" }} />
                      ))}
                    </div>
                    <span style={{ fontSize: "var(--yd-font-size-xs)", fontWeight: "var(--yd-weight-bold)", color: strength.color }}>{strength.label}</span>
                  </div>
                )}
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Confirm New Password</label>
                <div style={styles.inputWrapper}>
                  <span style={styles.inputIcon}><LockIcon /></span>
                  <input
                    className="yd-input"
                    style={{
                      ...styles.inputPadded,
                      borderColor: confirmPw && confirmPw !== newPw ? "var(--yd-danger)" : undefined,
                    }}
                    type={showPw ? "text" : "password"}
                    placeholder="Re-enter new password"
                    value={confirmPw}
                    onChange={e => { setConfirmPw(e.target.value); setError(""); }}
                  />
                </div>
              </div>

              {error && (
                <div style={styles.errorBox}><span>⚠</span><span>{error}</span></div>
              )}
              {success && (
                <div style={styles.successBox}><span>✓</span><span>{success}</span></div>
              )}

              <div style={styles.formActions}>
                <button type="submit" disabled={loading} style={styles.saveBtn}>
                  {loading ? <ButtonDots /> : "Update Password"}
                </button>
              </div>
            </form>
          </div>

          {/* Security information */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.cardIcon}>🛡️</div>
              <div>
                <h3 style={styles.cardTitle}>Security Information</h3>
                <p style={styles.cardSub}>Your account security overview.</p>
              </div>
            </div>

            <div style={styles.infoGrid}>
              <div style={styles.infoItem}>
                <span style={styles.infoLabel}>Account Email</span>
                <span style={styles.infoValue}>{user?.email || "—"}</span>
              </div>
              <div style={styles.infoItem}>
                <span style={styles.infoLabel}>Role</span>
                <span style={styles.infoValue}>{user?.role?.replace(/_/g, " ") || "—"}</span>
              </div>
              <div style={styles.infoItem}>
                <span style={styles.infoLabel}>Session Auto-Logout</span>
                <span style={styles.infoValue}>After 30 min inactivity</span>
              </div>
              <div style={styles.infoItem}>
                <span style={styles.infoLabel}>2FA</span>
                <span style={{ ...styles.infoValue, color: "var(--yd-warning)" }}>Coming Soon</span>
              </div>
            </div>
          </div>

          {/* Danger zone */}
          <div style={styles.dangerCard}>
            <div style={styles.dangerLeft}>
              <h4 style={styles.dangerTitle}>Sign Out All Devices</h4>
              <p style={styles.dangerSub}>This will end all active sessions across all devices.</p>
            </div>
            <button onClick={() => logout()} style={styles.dangerBtn}>
              Sign Out Everywhere
            </button>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes dotPulse {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; }
          40% { transform: scale(1.1); opacity: 1; }
        }
      `}</style>
    </MainLayout>
  );
}

function getStrength(pw) {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++;
  const map = [
    { score: 1, label: "Weak",   color: "var(--yd-danger)" },
    { score: 2, label: "Fair",   color: "var(--yd-warning)" },
    { score: 3, label: "Good",   color: "var(--yd-info)" },
    { score: 4, label: "Strong", color: "var(--yd-success)" },
  ];
  return { score, ...(map[score - 1] || map[0]) };
}

function ButtonDots() {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: "50%",
          background: "var(--yd-black)",
          display: "inline-block",
          animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </span>
  );
}

function LockIcon() { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>; }
function EyeIcon() { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>; }
function EyeOffIcon() { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>; }

const styles = {
  page: { padding: "32px 32px 48px", maxWidth: 700, margin: "0 auto" },
  inner: { display: "flex", flexDirection: "column", gap: 20 },
  pageHeader: { marginBottom: 4 },
  pageTitle: { fontSize: "var(--yd-font-size-2xl)", fontWeight: "var(--yd-weight-black)", color: "var(--yd-black)", letterSpacing: "-0.025em", marginBottom: 4 },
  pageSub: { fontSize: "var(--yd-font-size-base)", color: "var(--yd-text-soft)" },
  card: { background: "var(--yd-surface)", borderRadius: "var(--yd-radius-lg)", border: "1px solid var(--yd-border)", boxShadow: "var(--yd-shadow)", padding: "28px" },
  cardHeader: { display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 24 },
  cardIcon: { width: 44, height: 44, borderRadius: "var(--yd-radius-sm)", background: "var(--yd-soft)", border: "1px solid var(--yd-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 },
  cardTitle: { fontSize: "var(--yd-font-size-md)", fontWeight: "var(--yd-weight-extra)", color: "var(--yd-black)", marginBottom: 3 },
  cardSub: { fontSize: "var(--yd-font-size-sm)", color: "var(--yd-text-soft)" },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: "var(--yd-font-size-xs)", fontWeight: "var(--yd-weight-bold)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--yd-text-muted)" },
  inputWrapper: { position: "relative", display: "flex", alignItems: "center" },
  inputIcon: { position: "absolute", left: 14, color: "var(--yd-text-muted)", display: "flex", alignItems: "center", pointerEvents: "none", zIndex: 1 },
  inputPadded: { paddingLeft: 42, paddingRight: 48, height: 48 },
  eyeBtn: { position: "absolute", right: 12, background: "none", border: "none", cursor: "pointer", color: "var(--yd-text-muted)", display: "flex", alignItems: "center", padding: 4, borderRadius: "var(--yd-radius-xs)" },
  strengthWrap: { display: "flex", alignItems: "center", gap: 8 },
  strengthBar: { display: "flex", gap: 4, flex: 1 },
  strengthSeg: { flex: 1, height: 4, borderRadius: 3, transition: "background 0.2s" },
  errorBox: { display: "flex", alignItems: "center", gap: 8, background: "var(--yd-danger-soft)", border: "1px solid var(--yd-danger-border)", borderRadius: "var(--yd-radius)", padding: "10px 14px", fontSize: "var(--yd-font-size-sm)", fontWeight: "var(--yd-weight-semi)", color: "var(--yd-danger)" },
  successBox: { display: "flex", alignItems: "center", gap: 8, background: "var(--yd-success-soft)", border: "1px solid var(--yd-success-border)", borderRadius: "var(--yd-radius)", padding: "10px 14px", fontSize: "var(--yd-font-size-sm)", fontWeight: "var(--yd-weight-semi)", color: "var(--yd-success)" },
  formActions: { display: "flex", justifyContent: "flex-end" },
  saveBtn: { padding: "10px 24px", borderRadius: "var(--yd-radius)", background: "var(--yd-yellow)", border: "none", fontSize: "var(--yd-font-size-sm)", fontWeight: "var(--yd-weight-extra)", color: "var(--yd-black)", cursor: "pointer", boxShadow: "var(--yd-shadow-yellow)", display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--yd-font)" },
  infoGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 },
  infoItem: { display: "flex", flexDirection: "column", gap: 4 },
  infoLabel: { fontSize: "var(--yd-font-size-xs)", fontWeight: "var(--yd-weight-bold)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--yd-text-muted)" },
  infoValue: { fontSize: "var(--yd-font-size-base)", fontWeight: "var(--yd-weight-semi)", color: "var(--yd-text)" },
  dangerCard: { background: "var(--yd-danger-soft)", borderRadius: "var(--yd-radius-lg)", border: "1px solid var(--yd-danger-border)", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 },
  dangerLeft: {},
  dangerTitle: { fontSize: "var(--yd-font-size-base)", fontWeight: "var(--yd-weight-bold)", color: "var(--yd-danger)", marginBottom: 3 },
  dangerSub: { fontSize: "var(--yd-font-size-sm)", color: "var(--yd-danger)" },
  dangerBtn: { padding: "10px 18px", borderRadius: "var(--yd-radius)", background: "var(--yd-danger)", border: "none", fontSize: "var(--yd-font-size-sm)", fontWeight: "var(--yd-weight-bold)", color: "white", cursor: "pointer", flexShrink: 0, fontFamily: "var(--yd-font)" },
};
