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
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  linkWithCredential,
  signOut,
} from "firebase/auth";
import { auth } from "../firebase/firebase";

// ── Pending Google credential (account-linking flow) ──────────────────────────
// When loginWithGoogle fails because the email already has a password account,
// we store the Google credential here so loginWithEmail can link it after login.
let _pendingGoogleLink = null;   // { credential: AuthCredential, email: string } | null

// ── Popup → redirect fallback ────────────────────────────────────────────────
// signInWithPopup needs a real popup and a window the opener can talk back to.
// Two environments parents actually use don't provide that: the app installed
// to the home screen (standalone display mode) and in-app browsers such as the
// one WhatsApp opens links in. The failure there is not a clean "popup blocked"
// -- the SDK commonly surfaces the opaque auth/internal-error, which reached a
// parent's screen verbatim as "Firebase: Error (auth/internal-error)".
//
// These codes mean "this environment cannot run the popup", never "this account
// is wrong", so they are safe to retry as a full-page redirect. The redirect
// flow is same-origin here (authDomain is app.kueboxs.com, which serves
// /__/auth/handler), so it is not exposed to third-party-storage blocking.
//
// Deliberately NOT included: auth/popup-closed-by-user and
// auth/cancelled-popup-request. Those mean the person closed the popup or
// started a second one -- redirecting them would hijack a deliberate cancel.
const POPUP_UNAVAILABLE = new Set([
  "auth/internal-error",
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
  "auth/timeout",
]);

const REDIRECT_PENDING_KEY = "yd_google_redirect_pending";

export function getPendingGoogleLink()  { return _pendingGoogleLink; }
export function clearPendingGoogleLink() { _pendingGoogleLink = null; }

// API base URL selection:
// - Local dev: default to local Express (`http://localhost:5000`) unless overridden.
// - Production: default to relative calls (same origin) unless explicitly overridden
//   via VITE_API_URL (e.g. Railway backend URL).
const VITE_API_URL = import.meta.env.VITE_API_URL;
const API_BASE = import.meta.env.DEV
  ? (VITE_API_URL || "http://localhost:5000")
  : (VITE_API_URL || undefined);

// Request timeouts.
//
// Axios defaults to NO timeout, which means a request to an unreachable
// backend never settles — the promise just stays pending forever. That is not
// theoretical: when api.kueboxs.com became intermittently unreachable, the
// boot call below hung and the app sat on the splash screen with no login and
// no error, because the code after the `await` never ran.
//
// REQUEST_TIMEOUT_MS is the backstop for every call. It is deliberately
// generous, because some endpoints legitimately take a while (PDF generation,
// report exports) and cutting those off would trade one bug for another.
const REQUEST_TIMEOUT_MS = 30_000;

// The boot call gets a much shorter one. It gates the entire UI — nothing
// renders until it settles — so waiting half a minute to find out the server
// is unreachable is far worse than saying so quickly and offering a retry.
const BOOT_TIMEOUT_MS = 12_000;

// ── Shared axios instance ──────────────────────────────────────────────────────
// All other frontend service files import this `api` object.
// baseURL: "" (empty string) makes axios use relative paths → same origin.
// baseURL: "http://localhost:5000" routes to local backend in dev.
const api = axios.create({ baseURL: API_BASE, timeout: REQUEST_TIMEOUT_MS });

/**
 * True when the request never reached the server, or reached it and timed out
 * waiting for a reply — as opposed to the server answering with an error.
 *
 * The distinction matters: a 401/403 is the backend telling us something about
 * this session, and signing the user out is a reasonable response. A timeout
 * says nothing about the session at all, so reacting by destroying it logs
 * people out over a blip — and the login page they land on needs the same
 * unreachable backend to work.
 */
export function isUnreachableError(err) {
  if (!err) return false;
  if (err.response) return false;             // server replied; not a reachability problem
  return err.code === "ECONNABORTED"          // axios timeout
      || err.code === "ERR_NETWORK"           // DNS/TLS/connection refused
      || err.code === "ETIMEDOUT"
      || err.message === "Network Error";
}

// Request interceptor: attach the current Firebase ID token (auto-refreshes).
api.interceptors.request.use(async config => {
  const firebaseUser = auth.currentUser;
  const isQrEndpoint = config?.url?.includes("/api/qr/center");
  if (firebaseUser) {
    try {
      const token = await firebaseUser.getIdToken();
      config.headers["Authorization"] = `Bearer ${token}`;
      if (isQrEndpoint) {
        console.log("[authService][QR] token attached", {
          url: config.url,
          uid: firebaseUser.uid,
          tokenPresent: !!token,
          tokenPreview: token ? `${token.slice(0, 16)}...` : null,
        });
      }
    } catch (tokenErr) {
      console.error("[authService][QR] token fetch raw error", tokenErr);
      console.error("[authService][QR] token fetch failed", {
        url: config?.url,
        message: tokenErr?.message,
      });
    }
  }
  return config;
});

// Response interceptor: on 401 redirect to login
api.interceptors.response.use(
  res => res,
  err => {
    const isQrEndpoint = err?.config?.url?.includes("/api/qr/center");
    if (isQrEndpoint) {
      console.error("[authService][QR] raw response error object", err);
      console.error("[authService][QR] response error", {
        url: err?.config?.url,
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
    }
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
  const { data } = await api.get("/api/auth/me", { timeout: BOOT_TIMEOUT_MS });
  return data;
}

/**
 * Sign in with Google popup, then fetch profile from backend.
 *
 * Account-conflict flow (admin pre-created user with email/password):
 *   Firebase throws auth/account-exists-with-different-credential.
 *   We store the pending Google credential and rethrow with code
 *   "auth/link-required" + the conflicting email so Login.jsx can
 *   switch to the Email tab and tell the user what happened.
 *   loginWithEmail() auto-links the Google credential after password sign-in.
 */
async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
    _pendingGoogleLink = null;   // clean up any stale pending link
    return me();
  } catch (err) {
    if (POPUP_UNAVAILABLE.has(err.code)) {
      console.warn(`[auth] popup unavailable (${err.code}) — falling back to redirect`);
      try { sessionStorage.setItem(REDIRECT_PENDING_KEY, "1"); } catch { /* private mode */ }
      await signInWithRedirect(auth, provider);
      // The page navigates away here, so this never resolves in practice. The
      // throw exists so a caller awaiting us doesn't sit on a promise that can
      // never settle if the navigation is somehow blocked.
      const pending  = new Error("GOOGLE_REDIRECT_IN_PROGRESS");
      pending.code   = "auth/redirect-in-progress";
      throw pending;
    }
    if (err.code === "auth/account-exists-with-different-credential") {
      const credential = GoogleAuthProvider.credentialFromError(err);
      const email      = err.customData?.email || "";
      _pendingGoogleLink = { credential, email };

      // Throw a recognizable error for Login.jsx
      const linkErr    = new Error("GOOGLE_LINK_REQUIRED");
      linkErr.code     = "auth/link-required";
      linkErr.email    = email;
      throw linkErr;
    }
    throw err;
  }
}

/**
 * Settle a redirect sign-in after the browser comes back to the app.
 *
 * On success nothing needs doing here: Firebase restores the session and
 * AuthContext's onAuthStateChanged does the /api/auth/me fetch exactly as it
 * does for a popup login. This exists so the FAILURE of a redirect is visible
 * -- a redirect's error arrives here and nowhere else, so without this call a
 * failed redirect would land the user back on a silent login screen.
 *
 * @returns {Promise<{ redirected: boolean }>}
 * @throws the same auth/link-required error loginWithGoogle throws, so the
 *         account-linking flow behaves identically through either path.
 */
async function completeGoogleRedirect() {
  let wasPending = false;
  try { wasPending = sessionStorage.getItem(REDIRECT_PENDING_KEY) === "1"; } catch { /* private mode */ }
  try {
    const result = await getRedirectResult(auth);
    return { redirected: !!result };
  } catch (err) {
    if (err.code === "auth/account-exists-with-different-credential") {
      const credential = GoogleAuthProvider.credentialFromError(err);
      const email      = err.customData?.email || "";
      _pendingGoogleLink = { credential, email };
      const linkErr = new Error("GOOGLE_LINK_REQUIRED");
      linkErr.code  = "auth/link-required";
      linkErr.email = email;
      throw linkErr;
    }
    throw err;
  } finally {
    if (wasPending) { try { sessionStorage.removeItem(REDIRECT_PENDING_KEY); } catch { /* ignore */ } }
  }
}

/**
 * Sign in with email + password, then fetch profile from backend.
 * If a pending Google credential exists (from a failed loginWithGoogle),
 * it is automatically linked to the account after sign-in so future
 * Google logins work with the same UID.
 */
async function loginWithEmail(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);

  // Auto-link the pending Google credential when emails match
  if (_pendingGoogleLink?.credential &&
      _pendingGoogleLink.email.toLowerCase() === email.toLowerCase()) {
    try {
      await linkWithCredential(userCredential.user, _pendingGoogleLink.credential);
      console.log("[auth] Google account linked to email/password account.");
    } catch (linkErr) {
      // Linking can fail if the Google account already has a different UID.
      // Not fatal — email/password login still succeeds.
      console.warn("[auth] Could not link Google credential:", linkErr.message);
    }
    _pendingGoogleLink = null;
  }

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

/**
 * Flush the server-side permission cache for the current user's role and return
 * fresh permissions. Call this when you suspect stale permissions (e.g. after
 * a server-side role definition change without a re-login).
 * Returns { success, permissions, roleMatrix, homeRoute, role }
 */
async function refreshPermissions() {
  const { data } = await api.post("/api/auth/refresh-permissions");
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
  completeGoogleRedirect,
  loginWithEmail,
  logout,
  selectCenter,
  refreshPermissions,
  isUnreachableError,
  api,
};
