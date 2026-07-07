import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported } from "firebase/messaging";

// Firebase config — env-driven so each build (dev/staging/production) uses the
// correct OAuth authDomain. Production (KUE Boxs Care) uses app.kueboxs.com so
// the Google sign-in popup/redirect lands on the custom domain instead of the
// default *.firebaseapp.com. The custom domain must be registered as an
// Authorized Domain in Firebase Console → Authentication → Settings.
const env = import.meta.env;
const firebaseConfig = {
  apiKey:            env.VITE_FIREBASE_API_KEY            || "AIzaSyBwRMjTuDbOHMFdBtVV55kYoOcL-1L7tKM",
  authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN        || "yellowdot-app.firebaseapp.com",
  projectId:         env.VITE_FIREBASE_PROJECT_ID         || "yellowdot-app",
  storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET     || "yellowdot-app.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "230256365087",
  appId:             env.VITE_FIREBASE_APP_ID             || "1:230256365087:web:125297908a30fb5e28cf2a",
  measurementId:     env.VITE_FIREBASE_MEASUREMENT_ID     || "G-4XTR5RBQZD",
};

const app = initializeApp(firebaseConfig);
console.log("[FCM] Firebase initialized — project:", firebaseConfig.projectId, "authDomain:", firebaseConfig.authDomain);

export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);

// Firebase Messaging — only available in browsers that support Service Workers
// and the Push API (most modern mobile browsers). Returns null on unsupported
// environments (e.g. Safari < 16.4, Node, SSR).
let _messaging = null;
export async function getMessagingInstance() {
  if (_messaging) return _messaging;
  try {
    const supported = await isSupported();
    if (!supported) return null;
    _messaging = getMessaging(app);
    console.log("[FCM] Messaging initialized");
    return _messaging;
  } catch {
    return null;
  }
}

export default app;