/**
 * index.js — the Service Registry
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §5A — docs/platform-architecture/PLATFORM_ARCHITECTURE.md
 *
 * Consumers resolve a service by id, never by import path:
 *
 *     const attendance = useService("attendance");
 *     const summary    = await attendance.reads.summary({ date });
 *
 * `scope` is injected automatically (§2c.1), so a caller cannot forget it, and
 * a cross-module read is an explicit, greppable `useService("finance")` rather
 * than a quiet `import ../finance/service`.
 *
 * ── Deliberately small ────────────────────────────────────────────────────
 * This is a map plus an in-flight dedup table. It is NOT a new engine, and per
 * the architecture freeze it must not grow into one: caching policy, retries
 * and offline behaviour are explicitly out of scope until something real needs
 * them.
 */
import { useMemo } from "react";
import { usePermissions } from "../permissions/usePermissions.js";
import { ServiceError } from "./defineService.js";
import SERVICES from "./services.js";

const REGISTRY = Object.fromEntries(SERVICES.map(s => [s.id, s]));

export function getService(id) {
  return REGISTRY[id] ?? null;
}

export function listServices() {
  return Object.values(REGISTRY);
}

// ── In-flight dedup ───────────────────────────────────────────────────────────
// Two widgets needing the same read in the same tick issue ONE request. Entries
// are removed as soon as the promise settles: this deduplicates concurrent
// callers, it does not cache results. Caching stale data across a session is
// exactly what §3f forbids.
const _inflight = new Map();

function dedupKey(serviceId, readName, args) {
  let argPart;
  try {
    argPart = JSON.stringify(args ?? {});
  } catch {
    argPart = String(Date.now());   // unserialisable args → never dedup
  }
  return `${serviceId}:${readName}:${argPart}`;
}

/**
 * Invoke a registered read with scope injected, deduped and error-normalised.
 * Exported for non-React callers (task providers, tests); components use
 * useService().
 */
export function callRead(serviceId, readName, args = {}, scope = null) {
  const service = REGISTRY[serviceId];
  if (!service) {
    return Promise.reject(new ServiceError(`Unknown service "${serviceId}"`, { code: "NO_SUCH_SERVICE" }));
  }
  const read = service.reads[readName];
  if (!read) {
    return Promise.reject(
      new ServiceError(`Service "${serviceId}" has no read "${readName}"`, { code: "NO_SUCH_READ" }),
    );
  }

  // scope is part of the identity of a read: the same query under a different
  // branch is a different request and must not be deduped together.
  const key = dedupKey(serviceId, readName, { ...args, __scope: scope?.branchIds ?? null });
  if (_inflight.has(key)) return _inflight.get(key);

  const promise = Promise.resolve()
    .then(() => read({ ...args, scope }))
    .catch(err => { throw ServiceError.from(err); })
    .finally(() => { _inflight.delete(key); });

  _inflight.set(key, promise);
  return promise;
}

/**
 * React accessor. Returns the service with its reads pre-bound to the caller's
 * scope, so a component never assembles scope by hand.
 */
export function useService(serviceId) {
  const { scope } = usePermissions();

  return useMemo(() => {
    const service = REGISTRY[serviceId];
    if (!service) {
      throw new Error(
        `useService("${serviceId}") — not registered. Add it to platform/services/services.js.`,
      );
    }
    const reads = Object.fromEntries(
      Object.keys(service.reads).map(name => [
        name,
        (args = {}) => callRead(serviceId, name, args, scope),
      ]),
    );
    return { id: service.id, capability: service.capability, reads };
  }, [serviceId, scope]);
}

export { ServiceError };
export { defineService } from "./defineService.js";
