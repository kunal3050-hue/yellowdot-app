/**
 * lint-budget.mjs — a ratchet for the existing lint backlog.
 *
 * Why this exists
 * ───────────────
 * `npm run lint` currently reports a few hundred pre-existing errors. That
 * leaves two bad options for CI: block on zero (nothing can ever merge) or
 * don't run lint at all (the backlog grows silently, which is how it got this
 * big). This is the third option — fail only when the count goes UP.
 *
 * So the backlog is frozen where it is, new code cannot add to it, and every
 * fix that lowers the count prints the new number to commit.
 *
 * Usage
 * ─────
 *   node scripts/lint-budget.mjs              # check against .lint-budget.json
 *   node scripts/lint-budget.mjs --update     # rewrite the budget to current
 *
 * The budget is a ceiling, not a target. Lower it whenever you can; never
 * raise it to make a build pass — fix the finding instead.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, "..");
const BUDGET    = join(ROOT, ".lint-budget.json");
const UPDATE    = process.argv.includes("--update");

function runEslint() {
  // ESLint exits non-zero when it finds problems, which is the normal case
  // here, so a non-zero status is not on its own a failure. Only treat it as
  // one when stdout did not come back as parseable JSON.
  let stdout;
  try {
    stdout = execFileSync(
      process.execPath,
      [join(ROOT, "node_modules", "eslint", "bin", "eslint.js"), ".", "-f", "json"],
      { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (e) {
    stdout = e.stdout || "";
    if (!stdout.trim().startsWith("[")) {
      console.error("✖ Could not run ESLint.\n");
      console.error(e.stderr || e.message);
      process.exit(2);
    }
  }

  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    console.error("✖ ESLint did not return JSON. First 500 chars of output:\n");
    console.error(stdout.slice(0, 500));
    process.exit(2);
  }

  let errors = 0, warnings = 0;
  const byRule = {};
  for (const file of report) {
    for (const m of file.messages) {
      if (m.severity === 2) errors++; else warnings++;
      if (m.severity === 2) {
        const rule = m.ruleId || "(parse error)";
        byRule[rule] = (byRule[rule] || 0) + 1;
      }
    }
  }
  return { errors, warnings, byRule };
}

const { errors, warnings, byRule } = runEslint();

if (UPDATE) {
  writeFileSync(
    BUDGET,
    JSON.stringify({ maxErrors: errors, maxWarnings: warnings }, null, 2) + "\n",
  );
  console.log(`✅ Budget updated — maxErrors: ${errors}, maxWarnings: ${warnings}`);
  process.exit(0);
}

let budget;
try {
  budget = JSON.parse(readFileSync(BUDGET, "utf8"));
} catch {
  console.error(`✖ Missing or unreadable ${BUDGET}.`);
  console.error("  Create it with: node scripts/lint-budget.mjs --update");
  process.exit(2);
}

console.log(`\n🔍 Lint budget — errors ${errors}/${budget.maxErrors}, warnings ${warnings}/${budget.maxWarnings}\n`);

let failed = false;

if (errors > budget.maxErrors) {
  const added = errors - budget.maxErrors;
  console.error(`❌ ${added} new lint error${added === 1 ? "" : "s"} (${errors} > budget ${budget.maxErrors}).`);
  console.error("   Fix them, or run `npm run lint` to see the detail. Do NOT raise the budget.\n");
  console.error("   Top error rules in this run:");
  Object.entries(byRule).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .forEach(([rule, n]) => console.error(`     ${String(n).padStart(4)}  ${rule}`));
  failed = true;
} else if (errors < budget.maxErrors) {
  console.log(`✅ ${budget.maxErrors - errors} fewer error(s) than the budget — nice.`);
  console.log(`   Lock it in: node scripts/lint-budget.mjs --update  (maxErrors: ${errors})`);
} else {
  console.log("✅ Errors exactly at budget — no new ones.");
}

if (warnings > budget.maxWarnings) {
  // Warnings are advisory: report the growth, but do not fail the build on it.
  console.log(`⚠️  Warnings rose to ${warnings} (budget ${budget.maxWarnings}) — not blocking.`);
}

process.exit(failed ? 1 : 0);
