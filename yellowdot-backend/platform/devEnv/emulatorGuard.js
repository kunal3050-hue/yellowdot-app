/**
 * emulatorGuard.js — the safety interlock for local development
 * ─────────────────────────────────────────────────────────────────────
 * "No seed script should ever be able to write to production accidentally."
 *
 * This module is the single place that answers "am I talking to the emulator?"
 * and the only thing standing between a seed script and real children's data.
 *
 * ── Defence in depth: four independent conditions ─────────────────────────
 *
 *   1. DEMO PROJECT ID (the structural one)
 *      The emulator project is `demo-kueboxs`. Firebase SDKs treat any
 *      `demo-` prefixed project as OFFLINE-ONLY and refuse to contact real
 *      Google services for it — even with valid credentials and no emulator
 *      running. This is the guard that holds when every other check is
 *      misconfigured, because it is enforced by the SDK, not by us.
 *
 *   2. FIRESTORE_EMULATOR_HOST points at a loopback address.
 *
 *   3. FIREBASE_AUTH_EMULATOR_HOST points at a loopback address.
 *
 *   4. NO REAL CREDENTIALS in the environment. If FIREBASE_SERVICE_ACCOUNT or
 *      GOOGLE_APPLICATION_CREDENTIALS is set, a misconfigured host variable
 *      could reach production — so their mere presence fails the check.
 *
 * A destructive script must call assertEmulatorOnly() BEFORE it touches
 * anything. The check throws; it never warns and continues.
 */

const LOOPBACK = ["127.0.0.1", "localhost", "0.0.0.0", "[::1]", "::1"];

const DEMO_PROJECT_PREFIX = "demo-";

/** The project id the Admin SDK will actually use. */
function resolvedProjectId() {
  return (
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    ""
  );
}

function hostIsLoopback(hostPort) {
  if (!hostPort) return false;
  const host = String(hostPort).split(":").slice(0, -1).join(":") || String(hostPort);
  return LOOPBACK.includes(host);
}

/** Every signal, for diagnostics and for the checks below. */
function emulatorStatus() {
  const projectId = resolvedProjectId();
  return {
    projectId,
    isDemoProject:  projectId.startsWith(DEMO_PROJECT_PREFIX),
    firestoreHost:  process.env.FIRESTORE_EMULATOR_HOST || null,
    authHost:       process.env.FIREBASE_AUTH_EMULATOR_HOST || null,
    firestoreLocal: hostIsLoopback(process.env.FIRESTORE_EMULATOR_HOST),
    authLocal:      hostIsLoopback(process.env.FIREBASE_AUTH_EMULATOR_HOST),
    hasRealCreds:   Boolean(
      process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS,
    ),
  };
}

/** True only when every condition for a safe emulator session holds. */
function isEmulator() {
  const s = emulatorStatus();
  return s.isDemoProject && s.firestoreLocal && s.authLocal && !s.hasRealCreds;
}

/**
 * Hard gate for anything that WRITES. Throws unless this process is provably
 * talking to a local emulator on a demo project.
 *
 * @param {string} label  what is being guarded, used in the error message
 */
function assertEmulatorOnly(label = "this script") {
  const s = emulatorStatus();
  if (isEmulator()) return s;

  const reasons = [];
  if (!s.isDemoProject) {
    reasons.push(
      `  ✗ project id is "${s.projectId || "(unset)"}" — must start with "${DEMO_PROJECT_PREFIX}".\n` +
      `    A non-demo project id means the SDK is willing to talk to REAL Firebase.`,
    );
  }
  if (!s.firestoreLocal) {
    reasons.push(`  ✗ FIRESTORE_EMULATOR_HOST is "${s.firestoreHost || "(unset)"}" — must be a loopback address.`);
  }
  if (!s.authLocal) {
    reasons.push(`  ✗ FIREBASE_AUTH_EMULATOR_HOST is "${s.authHost || "(unset)"}" — must be a loopback address.`);
  }
  if (s.hasRealCreds) {
    reasons.push(
      "  ✗ real credentials are present (FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS).\n" +
      "    Unset them for emulator work — their presence alone makes a\n" +
      "    misconfigured host variable capable of reaching production.",
    );
  }

  throw new Error(
    `\n╔══════════════════════════════════════════════════════════════════╗\n` +
    `║  REFUSING TO RUN — ${label} is not pointed at the emulator.\n` +
    `╚══════════════════════════════════════════════════════════════════╝\n` +
    `${reasons.join("\n")}\n\n` +
    `  This guard exists so a seed script can never write to production.\n` +
    `  Start the emulator environment with:\n\n` +
    `      npm run dev:local        (from the repo root)\n\n` +
    `  or set the variables manually:\n\n` +
    `      GCLOUD_PROJECT=demo-kueboxs\n` +
    `      FIRESTORE_EMULATOR_HOST=127.0.0.1:8080\n` +
    `      FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099\n`,
  );
}

/**
 * Startup gate for the SERVER (not just seed scripts).
 *
 * Refuses to boot when APP_ENV says development but the process is wired to a
 * real Firebase project — the exact configuration this repo shipped with,
 * where local dev read and wrote live production data without saying so.
 *
 * Deliberately narrow: it only fires for APP_ENV=development, so production
 * and staging boots are untouched. `ALLOW_PROD_FROM_DEV=true` is the explicit,
 * greppable escape hatch for the rare case of debugging against real data.
 */
function assertDevNotPointedAtProduction() {
  const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "development";
  if (appEnv !== "development") return;          // only guards local dev
  if (isEmulator()) return;                      // emulator — safe
  if (process.env.ALLOW_PROD_FROM_DEV === "true") {
    console.warn(
      "\n⚠️  ALLOW_PROD_FROM_DEV=true — running in development against a REAL\n" +
      `   Firebase project ("${resolvedProjectId() || "default"}"). Live data is reachable.\n`,
    );
    return;
  }

  throw new Error(
    `\n╔══════════════════════════════════════════════════════════════════╗\n` +
    `║  REFUSING TO START — APP_ENV=development, but this process is\n` +
    `║  configured to reach a REAL Firebase project.\n` +
    `╚══════════════════════════════════════════════════════════════════╝\n` +
    `  project id: ${resolvedProjectId() || "(default from credentials)"}\n\n` +
    `  Use the emulator:            npm run dev:local   (from the repo root)\n` +
    `  Or, to do this deliberately: ALLOW_PROD_FROM_DEV=true npm run dev\n`,
  );
}

module.exports = {
  isEmulator,
  emulatorStatus,
  assertEmulatorOnly,
  assertDevNotPointedAtProduction,
  DEMO_PROJECT_ID: "demo-kueboxs",
};
