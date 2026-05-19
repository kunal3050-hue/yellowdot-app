import { useState } from "react";
import { Link } from "react-router-dom";

export default function ForgotPassword() {
  const [email,     setEmail]     = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    // Simulate API call — wire to real endpoint when email service is ready
    await new Promise(r => setTimeout(r, 1200));
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoRow}>
          <div style={styles.logoMark}>
            <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="14" fill="#111111" />
              <circle cx="14" cy="14" r="6" fill="#F4C400" />
            </svg>
          </div>
          <span style={styles.logoText}>Yellow Dot</span>
        </div>

        {!submitted ? (
          <>
            <div style={styles.iconBlock}>
              <div style={styles.iconRing}>
                <svg width="28" height="28" fill="none" stroke="#F4C400" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </div>
            </div>
            <h2 style={styles.title}>Forgot your password?</h2>
            <p style={styles.sub}>Enter your email address and we'll send you a link to reset your password.</p>

            <form onSubmit={handleSubmit} style={styles.form} noValidate>
              <div style={styles.field}>
                <label style={styles.label}>Email Address</label>
                <div style={styles.inputWrapper}>
                  <span style={styles.inputIcon}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="M2 7l10 7 10-7" />
                    </svg>
                  </span>
                  <input
                    style={styles.input}
                    type="email"
                    placeholder="admin@yellowdot.in"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <button type="submit" disabled={loading || !email.trim()} style={styles.submitBtn}>
                {loading ? <ButtonDots /> : "Send Reset Link"}
              </button>
            </form>
          </>
        ) : (
          <div style={styles.successBlock}>
            <div style={styles.successIcon}>✓</div>
            <h2 style={styles.title}>Check your inbox</h2>
            <p style={styles.sub}>
              We've sent a password reset link to <strong>{email}</strong>.
              <br />Check your email and follow the link.
            </p>
            <p style={{ ...styles.sub, marginTop: 8, fontSize: 12 }}>
              Didn't receive it? Check your spam folder or try again.
            </p>
            <button onClick={() => setSubmitted(false)} style={styles.retryBtn}>
              Try a different email
            </button>
          </div>
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
        input:focus {
          border-color: #F4C400 !important;
          box-shadow: 0 0 0 4px rgba(244,196,0,0.18) !important;
          background: #FFFFFF !important;
          outline: none;
        }
      `}</style>
    </div>
  );
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

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #FFFDF7 0%, #FFF8DC 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  },
  card: {
    background: "#FFFFFF",
    borderRadius: 32,
    boxShadow: "0 24px 80px rgba(244,196,0,0.12), 0 8px 32px rgba(0,0,0,0.08), 0 0 0 1px rgba(236,231,216,0.8)",
    padding: "44px 44px 36px",
    width: "100%",
    maxWidth: 420,
  },
  logoRow: {
    display: "flex", alignItems: "center", gap: 10, marginBottom: 32,
  },
  logoMark: {
    width: 36, height: 36, borderRadius: 11,
    background: "#FFFBEA", border: "1px solid #ECE7D8",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  logoText: { fontSize: 16, fontWeight: 800, color: "#111111", letterSpacing: "-0.02em" },
  iconBlock: { marginBottom: 20 },
  iconRing: {
    width: 60, height: 60, borderRadius: 20,
    background: "#FFF4BF", border: "1px solid #F4C400",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 22, fontWeight: 800, color: "#111111", letterSpacing: "-0.02em", marginBottom: 8 },
  sub: { fontSize: 14, color: "#6B7280", lineHeight: 1.6, fontWeight: 500, marginBottom: 28 },
  form: { display: "flex", flexDirection: "column", gap: 18 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: {
    fontSize: 11, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.06em", color: "#6B7280",
  },
  inputWrapper: { position: "relative", display: "flex", alignItems: "center" },
  inputIcon: {
    position: "absolute", left: 16, color: "#9CA3AF",
    display: "flex", alignItems: "center", pointerEvents: "none",
  },
  input: {
    width: "100%", height: 56, borderRadius: 16,
    border: "1.5px solid #ECE7D8", background: "#F8F6EF",
    paddingLeft: 44, paddingRight: 16,
    fontSize: 15, fontWeight: 500, color: "#2A2A2A",
    outline: "none", transition: "all 0.18s ease",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  submitBtn: {
    height: 56, borderRadius: 16, background: "#F4C400",
    color: "#111111", fontSize: 15, fontWeight: 800, border: "none",
    cursor: "pointer", boxShadow: "0 4px 16px rgba(244,196,0,0.40)",
    transition: "all 0.18s ease",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  successBlock: { textAlign: "center", paddingBottom: 8 },
  successIcon: {
    width: 60, height: 60, borderRadius: 20,
    background: "#F0FDF4", border: "1px solid #BBF7D0",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 24, color: "#16A34A", fontWeight: 800,
    margin: "0 auto 20px",
  },
  retryBtn: {
    marginTop: 20, background: "none", border: "1.5px solid #ECE7D8",
    borderRadius: 12, padding: "10px 20px", fontSize: 13, fontWeight: 600,
    color: "#6B7280", cursor: "pointer", transition: "all 0.15s",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  backRow: { marginTop: 28, textAlign: "center" },
  backLink: {
    fontSize: 13, fontWeight: 600, color: "#6B7280", textDecoration: "none",
  },
};
