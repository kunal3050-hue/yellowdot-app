/**
 * PlatformLogin.jsx — the way in to the operator console
 * ──────────────────────────────────────────────────────────────────────
 * Same Firebase account and the same session as the school app — this is
 * a separate door, not a separate identity. Someone already signed in with
 * a platform role is sent straight through; the screen exists so the
 * console has its own entry point rather than being a hidden corner of the
 * school app's navigation.
 *
 * It looks deliberately unlike the school login. Suspending a school and
 * marking a nap are not the same job, and the two should never be confused
 * at a glance.
 *
 * Someone who signs in here WITHOUT a platform role is told so plainly and
 * offered the school app, rather than being bounced to a login screen that
 * appears to have silently failed.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { canUsePlatformConsole } from "../../config/permissions";

const HOME = "/platform/tenants";

const CSS = `
  .yd-plogin-root {
    min-height: 100vh;
    background: var(--yd-charcoal);
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
    font-family: var(--yd-font);
  }
  .yd-plogin-card { width: 100%; max-width: 380px; text-align: center; }
  .yd-plogin-mark {
    width: 56px; height: 56px; border-radius: 16px;
    background: var(--yd-yellow);
    display: flex; align-items: center; justify-content: center;
    font-size: 26px; margin: 0 auto 18px;
  }
  .yd-plogin-title {
    font-size: 21px; font-weight: 800; color: #FFFFFF;
    letter-spacing: -0.03em; margin: 0 0 4px;
  }
  .yd-plogin-sub {
    font-size: 12px; font-weight: 600; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--yd-yellow); margin: 0 0 8px;
  }
  .yd-plogin-hint {
    font-size: 13px; line-height: 1.6;
    color: rgba(255,255,255,0.58); margin: 0 0 26px;
  }
  .yd-plogin-btn {
    width: 100%; padding: 12px 16px;
    border-radius: var(--yd-radius-button);
    font-size: 14px; font-weight: 700;
    background: var(--yd-yellow); color: var(--yd-black);
    border: 1px solid var(--yd-yellow);
    cursor: pointer; font-family: inherit;
  }
  .yd-plogin-btn:hover:not(:disabled) { background: var(--yd-yellow-dark); }
  .yd-plogin-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .yd-plogin-link {
    display: inline-block; margin-top: 16px;
    font-size: 12px; font-weight: 600;
    color: rgba(255,255,255,0.5); text-decoration: none;
  }
  .yd-plogin-link:hover { color: #FFFFFF; }
  .yd-plogin-note {
    margin-top: 18px; padding: 12px 14px;
    border-radius: 12px; text-align: left;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.12);
    font-size: 12.5px; line-height: 1.6;
    color: rgba(255,255,255,0.78);
  }
  .yd-plogin-note strong { color: #FFFFFF; }
`;

export default function PlatformLogin() {
  const { loginWithGoogle, isAuthenticated, role, user, logout } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const signedInWithoutAccess = isAuthenticated && !canUsePlatformConsole(role);

  useEffect(() => {
    if (isAuthenticated && canUsePlatformConsole(role)) navigate(HOME, { replace: true });
  }, [isAuthenticated, role, navigate]);

  async function handleGoogle() {
    setBusy(true);
    setError("");
    try {
      await loginWithGoogle();
      // Navigation is handled by the effect above once the profile resolves,
      // so that a redirect-based sign-in lands in the same place as a popup.
    } catch (e) {
      setError(e?.message || "Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="yd-plogin-root">
        <div className="yd-plogin-card">
          <div className="yd-plogin-mark">⚙️</div>
          <div className="yd-plogin-sub">Platform</div>
          <h1 className="yd-plogin-title">Operator Console</h1>

          {signedInWithoutAccess ? (
            <>
              <p className="yd-plogin-hint">
                You are signed in, but this console is for platform operators.
              </p>
              <div className="yd-plogin-note">
                <strong>{user?.email}</strong> has the role <strong>{role}</strong>, which
                does not include platform administration.
              </div>
              <a className="yd-plogin-link" href="/">Go to the school app →</a>
              <br />
              <button
                className="yd-plogin-link"
                style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                onClick={() => logout()}
              >
                Sign in as someone else
              </button>
            </>
          ) : (
            <>
              <p className="yd-plogin-hint">
                Manage preschools, plans and platform settings.
              </p>
              <button className="yd-plogin-btn" onClick={handleGoogle} disabled={busy}>
                {busy ? "Signing in…" : "Continue with Google"}
              </button>
              {error && <div className="yd-plogin-note">{error}</div>}
              <a className="yd-plogin-link" href="/">← School app</a>
            </>
          )}
        </div>
      </div>
    </>
  );
}
