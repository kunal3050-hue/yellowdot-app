/**
 * genBuildInfo.js — capture the git commit/branch at BUILD time and write
 * public/build-info.json so Vite copies it verbatim into dist/, making it
 * fetchable at /build-info.json on the deployed site (mirrors the backend's
 * /api/version pattern — see yellowdot-backend/scripts/genBuildInfo.js).
 *
 * Run automatically as part of `npm run build:staging` / `build:production`
 * (wired in package.json), passed the mode name so it can read the matching
 * .env.<mode> file for VITE_APP_VERSION — package.json's own "version" field
 * is an unrelated placeholder ("0.0.0"), not what the app displays as its
 * version elsewhere.
 *
 * Best-effort: if git is unavailable, does not overwrite an existing
 * public/build-info.json with "unknown".
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function git(cmd) {
  try { return execSync(`git ${cmd}`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); }
  catch { return ""; }
}

function readAppVersion(mode) {
  const envFile = path.join(__dirname, "..", mode ? `.env.${mode}` : ".env");
  try {
    const text = fs.readFileSync(envFile, "utf8");
    const match = text.match(/^VITE_APP_VERSION=(.+)$/m);
    if (match) return match[1].trim();
  } catch { /* fall through to package.json */ }
  try { return require("../package.json").version; } catch { return "unknown"; }
}

const mode = process.argv[2] || "";
const commit = git("rev-parse HEAD");
const outPath = path.join(__dirname, "..", "public", "build-info.json");

if (!commit) {
  console.warn("[build:info] git unavailable — leaving existing public/build-info.json untouched.");
  process.exit(0);
}

const info = {
  commit,
  commitShort: commit.slice(0, 7),
  branch:  git("rev-parse --abbrev-ref HEAD") || "unknown",
  builtAt: new Date().toISOString(),
  version: readAppVersion(mode),
};

fs.writeFileSync(outPath, JSON.stringify(info, null, 2) + "\n");
console.log(`[build:info] wrote ${outPath}:`, JSON.stringify(info));
