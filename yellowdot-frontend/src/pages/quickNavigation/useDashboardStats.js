/**
 * useDashboardStats.js — "Today's Overview" metrics for Control Center.
 * ─────────────────────────────────────────────────────────────────────
 * Reuses the exact same endpoints LiveDashboard.jsx already calls
 * (/students, /api/attendance/summary, /api/pickup-requests,
 * /api/invoices) — no new API surface, just a second consumer of
 * existing data. Failures are non-blocking (Promise.allSettled), same
 * resilience pattern as LiveDashboard.
 *
 * Birthdays are derived client-side from the already-fetched student
 * list's DOB field (same format LiveDashboard/PersonalInfo already
 * parse) — not a new API call, just a filter over data already in hand.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../services/authService";

const get = (url) => api.get(url).then(r => r.data);
const todayISO = () => new Date().toISOString().slice(0, 10);

function parseDOB(dob) {
  if (!dob) return null;
  const iso = dob.includes("/") ? dob.split("/").reverse().join("-") : dob;
  const d = new Date(iso);
  return isNaN(d) ? null : d;
}

export default function useDashboardStats() {
  const [stats, setStats] = useState({
    attendancePct: null, presentToday: null, pendingPickups: null,
    outstandingFees: null, birthdaysToday: null,
  });
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchAll = useCallback(async () => {
    const d = todayISO();
    const [stuRes, sumRes, pickupRes, invRes] = await Promise.allSettled([
      get("/students"),
      get(`/api/attendance/summary?date=${d}`),
      get("/api/pickup-requests?status=pending"),
      get("/api/invoices"),
    ]);
    if (!mountedRef.current) return;

    const students = stuRes.status === "fulfilled"
      ? (Array.isArray(stuRes.value) ? stuRes.value : (stuRes.value?.students || []))
      : [];
    const totalStudents = students.length || null;

    const present = (sumRes.status === "fulfilled" && sumRes.value?.success)
      ? sumRes.value.summary?.present ?? null
      : null;
    const attendancePct = (totalStudents && present != null)
      ? Math.round((present / totalStudents) * 100) + "%"
      : null;

    const pendingPickups = (pickupRes.status === "fulfilled" && pickupRes.value?.success)
      ? (pickupRes.value.count ?? (pickupRes.value.requests || []).length)
      : null;

    const invoices = (invRes.status === "fulfilled" && invRes.value?.success)
      ? (invRes.value.invoices || [])
      : null;
    const outstandingFees = invoices
      ? invoices
          .filter(i => ["Pending", "Partial", "Overdue"].includes(i.status))
          .reduce((s, i) => s + (Number(i.balance) || 0), 0)
      : null;

    const today = new Date();
    const birthdaysToday = students.filter(s => {
      const dob = parseDOB(s.DOB);
      return dob && dob.getMonth() === today.getMonth() && dob.getDate() === today.getDate();
    }).length;

    setStats({ attendancePct, presentToday: present, pendingPickups, outstandingFees, birthdaysToday });
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchAll();
    return () => { mountedRef.current = false; };
  }, [fetchAll]);

  return { ...stats, loading };
}
