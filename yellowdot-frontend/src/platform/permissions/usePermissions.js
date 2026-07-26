/**
 * usePermissions.js — the Permission Engine's single entry point
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §2 — docs/platform-architecture/PLATFORM_ARCHITECTURE.md
 *
 * Wraps the three independent gates (§2c) behind one hook, so a call site
 * never assembles them by hand and never checks a role name:
 *
 *     visible = isEnabled(flag) && can(capability) && inScope(scope, row)
 *
 *     const { can, level, scope, isEnabled } = usePermissions();
 *
 *     can("attendance.view")                 // boolean
 *     can("attendance.*")                    // any action on the module
 *     can(["fees.view", "invoices.view"])    // any-of
 *     can("staff_payroll.view", "team")      // at least team-level
 *     level("staff_payroll.view")            // "none" | "self" | "team" | "all"
 *
 * ── Additive, by design ───────────────────────────────────────────────────
 * Nothing here changes behaviour. It reads the same `roleMatrix` AuthContext
 * already holds, through the same bypass rules, and is a strict superset of
 * what `canDo()` does today. Existing screens keep working untouched; new code
 * uses this instead of reaching into AuthContext internals.
 */
import { useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { isEnabled as isFlagEnabled } from "../../config/featureFlags";
import { checkCapability, resolveLevel, MIN_GRANTED } from "./capabilities.js";

/**
 * Derive the caller's data scope (§2c gate 3).
 *
 * PHASE 1 NOTE: assembled client-side from fields the session already carries.
 * §12 Phase 2 replaces this with a server-resolved `scope` object on
 * /api/auth/me — at which point this function reads that instead of deriving.
 * Consumers should not need to change when it does.
 *
 * `classIds` is present but always empty: the frozen decision (Q4) is
 * branch-level scope in v1, with class-level deferred until a module needs it.
 */
const EMPTY_SCOPE = {
  platform: false, tenantId: null, schoolId: null,
  branchIds: [], departmentIds: [], classIds: [], teamIds: null, self: null,
};

function deriveScope(user) {
  if (!user) return EMPTY_SCOPE;

  const branchIds = user.activeCenter
    ? [user.activeCenter]
    : (Array.isArray(user.centers) && user.centers.length
        ? user.centers
        : (user.center ? [user.center] : []));

  return {
    ...EMPTY_SCOPE,
    tenantId: user.tenantId ?? user.schoolId ?? null,
    schoolId: user.schoolId ?? null,
    branchIds,
    self:     user.userId ?? null,
  };
}

export function usePermissions() {
  const { user, roleMatrix, can: legacyCan, permissions, features, serverScope } = useAuth();

  /**
   * `scope` is memoised separately, on PRIMITIVES.
   *
   * AuthContext declares `can` as a plain function in the component body, so it
   * has a new identity on every render — which means the combined memo below
   * recomputes every render too. That is harmless for the function members, but
   * a fresh `scope` OBJECT each render would invalidate every downstream
   * useMemo/useEffect keyed on it (useService, widget fetches), turning a
   * dependency array into a refetch loop. Keying on stable primitives makes the
   * object identity stable regardless of how often the outer memo re-runs.
   */
  const branchKey = Array.isArray(user?.centers) ? user.centers.join(",") : (user?.center ?? "");
  const scope = useMemo(
    () => serverScope ?? deriveScope(user),
    // `user` is intentionally absent: it is a fresh object on every /me
    // refresh, and the primitives below are the only parts scope reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [serverScope, user?.userId, user?.schoolId, user?.activeCenter, branchKey],
  );

  return useMemo(() => {
    const matrix = roleMatrix || {};

    /**
     * Capability check, with a legacy routeKey fallback.
     *
     * A capability contains a dot ("attendance.view"); a routeKey does not
     * ("attendance"). Bare strings are forwarded to AuthContext's existing
     * can(), so the 18 files still passing routeKeys behave EXACTLY as before
     * — this is what makes Phase 1 non-breaking. The fallback is removed in
     * §12 Phase 11, once no call site passes a routeKey.
     */
    const can = (capabilityOrRouteKey, required = MIN_GRANTED) => {
      if (Array.isArray(capabilityOrRouteKey)) {
        return capabilityOrRouteKey.some(c => can(c, required));
      }
      if (typeof capabilityOrRouteKey !== "string") return false;

      if (!capabilityOrRouteKey.includes(".")) {
        if (import.meta.env.DEV) {
          console.warn(
            `[usePermissions] "${capabilityOrRouteKey}" is a legacy routeKey. ` +
            `Prefer a capability such as "${capabilityOrRouteKey}.view" (§2b).`,
          );
        }
        return legacyCan(capabilityOrRouteKey);
      }
      return checkCapability(matrix, capabilityOrRouteKey, required);
    };

    const level = capability => resolveLevel(matrix, capability);

    /**
     * Feature-flag gate (§2c.2).
     *
     * Prefers the server's four-layer resolution, which is the only thing that
     * knows about this tenant's plan and overrides. Falls back to the
     * build-time flag ONLY when the server did not send a value for the key —
     * an older backend, or a flag the catalogue does not list yet. Since the
     * catalogue's defaults are seeded to today's build-time values, the two
     * agree flag-for-flag at cutover (asserted by verify:features).
     */
    const isEnabled = (flag) => {
      if (features && Object.prototype.hasOwnProperty.call(features, flag)) {
        return Boolean(features[flag]);
      }
      return isFlagEnabled(flag);
    };

    return {
      can,
      level,
      /** Server-resolved when available; client-derived otherwise (§2c.1). */
      scope,
      isEnabled,
      /** True when the flag set came from the server rather than the bundle. */
      featuresFromServer: Boolean(features),
      roleMatrix: matrix,
      /** Escape hatch for the few places still reasoning about routeKeys. */
      routeKeys: permissions,
    };
  }, [roleMatrix, permissions, legacyCan, features, scope]);
}

export default usePermissions;
