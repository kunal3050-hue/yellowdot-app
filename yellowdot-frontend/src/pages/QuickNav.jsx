import { Link } from "react-router-dom";

const todayLabel = () =>
  new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

/* ── Micro SVG icon factory ─────────────────────────────────────────────── */
const I = ({ d, size = 16 }) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
    strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"
    width={size} height={size}>{d}</svg>
);

const ICONS = {
  Home:        () => <I d={<><path d="M3 9.5L10 3l7 6.5V17a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M7 18v-7h6v7"/></>} />,
  Users:       () => <I d={<><circle cx="8" cy="6.5" r="2.8"/><path d="M2 18a6 6 0 0112 0"/><circle cx="15" cy="7" r="2"/><path d="M15 12c2 .5 3.2 2 3.2 4.5"/></>} />,
  Briefcase:   () => <I d={<><rect x="2" y="7" width="16" height="11" rx="2"/><path d="M13 7V5a2 2 0 00-2-2H9a2 2 0 00-2 2v2"/><path d="M2 12h16"/></>} />,
  Shield:      () => <I d={<><path d="M10 2L3 5.5V10c0 4 3.1 7.2 7 8 3.9-.8 7-4 7-8V5.5L10 2z"/><path d="M7 10l2 2 4-4"/></>} />,
  CreditCard:  () => <I d={<><rect x="2" y="5" width="16" height="12" rx="2"/><path d="M2 9h16"/><path d="M6 13h2"/></>} />,
  FileText:    () => <I d={<><path d="M4 3h8l4 4v11a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M12 3v4h4"/><path d="M7 9h6M7 12h6M7 15h4"/></>} />,
  BarChart:    () => <I d={<><path d="M2 16l4.5-7 3.2 4.5 2.8-8L17 16"/><path d="M2 16h16"/></>} />,
  Calendar:    () => <I d={<><rect x="3" y="4" width="14" height="14" rx="2"/><path d="M13 2v4M7 2v4M3 8h14"/><path d="M7 12l2 2 4-4"/></>} />,
  Moon:        () => <I d={<><path d="M17.5 12A7.5 7.5 0 019 3.5a7.5 7.5 0 100 13A7.5 7.5 0 0117.5 12z"/></>} />,
  Utensils:    () => <I d={<><path d="M7 3v5a3 3 0 006 0V3"/><path d="M10 8v9"/><path d="M15 3v14"/></>} />,
  Clipboard:   () => <I d={<><rect x="4" y="4" width="12" height="14" rx="2"/><path d="M8 4V3h4v1"/><path d="M7 9h6M7 12h6M7 15h4"/></>} />,
  Bell:        () => <I d={<><path d="M10 2a6 6 0 016 6c0 3.5.8 5.5 1.5 6.5H2.5C3.2 13.5 4 11.5 4 8a6 6 0 016-6z"/><path d="M8.5 17.5a1.5 1.5 0 003 0"/></>} />,
  CalendarDays:() => <I d={<><rect x="3" y="4" width="14" height="14" rx="2"/><path d="M13 2v4M7 2v4M3 8h14M7 12h.01M10 12h.01M13 12h.01M7 15h.01M10 15h.01"/></>} />,
  Megaphone:   () => <I d={<><path d="M3 9v2a1 1 0 001 1h1l2 4h1V9"/><path d="M7 9V6.5L17 4v12L7 13.5V9z"/><circle cx="5" cy="10" r=".5" fill="currentColor"/></>} />,
  CheckSquare: () => <I d={<><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M7 10l2.5 2.5L13 8"/></>} />,
  Car:         () => <I d={<><rect x="2" y="9" width="16" height="8" rx="2"/><path d="M4 9l2-4h8l2 4"/><circle cx="6" cy="15" r="1.5" fill="currentColor"/><circle cx="14" cy="15" r="1.5" fill="currentColor"/></>} />,
  LogOut:      () => <I d={<><path d="M13 3h4v14h-4"/><path d="M9 14l4-4-4-4"/><path d="M13 10H3"/></>} />,
  QrCode:      () => <I d={<><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="3" width="6" height="6" rx="1"/><rect x="3" y="11" width="6" height="6" rx="1"/><path d="M11 14h2M14 11h3v3M14 17h3"/></>} />,
  Video:       () => <I d={<><path d="M2 6a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/><path d="M16 8.5l4-2v7l-4-2V8.5z"/></>} />,
  Camera:      () => <I d={<><path d="M2 7a2 2 0 012-2h1.5l1.5-2h6l1.5 2H17a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V7z"/><circle cx="10" cy="11" r="3"/></>} />,
  Settings:    () => <I d={<><circle cx="10" cy="10" r="2.5"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4"/></>} />,
  Grid:        () => <I d={<><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="3" width="6" height="6" rx="1"/><rect x="3" y="11" width="6" height="6" rx="1"/><rect x="11" y="11" width="6" height="6" rx="1"/></>} />,
  Sliders:     () => <I d={<><path d="M4 6h12M4 10h12M4 14h12"/><circle cx="8" cy="6" r="1.5" fill="#fff" stroke="currentColor"/><circle cx="13" cy="10" r="1.5" fill="#fff" stroke="currentColor"/><circle cx="7" cy="14" r="1.5" fill="#fff" stroke="currentColor"/></>} />,
};

/* ── All sections with their modules ───────────────────────────────────── */
const SECTIONS = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { label: "Live Dashboard", path: "/live-dashboard", icon: "Home",  desc: "Real-time school activity" },
    ],
  },
  {
    id: "people",
    label: "People",
    items: [
      { label: "Students",           path: "/students",          icon: "Users",      desc: "Profiles & enrolment" },
      { label: "Staff",              path: "/user-management",   icon: "Briefcase",  desc: "Team management" },
      { label: "Roles & Permissions",path: "/roles-permissions", icon: "Shield",     desc: "Access control" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      { label: "Fees",     path: "/fees",      icon: "CreditCard", desc: "Collection & dues" },
      { label: "Invoices", path: "/invoice",   icon: "FileText",   desc: "Billing & payments" },
      { label: "Analytics",path: "/analytics", icon: "BarChart",   desc: "Reports & trends" },
    ],
  },
  {
    id: "daily_ops",
    label: "Daily Ops",
    items: [
      { label: "Attendance",       path: "/attendance",       icon: "Calendar",   desc: "Mark & track daily" },
      { label: "Nap Tracker",      path: "/nap-tracker",      icon: "Moon",       desc: "Sleep schedules" },
      { label: "Food Menu",        path: "/food-menu",        icon: "Utensils",   desc: "Meal planning" },
      { label: "Consumption Log",  path: "/food-consumption", icon: "Clipboard",  desc: "Intake records" },
    ],
  },
  {
    id: "communications",
    label: "Communications",
    items: [
      { label: "Holidays",      path: "/holidays",      icon: "CalendarDays", desc: "Academic calendar" },
      { label: "Notices",       path: "/notices",       icon: "Bell",         desc: "School notices" },
      { label: "Announcements", path: "/announcements", icon: "Megaphone",    desc: "Broadcast messages" },
    ],
  },
  {
    id: "presence",
    label: "Presence & Safety",
    items: [
      { label: "Parent Entry",   path: "/parent-checkin",       icon: "CheckSquare", desc: "Gate check-in" },
      { label: "Pickup",         path: "/pickup-authorization", icon: "Car",         desc: "Authorised pickups" },
      { label: "Staff Checkout", path: "/staff-checkout",       icon: "LogOut",      desc: "End-of-day sign-off" },
      { label: "QR Management",  path: "/qr-management",        icon: "QrCode",      desc: "Generate & print QR" },
    ],
  },
  {
    id: "surveillance",
    label: "Surveillance",
    items: [
      { label: "CCTV", path: "/cctv", icon: "Video", desc: "Camera management" },
    ],
  },
  {
    id: "system",
    label: "Settings",
    items: [
      { label: "Settings", path: "/settings", icon: "Settings", desc: "App preferences" },
    ],
  },
];

/* ── Single nav card ────────────────────────────────────────────────────── */
function NavCard({ item, index }) {
  const Icon = ICONS[item.icon] || ICONS.Grid;

  return (
    <Link
      to={item.path}
      style={{ textDecoration: "none" }}
    >
      <div
        className="qn-card"
        style={{ animationDelay: `${index * 38}ms` }}
      >
        <div className="qn-icon-wrap">
          <Icon />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="qn-label">{item.label}</div>
          <div className="qn-desc">{item.desc}</div>
        </div>
        <svg className="qn-arrow" viewBox="0 0 12 12" fill="none" stroke="currentColor"
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          width="11" height="11">
          <path d="M2 6h8M7 3l3 3-3 3"/>
        </svg>
      </div>
    </Link>
  );
}

/* ── Section block ──────────────────────────────────────────────────────── */
function Section({ section, startIndex }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div className="qn-section-header">
        <span>{section.label}</span>
      </div>
      <div className="qn-grid">
        {section.items.map((item, i) => (
          <NavCard key={item.path} item={item} index={startIndex + i} />
        ))}
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function QuickNav() {
  let cardIndex = 0;

  return (
    <>
      <style>{`
        @keyframes qn-fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .qn-card {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 14px 16px;
          background: #FFFFFF;
          border: 1px solid #F0EDE8;
          border-radius: 14px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 0 0 0 rgba(245,197,24,0);
          transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease, background 180ms ease;
          cursor: pointer;
          animation: qn-fade-up 340ms ease both;
          will-change: transform;
        }
        .qn-card:hover {
          border-color: #F5C518;
          background: #FFFEF7;
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(245,197,24,0.14), 0 1px 4px rgba(0,0,0,0.06);
        }
        .qn-card:hover .qn-icon-wrap {
          background: #FEF9C3;
          color: #A16207;
        }
        .qn-card:hover .qn-arrow {
          opacity: 1;
          transform: translateX(2px);
          color: #D97706;
        }
        .qn-card:hover .qn-label {
          color: #78350F;
        }

        .qn-icon-wrap {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #F5F3EF;
          color: #6B6057;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 180ms ease, color 180ms ease;
        }

        .qn-label {
          font-size: 13.5px;
          font-weight: 600;
          color: #1C1917;
          letter-spacing: -0.01em;
          transition: color 180ms ease;
        }

        .qn-desc {
          font-size: 11px;
          color: #A8A29E;
          margin-top: 2px;
          font-weight: 400;
          letter-spacing: 0;
        }

        .qn-arrow {
          opacity: 0;
          flex-shrink: 0;
          transition: opacity 180ms ease, transform 180ms ease, color 180ms ease;
          color: #C4B5A5;
        }

        .qn-section-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }
        .qn-section-header span {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #C4B5A5;
        }
        .qn-section-header::after {
          content: "";
          flex: 1;
          height: 1px;
          background: #F0EDE8;
        }

        .qn-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
          gap: 8px;
        }

        @media (max-width: 600px) {
          .qn-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
        @media (max-width: 400px) {
          .qn-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div style={{ maxWidth: 1060, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <h1 style={{
            fontSize: "clamp(20px, 3.5vw, 26px)",
            fontWeight: 700,
            color: "#1C1917",
            letterSpacing: "-0.025em",
            margin: "0 0 5px",
            lineHeight: 1.2,
          }}>
            Quick Navigation
          </h1>
          <p style={{
            fontSize: 13,
            color: "#A8A29E",
            fontWeight: 400,
            margin: 0,
            letterSpacing: "0.01em",
          }}>
            {todayLabel()}
          </p>
        </div>

        {/* Sections */}
        {SECTIONS.map(section => {
          const si = cardIndex;
          cardIndex += section.items.length;
          return <Section key={section.id} section={section} startIndex={si} />;
        })}

      </div>
    </>
  );
}
