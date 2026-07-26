/**
 * verify-services.mjs — service layer boundary + endpoint ownership
 * ─────────────────────────────────────────────────────────────────────
 * PLATFORM ARCHITECTURE §12 Phase 3 / §5A
 *
 * Usage: npm run verify:services
 *
 * Phase 3's gate is "identical network traffic before/after". Proving that by
 * executing the services is not possible here — they import authService, which
 * imports the Firebase SDK and reads Vite-only `import.meta.env`. So the
 * invariant is checked at the source level instead, which is where it actually
 * has to hold:
 *
 *   1. every endpoint the migrated hook used to call is now OWNED by the
 *      service layer — the URL literal lives in src/services/ and nowhere else
 *   2. migrated directories contain no direct `api` import
 *   3. every read registered in the Service Registry names a service symbol
 *      that its module really exports
 *
 * (2) duplicates the ESLint rule deliberately: lint is easy to bypass with a
 * disable comment, and this gate runs in the same breath as the other checks.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, relative } from "path";
import { makeReporter, stripComments } from "./verify-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "src");

const { pass, fail, warn, section, state } = makeReporter();

/** Endpoints moved behind the registry in Phase 3, with the read that owns them. */
const OWNED_ENDPOINTS = [
  { url: "/students",                 owner: "src/services/studentService.js",  read: "students.listRaw" },
  { url: "/api/attendance/summary",   owner: "src/services/attendanceService.js", read: "attendance.summary" },
  { url: "/api/pickup-requests",      owner: "src/services/securityService.js", read: "pickup_auth.requests" },
  { url: "/api/invoices",             owner: "src/services/invoiceService.js",  read: "invoices.listRaw" },
];

/** Directories whose consumers have been migrated to the registry. */
const MIGRATED_ZONES = ["src/platform", "src/pages/quickNavigation"];

/** `import { api } from ".../authService"` in any of its spellings. */
const IMPORTS_API = /import\s*\{[^}]*\bapi\b[^}]*\}\s*from\s*["'][^"']*authService/;

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|jsx)$/.test(p)) out.push(p);
  }
  return out;
}

const rel = p => relative(__dirname, p).replace(/\\/g, "/");

function run() {
  console.log("\n🔍 Service layer boundary — PLATFORM_ARCHITECTURE §12 Phase 3");

  const allFiles = walk(SRC);

  // ── 1. Endpoint ownership ──────────────────────────────────────────────────
  section("1. Endpoints are owned by the service layer");

  for (const { url, owner, read } of OWNED_ENDPOINTS) {
    const ownerSrc = readFileSync(join(__dirname, owner), "utf8");
    if (!ownerSrc.includes(url)) {
      fail(`${owner} no longer contains "${url}"`, `read ${read} would break`);
      continue;
    }
    // A "leak" is a migrated-zone file that BOTH holds an HTTP client and names
    // the endpoint in code. Both conditions are required:
    //   - comments are stripped, because these modules document what they wrap
    //   - the api-import condition matters because "/students" is also a ROUTE
    //     path; modules.js and the Module Registry reference it legitimately as
    //     a destination, not as a request.
    const leaked = allFiles.filter(f => {
      const r = rel(f);
      if (!MIGRATED_ZONES.some(z => r.startsWith(z))) return false;
      if (r.startsWith("src/platform/services")) return false;   // the layer itself
      const src = readFileSync(f, "utf8");
      if (!IMPORTS_API.test(src)) return false;
      return stripComments(src).includes(url);
    });
    if (leaked.length) {
      fail(`"${url}" is called directly from a migrated zone`, leaked.map(rel).join(", "));
    } else {
      pass(`"${url}" owned by ${owner.split("/").pop()}`, read);
    }
  }

  // ── 2. No direct api import in migrated zones ──────────────────────────────
  section("2. Migrated zones import no HTTP client");

  const violations = [];
  for (const f of allFiles) {
    const r = rel(f);
    if (!MIGRATED_ZONES.some(z => r.startsWith(z))) continue;
    if (r.startsWith("src/platform/services")) continue;   // the layer itself
    if (IMPORTS_API.test(readFileSync(f, "utf8"))) violations.push(r);
  }
  if (violations.length) {
    for (const v of violations) fail("direct `api` import in a migrated zone", v);
  } else {
    pass("No direct HTTP client imports", `${MIGRATED_ZONES.join(", ")}`);
  }

  // ── 3. Registered reads resolve to real service exports ────────────────────
  section("3. Registered reads reference real service exports");

  const regSrc = readFileSync(join(SRC, "platform/services/services.js"), "utf8");

  // `import X from "../../services/y"` / `import * as X from "../../services/y"`
  const imports = {};
  for (const m of regSrc.matchAll(
    /import\s+(?:\*\s+as\s+)?(\w+)\s+from\s+["']\.\.\/\.\.\/services\/(\w+)["']/g,
  )) {
    imports[m[1]] = m[2];
  }

  let unresolved = 0;
  // Every `alias.method(` call inside the registry must exist in that module.
  for (const m of regSrc.matchAll(/\b(\w+)\.(\w+)\s*\(/g)) {
    const [, alias, method] = m;
    const moduleName = imports[alias];
    if (!moduleName) continue;
    const modSrc = readFileSync(join(SRC, `services/${moduleName}.js`), "utf8");
    const declared =
      new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\b`).test(modSrc) ||
      new RegExp(`\\b${method}\\s*:`).test(modSrc) ||
      new RegExp(`export\\s+const\\s+${method}\\b`).test(modSrc);
    if (!declared) {
      fail(`registry calls ${alias}.${method}() but services/${moduleName}.js does not export it`);
      unresolved++;
    }
  }
  if (!unresolved) {
    pass("Every registered read resolves", `${Object.keys(imports).length} service modules`);
  }

  // ── Remaining debt ─────────────────────────────────────────────────────────
  section("Remaining direct-api debt (informational)");

  const debt = allFiles.filter(f => {
    const r = rel(f);
    if (r.startsWith("src/services") || r.startsWith("src/platform/services")) return false;
    return IMPORTS_API.test(readFileSync(f, "utf8"));
  });
  warn(`${debt.length} files still import \`api\` directly`,
       "ESLint warns; migrated per phase, error-enforced once moved");

  section("Summary");
  console.log(`   Endpoints owned : ${OWNED_ENDPOINTS.length}`);
  console.log(`   Migrated zones  : ${MIGRATED_ZONES.length}`);
  console.log(`   Direct-api debt : ${debt.length} files`);

  if (state.failures) {
    console.error(`\n❌ ${state.failures} failure(s).\n`);
    process.exit(1);
  }
  console.log(`\n✅ Service layer boundary holds.\n`);
}

run();
