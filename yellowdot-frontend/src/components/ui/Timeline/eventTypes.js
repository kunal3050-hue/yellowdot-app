/**
 * eventTypes.js — default colored event-type config for Timeline
 * Consumers can override/extend via the `eventTypeConfig` prop; these are
 * just sensible defaults covering the timelines named in the design brief
 * (Student Journey, Attendance, Pickup, Incidents, Medical, Communication,
 * Audit Logs, generic Activity).
 */
import {
  UserCheck, LogOut, AlertTriangle, HeartPulse, MessageSquare,
  ScrollText, Activity, Car,
} from "lucide-react";

export const DEFAULT_EVENT_TYPES = {
  attendance:     { icon: UserCheck,     color: "var(--yd-success)", bg: "var(--yd-success-soft)" },
  pickup:         { icon: Car,           color: "var(--yd-info)",    bg: "var(--yd-info-soft)" },
  checkout:       { icon: LogOut,        color: "var(--yd-text-soft)", bg: "var(--yd-soft)" },
  incident:       { icon: AlertTriangle, color: "var(--yd-danger)",  bg: "var(--yd-danger-soft)" },
  medical:        { icon: HeartPulse,    color: "var(--yd-danger)",  bg: "var(--yd-danger-soft)" },
  communication:  { icon: MessageSquare, color: "var(--yd-info)",    bg: "var(--yd-info-soft)" },
  audit:          { icon: ScrollText,    color: "var(--yd-text-soft)", bg: "var(--yd-soft)" },
  default:        { icon: Activity,      color: "var(--yd-text-muted)", bg: "var(--yd-soft)" },
};

export function resolveEventType(type, overrides) {
  return overrides?.[type] || DEFAULT_EVENT_TYPES[type] || DEFAULT_EVENT_TYPES.default;
}
