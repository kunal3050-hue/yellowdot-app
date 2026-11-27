/**
 * PlatformRoute — guards the operator console.
 *
 * Deliberately NOT ProtectedRoute. That one is built for school users and
 * routes them through school concerns — pick a centre, complete your staff
 * profile, your school is suspended. None of those apply to a platform
 * operator, and some would actively misfire: the console must stay usable
 * precisely WHEN a school is suspended, since un-suspending it is done here.
 *
 * Two levels of check:
 *
 *   `canUsePlatformConsole`  the front door — may this role be in here at all
 *   `requires` (optional)    a further capability this particular route needs
 *
 * The second exists because the backend does not guard every tenant route
 * the same way. tenantRoutes.js splits them: a platform_admin may read the
 * platform and suspend a school, but creating, editing, deleting and
 * impersonating are super_admin/developer only. A route whose entire purpose
 * is one of those takes `requires`, so it is refused at the door rather than
 * rendering a form that 403s on submit.
 *
 * Failing `requires` is NOT a failed sign-in, so it does not bounce to the
 * login screen — that would read as the session having broken. It says what
 * happened and offers the way back.
 */

import { Navigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { canUsePlatformConsole } from "../../config/permissions";

export default function PlatformRoute({ children, requires }) {
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

  // Signed in, allowed in the console, but not allowed this particular
  // route. Say so plainly.
  if (typeof requires === "function" && !requires(role)) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 10, height: "100vh", padding: 24,
        background: "var(--yd-charcoal)", textAlign: "center",
        fontFamily: "var(--yd-font)",
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#FFFFFF" }}>
          Not available on your account
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,0.6)", maxWidth: 380 }}>
          Your role can view the platform and change a school&rsquo;s status, but
          not create or remove schools.
        </div>
        <Link to="/platform/tenants" style={{
          marginTop: 8, fontSize: 13, fontWeight: 600,
          color: "var(--yd-yellow)", textDecoration: "none",
        }}>
          Back to schools
        </Link>
      </div>
    );
  }

  return children;
}
