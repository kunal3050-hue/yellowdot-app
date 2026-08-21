/**
 * catalog.js — the feature flag catalogue (layer 1: platform defaults)
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §2c.2 — docs/platform-architecture/PLATFORM_ARCHITECTURE.md
 *
 * Resolution order (see resolveFeatures.js):
 *   1. kill switch      — platform says OFF, unconditionally
 *   2. tenant override  — explicit true/false on tenants/{id}.features
 *   3. plan grant       — the subscription plan's feature list
 *   4. platform default — defaultByEnv below
 *
 * ── Defaults-preserving migration ─────────────────────────────────────────
 * Every `defaultByEnv` below is seeded to EXACTLY what the frontend's
 * build-time featureFlags.js resolves today, per environment:
 *
 *   frontend `true`             → true in every environment
 *   frontend `isPreProduction`  → true in development/staging, false in production
 *   frontend `false`            → false in every environment
 *
 * verify-features.mjs asserts that equivalence flag by flag, so this file
 * cannot silently change what any tenant sees. `minPlan` is null everywhere at
 * cutover for the same reason — plan gating is switched on deliberately, per
 * flag, afterwards.
 */

const ALL       = { development: true,  staging: true,  production: true  };
const PRE_PROD  = { development: true,  staging: true,  production: false };
const OFF       = { development: false, staging: false, production: false };

/**
 * stage — internal → alpha → beta → ga → deprecated.
 * Drives UI labelling and support expectations, NOT access. A beta flag that
 * a tenant has been granted is fully on for them; the stage just says how
 * finished it is.
 */
const FEATURES = [
  // ── Core — always on, every plan ───────────────────────────────────────
  { key: "STUDENTS",           label: "Students",            stage: "ga", defaultByEnv: ALL,      minPlan: null },
  { key: "ATTENDANCE",         label: "Attendance",          stage: "ga", defaultByEnv: ALL,      minPlan: null },
  { key: "NOTIFICATIONS",      label: "Notifications",       stage: "ga", defaultByEnv: ALL,      minPlan: null },
  { key: "GATE_MANAGEMENT",    label: "Gate Management",     stage: "ga", defaultByEnv: ALL,      minPlan: null },
  { key: "PARENT_PORTAL",      label: "Parent Portal",       stage: "ga", defaultByEnv: ALL,      minPlan: null },
  { key: "FAMILY_MODULE",      label: "Families",            stage: "ga", defaultByEnv: ALL,      minPlan: null },
  { key: "CHILD_PRESENCE",     label: "Child Presence",      stage: "ga", defaultByEnv: ALL,      minPlan: null },
  { key: "PICKUP_REQUEST",     label: "Pickup Requests",     stage: "ga", defaultByEnv: ALL,      minPlan: null },
  // Approved for production rollout 2026-08-17, moved out of Pre-production below.
  { key: "DAILY_CARE",         label: "Daily Care",          stage: "ga", defaultByEnv: ALL,      minPlan: null },

  // ── Pre-production — on in dev/staging, off in production ──────────────
  { key: "HIGHLIGHTS",         label: "Highlights",          stage: "beta", defaultByEnv: PRE_PROD, minPlan: null },
  { key: "LIVE_DASHBOARD",     label: "Dashboard",           stage: "beta", defaultByEnv: PRE_PROD, minPlan: null },
  { key: "STUDENT_REPORTS_V2", label: "Student Reports V2",  stage: "beta", defaultByEnv: PRE_PROD, minPlan: null },
  { key: "CHILD_JOURNEY",      label: "Child Journey",       stage: "beta", defaultByEnv: PRE_PROD, minPlan: null },

  // ── Not yet built ──────────────────────────────────────────────────────
  { key: "MESSAGING",          label: "Parent Messaging",    stage: "internal", defaultByEnv: OFF, minPlan: null },
  { key: "TIMETABLE",          label: "Timetable",           stage: "internal", defaultByEnv: OFF, minPlan: null },
  { key: "PAYROLL",            label: "Payroll",             stage: "internal", defaultByEnv: OFF, minPlan: null },

  // ── Finance Platform ───────────────────────────────────────────────────
  // Live in production and currently gated by FINANCE_FOUNDATION_ENABLED.
  // `envVar` keeps that variable authoritative until tenant data is populated,
  // so this migration cannot turn Finance off for anyone. Removed once every
  // tenant carries an explicit features entry.

  // ── AI — §5E. Default OFF everywhere, per the data-protection constraint ─
  // Children's data under DPDP: enabling is a deliberate act by a school,
  // never a deployment default. Do not change this default without the
  // provider/residency/retention/consent decisions named in §5E.4.
  { key: "AI_INSIGHTS",        label: "AI Insights",         stage: "internal", defaultByEnv: OFF, minPlan: null },
];

const BY_KEY = Object.fromEntries(FEATURES.map(f => [f.key, f]));

/** Deployment tier, mirroring server.js's resolution order. */
function currentEnv() {
  const raw = process.env.APP_ENV || process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV || "development";
  if (raw === "production" || raw === "prod") return "production";
  if (raw === "staging") return "staging";
  return "development";
}

module.exports = { FEATURES, BY_KEY, currentEnv };
