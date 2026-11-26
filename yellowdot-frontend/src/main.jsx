import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { registerSW } from "virtual:pwa-register";

// Import CSS in the correct cascade order via JS (avoids PostCSS @import ordering warnings)
import "./styles/tokens.css";
import "./styles/animations.css";
import "./styles/global.css";
import "./styles/components.css";
import "./styles/dataTable.css";
import "./styles/timeline.css";
import "./styles/activityFeed.css";
import "./styles/charts.css";
import "./styles/wizard.css";
import "./styles/filterBar.css";
import "./styles/quickActionCard.css";
import "./styles/viewSwitcher.css";
import "./styles/liveDashboard.css";
import "./styles/quickNav.css";
import "./styles/quickNavigation.css";
import "./styles/students.css";
import "./styles/layout.css";
import "./styles/settings.css";
import "./styles/certificates.css";
import "./styles/billing.css";
import "./styles/mobile.css";  // responsive overrides — must be last

// ── Service Worker registration ───────────────────────────────────────────────
// vite-plugin-pwa (registerType:'autoUpdate') handles SW updates automatically.
// We hook into onNeedRefresh to show a subtle "App updated" notice.
registerSW({
  onNeedRefresh() {
    // SW has a new version waiting — it will auto-activate on next navigation
    // (skipWaiting:true is set in workbox config). No disruptive prompt needed.
    console.info("[YD PWA] New version available — will activate on next visit.");
  },
  onOfflineReady() {
    console.info("[YD PWA] App is ready to work offline.");
  },
  onRegisteredSW(swUrl, r) {
    if (!r) return;

    // A service worker update check happens on a full page load, or when
    // something calls registration.update(). Client-side navigation inside the
    // SPA does neither, so a staff member who leaves the tab open was waiting
    // up to an hour to see a deploy — long enough that a shipped fix looks
    // like it did not work.
    //
    // The worker itself is fine: it calls skipWaiting() and clientsClaim(), so
    // once a new version IS found it takes over immediately, and
    // registerType:"autoUpdate" reloads the page. The gap was only in how
    // often we went looking.
    //
    // Checking when the tab regains focus is the useful trigger: it is the
    // moment someone comes back to the app, and — since autoUpdate reloads the
    // page when the new worker takes control — it is a far safer moment to
    // reload than mid-keystroke during attendance.
    const check = () => { r.update().catch(() => {}); };

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") check();
    });
    window.addEventListener("online", check);

    // Backstop for a tab left visible and untouched all day (a wall display,
    // the office desktop). Fifteen minutes rather than sixty: the request is a
    // conditional GET of one small file, and the old interval was the reason a
    // deploy could sit unseen for an hour.
    setInterval(check, 15 * 60 * 1000);
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
