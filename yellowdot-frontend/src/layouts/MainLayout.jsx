import { useState } from "react";
import Sidebar from "../components/common/Sidebar";
import Topbar from "../components/Topbar";
import { ToastProvider } from "../components/ui";

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
