/**
 * InstallContext.jsx — single source of truth for PWA install state
 * ───────────────────────────────────────────────────────────────────
 * Captures the browser's `beforeinstallprompt` event exactly once (it can
 * only be captured/used a single time per page load) and exposes it to
 * every consumer that needs to offer an "Install App" action — the
 * auto-popup banner, the Login page, the Sidebar footer, and Settings →
 * About all read from this one place instead of each registering their
 * own listener.
 *
 * Also tracks:
 *   - isInstalled   — running in standalone/PWA display mode already
 *   - isIOS         — iOS Safari (never fires beforeinstallprompt)
 *   - canPromptNatively — a captured, still-usable native install prompt
 *   - iosGuideOpen  — shared open/close state for the iOS instructions modal,
 *                      so any entry point (banner, button, menu item) can
 *                      open the exact same guide.
 */

import { createContext, useContext, useState, useEffect, useCallback } from "react";

const InstallContext = createContext(null);

function isInStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  // DEV-only manual override for QA — mirrors AuthContext's `yd_test_bypass_role`
  // pattern. import.meta.env.DEV is compiled to `false` in production builds,
  // so this branch is tree-shaken out entirely; no production behavior change.
  if (import.meta.env.DEV && typeof window !== "undefined" && window.localStorage.getItem("yd_test_force_ios") === "1") {
    return true;
  }
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

export function InstallProvider({ children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled,    setIsInstalled]    = useState(() => isInStandaloneMode());
  const [isIos]                             = useState(() => isIOS());
  const [iosGuideOpen,   setIosGuideOpen]   = useState(false);

  // Capture beforeinstallprompt once, app-wide.
  useEffect(() => {
    if (isInstalled) return;
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [isInstalled]);

  // Browser/OS-level install (menu, this prompt, or another tab) — flip
  // isInstalled everywhere immediately, no reload needed.
  useEffect(() => {
    const handler = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setIosGuideOpen(false);
    };
    window.addEventListener("appinstalled", handler);
    return () => window.removeEventListener("appinstalled", handler);
  }, []);

  // Some browsers toggle display-mode without firing appinstalled
  // (e.g. launching the already-installed app in its own window).
  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    const handler = (e) => { if (e.matches) setIsInstalled(true); };
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  const canPromptNatively = !isInstalled && !!deferredPrompt;
  const canInstall        = !isInstalled && (canPromptNatively || isIos);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return { outcome: "unavailable" };
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
    return choice;
  }, [deferredPrompt]);

  const openIosGuide  = useCallback(() => setIosGuideOpen(true),  []);
  const closeIosGuide = useCallback(() => setIosGuideOpen(false), []);

  const value = {
    isInstalled,
    isIos,
    canInstall,
    canPromptNatively,
    promptInstall,
    iosGuideOpen,
    openIosGuide,
    closeIosGuide,
  };

  return <InstallContext.Provider value={value}>{children}</InstallContext.Provider>;
}

export function useInstall() {
  const ctx = useContext(InstallContext);
  if (!ctx) throw new Error("useInstall must be used inside InstallProvider");
  return ctx;
}
