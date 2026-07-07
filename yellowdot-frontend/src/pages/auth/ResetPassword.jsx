import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { PLATFORM_NAME } from "../../config/environment";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [success,   setSuccess]   = useState(false);

  const strength = getStrength(password);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm)  { setError("Passwords do not match."); return; }
    if (!token)                { setError("Invalid or expired reset link."); return; }
    setLoading(true);
    setError("");
    try {
      // Wire to real API endpoint when available
      await new Promise(r => setTimeout(r, 1200));
      setSuccess(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch {
      setError("Reset failed. The link may have expired. Please request a new one.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <div style={styles.logoMark}>
            <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="14" fill="#111111" />
              <circle cx="14" cy="14" r="6" fill="#F4C400" />
            </svg>
          </div>
          <span style={styles.logoText}>{PLATFORM_NAME}</span>
        </div>

        {success ? (
          <div style={{ textAlign: "center", padding: "8px 0 8px" }}>
            <div style={styles.successIcon}>✓</div>
            <h2 style={styles.title}>Password updated!</h2>
            <p style={styles.sub}>Your password has been reset successfully. Redirecting you to sign in…</p>
          </div>
        ) : (
          <>
            <h2 style={styles.title}>Set new password</h2>
            <p style={styles.sub}>Choose a strong password for your account.</p>

            <form onSubmit={handleSubmit} style={styles.form} noValidate>
              <div style={styles.field}>
                <label style={styles.label}>New Password</label>
                <div style={styles.inputWrapper}>
                  <span style={styles.inputIcon}><LockIcon /></span>
                  <input
                    style={styles.input}
                    type={showPw ? "text" : "password"}
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(""); }}
                    autoFocus
                  />
                  <button type="button" style={styles.eyeBtn} onClick={() => setShowPw(p => !p)} tabIndex={-1}>
                    {showPw ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                {/* Strength bar */}
                {password && (
                  <div style={styles.strengthWrap}>
                    <div style={styles.strengthBar}>
                      {[1, 2, 3, 4].map(n => (
                        <div key={n} style={{
                          ...styles.strengthSegment,
                          background: n <= strength.score
                            ? strength.color
                            : "#ECE7D8",
                        }} />
                      ))}
                    </div>
                    <span style={{ ...styles.strengthLabel, color: strength.color }}>
                      {strength.label}
                    </span>
                  </div>
                )}
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Confirm Password</label>
                <div style={styles.inputWrapper}>
                  <span style={styles.inputIcon}><LockIcon /></span>
                  <input
                    style={{
                      ...styles.input,
                      borderColor: confirm && confirm !== password ? "#DC2626" : undefined,
                    }}
                    type={showPw ? "text" : "password"}
                    placeholder="Re-enter password"
                    value={confirm}
                    onChange={e => { setConfirm(e.target.value); setError(""); }}
                  />
                </div>
              </div>

              {error && (
                <div style={styles.errorBox}>
                  <span>⚠</span><span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={loading} style={styles.submitBtn}>
                {loading ? <ButtonDots /> : "Update Password"}
              </button>
            </form>
          </>
        )}

        <div style={styles.backRow}>
          <Link to="/login" style={styles.backLink}>← Back to Sign In</Link>
        </div>
      </div>

      <style>{`
        @keyframes dotPulse {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; }
          40% { transform: scale(1.1); opacity: 1; }
        }
        input:focus { border-color: #F4C400 !important; box-shadow: 0 0 0 4px rgba(244,196,0,0.18) !important; background: #FFFFFF !important; outline: none; }
      `}</style>
    </div>
  );
}

function getStrength(pw) {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++;
  const map = [
    { score: 1, label: "Weak",    color: "#DC2626" },
    { score: 2, label: "Fair",    color: "#D97706" },
    { score: 3, label: "Good",    color: "#b08030" },
    { score: 4, label: "Strong",  color: "#8b7a28" },
  ];
  return { score, ...(map[score - 1] || map[0]) };
}

function ButtonDots() {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: "50%", background: "#111",
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
  page: {
    minHeight: "100vh", background: "linear-gradient(135deg, #FFFDF7 0%, #FFF8DC 100%)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 24, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  },
  card: {
    background: "#FFFFFF", borderRadius: 32,
    boxShadow: "0 24px 80px rgba(244,196,0,0.12), 0 8px 32px rgba(0,0,0,0.08), 0 0 0 1px rgba(236,231,216,0.8)",
    padding: "44px 44px 36px", width: "100%", maxWidth: 420,
  },
  logoRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 32 },
  logoMark: { width: 36, height: 36, borderRadius: 11, background: "#FFFBEA", border: "1px solid #ECE7D8", display: "flex", alignItems: "center", justifyContent: "center" },
  logoText: { fontSize: 16, fontWeight: 800, color: "#111111", letterSpacing: "-0.02em" },
  title: { fontSize: 22, fontWeight: 800, color: "#111111", letterSpacing: "-0.02em", marginBottom: 8 },
  sub: { fontSize: 14, color: "#8b7d65", lineHeight: 1.6, fontWeight: 400, marginBottom: 28 },
  successIcon: {
    width: 60, height: 60, borderRadius: 20, background: "#f8f4d8",
    border: "1px solid #d4bc58", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 24, color: "#6a5c18", fontWeight: 800, margin: "0 auto 20px",
  },
  form: { display: "flex", flexDirection: "column", gap: 18 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B7280" },
  inputWrapper: { position: "relative", display: "flex", alignItems: "center" },
  inputIcon: { position: "absolute", left: 16, color: "#9CA3AF", display: "flex", alignItems: "center", pointerEvents: "none" },
  input: { width: "100%", height: 56, borderRadius: 16, border: "1.5px solid #ECE7D8", background: "#F8F6EF", paddingLeft: 44, paddingRight: 48, fontSize: 15, fontWeight: 500, color: "#2A2A2A", outline: "none", transition: "all 0.18s ease", fontFamily: "'Plus Jakarta Sans', sans-serif" },
  eyeBtn: { position: "absolute", right: 14, background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", display: "flex", alignItems: "center", padding: 4, borderRadius: 6 },
  strengthWrap: { display: "flex", alignItems: "center", gap: 8, marginTop: 4 },
  strengthBar: { display: "flex", gap: 4, flex: 1 },
  strengthSegment: { flex: 1, height: 4, borderRadius: 3, transition: "background 0.2s" },
  strengthLabel: { fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" },
  errorBox: { display: "flex", alignItems: "center", gap: 8, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#DC2626" },
  submitBtn: { height: 56, borderRadius: 16, background: "#F4C400", color: "#111111", fontSize: 15, fontWeight: 800, border: "none", cursor: "pointer", boxShadow: "0 4px 16px rgba(244,196,0,0.40)", transition: "all 0.18s ease", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Plus Jakarta Sans', sans-serif" },
  backRow: { marginTop: 28, textAlign: "center" },
  backLink: { fontSize: 13, fontWeight: 600, color: "#6B7280", textDecoration: "none" },
};
