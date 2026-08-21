/**
 * QuickActions — prominent one-tap shortcuts at the top of Control
 * Center, for the handful of things staff do constantly (add a
 * student, mark attendance, bill something, tell parents something).
 *
 * Gated on granular CAPABILITIES ("students.create"), not the coarser
 * routeKey ("students") every ModuleCard uses. Staff review finding C3
 * (2026-07-30): "Add Student" checked only the VIEW-level routeKey, so it
 * appeared — and fully opened the 5-step admission wizard — for Teacher,
 * Reception and Accountant, none of whom hold students.create. can()
 * auto-detects a capability by the dot, so this is a data change only;
 * the routeKey path 18 other call sites still use is untouched.
 */
import { useNavigate } from "react-router-dom";
import { UserPlus, CalendarCheck, Wallet, FileText, Megaphone } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { Button } from "../../../components/ui";

const ACTIONS = [
  { id: "add_student",       label: "Add Student",       path: "/students/new",     capability: "students.create",     icon: UserPlus },
  { id: "mark_attendance",   label: "Mark Attendance",   path: "/attendance",       capability: "attendance.mark",     icon: CalendarCheck },
  { id: "send_announcement", label: "Send Announcement", path: "/announcements",    capability: "notifications.create", icon: Megaphone },
];

export default function QuickActions() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const visible = ACTIONS.filter(a => can(a.capability));

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
