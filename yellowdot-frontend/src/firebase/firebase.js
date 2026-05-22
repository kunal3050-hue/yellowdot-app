import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBwRMjTuDbOHMFdBtVV55kYoOcL-1L7tKM",
  authDomain: "yellowdot-app.firebaseapp.com",
  projectId: "yellowdot-app",
  storageBucket: "yellowdot-app.firebasestorage.app",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;