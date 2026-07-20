/**
 * QuickActions — prominent one-tap shortcuts at the top of Control
 * Center, for the handful of things staff do constantly (add a
 * student, mark attendance, bill something, tell parents something).
 * Each button is RBAC-gated the same way as every ModuleCard.
 */
import { useNavigate } from "react-router-dom";
import { UserPlus, CalendarCheck, Wallet, FileText, Megaphone } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { Button } from "../../../components/ui";

const ACTIONS = [
  { id: "add_student",       label: "Add Student",       path: "/students/new",     routeKey: "students",      icon: UserPlus },
  { id: "mark_attendance",   label: "Mark Attendance",   path: "/attendance",       routeKey: "attendance",    icon: CalendarCheck },
  { id: "record_payment",    label: "Record Payment",    path: "/invoice",          routeKey: "invoice",       icon: Wallet },
  { id: "generate_invoice",  label: "Generate Invoice",  path: "/generate-invoice", routeKey: "invoice",       icon: FileText },
  { id: "send_announcement", label: "Send Announcement", path: "/announcements",    routeKey: "announcements", icon: Megaphone },
];

export default function QuickActions() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const visible = ACTIONS.filter(a => can(a.routeKey));

  if (visible.length === 0) return null;

  return (
    <section className="qnd-quickactions">
      {visible.map(a => (
        <Button
          key={a.id}
          variant="primary"
          size="lg"
          className="qnd-qa-btn"
          leftIcon={<a.icon size={16} strokeWidth={2} />}
          onClick={() => navigate(a.path)}
        >
          {a.label}
        </Button>
      ))}
    </section>
  );
}
