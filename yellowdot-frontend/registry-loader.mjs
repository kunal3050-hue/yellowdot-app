/**
 * registry-loader.mjs — extensionless-import resolver for Node-run verification
 * ─────────────────────────────────────────────────────────────────────
 * Used only by `npm run verify:registry`. Never part of a build.
 *
 * The app's source imports are written for Vite, which resolves
 * `./permissions` → `./permissions.js` automatically. Node's ESM resolver does
 * not. This hook retries a failed relative resolution with the extensions Vite
 * would have tried, so verification can import the REAL config modules
 * (sidebarConfig.js, modules.js, rbacConfig.js) instead of regex-parsing them.
 *
 * Registered via `node --import ./registry-register.mjs verify-registry.mjs`.
 */

const CANDIDATE_SUFFIXES = [".js", ".jsx", "/index.js", "/index.jsx"];

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err?.code !== "ERR_MODULE_NOT_FOUND" || !specifier.startsWith(".")) throw err;
    for (const suffix of CANDIDATE_SUFFIXES) {
      try {
        return await nextResolve(specifier + suffix, context);
      } catch { /* try the next candidate */ }
    }
    throw err;
  }
}
