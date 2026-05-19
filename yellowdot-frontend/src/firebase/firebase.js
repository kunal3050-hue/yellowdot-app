import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBwRMjTuDbOHMFdBtVV55kYoOcL-1L7tKM",
  authDomain: "yellowdot-app.firebaseapp.com",
  projectId: "yellowdot-app",
  storageBucket: "yellowdot-app.firebasestorage.app",
  messagingSenderId: "230256365087",
  appId: "1:230256365087:web:125297908a30fb5e28cf2a"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;