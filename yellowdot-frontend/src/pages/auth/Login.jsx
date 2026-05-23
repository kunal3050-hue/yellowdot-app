/**
 * Login — ultra-minimal, full-white, single-action sign-in screen.
 *
 * Layout  : centered column, no card, pure white bg
 * Auth    : Google only (Google → email account-link flow handled inline)
 * Vibe    : Apple × Notion × Linear
 */

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

// ── Route mapping ──────────────────────────────────────────────────────────────
function getHomeRoute(role) {
  const map = {
    super_admin: "/", developer: "/", center_admin: "/",
    teacher: "/attendance", parent: "/parent-checkin",
    accountant: "/invoice", cctv_viewer: "/live-cctv", reception: "/",
  };
  return map[role] || "/";
}

// ── Keyframes (injected once) ──────────────────────────────────────────────────
const CSS = `
  @keyframes yd-rise {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes yd-fade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes yd-spin {
    to { transform: rotate(360deg); }
  }
`;

// ═══════════════════════════════════════════════════════════════════════════════
export default function Login() {
  const { loginWithGoogle, isAuthenticated, user } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const _from = location.state?.from?.pathname;
  const from  = (_from && _from !== "/unauthorized" && _from !== "/login") ? _from : null;

  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  // Redirect if already authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    if (user?.centers?.length > 1 && !user?.activeCenter) {
      navigate("/select-center", { replace: true });
    } else {
      navigate(from || getHomeRoute(user?.role), { replace: true });
    }
  }, [isAuthenticated]); // eslint-disable-line

  const inactivityNote = location.search.includes("reason=inactivity");

  function handleResult(result) {
    if (result.requiresCenterSelect) {
      navigate("/select-center", { replace: true });
    } else {
      navigate(from || result.homeRoute || "/", { replace: true });
    }
  }

  async function handleGoogle() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const result = await loginWithGoogle();
      handleResult(result);
    } catch (err) {
      setLoading(false);
      if (err.code === "auth/popup-closed-by-user") {
        setError("Sign-in was cancelled. Tap the button to try again.");
        return;
      }
      if (err.code === "auth/link-required") {
        setError(
          "This email is registered as a staff account. Contact your administrator to link your Google account."
        );
        return;
      }
      setError(
        err?.response?.data?.error || err.message || "Sign-in failed. Please try again."
      );
    }
  }

  return (
    <div
      style={{
        position:       "fixed",
        inset:          0,
        background:     "#ffffff",
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        fontFamily:     '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        overflowY:      "auto",
        padding:        "32px 24px",
        boxSizing:      "border-box",
      }}
    >
      <style>{CSS}</style>

      {/* ── Mascot + glow ─────────────────────────────────────────────────── */}
      <div
        style={{
          position:  "relative",
          width:     120,
          height:    120,
          display:   "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 28,
          animation: "yd-rise 0.65s cubic-bezier(0.22, 1, 0.36, 1) 0.04s both",
        }}
      >
        {/* Warm ambient glow */}
        <div
          aria-hidden="true"
          style={{
            position:     "absolute",
            inset:        -18,
            borderRadius: "50%",
            background:   "radial-gradient(circle at center, rgba(244,196,0,0.28) 0%, rgba(244,196,0,0.10) 45%, transparent 72%)",
            filter:       "blur(18px)",
          }}
        />
        {/* Mascot image */}
        <img
          src="/icons/pwa-512x512.png"
          alt="Yellow Dot"
          draggable={false}
          style={{
            width:      90,
            height:     90,
            position:   "relative",
            zIndex:     1,
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        />
      </div>

      {/* ── Wordmark ──────────────────────────────────────────────────────── */}
      <div
        style={{
          textAlign:  "center",
          marginBottom: 52,
          animation:  "yd-rise 0.65s cubic-bezier(0.22, 1, 0.36, 1) 0.16s both",
        }}
      >
        <div
          style={{
            fontSize:      34,
            fontWeight:    800,
            letterSpacing: "-0.045em",
            color:         "#0F0F0F",
            lineHeight:    1.05,
          }}
        >
          Yellow Dot
        </div>
        <div
          style={{
            fontSize:      15,
            fontWeight:    400,
            color:         "#A8A29E",
            marginTop:     8,
            letterSpacing: "0.005em",
            lineHeight:    1.4,
          }}
        >
          Preschool &amp; Daycare
        </div>
      </div>

      {/* ── Inactivity note ───────────────────────────────────────────────── */}
      {inactivityNote && (
        <div
          style={{
            marginBottom:  20,
            padding:       "11px 16px",
            background:    "#FFFBEA",
            border:        "1px solid rgba(244,196,0,0.35)",
            borderRadius:  12,
            fontSize:      13,
            color:         "#92700A",
            fontWeight:    500,
            maxWidth:      320,
            textAlign:     "center",
            animation:     "yd-fade 0.4s ease both",
          }}
        >
          You were signed out due to inactivity.
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div
          style={{
            marginBottom:  20,
            padding:       "11px 16px",
            background:    "#FFF2F2",
            border:        "1px solid rgba(220,38,38,0.18)",
            borderRadius:  12,
            fontSize:      13,
            color:         "#B91C1C",
            fontWeight:    500,
            maxWidth:      320,
            textAlign:     "center",
            lineHeight:    1.5,
            animation:     "yd-fade 0.3s ease both",
          }}
        >
          {error}
        </div>
      )}

      {/* ── Google Sign-In button ─────────────────────────────────────────── */}
      <GoogleButton loading={loading} onClick={handleGoogle} />

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GOOGLE BUTTON
// ═══════════════════════════════════════════════════════════════════════════════

function GoogleButton({ loading, onClick }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const transform = loading
    ? "none"
    : pressed
    ? "scale(0.972)"
    : hovered
    ? "translateY(-2px)"
    : "none";

  const shadow = pressed || loading
    ? "0 1px 3px rgba(0,0,0,0.06)"
    : hovered
    ? "0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)"
    : "0 2px 10px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)";

  return (
    <button
      onClick={onClick}
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      aria-label="Continue with Google"
      style={{
        /* sizing */
        width:          "min(300px, calc(100vw - 48px))",
        height:         56,
        borderRadius:   18,
        /* colours */
        background:     pressed ? "#F9F9F7" : "#ffffff",
        border:         "1px solid rgba(0,0,0,0.09)",
        /* layout */
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        gap:            12,
        /* typography */
        fontFamily:     "inherit",
        fontWeight:     600,
        fontSize:       16,
        color:          "#1A1A1A",
        letterSpacing:  "-0.01em",
        /* interaction */
        cursor:         loading ? "default" : "pointer",
        transition:     "transform 0.18s cubic-bezier(0.22,1,0.36,1), box-shadow 0.18s ease, background 0.12s ease",
        transform,
        boxShadow:      shadow,
        /* animation */
        animation:      "yd-rise 0.65s cubic-bezier(0.22, 1, 0.36, 1) 0.30s both",
        /* prevent tap highlight on mobile */
        WebkitTapHighlightColor: "transparent",
        outline:        "none",
        userSelect:     "none",
      }}
    >
      {loading ? (
        <span
          style={{
            width:        20,
            height:       20,
            borderRadius: "50%",
            border:       "2.5px solid #E0D8C0",
            borderTopColor: "#F4C400",
            animation:    "yd-spin 0.7s linear infinite",
            display:      "block",
            flexShrink:   0,
          }}
        />
      ) : (
        <GoogleIcon />
      )}
      <span>{loading ? "Signing in…" : "Continue with Google"}</span>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GOOGLE SVG ICON
// ═══════════════════════════════════════════════════════════════════════════════

function GoogleIcon() {
  return (
    <svg
      width="20" height="20" viewBox="0 0 48 48"
      aria-hidden="true" focusable="false"
      style={{ flexShrink: 0 }}
    >
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}
