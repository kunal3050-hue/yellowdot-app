/**
 * AuthContext.jsx — Yellow Dot unified authentication state (Firebase)
 * ─────────────────────────────────────────────────────────────────────
 * Firebase Auth handles all token lifecycle. onAuthStateChanged drives
 * the loading / authenticated state. After Firebase sign-in the backend
 * /api/auth/me endpoint is called to resolve role, permissions, center.
 *
 * Provides:
 *   currentUser   — full user object (userId, name, email, role, centers, photoUrl, ...)
 *   role          — shortcut: currentUser?.role
 *   permissions   — array of allowed route keys (or ["*"] for super_admin)
 *   isAuthenticated
 *   loading       — true until Firebase first fires onAuthStateChanged
 *
 * Login methods:
 *   loginWithGoogle()         — popup-based Google sign-in
 *   loginWithEmail(email, pw) — email + password sign-in
 *
 * Other actions:
 *   logout(reason?)           — Firebase signOut + audit log
 *   selectCenter(centerId)    — switch active center (multi-center staff)
 *   can(routeKey)             — permission check helper
 *   setDevRole(role)          — developer-only role override for testing
 */

import {
  createContext, useContext, useState, useEffect, useCallback, useRef,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/firebase";
import authService from "../services/authService";
import { checkPermission, isBypassRole, getPermissionsForRole } from "../config/permissions";

const AuthContext = createContext(null);

const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes

export function AuthProvider({ children }) {
  // user = Yellow Dot profile from /api/auth/me (not the raw Firebase user)
  const [user,        setUser]         = useState(null);
  const [permissions, setPermissions]  = useState([]);
  const [loading,     setLoading]      = useState(true);  // true until Firebase fires
  const [devRole,     setDevRoleState] = useState(null);
  const inactivityTimer = useRef(null);

  // ── Firebase auth state listener ────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
      if (firebaseUser) {
        try {
          // Fetch Yellow Dot profile (role, permissions, center assignments)
          const data = await authService.me();
          setUser(data.user);
          setPermissions(data.permissions || []);
        } catch (err) {
          console.error("[AuthContext] Failed to fetch profile:", err.message);
          // If the backend is unreachable, sign out rather than leaving a broken state
          await auth.signOut().catch(() => {});
          setUser(null);
          setPermissions([]);
        }
      } else {
        // Firebase user is signed out
        setUser(null);
        setPermissions([]);
        setDevRoleState(null);
      }
      setLoading(false);
    });

    return unsubscribe; // cleanup on unmount
  }, []);

  // ── Inactivity auto-logout ─────────────────────────────────────────────────
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => logout("inactivity"), INACTIVITY_MS);
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!user) return;
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach(e => window.addEventListener(e, resetInactivityTimer));
    resetInactivityTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetInactivityTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [user, resetInactivityTimer]);

  // ════════════════════════════════════════════════════════════════════════
  // LOGIN METHODS
  // ════════════════════════════════════════════════════════════════════════

  /** Google OAuth popup */
  async function loginWithGoogle() {
    const data = await authService.loginWithGoogle();
    setUser(data.user);
    setPermissions(data.permissions || []);
    return data;
  }

  /** Email + password (staff accounts) */
  async function loginWithEmail(email, password) {
    const data = await authService.loginWithEmail(email, password);
    setUser(data.user);
    setPermissions(data.permissions || []);
    return data;
  }

  // ── Stub: OTP not yet implemented with Firebase Phone Auth ────────────────
  async function requestOTP() {
    throw new Error("OTP login not available. Please use email or Google sign-in.");
  }
  async function loginWithOTP() {
    throw new Error("OTP login not available. Please use email or Google sign-in.");
  }

  // ════════════════════════════════════════════════════════════════════════
  // LOGOUT
  // ════════════════════════════════════════════════════════════════════════

  async function logout(reason) {
    try {
      await authService.logout();
    } catch { /* no-op */ }

    // State is cleared by the onAuthStateChanged listener (Firebase fires it after signOut)
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    window.location.href = "/login" + (reason === "inactivity" ? "?reason=inactivity" : "");
  }

  // ════════════════════════════════════════════════════════════════════════
  // CENTER SELECTION
  // ════════════════════════════════════════════════════════════════════════

  async function selectCenter(centerId) {
    await authService.selectCenter(centerId);
    setUser(prev => prev ? { ...prev, activeCenter: centerId, center: centerId } : prev);
    return { activeCenter: centerId };
  }

  // ════════════════════════════════════════════════════════════════════════
  // PERMISSION CHECK
  // ════════════════════════════════════════════════════════════════════════

  function can(routeKey) {
    const effectiveRole = devRole || user?.role;
    if (isBypassRole(effectiveRole)) return true;
    if (devRole) {
      const devPerms = getPermissionsForRole(devRole);
      if (devPerms.includes("*")) return true;
      return devPerms.includes(routeKey);
    }
    return checkPermission(effectiveRole, permissions, routeKey);
  }

  // ════════════════════════════════════════════════════════════════════════
  // DEVELOPER ROLE OVERRIDE
  // ════════════════════════════════════════════════════════════════════════

  function setDevRole(role) {
    if (user?.role !== "developer" && user?.role !== "super_admin") return;
    setDevRoleState(role || null);
  }

  const effectiveRole = devRole || user?.role;
  const effectiveUser = user ? { ...user, role: effectiveRole } : null;
  const isDevBypass   = isBypassRole(user?.role);

  const value = {
    // State
    user:            effectiveUser,
    currentUser:     effectiveUser,
    role:            effectiveRole,
    permissions,
    loading,
    isAuthenticated: !!user,

    // Login
    loginWithGoogle,
    loginWithEmail,
    loginWithOTP,   // stub — kept so existing UI code doesn't crash
    requestOTP,     // stub

    // Session management
    logout,
    selectCenter,

    // Permission
    can,

    // Dev tools
    setDevRole,
    devRole,
    isDeveloper: isDevBypass,
    isDevBypass,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
