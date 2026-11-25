/**
 * AccountBlocked.jsx
 * ──────────────────────────────────────────────────────────────────────
 * Shown when the signed-in user's school is suspended, cancelled, or past
 * the end of its trial.
 *
 * The backend gate (tenantMiddleware) 403s every data route for such a
 * school, so without this page the app signs in fine and then fails on
 * every request — indistinguishable from an outage. /api/auth/me is
 * deliberately exempt from the gate so it can return the reason instead,
 * which is what this page renders.
 *
 * Deliberately offers no retry. The block is an account state, not a
 * transient error, and a Retry button that always fails teaches people to
 * distrust the message. Sign-out is offered because someone may need to
 * reach a different school's account.
 */

import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { PLATFORM_NAME } from "../../config/environment";

const SPRING = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * Copy per block reason. `action` is what the reader can actually do —
 * vague sympathy is worse than a concrete next step.
 */
const REASONS = {
  TENANT_SUSPENDED: {
    icon: "⏸",
    title: "Account suspended",
    body: "Your school's access has been paused. Your data is safe and nothing has been deleted.",
    action: "Please get in touch to restore access.",
  },
  TENANT_CANCELLED: {
    icon: "🔒",
    title: "Account closed",
    body: "This school's subscription has ended, so the app is no longer available.",
    action: "Contact us if you believe this is a mistake, or to reopen the account.",
  },
  TRIAL_EXPIRED: {
    icon: "⏳",
    title: "Your trial has ended",
    body: "The free trial for your school has finished. Everything you added during the trial is still here.",
    action: "Choose a plan to pick up where you left off.",
  },
};

const FALLBACK = {
  icon: "🔒",
  title: "Access unavailable",
  body: "Your school's account is not active at the moment.",
  action: "Please get in touch to restore access.",
};

const CSS = `
  @keyframes yd-ab-rise {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  .yd-ab-root {
    min-height: 100vh;
    background: var(--yd-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    font-family: var(--yd-font);
  }
  .yd-ab-card {
    width: 100%;
    max-width: 460px;
    text-align: center;
    animation: yd-ab-rise 0.5s ${SPRING} both;
  }
  .yd-ab-icon {
    width: 72px; height: 72px;
    border-radius: 20px;
    background: var(--yd-yellow-light);
    border: 1px solid var(--yd-yellow);
    display: flex; align-items: center; justify-content: center;
    font-size: 32px;
    margin: 0 auto 20px;
  }
  .yd-ab-title {
    font-size: 22px; font-weight: 800;
    color: var(--yd-charcoal);
    letter-spacing: -0.03em;
    margin: 0 0 8px;
  }
  .yd-ab-school {
    font-size: 13px; font-weight: 600;
    color: var(--yd-text-soft);
    margin: 0 0 14px;
  }
  .yd-ab-body {
    font-size: 14px; line-height: 1.6;
    color: var(--yd-text-soft);
    margin: 0 0 6px;
  }
  .yd-ab-action {
    font-size: 14px; line-height: 1.6; font-weight: 600;
    color: var(--yd-charcoal);
    margin: 0 0 22px;
  }
  .yd-ab-contact {
    background: var(--yd-surface);
    border: 1px solid var(--yd-border);
    border-radius: 14px;
    padding: 14px 16px;
    margin-bottom: 20px;
    text-align: left;
  }
  .yd-ab-label {
    font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--yd-text-muted);
    margin-bottom: 4px;
  }
  .yd-ab-value {
    font-size: 14px; font-weight: 600;
    color: var(--yd-charcoal);
    word-break: break-all;
  }
  .yd-ab-divider {
    height: 1px; background: var(--yd-border-light);
    margin: 12px 0;
  }
  .yd-ab-btn {
    width: 100%;
    padding: 11px 16px;
    border-radius: var(--yd-radius-button);
    font-size: 13px; font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: border-color 120ms ease, background 120ms ease;
  }
  .yd-ab-btn-primary {
    background: var(--yd-yellow);
    color: var(--yd-black);
    border: 1px solid var(--yd-yellow);
  }
  .yd-ab-btn-primary:hover { background: var(--yd-yellow-dark); border-color: var(--yd-yellow-dark); }
  .yd-ab-btn-secondary {
    background: var(--yd-surface);
    color: var(--yd-charcoal);
    border: 1px solid var(--yd-border);
    margin-bottom: 10px;
  }
  .yd-ab-btn-secondary:hover { border-color: var(--yd-yellow); }
  .yd-ab-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .yd-ab-footer {
    margin-top: 22px;
    font-size: 11px;
    color: var(--yd-text-muted);
  }
`;

export default function AccountBlocked() {
  const { tenantBlocked, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const reason = REASONS[tenantBlocked?.code] || FALLBACK;
  const contact = tenantBlocked?.contact;

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await logout();
    } catch {
      window.location.href = "/login";
    }
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="yd-ab-root">
        <div className="yd-ab-card">

          <div className="yd-ab-icon">{reason.icon}</div>

          <h1 className="yd-ab-title">{reason.title}</h1>
          {tenantBlocked?.schoolName && (
            <p className="yd-ab-school">{tenantBlocked.schoolName}</p>
          )}

          <p className="yd-ab-body">{reason.body}</p>
          <p className="yd-ab-action">{reason.action}</p>

          {contact && (
            <div className="yd-ab-contact">
              <div className="yd-ab-label">Who to contact</div>
              <div className="yd-ab-value">{contact}</div>
              <div className="yd-ab-divider" />
              <div className="yd-ab-label">Quote this reference</div>
              <div className="yd-ab-value">{tenantBlocked.code}</div>
            </div>
          )}

          {contact && (
            <a
              className="yd-ab-btn yd-ab-btn-primary"
              style={{ display: "block", textDecoration: "none", marginBottom: 10 }}
              href={`mailto:${contact}?subject=${encodeURIComponent(`${reason.title} — ${tenantBlocked?.schoolName || "school account"}`)}`}
            >
              Contact support
            </a>
          )}

          <button
            className="yd-ab-btn yd-ab-btn-secondary"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>

          <div className="yd-ab-footer">{PLATFORM_NAME}</div>
        </div>
      </div>
    </>
  );
}
