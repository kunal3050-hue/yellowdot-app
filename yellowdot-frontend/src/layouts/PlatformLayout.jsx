/**
 * PlatformLayout.jsx — shell for the platform operator console
 * ──────────────────────────────────────────────────────────────────────
 * The console manages preschools: which are live, what plan they are on,
 * suspending them, impersonating into them. That is work done ACROSS
 * tenants, so it has no business wearing one school's chrome.
 *
 * Until now these pages rendered inside MainLayout, which meant managing
 * every school on the platform while a single school's sidebar, branding
 * and tenant switcher sat around the page — easy to misread which context
 * you were acting in, when the actions include suspending a school.
 *
 * This shell is deliberately plain: dark rail, no tenant switcher, no
 * school nav, no search. It should not be mistakable for the school app.
 */

import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ToastProvider } from "../components/ui";

const NAV = [
  { to: "/platform/tenants",  label: "Preschools", icon: "🏫" },
  { to: "/platform/analytics", label: "Analytics",  icon: "📈" },
  { to: "/platform/audit",     label: "Audit Log",  icon: "📋" },
];

const CSS = `
  .yd-pl-root {
    display: flex;
    height: 100vh;
    overflow: hidden;
    background: var(--yd-bg);
    font-family: var(--yd-font);
  }
  .yd-pl-rail {
    width: 232px;
    flex-shrink: 0;
    background: var(--yd-charcoal);
    display: flex;
    flex-direction: column;
    padding: 20px 14px;
  }
  .yd-pl-brand {
    display: flex; align-items: center; gap: 9px;
    padding: 0 8px 18px;
    border-bottom: 1px solid rgba(255,255,255,0.10);
    margin-bottom: 14px;
  }
  .yd-pl-brand-mark {
    width: 30px; height: 30px; border-radius: 9px;
    background: var(--yd-yellow);
    display: flex; align-items: center; justify-content: center;
    font-size: 15px; flex-shrink: 0;
  }
  .yd-pl-brand-text { line-height: 1.25; min-width: 0; }
  .yd-pl-brand-title {
    font-size: 13px; font-weight: 800; color: #FFFFFF;
    letter-spacing: -0.02em; white-space: nowrap;
  }
  .yd-pl-brand-sub {
    font-size: 10px; font-weight: 600; letter-spacing: 0.07em;
    text-transform: uppercase; color: var(--yd-yellow);
  }
  .yd-pl-nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }
  .yd-pl-link {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 10px;
    border-radius: 10px;
    font-size: 13px; font-weight: 600;
    color: rgba(255,255,255,0.72);
    text-decoration: none;
    transition: background 120ms ease, color 120ms ease;
  }
  .yd-pl-link:hover { background: rgba(255,255,255,0.07); color: #FFFFFF; }
  .yd-pl-link.active { background: var(--yd-yellow); color: var(--yd-black); }
  .yd-pl-foot { border-top: 1px solid rgba(255,255,255,0.10); padding-top: 12px; }
  .yd-pl-who { padding: 0 10px 10px; }
  .yd-pl-who-name {
    font-size: 12px; font-weight: 700; color: #FFFFFF;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .yd-pl-who-role {
    font-size: 10px; font-weight: 600; letter-spacing: 0.05em;
    text-transform: uppercase; color: rgba(255,255,255,0.45);
  }
  .yd-pl-foot-btn {
    display: block; width: 100%;
    padding: 8px 10px;
    border-radius: 9px;
    font-size: 12px; font-weight: 600;
    text-align: left;
    background: transparent;
    color: rgba(255,255,255,0.72);
    border: 1px solid rgba(255,255,255,0.14);
    cursor: pointer;
    font-family: inherit;
    text-decoration: none;
  }
  .yd-pl-foot-btn + .yd-pl-foot-btn { margin-top: 6px; }
  .yd-pl-foot-btn:hover { background: rgba(255,255,255,0.07); color: #FFFFFF; }
  .yd-pl-main { flex: 1; min-width: 0; overflow-y: auto; padding: 28px 32px; }
  @media (max-width: 860px) {
    .yd-pl-rail { width: 64px; padding: 16px 8px; }
    .yd-pl-brand-text, .yd-pl-link span:last-child, .yd-pl-who { display: none; }
    .yd-pl-link { justify-content: center; }
    .yd-pl-main { padding: 20px 16px; }
  }
`;

export default function PlatformLayout({ children }) {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    try {
      await logout();
    } catch {
      navigate("/platform/login", { replace: true });
    }
  }

  return (
    <ToastProvider>
      <style>{CSS}</style>
      <div className="yd-pl-root">
        <aside className="yd-pl-rail">
          <div className="yd-pl-brand">
            <div className="yd-pl-brand-mark">⚙️</div>
            <div className="yd-pl-brand-text">
              <div className="yd-pl-brand-title">KUE BOXS</div>
              <div className="yd-pl-brand-sub">Platform</div>
            </div>
          </div>

          <nav className="yd-pl-nav">
            {NAV.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `yd-pl-link${isActive ? " active" : ""}`}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="yd-pl-foot">
            <div className="yd-pl-who">
              <div className="yd-pl-who-name">{user?.name || user?.email || "—"}</div>
              <div className="yd-pl-who-role">{role || "unknown"}</div>
            </div>
            {/* The console is a different job from running a school, but it is
                the same person and the same session — this is a context switch,
                not a second sign-in. */}
            <a className="yd-pl-foot-btn" href="/">← School app</a>
            <button className="yd-pl-foot-btn" onClick={handleSignOut}>Sign out</button>
          </div>
        </aside>

        <main className="yd-pl-main">{children}</main>
      </div>
    </ToastProvider>
  );
}
