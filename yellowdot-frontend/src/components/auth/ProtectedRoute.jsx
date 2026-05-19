import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { isBypassRole } from "../../config/permissions";

/**
 * ProtectedRoute — wraps any route that requires authentication.
 *
 * Permission evaluation order (immutable):
 *   0. Loading session        → show spinner
 *   1. Not authenticated      → /login
 *   2. isBypassRole(role)     → GRANT immediately (developer / super_admin never blocked)
 *   3. Multi-center, no seat  → /select-center
 *   4. routeKey + can()=false → /unauthorized
 *   5. All checks pass        → render children
 *
 * Step 2 runs BEFORE center-selection and permission checks so developers
 * are never accidentally redirected anywhere other than their intended page.
 */
export default function ProtectedRoute({ children, routeKey }) {
  const { isAuthenticated, loading, can, user, role } = useAuth();
  const location = useLocation();

  // ── 0. Loading ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", background: "var(--yd-bg, #FFFDF7)",
      }}>
        <LoadingDots />
      </div>
    );
  }

  // ── 1. Not authenticated ─────────────────────────────────────────────
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // ── 2. Bypass roles (developer / super_admin) ────────────────────────
  // These roles NEVER get blocked — skip every remaining check.
  if (isBypassRole(role)) {
    return children;
  }

  // ── 3. Multi-center: user hasn't picked a center yet ─────────────────
  if (
    user?.centers?.length > 1 &&
    !user?.activeCenter &&
    location.pathname !== "/select-center"
  ) {
    return <Navigate to="/select-center" state={{ from: location }} replace />;
  }

  // ── 4. Route-key permission check ────────────────────────────────────
  if (routeKey && !can(routeKey)) {
    return <Navigate to="/unauthorized" state={{ from: location }} replace />;
  }

  // ── 5. Authorized ────────────────────────────────────────────────────
  return children;
}

// ── Bouncing-dots loading indicator ──────────────────────────────────────────
function LoadingDots() {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            width: 10, height: 10, borderRadius: "50%",
            background: "var(--yd-yellow, #F4C400)",
            display: "inline-block",
            animation: `yd-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes yd-bounce {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.4; }
          40%            { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
