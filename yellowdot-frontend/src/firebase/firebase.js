import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyBwRMjTuDbOHMFdBtVV55kYoOcL-1L7tKM",
  authDomain: "yellowdot-app.firebaseapp.com",
  projectId: "yellowdot-app",
  storageBucket: "yellowdot-app.firebasestorage.app",
  messagingSenderId: "230256365087",
  appId: "1:230256365087:web:125297908a30fb5e28cf2a",
  measurementId: "G-4XTR5RBQZD",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);

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
    return _messaging;
  } catch {
    return null;
  }
}

export default app;