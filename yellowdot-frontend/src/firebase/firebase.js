import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported } from "firebase/messaging";

// Firebase config — env-driven so each build (dev/staging/production) uses the
// correct OAuth authDomain. Production (KUE Boxs Care) uses app.kueboxs.com so
// the Google sign-in popup/redirect lands on the custom domain instead of the
// default *.firebaseapp.com. The custom domain must be registered as an
// Authorized Domain in Firebase Console → Authentication → Settings.
const env = import.meta.env;

// ── Emulator mode ────────────────────────────────────────────────────────────
// Opt-in via VITE_USE_FIREBASE_EMULATOR=true (set by `npm run dev:local`).
// The project id is forced to a `demo-` prefix, which Firebase treats as
// offline-only: even a misconfigured emulator host cannot reach production.
const USE_EMULATOR = env.VITE_USE_FIREBASE_EMULATOR === "true";
const EMULATOR_PROJECT = env.VITE_FIREBASE_PROJECT_ID || "demo-kueboxs";

// Mirrors the backend's emulatorGuard: emulator mode is only ever allowed on a
// `demo-` project. Without this, a stray VITE_FIREBASE_PROJECT_ID could point
// emulator mode at the real project and the client would happily write to it.
if (USE_EMULATOR && !EMULATOR_PROJECT.startsWith("demo-")) {
  throw new Error(
    `[firebase] Emulator mode requires a "demo-" project id, got "${EMULATOR_PROJECT}". ` +
    `Refusing to start: a non-demo project can reach production Firebase.`,
  );
}

const firebaseConfig = USE_EMULATOR ? {
  // The emulator validates none of these; the apiKey just has to be non-empty.
  apiKey:     "demo-api-key",
  authDomain: "localhost",
  projectId:  EMULATOR_PROJECT,
} : {
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

if (USE_EMULATOR) {
  const authHost = env.VITE_AUTH_EMULATOR_URL || "http://127.0.0.1:9099";
  const [fsHost, fsPort] = (env.VITE_FIRESTORE_EMULATOR || "127.0.0.1:8080").split(":");
  connectAuthEmulator(auth, authHost, { disableWarnings: true });
  connectFirestoreEmulator(db, fsHost, Number(fsPort));
  console.log(
    `%c🧪 EMULATOR MODE — project=${EMULATOR_PROJECT} auth=${authHost} firestore=${fsHost}:${fsPort}`,
    "background:#FEF3C7;color:#92400E;padding:2px 6px;border-radius:4px;font-weight:600",
  );
}

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