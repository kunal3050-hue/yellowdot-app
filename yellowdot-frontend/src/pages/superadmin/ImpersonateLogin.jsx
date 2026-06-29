/**
 * ImpersonateLogin.jsx — Landing page for super-admin impersonation sessions.
 *
 * URL: /impersonate?token=<customToken>&tenantId=<id>
 *
 * Exchanges the custom token for a Firebase session, then redirects to the
 * tenant's dashboard. Shows a persistent yellow banner warning so the admin
 * always knows they are in an impersonation session.
 */

import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getAuth, signInWithCustomToken, signOut } from "firebase/auth";

export default function ImpersonateLogin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("Signing in to tenant account…");
  const [error, setError]   = useState(null);

  useEffect(() => {
    const token    = searchParams.get("token");
    const tenantId = searchParams.get("tenantId");

    if (!token) {
      setError("No impersonation token provided.");
      return;
    }

    async function doImpersonate() {
      try {
        const auth = getAuth();
        setStatus("Exchanging impersonation token…");
        await signInWithCustomToken(auth, token);

        setStatus("Session ready — redirecting…");
        sessionStorage.setItem("yd_impersonating_tenant", tenantId || "");
        navigate("/", { replace: true });
      } catch (err) {
        setError(err.message);
      }
    }

    doImpersonate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleExit() {
    sessionStorage.removeItem("yd_impersonating_tenant");
    await signOut(getAuth());
    window.close(); // close the tab that was opened for impersonation
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFBEB" }}>
      <div style={{ textAlign: "center", maxWidth: 360 }}>
        {/* Impersonation warning banner */}
        <div style={{
          background: "#FEF9C3", border: "2px solid #F5C518",
          borderRadius: 12, padding: "16px 20px", marginBottom: 24,
          fontSize: 13, color: "#A16207", fontWeight: 600,
        }}>
          ⚠ Super Admin Impersonation Session
          <br /><span style={{ fontWeight: 400 }}>This tab is operating under a tenant admin account. All actions are audit-logged.</span>
        </div>

        {error ? (
          <div>
            <div style={{ color: "#DC2626", marginBottom: 16, fontSize: 14 }}>{error}</div>
            <button onClick={handleExit} style={{ background: "#F5F0E8", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, cursor: "pointer" }}>
              Close
            </button>
          </div>
        ) : (
          <div style={{ color: "#78716C", fontSize: 14 }}>{status}</div>
        )}
      </div>
    </div>
  );
}
