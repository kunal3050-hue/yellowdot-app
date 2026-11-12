/**
 * trustProxy.js — turn the TRUST_PROXY env var into an Express setting
 * ─────────────────────────────────────────────────────────────────────
 * Pulled out of server.js so it can be tested without booting the app.
 * See the comment at the call site in server.js for why the production
 * value is the Docker bridge gateway rather than "loopback".
 *
 * Accepted forms, matching what Express itself understands:
 *   "false"         → false        (never trust; req.ip is the socket peer)
 *   "2"             → 2            (trust N hops)
 *   "true"          → true         (trust anyone — warns; see below)
 *   anything else   → passed through as a string, which Express parses as a
 *                     comma-separated list of presets ("loopback",
 *                     "linklocal", "uniquelocal"), IPs, or CIDR ranges.
 *
 * Unset or empty resolves to "loopback", which is correct for local dev and
 * deliberately inert inside the container, so shipping this cannot change
 * behaviour until someone sets the value on purpose.
 */

const DEFAULT = "loopback";

const TRUE_WARNING =
  "[trust-proxy] TRUST_PROXY=true trusts X-Forwarded-For from ANY caller, " +
  "which lets clients forge the IP recorded in the CCTV audit log. " +
  "Set it to the proxy's address instead (e.g. 172.17.0.1).";

/**
 * @param {string|undefined} raw   process.env.TRUST_PROXY
 * @param {(msg: string) => void} [warn]  injected so tests can assert the warning
 * @returns {boolean|number|string} a value for app.set("trust proxy", …)
 */
function resolveTrustProxy(raw, warn = console.warn) {
  const value = String(raw ?? "").trim();

  if (value === "") return DEFAULT;
  if (value.toLowerCase() === "false") return false;
  if (/^\d+$/.test(value)) return Number(value);
  if (value.toLowerCase() === "true") {
    warn(TRUE_WARNING);
    return true;
  }
  return value;
}

module.exports = { resolveTrustProxy, DEFAULT, TRUE_WARNING };
