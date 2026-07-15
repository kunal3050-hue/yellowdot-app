/**
 * InstallAppButton.jsx — reusable "Install App" action
 * ──────────────────────────────────────────────────────
 * Drop this into any surface that should offer a manual install entry point
 * (Login page, Sidebar footer, Settings → About). All three share the same
 * InstallContext, so dismissing the auto-popup banner never removes these —
 * they're independent, always-available manual triggers.
 *
 * Behavior (same everywhere):
 *   - Already installed          → renders nothing, unless `showInstalledStatus`
 *   - Non-iOS, prompt available  → click triggers the native install prompt
 *   - iOS Safari                 → click opens the branded Add-to-Home-Screen guide
 *   - Non-iOS, prompt NOT yet available (unsupported browser, or the OS
 *     hasn't offered it) → renders nothing (nothing actionable to do)
 *
 * @prop {"icon"|"link"|"card"} variant
 * @prop {boolean} showInstalledStatus  — if true, still renders (as an
 *       "Installed" status) instead of vanishing once installed. Used by
 *       Settings → About; Login/Sidebar leave this off so they simply
 *       disappear once there's nothing left to do.
 */

import { Download, CheckCircle2 } from "lucide-react";
import { useInstall } from "../contexts/InstallContext";
import { PLATFORM_NAME } from "../config/environment";

export default function InstallAppButton({ variant = "link", showInstalledStatus = false, className = "" }) {
  const { isInstalled, canInstall, isIos, promptInstall, openIosGuide } = useInstall();

  if (isInstalled && !showInstalledStatus) return null;
  if (!isInstalled && !canInstall) return null;

  function handleClick() {
    if (isIos) openIosGuide();
    else promptInstall();
  }

  if (isInstalled) {
    // showInstalledStatus path only — informational, not a prompt
    if (variant === "card") {
      return (
        <div className={`yd-iab-card yd-iab-card--installed ${className}`}>
          <div className="yd-iab-card-icon"><CheckCircleIcon /></div>
          <div className="yd-iab-card-copy">
            <div className="yd-iab-card-title">App installed</div>
            <div className="yd-iab-card-desc">{PLATFORM_NAME} is installed on this device.</div>
          </div>
        </div>
      );
    }
    return null;
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        className={`yd-iab-icon-btn ${className}`}
        onClick={handleClick}
        aria-label={`Install ${PLATFORM_NAME} app`}
        title="Install app"
      >
        <DownloadIcon />
      </button>
    );
  }

  if (variant === "card") {
    return (
      <div className={`yd-iab-card ${className}`}>
        <div className="yd-iab-card-icon"><DownloadIcon /></div>
        <div className="yd-iab-card-copy">
          <div className="yd-iab-card-title">Install {PLATFORM_NAME}</div>
          <div className="yd-iab-card-desc">
            {isIos
              ? "Add to your Home Screen for one-tap, full-screen access."
              : "Get a faster, full-screen experience with offline support."}
          </div>
        </div>
        <button type="button" className="yd-iab-card-btn" onClick={handleClick}>
          Install
        </button>
      </div>
    );
  }

  // "link" — subtle text-link style, for Login page
  return (
    <button type="button" className={`yd-iab-link ${className}`} onClick={handleClick}>
      <DownloadIcon />
      <span>Install app</span>
    </button>
  );
}

function DownloadIcon() {
  return <Download size={16} strokeWidth={2} />;
}

function CheckCircleIcon() {
  return <CheckCircle2 size={18} strokeWidth={2} />;
}
