/**
 * Login — ultra-premium minimal sign-in screen.
 *
 * Layout  : pure #FFFFFF, no card, content sits ~15 vh from top
 * Auth    : Google only
 * Vibe    : Apple onboarding × Linear × premium SaaS
 */

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { PLATFORM_NAME } from "../../config/environment";

// ── Route map ──────────────────────────────────────────────────────────────────
function getHomeRoute(role) {
  const map = {
    super_admin:  "/",          developer:   "/",
    center_admin: "/",          teacher:     "/attendance",
    parent:       "/parent-home",
    accountant:   "/invoice",
    reception:    "/",
  };
  return map[role] || "/";
}

// ── Time-based greeting ────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return "Good morning ☀️";
  if (h >= 12 && h < 17) return "Good afternoon ☀️";
  return "Good evening 🌙";
}

// ── Shared spring easing ───────────────────────────────────────────────────────
const SPRING = "cubic-bezier(0.22, 1, 0.36, 1)";

// ── Keyframes + safe-area support ─────────────────────────────────────────────
const CSS = `
  @keyframes yd-rise {
    from { opacity: 0; transform: translateY(10px); }
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

// ── Animation helper ───────────────────────────────────────────────────────────
const rise = (delay) =>
  `yd-rise 0.65s ${SPRING} ${delay}s both`;

// ═══════════════════════════════════════════════════════════════════════════════
export default function Login() {
  const { loginWithGoogle, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const _from = location.state?.from?.pathname;
  const from  = (_from && _from !== "/unauthorized" && _from !== "/login") ? _from : null;

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

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
        setError("Sign-in was cancelled. Tap to try again.");
        return;
      }
      if (err.code === "auth/link-required") {
        setError("This email has a staff account. Contact your administrator to link your Google account.");
        return;
      }
      setError(err?.response?.data?.error || err.message || "Sign-in failed. Please try again.");
    }
  }

  return (
    <div
      style={{
        /* ── canvas ── */
        position:   "fixed",
        inset:      0,
        background: "#FFFFFF",

        /* ── layout: column, starts ~15 vh from top (not centred) ── */
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "flex-start",

        /* ── safe-area-aware padding for notches & home bars ── */
        paddingTop:    "max(15vh, calc(env(safe-area-inset-top, 0px) + 32px))",
        paddingBottom: "max(32px, calc(env(safe-area-inset-bottom, 0px) + 20px))",
        paddingLeft:   "max(24px, env(safe-area-inset-left, 0px))",
        paddingRight:  "max(24px, env(safe-area-inset-right, 0px))",

        boxSizing: "border-box",
        overflowY: "auto",

        /* ── typography base ── */
        fontFamily:          '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      }}
    >
      <style>{CSS}</style>

      {/* ── 1. Mascot ──────────────────────────────────────────────────────── */}
      {/*    drop-shadow: blur reduced 20 % vs previous (30 → 24 px, 0.18 → 0.14 opacity) */}
      <img
        src="/icons/pwa-512x512.png"
        alt={PLATFORM_NAME}
        draggable={false}
        style={{
          width:     90,
          height:    90,
          display:   "block",
          filter:    "drop-shadow(0 8px 24px rgba(255, 196, 0, 0.14))",
          userSelect:       "none",
          WebkitUserSelect: "none",
          marginBottom: 36,         /* increased gap to wordmark */
          animation:    rise(0.04),
        }}
      />

      {/* ── 2. Brand wordmark ──────────────────────────────────────────────── */}
      <div
        style={{
          textAlign:    "center",
          marginBottom: 18,
          animation:    rise(0.17),
        }}
      >
        <div
          style={{
            fontSize:      34,
            fontWeight:    800,
            letterSpacing: "-0.045em",
            color:         "#0F0F0F",
            lineHeight:    1.0,
          }}
        >
          {PLATFORM_NAME}
        </div>
        <div
          style={{
            fontSize:      14,
            fontWeight:    400,
            color:         "#B5AFA9",
            marginTop:     7,
            letterSpacing: "0.01em",
            lineHeight:    1.4,
          }}
        >
          Preschool &amp; Daycare
        </div>
      </div>

      {/* ── 3. Dynamic greeting ────────────────────────────────────────────── */}
      {/*    Smaller, lighter — atmospheric, not structural */}
      <div
        style={{
          fontSize:      15,
          fontWeight:    400,
          color:         "#C0BAB3",      /* lighter than subtitle — purely atmospheric */
          letterSpacing: "0.01em",
          lineHeight:    1.4,
          marginBottom:  52,
          textAlign:     "center",
          animation:     rise(0.30),
        }}
      >
        {getGreeting()}
      </div>

      {/* ── 4. Contextual notices ──────────────────────────────────────────── */}
      {inactivityNote && (
        <div style={noticeStyle("amber")}>
          You were signed out due to inactivity.
        </div>
      )}
      {error && (
        <div style={noticeStyle("red")}>
          {error}
        </div>
      )}

      {/* ── 5. Google button ───────────────────────────────────────────────── */}
      <GoogleButton loading={loading} onClick={handleGoogle} />

    </div>
  );
}

// ── Notice banners ─────────────────────────────────────────────────────────────
function noticeStyle(tone) {
  const amber = tone === "amber";
  return {
    marginBottom: 18,
    padding:      "10px 16px",
    background:   amber ? "#FFFBEA" : "#FFF2F2",
    border:       `1px solid ${amber ? "rgba(244,196,0,0.28)" : "rgba(220,38,38,0.13)"}`,
    borderRadius: 12,
    fontSize:     13,
    fontWeight:   400,
    color:        amber ? "#92700A" : "#B91C1C",
    maxWidth:     "min(300px, calc(100vw - 48px))",
    textAlign:    "center",
    lineHeight:   1.5,
    animation:    "yd-fade 0.35s ease both",
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GOOGLE BUTTON
// ═══════════════════════════════════════════════════════════════════════════════

function GoogleButton({ loading, onClick }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  /* hover: -1 px lift  |  press: scale 0.985  (tighter / more premium) */
  const btnTransform = loading   ? "none"
    : pressed                    ? "scale(0.985)"
    : hovered                    ? "translateY(-1px)"
    : "none";

  const btnShadow = (pressed || loading)
    ? "0 1px 4px rgba(0,0,0,0.05)"
    : hovered
    ? "0 6px 22px rgba(0,0,0,0.09), 0 2px 6px rgba(0,0,0,0.05)"
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
        /* sizing — height reduced to 52px for tighter premium feel */
        width:          "min(308px, calc(100vw - 48px))",
        height:         52,
        borderRadius:   16,

        /* colour */
        background:     pressed ? "#F7F7F5" : "#FFFFFF",
        border:         "1px solid rgba(0,0,0,0.09)",

        /* layout */
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        gap:            11,

        /* type */
        fontFamily:     "inherit",
        fontWeight:     600,
        fontSize:       15,
        color:          "#1A1A1A",
        letterSpacing:  "-0.01em",

        /* interaction */
        cursor:                  loading ? "default" : "pointer",
        WebkitTapHighlightColor: "transparent",
        outline:                 "none",
        userSelect:              "none",

        /* motion */
        transition: `transform 0.16s ${SPRING}, box-shadow 0.16s ease, background 0.1s ease`,
        transform:  btnTransform,
        boxShadow:  btnShadow,

        /* entrance — last element to fade in */
        animation: rise(0.44),
      }}
    >
      {loading ? <Spinner /> : <GoogleIcon />}
      <span style={{ lineHeight: 1 }}>
        {loading ? "Signing in…" : "Continue with Google"}
      </span>
    </button>
  );
}

// ── Spinner ────────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <span
      style={{
        display:        "block",
        width:          18,
        height:         18,
        borderRadius:   "50%",
        border:         "2px solid rgba(0,0,0,0.10)",
        borderTopColor: "#F4C400",
        animation:      "yd-spin 0.75s linear infinite",
        flexShrink:     0,
      }}
    />
  );
}

// ── Google colour icon — 18 px ─────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg
      width="18" height="18" viewBox="0 0 48 48"
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
