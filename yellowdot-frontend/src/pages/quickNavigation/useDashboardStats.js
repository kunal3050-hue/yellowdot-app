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
 *
 * Admissions-this-week is derived the same way, from each student's
 * Admission_Date (studentService.js's PascalCase projection of the raw
 * `admissionDate` field) — replacing what was a hardcoded "3" with no
 * backend source at all (staff review finding C1, 2026-07-30).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { callRead } from "../../platform/services";

const todayISO = () => new Date().toISOString().slice(0, 10);

function parseDOB(dob) {
  if (!dob) return null;
  const iso = dob.includes("/") ? dob.split("/").reverse().join("-") : dob;
  const d = new Date(iso);
  return isNaN(d) ? null : d;
}

// Admission_Date has been observed as either ISO (YYYY-MM-DD) or DD/MM/YYYY —
// same ambiguity as DOB, so it gets the same slash-aware parse.
const parseAdmissionDate = parseDOB;

export default function useDashboardStats() {
  const [stats, setStats] = useState({
    attendancePct: null, presentToday: null, pendingPickups: null,
    outstandingFees: null, birthdaysToday: null, admissionsThisWeek: null,
  });
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchAll = useCallback(async () => {
    const d = todayISO();
    // Registry reads (§5A) — same four endpoints, same query strings, now
    // resolved through registered services instead of raw api.get. The *Raw
    // variants are used deliberately: the envelope is what lets a failed
    // request render "—" rather than a misleading 0.
    const [stuRes, sumRes, pickupRes, invRes] = await Promise.allSettled([
      callRead("students",   "listRaw"),
      callRead("attendance", "summary",  { date: d }),
      callRead("pickup_auth", "requests", { status: "pending" }),
      callRead("invoices",   "listRaw"),
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

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const admissionsThisWeek = students.length ? students.filter(s => {
      const admitted = parseAdmissionDate(s.Admission_Date);
      return admitted && admitted >= sevenDaysAgo && admitted <= today;
    }).length : null;

    setStats({
      attendancePct, presentToday: present, pendingPickups, outstandingFees,
      birthdaysToday, admissionsThisWeek,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchAll();
    return () => { mountedRef.current = false; };
  }, [fetchAll]);

  return { ...stats, loading };
}
