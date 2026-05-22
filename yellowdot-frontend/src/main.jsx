import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { registerSW } from "virtual:pwa-register";

// Import CSS in the correct cascade order via JS (avoids PostCSS @import ordering warnings)
import "./styles/tokens.css";
import "./styles/animations.css";
import "./styles/global.css";
import "./styles/components.css";
import "./styles/layout.css";
import "./styles/settings.css";
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
    // Poll for updates every 60 min when the app is open
    if (r) setInterval(() => r.update(), 60 * 60 * 1000);
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
