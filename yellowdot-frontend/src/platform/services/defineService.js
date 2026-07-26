/**
 * defineService.js — Service Registry entry contract
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §5A — docs/platform-architecture/PLATFORM_ARCHITECTURE.md
 *
 * The 37 modules in src/services/ are NOT rewritten. This wraps them, because
 * the layer already exists — what was missing is that it gets bypassed
 * (useDashboardStats called `api.get` directly for four endpoints). Registration
 * is the fix, not replacement.
 *
 * Two service styles exist in the codebase and both are supported as-is:
 *   - default-export object of methods  (attendanceService, securityService)
 *   - named function exports            (incidentService, invoiceService)
 * A `reads` entry is just a function, so it can call either.
 *
 * ── What registration buys ────────────────────────────────────────────────
 *   scope injection — every read receives the caller's scope (§2c.1)
 *   dedup           — one in-flight request per (service, read, args)
 *   uniform errors  — a single ServiceError shape
 *   abort           — unmounting cancels
 * None of which 37 services should each reimplement.
 */

/** One error shape, so callers stop unwrapping three different envelopes. */
export class ServiceError extends Error {
  constructor(message, { status = null, code = null, retriable = false, cause = null } = {}) {
    super(message);
    this.name = "ServiceError";
    this.status = status;
    this.code = code;
    this.retriable = retriable;
    this.cause = cause;
  }

  /** Normalise an axios/fetch/plain failure into a ServiceError. */
  static from(err) {
    if (err instanceof ServiceError) return err;
    const status = err?.response?.status ?? null;
    return new ServiceError(
      err?.response?.data?.error || err?.message || "Request failed",
      {
        status,
        code: err?.code ?? null,
        // 5xx and network failures are worth retrying; 4xx are not.
        retriable: status == null || status >= 500,
        cause: err,
      },
    );
  }
}

/**
 * @param {object} def
 * @param {string} def.id          registry id, matches the Module Registry module id
 * @param {string} def.capability  baseline capability (§2a)
 * @param {object} def.reads       { name: (args) => Promise } — args include `scope`
 * @param {object} [def.writes]    { name: { capability?, fn } }
 */
export function defineService(def) {
  const where = `service "${def?.id ?? "(missing id)"}"`;

  if (!def?.id)      throw new Error(`Service registry: ${where} — 'id' is required`);
  if (!def.reads || typeof def.reads !== "object") {
    throw new Error(`Service registry: ${where} — 'reads' must be an object`);
  }
  for (const [name, fn] of Object.entries(def.reads)) {
    if (typeof fn !== "function") {
      throw new Error(`Service registry: ${where} — reads.${name} must be a function`);
    }
  }

  return Object.freeze({
    capability: `${def.id}.view`,
    writes: {},
    ...def,
  });
}
