/**
 * useFinancePlatformStatus — is the Finance Platform backend enabled?
 * ─────────────────────────────────────────────────────────────────────────
 * Backed by GET /api/finance/status, the one Finance route that is always
 * registered regardless of FINANCE_FOUNDATION_ENABLED (see server.js — it
 * lives outside the flag block every other Finance route is inside). Every
 * Finance screen checks this before making any other Finance API call, so
 * a disabled backend never produces a raw 404 in the first place — the
 * screen renders <FinancePlatformDisabled /> instead and skips its own
 * fetch entirely.
 *
 * Resolved once per app session and shared across every Finance screen via
 * a module-level cache — navigating between the 10 Finance tabs shouldn't
 * re-check this on every click. A fresh page load re-checks, which is what
 * makes "enable the flag, reload" work with no UI changes required.
 *
 * `enabled` is `null` while the check is in flight (screens should treat
 * this the same as their own "loading" state) and resolves to `true` if
 * the status check itself fails for an unrelated reason (network blip,
 * unexpected 5xx) — a transient failure here must never permanently mask a
 * working Finance Platform behind the disabled state; the screen's own
 * existing error handling takes over from there exactly as it did before.
 */
import { useEffect, useState } from "react";
import financeApi from "../../../services/financeApi";

let cachedEnabled = null; // null = not yet resolved this session
let inFlight = null;

function fetchStatus() {
  if (cachedEnabled !== null) return Promise.resolve(cachedEnabled);
  if (!inFlight) {
    inFlight = financeApi.platform.status()
      .then(data => { cachedEnabled = data.enabled === true; return cachedEnabled; })
      .catch(() => { cachedEnabled = true; return cachedEnabled; }) // fail open — see header comment
      .finally(() => { inFlight = null; });
  }
  return inFlight;
}

export default function useFinancePlatformStatus() {
  const [enabled, setEnabled] = useState(cachedEnabled);

  useEffect(() => {
    if (enabled !== null) return;
    let cancelled = false;
    fetchStatus().then(v => { if (!cancelled) setEnabled(v); });
    return () => { cancelled = true; };
  }, [enabled]);

  return { enabled };
}
