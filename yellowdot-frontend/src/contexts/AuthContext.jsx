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

// ── DEV-ONLY headless test bypass ─────────────────────────────────────────────
// Set localStorage key  yd_test_bypass_role = "developer"  before navigation.
// import.meta.env.DEV is compiled to `false` in production builds (tree-shaken).
// This code path is COMPLETELY absent from any production bundle.
const _DEV_BYPASS_ROLE = import.meta.env.DEV
  ? (typeof window !== "undefined" && window.localStorage.getItem("yd_test_bypass_role")) || null
  : null;
const _DEV_BYPASS_USER = _DEV_BYPASS_ROLE
  ? { uid: "test-dev-user", email: "dev@test.local", name: "Dev Test",
      role: _DEV_BYPASS_ROLE, centers: [], activeCenter: "ydseawoods",
      photoUrl: null, schoolId: "ydseawoods" }
  : null;

export function AuthProvider({ children }) {
  // user = Yellow Dot profile from /api/auth/me (not the raw Firebase user)
  const [user,           setUser]          = useState(null);
  const [permissions,    setPermissions]   = useState([]);
  const [roleMatrix,     setRoleMatrix]    = useState({});  // granular { moduleId: { action: bool } }
  const [loading,        setLoading]       = useState(true);  // always starts loading (SplashScreen needs true→false)
  const [devRole,        setDevRoleState]  = useState(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const inactivityTimer = useRef(null);

  // ── Firebase auth state listener ────────────────────────────────────────────
  useEffect(() => {
    if (_DEV_BYPASS_ROLE) {
      // DEV bypass: skip Firebase, inject mock user, resolve loading
      setUser(_DEV_BYPASS_USER);
      setPermissions(["*"]);
      setLoading(false);
      return; // no Firebase subscription to clean up
    }
    const unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
      if (firebaseUser) {
        try {
          // Fetch Yellow Dot profile (role, permissions, center assignments)
          const data = await authService.me();

          // Backend signals profile-missing: Firebase auth passed but no Firestore
          // staff doc or parent email match was found. Surface this state so
          // ProtectedRoute can redirect to the ProfileIncomplete page.
          if (data.profileMissing) {
            console.warn("[AuthContext] profileMissing=true — uid exists in Firebase but no Firestore profile.");
            setUser(data.user || null);
            setPermissions([]);
            setRoleMatrix({});
            setProfileMissing(true);
          } else {
            setUser(data.user);
            setPermissions(data.permissions || []);
            setRoleMatrix(data.roleMatrix || {});
            setProfileMissing(false);
          }
        } catch (err) {
          console.error("[AuthContext] Failed to fetch profile:", err.message);
          // If the backend is unreachable, sign out rather than leaving a broken state
          await auth.signOut().catch(() => {});
          setUser(null);
          setPermissions([]);
          setRoleMatrix({});
          setProfileMissing(false);
        }
      } else {
        // Firebase user is signed out
        setUser(null);
        setPermissions([]);
        setRoleMatrix({});
        setDevRoleState(null);
        setProfileMissing(false);
      }
      setLoading(false);
    });

    return unsubscribe; // cleanup on unmount
  }, []);

  // ── Permission refresh ─────────────────────────────────────────────────────
  // Flushes the server-side cache and returns a fresh permissions array.
  // Safe to call at any time; updates context state in-place (no logout needed).
  const refreshPermissions = useCallback(async () => {
    try {
      const data = await authService.refreshPermissions();
      if (Array.isArray(data.permissions)) setPermissions(data.permissions);
      if (data.roleMatrix) setRoleMatrix(data.roleMatrix);
      return data.permissions || [];
    } catch (err) {
      console.warn("[AuthContext] refreshPermissions failed:", err.message);
      return permissions;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh stale sessions: if the user is an admin-level role but is
  // missing communications permissions, silently re-fetch once per session.
  // This handles users who were already logged in before the backend update.
  const _refreshedRef = useRef(false);
  const ADMIN_ROLES     = ["admin", "center_owner", "center_admin"];
  const COMMS_KEYS      = ["holidays", "notices", "announcements"];
  const ACADEMICS_KEYS  = ["academics-classes", "academics-batches"];
  useEffect(() => {
    if (loading || !user || _refreshedRef.current) return;
    const role = user?.role;
    const hasWildcard = permissions.includes("*");
    if (hasWildcard) return; // bypass roles never need refresh
    const missingComms     = ADMIN_ROLES.includes(role) && COMMS_KEYS.some(k => !permissions.includes(k));
    const missingAcademics = (ADMIN_ROLES.includes(role) || role === "teacher")
                             && ACADEMICS_KEYS.some(k => !permissions.includes(k));
    if (missingComms || missingAcademics) {
      _refreshedRef.current = true;
      console.log("[AuthContext] Stale permissions detected for", role, "— auto-refreshing…");
      refreshPermissions().then(fresh => {
        console.log("[AuthContext] Refreshed permissions:", fresh);
      });
    }
  }, [loading, user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setRoleMatrix(data.roleMatrix || {});
    return data;
  }

  /** Email + password (staff accounts) */
  async function loginWithEmail(email, password) {
    const data = await authService.loginWithEmail(email, password);
    setUser(data.user);
    setPermissions(data.permissions || []);
    setRoleMatrix(data.roleMatrix || {});
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

  /**
   * Granular action-level permission check.
   * canDo("students", "delete") — true if the current role's matrix has students.delete = true.
   * Bypass roles (developer / super_admin) always return true.
   * Falls back gracefully if roleMatrix is not yet populated (returns true for bypass roles, false otherwise).
   *
   * @param {string} moduleId  — e.g. "students", "fees", "attendance"
   * @param {string} action    — e.g. "view", "create", "edit", "delete", "export", "approve", "mark"
   * @returns {boolean}
   */
  function canDo(moduleId, action) {
    const effectiveRole = devRole || user?.role;
    if (isBypassRole(effectiveRole)) return true;
    // If roleMatrix has _bypass flag (wildcard roles) — allow all
    if (roleMatrix?._bypass) return true;
    return Boolean(roleMatrix?.[moduleId]?.[action]);
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
    roleMatrix,
    loading,
    isAuthenticated: !!user,
    profileMissing,

    // Login
    loginWithGoogle,
    loginWithEmail,
    loginWithOTP,   // stub — kept so existing UI code doesn't crash
    requestOTP,     // stub

    // Session management
    logout,
    selectCenter,
    refreshPermissions,

    // Permission helpers
    can,    // route-level:  can("students")
    canDo,  // action-level: canDo("students", "delete")

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
