import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

// ── Design tokens ─────────────────────────────────────────────────────────────
const YD_YELLOW    = "#F4C400";
const YD_YELLOW_DK = "#D9AE00";
const YD_BG        = "#FFFDF7";
const YD_CHARCOAL  = "#1E1E1E";
const YD_TEXT      = "#2A2A2A";
const YD_SOFT      = "#888";

const FEATURES = [
  { label: "Student Attendance",   icon: "✦" },
  { label: "Fee & Billing",        icon: "✦" },
  { label: "Live CCTV",            icon: "✦" },
  { label: "Parent Check-In",      icon: "✦" },
  { label: "Pickup Security",      icon: "✦" },
];

function getHomeRoute(role) {
  const map = {
    super_admin: "/", developer: "/", center_admin: "/",
    teacher: "/attendance", parent: "/parent-checkin",
    accountant: "/invoice", cctv_viewer: "/live-cctv", reception: "/",
  };
  return map[role] || "/";
}

// ── Grain overlay (SVG data URI) ──────────────────────────────────────────────
const GRAIN_URI = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23g)' opacity='1'/%3E%3C/svg%3E")`;

// ═════════════════════════════════════════════════════════════════════════════
// MAIN LOGIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function Login() {
  const { loginWithGoogle, loginWithEmail, loginWithOTP, requestOTP, isAuthenticated, user } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  // Ignore /unauthorized as a "came from" — always send them to their home route instead
  const _from     = location.state?.from?.pathname;
  const from      = (_from && _from !== "/unauthorized" && _from !== "/login") ? _from : null;

  const [tab,        setTab]        = useState("google");   // "google" | "otp" | "email"
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [linkEmail,  setLinkEmail]  = useState("");        // pre-fill after Google conflict

  // Redirect if already logged in
  useEffect(() => {
    if (!isAuthenticated) return;
    if (user?.centers?.length > 1 && !user?.activeCenter) {
      navigate("/select-center", { replace: true });
    } else {
      navigate(from || getHomeRoute(user?.role), { replace: true });
    }
  }, [isAuthenticated]); // eslint-disable-line

  // Check for inactivity redirect
  const inactivityNote = location.search.includes("reason=inactivity");

  function handleResult(result) {
    if (result.requiresCenterSelect) {
      navigate("/select-center", { replace: true });
    } else {
      navigate(from || result.homeRoute || "/", { replace: true });
    }
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>

      {/* ── Left panel — brand (hidden on mobile) ────────────────────── */}
      <div className="login-left-panel">
        <LeftPanel />
      </div>

      {/* ── Right panel — auth card ───────────────────────────────────── */}
      <div className="login-right-panel" style={{
        flex: 1, background: `linear-gradient(160deg, ${YD_BG} 0%, #FFF8E8 100%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "32px 24px", overflowY: "auto",
        animation: "fadeSlideRight 0.6s ease both",
      }}>
        <div className="login-card" style={{
          width: "100%", maxWidth: 440,
          background: "rgba(255,255,255,0.82)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderRadius: 28,
          border: "1px solid rgba(236,231,216,0.9)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.07), 0 2px 8px rgba(244,196,0,0.06)",
          padding: "40px 36px",
        }}>

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 28 }}>
            <img
              src="/icons/pwa-192x192.png"
              alt="Yellow Dot"
              style={{ width: 44, height: 44, borderRadius: 13, display: "block" }}
            />
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: YD_CHARCOAL, lineHeight: 1 }}>Yellow Dot</div>
              <div style={{ fontSize: 11, color: YD_SOFT, marginTop: 3, fontWeight: 500 }}>Preschool CRM</div>
            </div>
          </div>

          {/* Heading */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontWeight: 800, fontSize: 26, color: YD_CHARCOAL, margin: 0, lineHeight: 1.15, letterSpacing: "-0.5px" }}>
              Welcome back
            </h1>
            <p style={{ marginTop: 6, color: YD_SOFT, fontSize: 14, fontWeight: 500 }}>
              Sign in to your school account
            </p>
          </div>

          {/* Inactivity note */}
          {inactivityNote && (
            <div style={{
              background: "#FFF8E0", border: "1px solid #F4C40044",
              borderRadius: 10, padding: "10px 14px", marginBottom: 20,
              fontSize: 13, color: "#92730A", fontWeight: 500,
            }}>
              You were signed out due to inactivity.
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              background: "#FFF0F0", border: "1px solid #FFB3B3",
              borderRadius: 10, padding: "10px 14px", marginBottom: 20,
              fontSize: 13, color: "#D02020", fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          {/* Auth method tabs */}
          <AuthTabs tab={tab} setTab={t => { setTab(t); setError(""); }} />

          {/* Tab content */}
          <div style={{ marginTop: 24 }}>
            {tab === "google" && (
              <GoogleTab
                loading={loading} setLoading={setLoading}
                setError={setError} loginWithGoogle={loginWithGoogle}
                handleResult={handleResult}
                onLinkRequired={(email) => {
                  setLinkEmail(email);
                  setTab("email");
                  setError(
                    `This email already has a staff account. Sign in with your temporary password — Google will be linked automatically.`
                  );
                }}
              />
            )}
            {tab === "otp" && (
              <OTPTab
                loading={loading} setLoading={setLoading}
                setError={setError} requestOTP={requestOTP}
                loginWithOTP={loginWithOTP} handleResult={handleResult}
              />
            )}
            {tab === "email" && (
              <EmailTab
                loading={loading} setLoading={setLoading}
                setError={setError} loginWithEmail={loginWithEmail}
                handleResult={handleResult}
                prefillEmail={linkEmail}
              />
            )}
          </div>

        </div>
      </div>

      {/* Global animations + mobile responsive */}
      <style>{`
        @keyframes fadeSlideUp    { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:none; } }
        @keyframes fadeSlideRight { from { opacity:0; transform:translateX(24px); } to { opacity:1; transform:none; } }
        @keyframes blobPulse      { 0%,100%{transform:scale(1) rotate(0deg);} 50%{transform:scale(1.08) rotate(4deg);} }
        @keyframes slideIn        { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }

        /* Mobile — hide left brand panel, full-width auth card */
        @media (max-width: 767px) {
          .login-left-panel { display: none !important; }
          .login-right-panel {
            padding: 20px 18px !important;
            align-items: center !important;
            justify-content: center !important;
            min-height: 100svh;
          }
        }

        /* Small phones — tighten further */
        @media (max-width: 480px) {
          .login-right-panel {
            padding: 16px !important;
          }
        }

        /* Tablet — slightly narrower left panel */
        @media (min-width: 768px) and (max-width: 1023px) {
          .login-left-panel > div {
            width: 42% !important;
            min-width: 280px !important;
            padding: 40px 32px !important;
          }
        }

        /* Touch targets on mobile */
        @media (max-width: 767px) {
          .login-right-panel input {
            font-size: 16px !important;
            height: 48px !important;
          }
          .login-right-panel button:not([style*="36px"]) {
            min-height: 44px !important;
          }
          .login-card {
            padding: 28px 20px 24px !important;
            border-radius: 24px !important;
            background: rgba(255,255,255,0.97) !important;
          }
        }
        @media (max-width: 480px) {
          .login-card {
            border-radius: 20px !important;
            padding: 26px 18px 22px !important;
          }
        }
      `}</style>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LEFT PANEL
// ═════════════════════════════════════════════════════════════════════════════

function LeftPanel() {
  return (
    <div style={{
      width: "54%", minWidth: 380, position: "relative", overflow: "hidden",
      background: `linear-gradient(135deg, ${YD_YELLOW} 0%, #EAB308 60%, ${YD_YELLOW_DK} 100%)`,
      display: "flex", flexDirection: "column", justifyContent: "center",
      padding: "60px 56px",
      animation: "fadeSlideUp 0.75s ease both",
    }}>

      {/* Grain overlay */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.028,
        mixBlendMode: "overlay", pointerEvents: "none",
        backgroundImage: GRAIN_URI, backgroundSize: "300px 300px",
      }} />

      {/* Ambient blobs */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", overflow:"hidden" }}>
        <div style={blob(340,-80,-80,"rgba(255,255,255,0.13)",22)} />
        <div style={blob(280,"auto","auto",-60,"rgba(0,0,0,0.06)",30)} />
        <div style={blob(200,60,"auto","auto","rgba(255,255,255,0.09)",18,"bottom")} />
        <div style={ring(360,-120,-100)} />
        <div style={ring(220,"auto","auto",-60,"bottom")} />
      </div>

      {/* Content */}
      <div style={{ position:"relative", zIndex:1 }}>

        {/* Brand */}
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:48 }}>
          <img
            src="/icons/pwa-192x192.png"
            alt="Yellow Dot"
            style={{ width:44, height:44, borderRadius:13, display:"block" }}
          />
          <div>
            <div style={{ fontWeight:800, fontSize:16, color:YD_CHARCOAL, lineHeight:1 }}>Yellow Dot</div>
            <div style={{ fontSize:11, color:"rgba(0,0,0,0.5)", marginTop:2, fontWeight:500 }}>Preschool CRM</div>
          </div>
        </div>

        {/* Headline */}
        <h2 style={{
          fontSize:72, fontWeight:800, lineHeight:0.95, letterSpacing:-3,
          color:YD_CHARCOAL, margin:0,
        }}>
          One<br />school,<br />one app.
        </h2>

        <p style={{
          marginTop:24, color:"rgba(0,0,0,0.55)", fontSize:16,
          fontWeight:500, lineHeight:1.6, maxWidth:320,
        }}>
          Manage attendance, billing, CCTV, and parent check-ins — all in one secure platform.
        </p>

        {/* Feature pills */}
        <div style={{ marginTop:36, display:"flex", flexWrap:"wrap", gap:8 }}>
          {FEATURES.map(f => (
            <span key={f.label} style={{
              display:"inline-flex", alignItems:"center", gap:6,
              height:28, padding:"0 12px", borderRadius:100,
              background:"rgba(255,255,255,0.18)",
              border:"1px solid rgba(255,255,255,0.3)",
              fontSize:12, fontWeight:600, color:YD_CHARCOAL,
            }}>
              <span style={{
                width:6, height:6, borderRadius:"50%",
                background:"rgba(0,0,0,0.35)",
              }} />
              {f.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function blob(size, top, right, left, bg, duration, bottomKey) {
  const style = {
    position:"absolute", width:size, height:size, borderRadius:"50%", background:bg,
    filter:"blur(60px)", animation:`blobPulse ${duration}s ease-in-out infinite`,
  };
  if (top    !== "auto" && top    !== undefined) style.top    = top;
  if (right  !== "auto" && right  !== undefined) style.right  = right;
  if (left   !== "auto" && left   !== undefined) style.left   = left;
  if (bottomKey === "bottom") style.bottom = size * 0.1;
  return style;
}

function ring(size, top, left, right, bottomKey) {
  const style = {
    position:"absolute", width:size, height:size, borderRadius:"50%",
    border:"1px solid rgba(255,255,255,0.15)",
  };
  if (top   !== "auto" && top   !== undefined) style.top   = top;
  if (left  !== "auto" && left  !== undefined) style.left  = left;
  if (right !== "auto" && right !== undefined) style.right = right;
  if (bottomKey === "bottom") style.bottom = -size * 0.3;
  return style;
}

// ═════════════════════════════════════════════════════════════════════════════
// AUTH TABS
// ═════════════════════════════════════════════════════════════════════════════

function AuthTabs({ tab, setTab }) {
  const tabs = [
    { key: "google", label: "Google"  },
    { key: "otp",    label: "Mobile"  },
    { key: "email",  label: "Email"   },
  ];
  return (
    <div style={{
      display: "flex", background: "#F5F5F0", borderRadius: 12,
      padding: 4, gap: 2,
    }}>
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => setTab(t.key)}
          style={{
            flex: 1, height: 36, borderRadius: 9, border: "none",
            fontFamily: "inherit", fontWeight: 600, fontSize: 13,
            cursor: "pointer", transition: "all 0.18s ease",
            background:   tab === t.key ? "#fff" : "transparent",
            color:        tab === t.key ? YD_CHARCOAL : YD_SOFT,
            boxShadow:    tab === t.key ? "0 1px 6px rgba(0,0,0,0.08)" : "none",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB: GOOGLE
// ═════════════════════════════════════════════════════════════════════════════

function GoogleTab({ loading, setLoading, setError, loginWithGoogle, handleResult, onLinkRequired }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  async function handleGoogle() {
    setLoading(true);
    setError("");
    try {
      const result = await loginWithGoogle();
      handleResult(result);
    } catch (err) {
      setLoading(false);
      // Account-link flow: email already has a password account
      if (err.code === "auth/link-required") {
        onLinkRequired?.(err.email || "");
        return;
      }
      const msg = err?.code === "auth/popup-closed-by-user"
        ? "Sign-in popup was closed. Please try again."
        : err?.response?.data?.error || err.message || "Sign-in failed. Please try again.";
      setError(msg);
    }
  }

  const btnTransform = loading
    ? "none"
    : pressed
    ? "scale(0.977)"
    : hovered
    ? "translateY(-2px)"
    : "none";

  const btnShadow = loading
    ? "0 1px 4px rgba(0,0,0,0.04)"
    : pressed
    ? "0 1px 4px rgba(0,0,0,0.06)"
    : hovered
    ? "0 6px 20px rgba(0,0,0,0.09), 0 2px 6px rgba(0,0,0,0.05)"
    : "0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)";

  return (
    <div style={{ animation: "slideIn 0.25s ease both" }}>
      <p style={{ fontSize: 13, color: YD_SOFT, marginBottom: 20, fontWeight: 500, lineHeight: 1.55 }}>
        Parents sign in with the Google account linked to your child's school profile.
        Staff sign in with your school Google account.
      </p>

      <button
        onClick={() => !loading && handleGoogle()}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setPressed(false); }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onTouchStart={() => setPressed(true)}
        onTouchEnd={() => { setPressed(false); !loading && handleGoogle(); }}
        disabled={loading}
        style={{
          width: "100%", height: 54, borderRadius: 14,
          border: "1px solid rgba(0,0,0,0.09)",
          background: pressed ? "#F8F8F6" : loading ? "#FAFAF8" : "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 12, cursor: loading ? "not-allowed" : "pointer",
          transition: "transform 0.15s cubic-bezier(0.22,1,0.36,1), box-shadow 0.18s ease, background 0.12s ease",
          fontFamily: "inherit",
          boxShadow: btnShadow,
          transform: btnTransform,
        }}
      >
        {loading ? (
          <LoadingSpinner size={20} color={YD_YELLOW} />
        ) : (
          <>
            <GoogleIcon />
            <span style={{ fontWeight: 700, fontSize: 15, color: YD_TEXT }}>
              Continue with Google
            </span>
            <span style={{
              fontSize: 17, color: "#C8C0B0",
              transform: hovered && !pressed ? "translateX(3px)" : "none",
              transition: "transform 0.18s ease",
            }}>→</span>
          </>
        )}
      </button>

      <div style={{
        marginTop: 14, fontSize: 12, color: "#C8C0B0",
        textAlign: "center", fontWeight: 500,
      }}>
        Secured by Google OAuth 2.0
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB: MOBILE OTP
// ═════════════════════════════════════════════════════════════════════════════

function OTPTab({ loading, setLoading, setError, requestOTP, loginWithOTP, handleResult }) {
  const [step,      setStep]      = useState("phone");  // "phone" | "otp"
  const [mobile,    setMobile]    = useState("");
  const [code,      setCode]      = useState("");
  const [countdown, setCountdown] = useState(0);
  const [devCode,   setDevCode]   = useState("");
  const inputRefs   = useRef([]);
  const timerRef    = useRef(null);

  // OTP input boxes (6 digits)
  function handleOtpChange(i, val) {
    if (!/^\d*$/.test(val)) return;
    const digits = code.split("").concat(Array(6).fill(""));
    digits[i]    = val.slice(-1);
    const next   = digits.slice(0, 6).join("");
    setCode(next);
    if (val && i < 5) inputRefs.current[i + 1]?.focus();
  }

  function handleOtpKey(i, e) {
    if (e.key === "Backspace" && !code[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  }

  async function handleSendOTP() {
    if (!mobile.trim()) { setError("Please enter your mobile number."); return; }
    setLoading(true);
    setError("");
    try {
      const result = await requestOTP(mobile.trim());
      setStep("otp");
      setCountdown(result.expiresInSeconds || 300);
      if (result._devCode) setDevCode(result._devCode);
      startCountdown(result.expiresInSeconds || 300);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  }

  function startCountdown(seconds) {
    setCountdown(seconds);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  useEffect(() => () => clearInterval(timerRef.current), []);

  async function handleVerifyOTP() {
    if (code.length < 6) { setError("Please enter the 6-digit OTP."); return; }
    setLoading(true);
    setError("");
    try {
      const result = await loginWithOTP(mobile.trim(), code);
      handleResult(result);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Incorrect OTP.");
      setLoading(false);
    }
  }

  return (
    <div style={{ animation: "slideIn 0.25s ease both" }}>
      {step === "phone" ? (
        <>
          <label style={labelStyle}>Mobile Number</label>
          <div style={{ display:"flex", gap:8, marginTop:6 }}>
            <input
              type="tel"
              value={mobile}
              onChange={e => setMobile(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSendOTP()}
              placeholder="+91 98765 43210"
              style={inputStyle}
            />
          </div>
          <p style={{ fontSize:12, color:"#C0B8A8", marginTop:8, fontWeight:500 }}>
            A 6-digit code will be sent via SMS to your registered number.
          </p>
          <AuthButton onClick={handleSendOTP} loading={loading} label="Send OTP" />
        </>
      ) : (
        <>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
            <button
              onClick={() => { setStep("phone"); setCode(""); setError(""); }}
              style={{ background:"none", border:"none", cursor:"pointer", color:YD_SOFT, fontSize:20, padding:0 }}
            >←</button>
            <p style={{ fontSize:13, color:YD_SOFT, margin:0, fontWeight:500 }}>
              Code sent to <strong style={{ color:YD_TEXT }}>{mobile}</strong>
            </p>
          </div>

          {devCode && (
            <div style={{
              background:"#F0FAF0", border:"1px solid #B8EAB8", borderRadius:10,
              padding:"8px 12px", marginBottom:14, fontSize:12, color:"#2A7A2A", fontWeight:600,
            }}>
              DEV MODE — OTP: {devCode}
            </div>
          )}

          {/* OTP boxes */}
          <div style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:16 }}>
            {Array(6).fill(0).map((_, i) => (
              <input
                key={i}
                ref={el => (inputRefs.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={code[i] || ""}
                onChange={e => handleOtpChange(i, e.target.value)}
                onKeyDown={e => handleOtpKey(i, e)}
                style={{
                  width:44, height:52, textAlign:"center", fontSize:22, fontWeight:700,
                  border:`2px solid ${code[i] ? YD_YELLOW : "#E8E3D9"}`,
                  borderRadius:10, outline:"none", fontFamily:"inherit",
                  color:YD_CHARCOAL, background:"#fff", transition:"border-color 0.15s",
                }}
              />
            ))}
          </div>

          {/* Countdown + resend */}
          <div style={{ textAlign:"center", marginBottom:16 }}>
            {countdown > 0 ? (
              <span style={{ fontSize:12, color:YD_SOFT, fontWeight:500 }}>
                Resend in {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2,"0")}
              </span>
            ) : (
              <button
                onClick={handleSendOTP}
                style={{ fontSize:13, color:YD_YELLOW_DK, fontWeight:700, background:"none", border:"none", cursor:"pointer", fontFamily:"inherit" }}
              >
                Resend OTP
              </button>
            )}
          </div>

          <AuthButton onClick={handleVerifyOTP} loading={loading} label="Verify & Sign In" />
        </>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB: EMAIL + PASSWORD
// ═════════════════════════════════════════════════════════════════════════════

function EmailTab({ loading, setLoading, setError, loginWithEmail, handleResult, prefillEmail = "" }) {
  const [email,    setEmail]    = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    if (!email || !password) { setError("Please enter your email and password."); return; }
    setLoading(true);
    setError("");
    try {
      const result = await loginWithEmail(email.trim(), password);
      handleResult(result);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Invalid email or password.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ animation: "slideIn 0.25s ease both" }}>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Email Address</label>
        <input
          type="email" value={email} autoComplete="email"
          onChange={e => setEmail(e.target.value)}
          placeholder="you@school.edu"
          style={{ ...inputStyle, marginTop: 6 }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <label style={labelStyle}>Password</label>
          <a href="/forgot-password" style={{ fontSize:12, color:YD_YELLOW_DK, fontWeight:600, textDecoration:"none" }}>
            Forgot password?
          </a>
        </div>
        <div style={{ position:"relative", marginTop:6 }}>
          <input
            type={showPwd ? "text" : "password"}
            value={password} autoComplete="current-password"
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{ ...inputStyle, paddingRight: 44 }}
          />
          <button
            type="button"
            onClick={() => setShowPwd(!showPwd)}
            style={{
              position:"absolute", right:12, top:"50%", transform:"translateY(-50%)",
              background:"none", border:"none", cursor:"pointer",
              color:YD_SOFT, fontSize:16, padding:2,
            }}
          >
            {showPwd ? "🙈" : "👁"}
          </button>
        </div>
      </div>

      <AuthButton label="Sign In" loading={loading} />

      <p style={{ marginTop:14, fontSize:12, color:"#C0B8A8", textAlign:"center", fontWeight:500 }}>
        Staff accounts only. Parents use Google login.
      </p>
    </form>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SHARED UI PRIMITIVES
// ═════════════════════════════════════════════════════════════════════════════

function AuthButton({ label, loading, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      disabled={loading}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width:"100%", height:52, borderRadius:14, border:"none",
        background: loading ? "#E8C800" : hov ? "#E8C000" : YD_YELLOW,
        color: YD_CHARCOAL, fontFamily:"inherit",
        fontWeight:800, fontSize:15, cursor: loading ? "not-allowed" : "pointer",
        display:"flex", alignItems:"center", justifyContent:"center", gap:8,
        transition:"all 0.18s ease",
        boxShadow: hov && !loading ? `0 6px 20px ${YD_YELLOW}66` : `0 2px 8px ${YD_YELLOW}44`,
        transform: hov && !loading ? "translateY(-2px)" : "none",
      }}
    >
      {loading ? <LoadingSpinner size={20} color={YD_CHARCOAL} /> : label}
    </button>
  );
}

function LoadingSpinner({ size = 20, color = "#fff" }) {
  return (
    <div style={{
      width: size, height: size, border: `2.5px solid transparent`,
      borderTopColor: color, borderRadius: "50%",
      animation: "spin 0.7s linear infinite",
    }}>
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

const labelStyle = {
  fontSize: 13, fontWeight: 600, color: YD_TEXT, display: "block",
};

const inputStyle = {
  width: "100%", height: 46, borderRadius: 12,
  border: "1.5px solid #E8E3D9", padding: "0 14px",
  fontSize: 14, fontFamily: "inherit", color: YD_TEXT,
  outline: "none", background: "#fff", boxSizing: "border-box",
  transition: "border-color 0.15s ease",
};
