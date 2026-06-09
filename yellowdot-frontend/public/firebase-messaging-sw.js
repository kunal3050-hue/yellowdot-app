/**
 * firebase-messaging-sw.js — FCM Service Worker
 * ─────────────────────────────────────────────────
 * Handles background push notifications for the Yellow Dot Parent App.
 * This file must live at the root of the public directory so the browser
 * registers it at /firebase-messaging-sw.js (the path FCM expects).
 *
 * Uses the Firebase compat SDK via importScripts — compatible with all
 * browsers that support Service Workers + Web Push.
 *
 * Note: version must match or be close to the firebase npm package version.
 */

importScripts("https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:            "AIzaSyBwRMjTuDbOHMFdBtVV55kYoOcL-1L7tKM",
  authDomain:        "yellowdot-app.firebaseapp.com",
  projectId:         "yellowdot-app",
  storageBucket:     "yellowdot-app.firebasestorage.app",
  messagingSenderId: "230256365087",
  appId:             "1:230256365087:web:125297908a30fb5e28cf2a",
});

const messaging = firebase.messaging();

// ── Background message handler ────────────────────────────────────
// Called when a push arrives while the app is in the background / closed.
// Foreground messages are handled by onMessage() in the app itself.
messaging.onBackgroundMessage(function (payload) {
  console.log("[firebase-messaging-sw] Background message:", payload);

  const title   = payload.notification?.title || "Yellow Dot";
  const body    = payload.notification?.body  || "";
  const deepLink = payload.data?.deepLink     || "/parent-notifications";

  return self.registration.showNotification(title, {
    body,
    icon:  "/icons/pwa-192x192.png",
    badge: "/icons/pwa-192x192.png",
    tag:   payload.data?.type || "yd-notification",
    data:  { deepLink, ...payload.data },
    vibrate: [200, 100, 200],
  });
});

// ── Notification click handler ────────────────────────────────────
// Deep-links the user to the relevant screen when they tap the notification.
self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const deepLink = event.notification.data?.deepLink || "/parent-notifications";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        // If the app is already open, navigate the existing tab
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.focus();
            return client.navigate(deepLink);
          }
        }
        // Otherwise open a new tab at the deep-link path
        if (clients.openWindow) {
          return clients.openWindow(deepLink);
        }
      })
  );
});
