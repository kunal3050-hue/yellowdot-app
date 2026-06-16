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
import { getToken, onMessage } from "firebase/messaging";
import { getMessagingInstance } from "../../../firebase/firebase";
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
          return;
        }
        console.info("[usePushNotifications] VAPID key present:", VAPID_KEY.slice(0, 8) + "...");

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
          console.info("[usePushNotifications] Active SW:", swRegistration.active?.scriptURL);
        } catch (swErr) {
          console.warn("[usePushNotifications] SW not ready:", swErr.message);
          return;
        }

        console.info("[usePushNotifications] Calling getToken()...");
        const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swRegistration });
        if (!token) {
          console.warn("[usePushNotifications] getToken() returned empty — reload and try again.");
          return;
        }
        console.info("[usePushNotifications] FCM token obtained:", token.slice(0, 12) + "...");

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
        console.warn("[usePushNotifications] Setup error:", e.message, e);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
