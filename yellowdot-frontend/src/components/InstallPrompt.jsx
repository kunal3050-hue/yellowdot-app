/**
 * InstallPrompt.jsx — auto-popup "Install KUE BOXS Care" banner
 * ─────────────────────────────────────────────────────────────
 * Shows shortly after load when the app isn't installed and hasn't been
 * dismissed recently. Reads capability (native prompt availability, iOS,
 * already-installed) from InstallContext, which is shared with the manual
 * entry points (Login, Sidebar footer, Settings → About) — dismissing this
 * banner only suppresses the auto-popup, never those manual triggers.
 *
 * - Android / Chrome / Edge / Desktop Chrome: branded card with an
 *   "Install" button that triggers the real native prompt.
 * - iOS Safari: compact teaser card whose button opens the full branded
 *   Add-to-Home-Screen guide (IosInstallGuide.jsx).
 *
 * Dismissal persists in localStorage for 30 days.
 */

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { PLATFORM_NAME } from "../config/environment";
import { useInstall } from "../contexts/InstallContext";

const STORAGE_KEY  = "yd_pwa_dismissed_at";
const DISMISS_DAYS = 30;

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

export default function InstallPrompt() {
  const { isInstalled, isIos, canPromptNatively, canInstall, promptInstall, openIosGuide } = useInstall();
  const [visible,    setVisible]    = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isInstalled || isDismissed() || !canInstall) { setVisible(false); return; }
    // Small delay so it never pops up the instant the page loads.
    const t = setTimeout(() => setVisible(true), isIos ? 3000 : 2500);
    return () => clearTimeout(t);
  }, [isInstalled, isIos, canInstall, canPromptNatively]);

  if (!visible) return null;

  async function handleInstall() {
    if (isIos) { openIosGuide(); setVisible(false); return; }
    setInstalling(true);
    try {
      const choice = await promptInstall();
      if (choice.outcome === "accepted") setVisible(false);
    } finally {
      setInstalling(false);
    }
  }

  function handleDismiss() {
    setDismissed();
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label={`Install ${PLATFORM_NAME} app`}
      className="yd-install-prompt"
    >
      {/* App icon + copy */}
      <div className="yd-ip-left">
        <div className="yd-ip-icon" aria-hidden="true">
          <img src="/icons/pwa-192x192.png" alt="" />
        </div>
        <div className="yd-ip-text">
          <p className="yd-ip-title">Install {PLATFORM_NAME}</p>
          {isIos ? (
            <p className="yd-ip-sub">Add to your Home Screen</p>
          ) : (
            <p className="yd-ip-sub">Faster access, works offline</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="yd-ip-actions">
        <button
          onClick={handleInstall}
          disabled={installing}
          className="yd-ip-btn-install"
          aria-label={isIos ? "Show install instructions" : "Install app"}
        >
          {installing ? "…" : isIos ? "How to install" : "Install"}
        </button>
        <button
          onClick={handleDismiss}
          className="yd-ip-btn-dismiss"
          aria-label="Dismiss install prompt"
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
