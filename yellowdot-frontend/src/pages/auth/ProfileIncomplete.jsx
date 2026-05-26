/**
 * ProfileIncomplete.jsx
 * ──────────────────────────────────────────────────────────────────────
 * Shown when a user successfully authenticates with Firebase (Google or
 * email) but no matching Firestore staff profile or parent link exists.
 *
 * This replaces the generic "403 Access Denied" screen with a clear,
 * actionable message that tells the user:
 *   - What happened (account not registered)
 *   - Who to contact (their administrator)
 *   - Their authenticated identity (email / UID) for the admin to look up
 *   - A sign-out button so they can try a different account
 */

import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

const SPRING = "cubic-bezier(0.22, 1, 0.36, 1)";

const CSS = `
  @keyframes yd-pi-rise {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  .yd-pi-root {
    min-height: 100vh;
    background: #FFFFFF;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .yd-pi-card {
    width: 100%;
    max-width: 480px;
    text-align: center;
    animation: yd-pi-rise 0.5s ${SPRING} both;
  }
  .yd-pi-icon {
    width: 72px;
    height: 72px;
    border-radius: 20px;
    background: #FFF9E6;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 28px;
    font-size: 32px;
  }
  .yd-pi-title {
    font-size: 24px;
    font-weight: 700;
    color: #0D0D0D;
    letter-spacing: -0.5px;
    margin: 0 0 12px;
  }
  .yd-pi-subtitle {
    font-size: 15px;
    line-height: 1.6;
    color: #666;
    margin: 0 0 32px;
  }
  .yd-pi-info-box {
    background: #F8F8F8;
    border: 1px solid #E8E8E8;
    border-radius: 12px;
    padding: 16px 20px;
    margin: 0 0 32px;
    text-align: left;
  }
  .yd-pi-info-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #999;
    margin-bottom: 4px;
  }
  .yd-pi-info-value {
    font-size: 14px;
    color: #333;
    font-family: ui-monospace, "SF Mono", "Cascadia Code", monospace;
    word-break: break-all;
  }
  .yd-pi-divider {
    height: 1px;
    background: #E8E8E8;
    margin: 12px 0;
  }
  .yd-pi-steps {
    text-align: left;
    margin: 0 0 32px;
  }
  .yd-pi-steps-title {
    font-size: 13px;
    font-weight: 600;
    color: #333;
    margin-bottom: 10px;
  }
  .yd-pi-step {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    margin-bottom: 8px;
  }
  .yd-pi-step-num {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #F4C400;
    color: #0D0D0D;
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 1px;
  }
  .yd-pi-step-text {
    font-size: 13px;
    line-height: 1.5;
    color: #555;
  }
  .yd-pi-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 14px 20px;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: opacity 0.15s ease, transform 0.15s ease;
  }
  .yd-pi-btn:active { transform: scale(0.98); }
  .yd-pi-btn-primary {
    background: #0D0D0D;
    color: #FFFFFF;
    margin-bottom: 12px;
  }
  .yd-pi-btn-primary:hover { opacity: 0.85; }
  .yd-pi-btn-secondary {
    background: #F2F2F2;
    color: #333;
  }
  .yd-pi-btn-secondary:hover { background: #E8E8E8; }
  .yd-pi-footer {
    margin-top: 28px;
    font-size: 12px;
    color: #999;
  }
`;

export default function ProfileIncomplete() {
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await logout();
    } catch {
      window.location.href = "/login";
    }
  }

  function copyInfo() {
    const text = [
      `Email: ${user?.email || "unknown"}`,
      `UID:   ${user?.userId || "unknown"}`,
    ].join("\n");
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="yd-pi-root">
        <div className="yd-pi-card">

          {/* Icon */}
          <div className="yd-pi-icon">🔐</div>

          {/* Heading */}
          <h1 className="yd-pi-title">Profile setup incomplete</h1>
          <p className="yd-pi-subtitle">
            Your Google account was verified, but no staff profile was found
            in this system. Contact your school administrator to get access.
          </p>

          {/* Account info box */}
          <div className="yd-pi-info-box">
            <div className="yd-pi-info-label">Signed in as</div>
            <div className="yd-pi-info-value">{user?.email || "—"}</div>
            <div className="yd-pi-divider" />
            <div className="yd-pi-info-label">Firebase UID (share with admin)</div>
            <div className="yd-pi-info-value">{user?.userId || "—"}</div>
          </div>

          {/* Steps for admin */}
          <div className="yd-pi-steps">
            <div className="yd-pi-steps-title">What your administrator needs to do:</div>
            <div className="yd-pi-step">
              <div className="yd-pi-step-num">1</div>
              <div className="yd-pi-step-text">
                Go to <strong>User Management</strong> and create a staff account for your email address.
              </div>
            </div>
            <div className="yd-pi-step">
              <div className="yd-pi-step-num">2</div>
              <div className="yd-pi-step-text">
                Assign you a role (teacher, admin, etc.) and a center.
              </div>
            </div>
            <div className="yd-pi-step">
              <div className="yd-pi-step-num">3</div>
              <div className="yd-pi-step-text">
                Once created, sign out and sign back in with Google — your profile will load automatically.
              </div>
            </div>
          </div>

          {/* Actions */}
          <button className="yd-pi-btn yd-pi-btn-secondary" onClick={copyInfo}>
            📋 Copy account info for admin
          </button>
          <button
            className="yd-pi-btn yd-pi-btn-primary"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? "Signing out…" : "Sign out and try a different account"}
          </button>

          <div className="yd-pi-footer">
            Yellow Dot · yellowdot-app.web.app
          </div>
        </div>
      </div>
    </>
  );
}
