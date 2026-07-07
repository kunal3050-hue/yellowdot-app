/**
 * usePushNotifications.js — FCM push notification registration hook
 * ──────────────────────────────────────────────────────────────────
 * Call once from ParentLayout when a parent session starts.
 *
 * What it does:
 *   1. Checks if the browser supports Web Push (Notification API + SW)
 *   2. Requests notification permission (prompts once; no-op on subsequent calls)
 *   3. Obtains an FCM device token using the VAPID key
 *   4. Registers the token with the backend (idempotent — backend stores it on
 *      the parent's Firestore doc so the server can send pushes to this device)
 *   5. Sets up a foreground message handler that triggers an optional callback
 *      (so the UI can show an in-app toast/banner while the app is open)
 *
 * Requirements:
 *   • VITE_FCM_VAPID_KEY must be set in .env (get it from Firebase Console →
 *     Project Settings → Cloud Messaging → Web Push certificates → Generate key pair)
 *   • public/firebase-messaging-sw.js must be present (already created)
 *
 * The hook is safe to call in environments where messaging isn't supported —
 * it exits early and never throws.
 */

import { useEffect, useRef } from "react";
import { getToken, deleteToken, onMessage } from "firebase/messaging";
import { getInstallations, deleteInstallations } from "firebase/installations";
import app, { getMessagingInstance } from "../../../firebase/firebase";
import { registerFcmToken } from "../services/notificationService";

const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY;

export default function usePushNotifications({ onForegroundMessage } = {}) {
  const initialized = useRef(false);

  useEffect(() => {
    // Run once per mount — re-registration on every render is wasteful
    if (initialized.current) return;
    initialized.current = true;

    console.info("[usePushNotifications] Hook mounted — starting FCM setup.");

    (async () => {
      try {
        // 1. Feature detection
        if (typeof window === "undefined" || !("Notification" in window)) {
          console.warn("[usePushNotifications] Notification API not available in this environment.");
          return;
        }
        if (!("serviceWorker" in navigator)) {
          console.warn("[usePushNotifications] Service Worker not supported in this browser.");
          return;
        }

        console.info("[usePushNotifications] Browser APIs OK. Current permission:", Notification.permission);

        // 2. Check VAPID key is configured
        if (!VAPID_KEY || VAPID_KEY === "YOUR_VAPID_KEY_FROM_FIREBASE_CONSOLE") {
          console.warn(
            "[usePushNotifications] FCM VAPID key not configured.\n" +
            "  → Set VITE_FCM_VAPID_KEY in .env and restart Vite."
          );
          console.error("[FCM] ERROR — VAPID key missing or unset");
          return;
        }
        console.log("[FCM] VAPID key loaded — length:", VAPID_KEY.length, "preview:", VAPID_KEY.slice(0, 8) + "…");

        // 3. Request notification permission
        //    Calling requestPermission() when already granted/denied is a no-op.
        console.info("[usePushNotifications] Requesting notification permission...");
        const permission = await Notification.requestPermission();
        console.info("[usePushNotifications] Permission result:", permission);
        if (permission !== "granted") return;

        // 4. Get Firebase Messaging instance (null on unsupported browsers)
        console.info("[usePushNotifications] Initializing Firebase Messaging...");
        const messaging = await getMessagingInstance();
        if (!messaging) {
          console.warn("[usePushNotifications] Firebase Messaging not supported (isSupported() returned false).");
          return;
        }

        // 5. Get the active service worker registration.
        //    VitePWA now uses firebase-messaging-sw.js as the single combined SW
        //    (Workbox precaching + FCM messaging). navigator.serviceWorker.ready
        //    returns that active registration, which we pass to getToken() so
        //    Firebase subscribes to push through the correct SW with no scope conflict.
        console.info("[usePushNotifications] Waiting for active service worker...");
        let swRegistration;
        try {
          swRegistration = await navigator.serviceWorker.ready;
          console.log("[FCM] Service Worker registration —", swRegistration.active?.scriptURL, "scope:", swRegistration.scope);
        } catch (swErr) {
          console.error("[FCM] ERROR — Service Worker not ready. code:", swErr?.code, "message:", swErr?.message);
          return;
        }

        console.info("[usePushNotifications] Calling getToken()...");
        let token;
        try {
          token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swRegistration });
        } catch (tokenErr) {
          // Stale Firebase Installation auth tokens cached in IndexedDB can cause
          // fcmregistrations.googleapis.com to return 401 UNAUTHENTICATED. The fix
          // is to delete the cached FID + FCM token so the SDK fetches fresh
          // credentials, then retry getToken() exactly once.
          const isStaleAuth =
            tokenErr?.code === "messaging/token-subscribe-failed" ||
            /401|UNAUTHENTICATED|missing required authentication/i.test(tokenErr?.message || "");
          if (isStaleAuth) {
            console.warn("[FCM] getToken() 401 — clearing stale Firebase Installation cache and retrying once.");
            try { await deleteToken(messaging); } catch (e) { console.warn("[FCM] deleteToken cleanup:", e?.message); }
            try { await deleteInstallations(getInstallations(app)); } catch (e) { console.warn("[FCM] deleteInstallations cleanup:", e?.message); }
            try {
              token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swRegistration });
              console.log("[FCM] Recovered after cache clear ✅");
            } catch (retryErr) {
              console.error("[FCM] ERROR — getToken() failed even after cache clear. Firebase error code:", retryErr?.code, "name:", retryErr?.name, "message:", retryErr?.message);
              return;
            }
          } else {
            console.error("[FCM] ERROR — getToken() failed. Firebase error code:", tokenErr?.code, "name:", tokenErr?.name, "message:", tokenErr?.message);
            return;
          }
        }
        if (!token) {
          console.error("[FCM] ERROR — getToken() returned empty. Reload, check Site Settings → Notifications, and verify Cloud Messaging API is enabled in Firebase Console.");
          return;
        }
        // Stash the full token on window so it can be copied from DevTools:
        //   copy(__yd_fcm_token)
        try { window.__yd_fcm_token = token; } catch (_) {}
        console.log("[FCM] FCM token —", token);
        console.log("[FCM] (full token also available as window.__yd_fcm_token — run copy(__yd_fcm_token) to copy)");

        // 6. Register token with backend
        await registerFcmToken(token);
        console.info("[usePushNotifications] FCM token registered. ✅");

        // 7. Handle foreground messages (app is open)
        onMessage(messaging, (payload) => {
          console.info("[usePushNotifications] Foreground message received:", payload);
          if (onForegroundMessage) onForegroundMessage(payload);
        });

      } catch (e) {
        // Never let push setup crash the app
        console.error("[FCM] ERROR — Uncaught. Firebase error code:", e?.code, "name:", e?.name, "message:", e?.message);
        console.warn("[usePushNotifications] Setup error:", e?.message, e);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
