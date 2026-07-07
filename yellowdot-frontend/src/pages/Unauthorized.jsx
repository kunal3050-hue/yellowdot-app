import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { PLATFORM_NAME } from "../config/environment";

const ROLE_LABELS = {
  super_admin:  "Super Admin",
  developer:    "Developer",
  center_admin: "Center Admin",
  teacher:      "Teacher",
  accountant:   "Accountant",
  reception:    "Reception",
  parent:       "Parent",
};

export default function Unauthorized() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const roleLabel = ROLE_LABELS[user?.role] || user?.role || "Guest";

  return (
    <div style={{
      minHeight: "100vh", background: "var(--yd-bg, #FFFDF7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      padding: 24,
    }}>
      <div style={{
        textAlign: "center", maxWidth: 440,
        animation: "fadeUp 0.4s ease both",
      }}>

        {/* Lock icon */}
        <div style={{
          width: 72, height: 72, margin: "0 auto 24px",
          borderRadius: 22, background: "#FFF0F0",
          border: "1.5px solid #FBBFBF",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 30,
        }}>
          🔒
        </div>

        {/* Heading */}
        <h1 style={{
          fontWeight: 800, fontSize: 26, color: "#1E1E1E",
          margin: "0 0 10px", letterSpacing: "-0.5px",
        }}>
          Access Restricted
        </h1>

        <p style={{ color: "#888", fontSize: 15, fontWeight: 500, lineHeight: 1.6, margin: "0 0 24px" }}>
          Your account ({roleLabel}) doesn't have permission to view this page.
          Please contact your school administrator to request access.
        </p>

        {/* KUE BOXS Care branding strip */}
        <div style={{
          background: "linear-gradient(135deg, #FFF8D0, #FFF3B0)",
          border: "1px solid #F4C40044",
          borderRadius: 14, padding: "14px 20px",
          marginBottom: 28, display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "#F4C400",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 16, color: "#1E1E1E",
            flexShrink: 0,
          }}>{PLATFORM_NAME.charAt(0)}</div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#1E1E1E" }}>{PLATFORM_NAME}</div>
            <div style={{ fontSize: 12, color: "#888", fontWeight: 500 }}>
              Role-based access control is active
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              height: 42, padding: "0 20px", borderRadius: 11,
              border: "1.5px solid #E8E3D9", background: "#fff",
              fontFamily: "inherit", fontWeight: 700, fontSize: 14,
              color: "#2A2A2A", cursor: "pointer",
            }}
          >
            ← Go Back
          </button>

          <button
            onClick={() => navigate("/")}
            style={{
              height: 42, padding: "0 20px", borderRadius: 11,
              border: "none", background: "#F4C400",
              fontFamily: "inherit", fontWeight: 800, fontSize: 14,
              color: "#1E1E1E", cursor: "pointer",
              boxShadow: "0 2px 8px #F4C40044",
            }}
          >
            Dashboard
          </button>

          <button
            onClick={() => logout()}
            style={{
              height: 42, padding: "0 20px", borderRadius: 11,
              border: "1.5px solid #FBBFBF", background: "#FFF0F0",
              fontFamily: "inherit", fontWeight: 700, fontSize: 14,
              color: "#D02020", cursor: "pointer",
            }}
          >
            Sign Out
          </button>
        </div>

        {/* Role info */}
        {user && (
          <p style={{ marginTop: 24, fontSize: 12, color: "#C0B8A8", fontWeight: 500 }}>
            Signed in as <strong style={{ color: "#888" }}>{user.name || user.email}</strong>
            {" · "}<span style={{ textTransform: "capitalize" }}>{roleLabel}</span>
            {user.activeCenter && ` · ${user.activeCenter}`}
          </p>
        )}
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
