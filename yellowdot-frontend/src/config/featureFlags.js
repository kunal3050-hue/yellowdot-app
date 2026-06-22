/**
 * featureFlags.js — controls which modules/features are enabled per environment.
 *
 * Workflow:
 *   1. Build & test a new module in Yellow Dot (development | staging).
 *   2. Once approved, flip its flag to `true` so it ships in the next
 *      production (KUE Boxs Care) build.
 *
 * Usage:
 *   import { isEnabled } from '../config/featureFlags';
 *   if (!isEnabled('DAILY_CARE')) return null;
 *
 *   // or as a hook (same value, React-friendly name):
 *   import { useFeatureFlag } from '../config/featureFlags';
 *   const hasDailyCare = useFeatureFlag('DAILY_CARE');
 */

import { isPreProduction } from './environment';

// ── Flag registry ─────────────────────────────────────────────────────────────
// true  = enabled in ALL environments (including production)
// false = disabled everywhere
// isPreProduction = enabled only in development / staging (Yellow Dot)

export const FLAGS = {
  // ── Core — always on ─────────────────────────────────────────────────────
  STUDENTS:           true,
  ATTENDANCE:         true,
  FEES:               true,
  INVOICES:           true,

  // ── Approved for production ───────────────────────────────────────────────
  NOTIFICATIONS:      true,
  GATE_MANAGEMENT:    true,
  PARENT_PORTAL:      true,
  FAMILY_MODULE:      true,
  CHILD_PRESENCE:     true,
  PICKUP_REQUEST:     true,

  // ── In development — Yellow Dot only ─────────────────────────────────────
  // Flip to `true` when approved for production rollout.
  DAILY_CARE:         isPreProduction,
  HIGHLIGHTS:         isPreProduction,
  LIVE_DASHBOARD:     isPreProduction,
  STUDENT_REPORTS_V2: isPreProduction,
  CHILD_JOURNEY:      isPreProduction,

  // ── Coming soon — not yet built ───────────────────────────────────────────
  MESSAGING:          false,
  TIMETABLE:          false,
  PAYROLL:            false,
};

// Explicit scope groups for display in Settings — decoupled from runtime boolean
// so the "Yellow Dot only" group shows correctly even in a dev build where
// isPreProduction is true (making those flags indistinguishable from always-on).
export const FLAG_GROUPS = {
  production: ['STUDENTS', 'ATTENDANCE', 'FEES', 'INVOICES', 'NOTIFICATIONS',
               'GATE_MANAGEMENT', 'PARENT_PORTAL', 'FAMILY_MODULE', 'CHILD_PRESENCE', 'PICKUP_REQUEST'],
  staging:    ['DAILY_CARE', 'HIGHLIGHTS', 'LIVE_DASHBOARD', 'STUDENT_REPORTS_V2', 'CHILD_JOURNEY'],
  planned:    ['MESSAGING', 'TIMETABLE', 'PAYROLL'],
};

/**
 * Returns true if the named feature flag is enabled in the current environment.
 * Unknown flags default to false (fail-closed).
 */
export function isEnabled(flag) {
  return FLAGS[flag] ?? false;
}

/**
 * React-friendly alias for isEnabled — call at the top of a component.
 * Returns the same boolean; no async loading needed (flags are compile-time).
 */
export function useFeatureFlag(flag) {
  return FLAGS[flag] ?? false;
}
