import { useState } from "react";
import { getAuth, signOut } from "firebase/auth";
import Sidebar from "../components/common/Sidebar";
import Topbar from "../components/Topbar";
import { ToastProvider } from "../components/ui";

function ImpersonationBanner() {
  const tenantId = sessionStorage.getItem("yd_impersonating_tenant");
  if (!tenantId) return null;

  async function handleExit() {
    sessionStorage.removeItem("yd_impersonating_tenant");
    await signOut(getAuth());
    window.close();
  }

  return (
    <div style={{
      background: "#FEF9C3", borderBottom: "2px solid #F5C518",
      padding: "8px 20px", display: "flex", alignItems: "center",
      justifyContent: "space-between", fontSize: 13, color: "#A16207",
      fontWeight: 600, flexShrink: 0,
    }}>
      <span>⚠ Impersonation Session — viewing as tenant admin of <strong>{tenantId}</strong>. All actions are audit-logged.</span>
      <button
        onClick={handleExit}
        style={{ background: "#F5C518", border: "none", borderRadius: 6, padding: "4px 12px", fontWeight: 700, cursor: "pointer", color: "#1C1917", fontSize: 12 }}
      >
        Exit Session
      </button>
    </div>
  );
}

function MainLayout({ children }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="yd-page">
        {/* Sidebar — mobile overlay handled inside via `mobileSidebarOpen` */}
        <Sidebar
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />

        {/* Content column: topbar + scrollable content */}
        <div className="yd-content">
          <ImpersonationBanner />
          <Topbar onMenuToggle={() => setMobileSidebarOpen(o => !o)} />

          <div className="yd-scroll-area">
            {children}
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}

export default MainLayout;
