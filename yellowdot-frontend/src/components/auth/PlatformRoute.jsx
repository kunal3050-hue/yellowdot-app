/**
 * PlatformRoute — guards the operator console.
 *
 * Deliberately NOT ProtectedRoute. That one is built for school users and
 * routes them through school concerns — pick a centre, complete your staff
 * profile, your school is suspended. None of those apply to a platform
 * operator, and some would actively misfire: the console must stay usable
 * precisely WHEN a school is suspended, since un-suspending it is done here.
 *
 * Access is currently "is this a bypass role", because that is the only
 * thing the system can express today — `tenant-management` is listed in
 * knownGaps as unreachable for every non-bypass role, and both bypass roles
 * hold "*". The check is isolated here so that granting a narrower
 * platform role later is a change to one function rather than a hunt
 * through the routes.
 */

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { canUsePlatformConsole } from "../../config/permissions";

export default function PlatformRoute({ children }) {
  const { isAuthenticated, loading, role } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", background: "var(--yd-charcoal)",
        color: "rgba(255,255,255,0.6)", fontFamily: "var(--yd-font)", fontSize: 13,
      }}>
        Loading console…
      </div>
    );
  }

  // Both cases land on the console's own login, which explains the second
  // one rather than looking like a failed sign-in.
  if (!isAuthenticated || !canUsePlatformConsole(role)) {
    return <Navigate to="/platform/login" state={{ from: location }} replace />;
  }

  return children;
}
