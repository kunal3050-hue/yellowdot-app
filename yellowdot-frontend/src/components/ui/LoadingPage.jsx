/**
 * LoadingPage — full-page loading state with Yellow Dot branding
 *
 * Usage:
 *   if (loading) return <LoadingPage />;
 *   if (loading) return <LoadingPage message="Loading students…" />;
 *   if (loading) return <LoadingPage variant="dots" />;
 *
 * @prop {string}  message    (default: "Loading…")
 * @prop {string}  variant    "spinner" | "dots" | "pulse" (default: "dots")
 * @prop {string}  size       "sm" | "md" | "full" (default: "full")
 * @prop {string}  className
 */
export default function LoadingPage({
  message   = "Loading…",
  variant   = "dots",
  size      = "full",
  className = "",
}) {
  const containerStyle = {
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    gap:            16,
    background:     "var(--yd-bg)",
    color:          "var(--yd-text-muted)",
    ...(size === "full"
      ? { minHeight: "100vh", width: "100%" }
      : size === "sm"
      ? { minHeight: 200 }
      : { minHeight: "60vh" }
    ),
  };

  return (
    <div className={className} style={containerStyle}>
      {/* Brand mark */}
      <div style={{
        width:        48,
        height:       48,
        borderRadius: "var(--yd-radius-md)",
        background:   "linear-gradient(135deg, var(--yd-yellow), #FFE55C)",
        display:      "flex",
        alignItems:   "center",
        justifyContent: "center",
        fontSize:     22,
        boxShadow:    "var(--yd-shadow-yellow)",
        animation:    "yd-pulse 2s ease-in-out infinite",
      }}>
        ⭐
      </div>

      {/* Loader */}
      {variant === "dots" && (
        <div className="yd-dots">
          <span /><span /><span />
        </div>
      )}
      {variant === "spinner" && (
        <div className="yd-spinner yd-spinner-lg" />
      )}
      {variant === "pulse" && (
        <div style={{
          width: 120, height: 4, borderRadius: 4,
          background: "var(--yd-border-light)",
          overflow: "hidden",
          position: "relative",
        }}>
          <div style={{
            position: "absolute",
            height: "100%",
            width: "40%",
            background: "linear-gradient(90deg, transparent, var(--yd-yellow), transparent)",
            animation: "yd-loading-bar 1.4s ease-in-out infinite",
          }} />
        </div>
      )}

      {message && (
        <div style={{
          fontSize:   13,
          fontWeight: 600,
          color:      "var(--yd-text-muted)",
          letterSpacing: "0.02em",
        }}>
          {message}
        </div>
      )}

      <style>{`
        @keyframes yd-loading-bar {
          0%   { left: -40%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}

/* ── PageError — error state used alongside LoadingPage ── */
/**
 * PageError — full-page error state
 *
 * @prop {string}   message
 * @prop {function} onRetry
 * @prop {function} onBack
 */
export function PageError({ message, onRetry, onBack }) {
  return (
    <div style={{
      display:        "flex",
      flexDirection:  "column",
      alignItems:     "center",
      justifyContent: "center",
      minHeight:      "60vh",
      gap:            16,
      padding:        24,
      textAlign:      "center",
    }}>
      <div style={{ fontSize: 48, lineHeight: 1 }}>⚠️</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "var(--yd-charcoal)" }}>
        Something went wrong
      </div>
      {message && (
        <div style={{ fontSize: 13, color: "var(--yd-text-muted)", maxWidth: 400, lineHeight: 1.6 }}>
          {message}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        {onRetry && (
          <button
            onClick={onRetry}
            style={errBtnStyle("var(--yd-charcoal)", "white")}
          >
            Try again
          </button>
        )}
        {onBack && (
          <button
            onClick={onBack}
            style={errBtnStyle("var(--yd-soft)", "var(--yd-text)", "1px solid var(--yd-border)")}
          >
            ← Go back
          </button>
        )}
      </div>
    </div>
  );
}

function errBtnStyle(bg, color, border = "none") {
  return {
    padding:      "9px 20px",
    borderRadius: "var(--yd-radius-sm)",
    background:   bg,
    color,
    border,
    fontSize:     13,
    fontWeight:   700,
    fontFamily:   "var(--yd-font)",
    cursor:       "pointer",
  };
}
