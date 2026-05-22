/**
 * InstallPrompt.jsx
 *
 * Shows a branded "Add to Home Screen" banner when the browser fires
 * the `beforeinstallprompt` event (Chrome / Android / Edge).
 *
 * On iOS Safari the event is not available, so we show a manual
 * "Share → Add to Home Screen" nudge instead.
 *
 * Dismissal is persisted in localStorage — the banner won't re-appear
 * until the user clears site data or 30 days have passed.
 */

import { useState, useEffect } from "react";

const STORAGE_KEY  = "yd_pwa_dismissed_at";
const DISMISS_DAYS = 30; // re-show after 30 days

function isDismissed() {
  try {
    const ts = localStorage.getItem(STORAGE_KEY);
    if (!ts) return false;
    const days = (Date.now() - Number(ts)) / (1000 * 60 * 60 * 24);
    return days < DISMISS_DAYS;
  } catch {
    return false;
  }
}

function setDismissed() {
  try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch {}
}

function isInStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible]               = useState(false);
  const [isIos, setIsIos]                   = useState(false);
  const [installing, setInstalling]         = useState(false);

  useEffect(() => {
    // Already installed as PWA — nothing to do
    if (isInStandaloneMode()) return;
    // Already dismissed recently
    if (isDismissed()) return;

    const ios = isIOS();
    setIsIos(ios);

    if (ios) {
      // iOS: show manual instructions after 3s
      const t = setTimeout(() => setVisible(true), 3000);
      return () => clearTimeout(t);
    }

    // Android / Chrome: wait for the browser event
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Small delay so it doesn't pop up on first page load
      setTimeout(() => setVisible(true), 2500);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Also hide if user installs via browser menu
  useEffect(() => {
    const handler = () => { setVisible(false); setDeferredPrompt(null); };
    window.addEventListener("appinstalled", handler);
    return () => window.removeEventListener("appinstalled", handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setVisible(false);
        setDeferredPrompt(null);
      }
    } finally {
      setInstalling(false);
    }
  }

  function handleDismiss() {
    setDismissed();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Yellow Dot app"
      className="yd-install-prompt"
    >
      {/* App icon + copy */}
      <div className="yd-ip-left">
        <div className="yd-ip-icon" aria-hidden="true">
          {/* Inline bolt mark */}
          <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="512" height="512" fill="#F4C400"/>
            <path d="M296,72 L184,272 H248 L212,440 L328,240 H264 Z" fill="#1E1B4B"/>
          </svg>
        </div>
        <div className="yd-ip-text">
          <p className="yd-ip-title">Yellow Dot</p>
          {isIos ? (
            <p className="yd-ip-sub">
              Tap&nbsp;
              <svg className="yd-ip-share-icon" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <polyline points="16 6 12 2 8 6"/>
                <line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
              &nbsp;then <strong>Add to Home Screen</strong>
            </p>
          ) : (
            <p className="yd-ip-sub">Install for faster access</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="yd-ip-actions">
        {!isIos && (
          <button
            onClick={handleInstall}
            disabled={installing}
            className="yd-ip-btn-install"
            aria-label="Install app"
          >
            {installing ? "…" : "Install"}
          </button>
        )}
        <button
          onClick={handleDismiss}
          className="yd-ip-btn-dismiss"
          aria-label="Dismiss install prompt"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
