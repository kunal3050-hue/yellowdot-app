/**
 * verify-lib.mjs — shared helpers for the verify:* scripts
 * ─────────────────────────────────────────────────────────────────────
 * Used only by verification tooling; never part of a build.
 *
 * Several config modules cannot simply be imported in Node:
 *   - backend roleService.js is CommonJS and requires firebaseAdmin at load,
 *     which would initialise a real Firebase app
 *   - frontend featureFlags.js imports environment.js, which reads
 *     `import.meta.env` — a Vite-only global
 *
 * In both cases the data we need is a plain literal, so it is sliced out of the
 * source and evaluated with an explicit scope for any identifier it references.
 */

/**
 * Slice a balanced `{...}` or `[...]` literal following `marker`, and evaluate it.
 * Comment- and string-aware, so braces inside either do not unbalance the scan.
 *
 * @param {string} src     module source text
 * @param {string} marker  e.g. "const STATIC_ROLE_PERMS ="
 * @param {object} scope   identifiers the literal references (spreads, constants)
 */
export function extractLiteral(src, marker, scope = {}) {
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`marker not found: ${marker}`);

  let i = start + marker.length;
  while (i < src.length && /\s/.test(src[i])) i++;
  const open = src[i];
  if (open !== "{" && open !== "[") {
    throw new Error(`expected { or [ after "${marker}", found "${open}"`);
  }
  const close = open === "{" ? "}" : "]";

  let depth = 0, end = -1, inStr = null, inComment = null;
  for (let j = i; j < src.length; j++) {
    const c = src[j], next = src[j + 1];
    if (inComment === "line")  { if (c === "\n") inComment = null; continue; }
    if (inComment === "block") { if (c === "*" && next === "/") { inComment = null; j++; } continue; }
    if (inStr) { if (c === "\\") j++; else if (c === inStr) inStr = null; continue; }
    if (c === "/" && next === "/") { inComment = "line"; j++; continue; }
    if (c === "/" && next === "*") { inComment = "block"; j++; continue; }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === open) depth++;
    else if (c === close && --depth === 0) { end = j + 1; break; }
  }
  if (end === -1) throw new Error(`unbalanced literal after: ${marker}`);

  const names = Object.keys(scope);
  return new Function(...names, `return (${src.slice(i, end)});`)(...names.map(n => scope[n]));
}

/** Console helpers shared by the verify scripts. */
export function makeReporter() {
  const state = { failures: 0, warnings: 0 };
  return {
    state,
    pass: (m, x = "") => console.log(`✅ ${m}${x ? `  →  ${x}` : ""}`),
    fail: (m, x = "") => { console.error(`❌ ${m}${x ? `  →  ${x}` : ""}`); state.failures++; },
    warn: (m, x = "") => { console.log(`⚠️ ${m}${x ? `  →  ${x}` : ""}`); state.warnings++; },
    section: t => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 62 - t.length))}`),
  };
}
