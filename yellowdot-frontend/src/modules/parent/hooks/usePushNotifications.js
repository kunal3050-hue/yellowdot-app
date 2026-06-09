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

    (async () => {
      try {
        // 1. Feature detection
        if (typeof window === "undefined" || !("Notification" in window)) return;
        if (!("serviceWorker" in navigator))                              return;

        // 2. Check VAPID key is configured
        if (!VAPID_KEY || VAPID_KEY === "YOUR_VAPID_KEY_FROM_FIREBASE_CONSOLE") {
          console.info(
            "[usePushNotifications] FCM VAPID key not configured.\n" +
            "  → Go to Firebase Console → Project Settings → Cloud Messaging\n" +
            "  → Web Push certificates → Generate key pair\n" +
            "  → Set VITE_FCM_VAPID_KEY in .env"
          );
          return;
        }

        // 3. Request notification permission
        //    Calling requestPermission() when already granted/denied is a no-op.
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          console.info("[usePushNotifications] Notification permission:", permission);
          return;
        }

        // 4. Get Firebase Messaging instance (null on unsupported browsers)
        const messaging = await getMessagingInstance();
        if (!messaging) return;

        // 5. Obtain FCM token (also registers the service worker)
        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (!token) {
          console.warn("[usePushNotifications] No FCM token returned.");
          return;
        }

        // 6. Register token with backend
        await registerFcmToken(token);
        console.info("[usePushNotifications] FCM token registered.");

        // 7. Handle foreground messages (app is open)
        onMessage(messaging, (payload) => {
          console.info("[usePushNotifications] Foreground message:", payload);
          if (onForegroundMessage) onForegroundMessage(payload);
        });

      } catch (e) {
        // Never let push setup crash the app
        console.warn("[usePushNotifications] Setup failed:", e.message);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
