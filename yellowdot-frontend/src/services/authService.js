/**
 * authService.js — Firebase Auth client + Yellow Dot backend bridge
 * ──────────────────────────────────────────────────────────────────
 * Login is handled entirely by the Firebase Auth SDK.
 * After each login the frontend calls /api/auth/me to get the
 * Yellow Dot role, permissions, and center assignments.
 *
 * Exported login methods all return the same shape:
 *   { user, permissions, homeRoute, requiresCenterSelect }
 */

import axios from "axios";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
import { auth } from "../firebase/firebase";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

// ── Shared axios instance ──────────────────────────────────────────────────────
// All other frontend service files import this `api` object.
const api = axios.create({ baseURL: API_BASE });

// Request interceptor: attach the current Firebase ID token (auto-refreshes).
api.interceptors.request.use(async config => {
  const firebaseUser = auth.currentUser;
  if (firebaseUser) {
    try {
      const token = await firebaseUser.getIdToken();
      config.headers["Authorization"] = `Bearer ${token}`;
    } catch { /* if token fetch fails, request proceeds without header */ }
  }
  return config;
});

// Response interceptor: on 401 redirect to login
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      signOut(auth).catch(() => {});
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ════════════════════════════════════════════════════════════════════════
// AUTH METHODS
// ════════════════════════════════════════════════════════════════════════

/**
 * Fetch the Yellow Dot user profile from the backend using the current
 * Firebase ID token. Returns { user, permissions, homeRoute, requiresCenterSelect }.
 */
async function me() {
  const { data } = await api.get("/api/auth/me");
  return data;
}

/**
 * Sign in with Google popup, then fetch profile from backend.
 */
async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
  // Firebase sets auth.currentUser; api interceptor will attach token automatically
  return me();
}

/**
 * Sign in with email + password, then fetch profile from backend.
 */
async function loginWithEmail(email, password) {
  await signInWithEmailAndPassword(auth, email, password);
  return me();
}

/**
 * Sign out from Firebase and notify the backend (audit log).
 */
async function logout() {
  try {
    await api.post("/api/auth/logout");
  } catch { /* best-effort */ }
  await signOut(auth);
}

/**
 * Switch active center (multi-center staff).
 */
async function selectCenter(centerId) {
  const { data } = await api.post("/api/auth/select-center", { centerId });
  return data;
}

// ════════════════════════════════════════════════════════════════════════
// STORAGE HELPERS  (kept for backward compatibility with existing callers)
// ════════════════════════════════════════════════════════════════════════

// No longer needed — Firebase manages the token. Kept as no-ops so
// any old code that calls these doesn't crash.
export function getAccessToken()               { return null; }
export function getStoredSession()             { return null; }
export function updateAccessToken()            {}
export function clearSession() {
  localStorage.removeItem("yd_session");
  sessionStorage.removeItem("yd_session");
}

export { api };

export default {
  me,
  loginWithGoogle,
  loginWithEmail,
  logout,
  selectCenter,
  api,
};
