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
function deriveScope(user) {
  if (!user) return { tenantId: null, schoolId: null, branchIds: [], classIds: [], self: null };

  const branchIds = user.activeCenter
    ? [user.activeCenter]
    : (Array.isArray(user.centers) && user.centers.length
        ? user.centers
        : (user.center ? [user.center] : []));

  return {
    tenantId:  user.tenantId ?? null,     // not yet issued by the backend — Phase 2
    schoolId:  user.schoolId ?? null,
    branchIds,
    classIds:  [],                        // Q4: branch-level in v1
    self:      user.userId ?? null,
  };
}

export function usePermissions() {
  const { user, roleMatrix, can: legacyCan, permissions } = useAuth();

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

    return {
      can,
      level,
      scope: deriveScope(user),
      /** Feature-flag gate. Phase 2 layers per-tenant features over this. */
      isEnabled: isFlagEnabled,
      roleMatrix: matrix,
      /** Escape hatch for the few places still reasoning about routeKeys. */
      routeKeys: permissions,
    };
  }, [user, roleMatrix, permissions, legacyCan]);
}

export default usePermissions;
