/**
 * genBuildInfo.js — capture the git commit at DEPLOY time.
 *
 * Run this locally right before deploying (`npm run build:info`) so the SHA of
 * the code you're shipping is uploaded as build-info.json and surfaced by
 * GET /api/version. This covers `railway up` deploys, where Railway does not
 * inject RAILWAY_GIT_* env vars.
 *
 * Best-effort: if git is unavailable (e.g. running on a server without .git),
 * it does NOT overwrite an existing build-info.json with "unknown".
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function git(cmd) {
  try { return execSync(`git ${cmd}`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); }
  catch { return ""; }
}

const commit = git("rev-parse HEAD");
const outPath = path.join(__dirname, "..", "build-info.json");

if (!commit) {
  console.warn("[build:info] git unavailable — leaving existing build-info.json untouched.");
  process.exit(0);
}

const info = {
  commit,
  branch:  git("rev-parse --abbrev-ref HEAD") || "unknown",
  builtAt: new Date().toISOString(),
};

fs.writeFileSync(outPath, JSON.stringify(info, null, 2) + "\n");
console.log(`[build:info] wrote ${outPath}:`, JSON.stringify(info));
