/**
 * firebase-messaging-sw.js — Combined Workbox + FCM Service Worker
 * ─────────────────────────────────────────────────────────────────
 * This single file handles BOTH:
 *   1. Workbox precaching (VitePWA injects self.__WB_MANIFEST at build time)
 *   2. Firebase Cloud Messaging background push notifications
 *
 * Why combined: Vite PWA's generated Workbox SW (/sw.js) and the Firebase
 * messaging SW (/firebase-messaging-sw.js) cannot both control scope "/" —
 * the first to skipWaiting wins and the other remains in "waiting" state,
 * causing getToken() to fail. Using one file eliminates the conflict.
 */

// ── 1. Workbox Precaching ──────────────────────────────────────────
importScripts("https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js");

workbox.core.skipWaiting();
workbox.core.clientsClaim();

// VitePWA replaces self.__WB_MANIFEST with the actual precache manifest at build time.
workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);
workbox.precaching.cleanupOutdatedCaches();

// SPA navigation fallback — serve index.html for all nav requests except API / Firebase internals
workbox.routing.registerRoute(
  new workbox.routing.NavigationRoute(
    workbox.precaching.createHandlerBoundToURL("/index.html"),
    { denylist: [/^\/__/, /\/api\//] }
  )
);

// Runtime: Firestore — network-first, 8s timeout
workbox.routing.registerRoute(
  /^https:\/\/firestore\.googleapis\.com\/.*/i,
  new workbox.strategies.NetworkFirst({
    cacheName: "firestore-cache-v2",
    networkTimeoutSeconds: 8,
    plugins: [new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] })],
  })
);

// Runtime: Google Fonts — stale-while-revalidate
workbox.routing.registerRoute(
  /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: "google-fonts-cache-v2",
    plugins: [new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] })],
  })
);

// ── 2. Firebase Cloud Messaging ───────────────────────────────────
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

// Background message handler — app is closed or in background
messaging.onBackgroundMessage(function (payload) {
  console.log("[firebase-messaging-sw] Background message:", payload);

  const title    = payload.notification?.title || "Yellow Dot";
  const body     = payload.notification?.body  || "";
  const deepLink = payload.data?.deepLink      || "/parent-notifications";

  return self.registration.showNotification(title, {
    body,
    icon:    "/icons/pwa-192x192.png",
    badge:   "/icons/pwa-192x192.png",
    tag:     payload.data?.type || "yd-notification",
    data:    { deepLink, ...payload.data },
    vibrate: [200, 100, 200],
  });
});

// Notification click → deep-link into the app
self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const deepLink = event.notification.data?.deepLink || "/parent-notifications";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.focus();
            return client.navigate(deepLink);
          }
        }
        if (clients.openWindow) return clients.openWindow(deepLink);
      })
  );
});
