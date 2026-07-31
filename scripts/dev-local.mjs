/**
 * dev-local.mjs — one command for the whole local environment
 * ─────────────────────────────────────────────────────────────────────
 * Usage:  npm run dev:local          (from the repo root)
 *         npm run dev:local -- --no-seed
 *         npm run dev:local -- --seed-only
 *
 * Starts, in order:
 *   1. Firebase Emulator Suite (Auth + Firestore + UI) on the demo project
 *   2. the seed script, once the emulators are accepting connections
 *   3. the backend API, wired to the emulators
 *   4. the frontend dev server, wired to the emulators
 *
 * Every child process inherits EMULATOR_ENV below, so none of them can reach
 * production: the project id is `demo-kueboxs`, which Firebase treats as
 * offline-only, and no real credentials are passed through.
 *
 * Deliberately dependency-free — plain child_process rather than adding
 * `concurrently` for four spawns.
 */

import { spawn, spawnSync } from "child_process";
import { createConnection } from "net";
import { existsSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const PROJECT_ID     = "demo-kueboxs";
const FIRESTORE_PORT = 8080;
const AUTH_PORT      = 9099;
const UI_PORT        = 4000;
const API_PORT       = 5000;
const WEB_PORT       = 5173;

const args     = process.argv.slice(2);
const NO_SEED  = args.includes("--no-seed");
const SEED_ONLY = args.includes("--seed-only");

/**
 * The one environment every child inherits.
 *
 * GOOGLE_APPLICATION_CREDENTIALS is explicitly BLANKED: the repo's .env points
 * it at a real service-account key, and the emulator guard fails closed when
 * real credentials are present. Clearing it here is what lets the guard pass
 * honestly rather than being weakened to accommodate the repo's default.
 */
const EMULATOR_ENV = {
  ...process.env,
  GCLOUD_PROJECT:              PROJECT_ID,
  FIREBASE_PROJECT_ID:         PROJECT_ID,
  FIRESTORE_EMULATOR_HOST:     `127.0.0.1:${FIRESTORE_PORT}`,
  FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${AUTH_PORT}`,
  GOOGLE_APPLICATION_CREDENTIALS: "",
  FIREBASE_SERVICE_ACCOUNT:       "",
  APP_ENV:   "development",
  SCHOOL_ID: "demo-school",
  PORT:      String(API_PORT),
  // Finance routes are excluded unless this is set — without it the finance
  // widget and task provider cannot be validated at all.
  FINANCE_FOUNDATION_ENABLED: "true",
  // Frontend
  VITE_USE_FIREBASE_EMULATOR: "true",
  VITE_FIREBASE_PROJECT_ID:   PROJECT_ID,
  VITE_AUTH_EMULATOR_URL:     `http://127.0.0.1:${AUTH_PORT}`,
  VITE_FIRESTORE_EMULATOR:    `127.0.0.1:${FIRESTORE_PORT}`,
  VITE_API_URL:               `http://127.0.0.1:${API_PORT}`,
};

const children = [];
const isWin = process.platform === "win32";

/**
 * Locate a JRE for the Firestore emulator.
 *
 * The Auth emulator is pure Node, but Firestore needs Java. A freshly installed
 * JRE is on the SYSTEM path yet absent from any shell started before the
 * install, which produces a confusing "Java is not installed" error on a
 * machine where it plainly is. So: check PATH first, then the standard install
 * locations, and inject what we find into the emulator's environment.
 */
function findJavaBin() {
  const probe = spawnSync(isWin ? "where" : "which", ["java"], { encoding: "utf8", shell: isWin });
  if (probe.status === 0 && probe.stdout.trim()) return null;   // already on PATH

  const roots = isWin
    ? ["C:\\Program Files\\Eclipse Adoptium", "C:\\Program Files\\Java",
       "C:\\Program Files\\Microsoft\\jdk", "C:\\Program Files\\Amazon Corretto"]
    : ["/usr/lib/jvm", "/Library/Java/JavaVirtualMachines"];

  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root)) {
      for (const rel of ["bin", join("Contents", "Home", "bin")]) {
        const bin = join(root, entry, rel);
        if (existsSync(join(bin, isWin ? "java.exe" : "java"))) return bin;
      }
    }
  }
  return undefined;   // not on PATH and not found
}

function run(name, cmd, cmdArgs, cwd) {
  const child = spawn(cmd, cmdArgs, {
    cwd: join(ROOT, cwd),
    env: EMULATOR_ENV,
    stdio: ["ignore", "pipe", "pipe"],
    shell: isWin,
  });
  const tag = `[${name}]`.padEnd(12);
  const write = (buf, stream) => {
    for (const line of String(buf).split("\n")) {
      if (line.trim()) stream.write(`${tag} ${line}\n`);
    }
  };
  child.stdout.on("data", b => write(b, process.stdout));
  child.stderr.on("data", b => write(b, process.stderr));
  child.on("exit", code => {
    if (code !== 0 && code !== null) console.error(`${tag} exited with code ${code}`);
  });
  children.push({ name, child });
  return child;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function portOpen(port) {
  return new Promise(resolve => {
    const sock = createConnection({ host: "127.0.0.1", port });
    const done = ok => { sock.destroy(); resolve(ok); };
    sock.once("connect", () => done(true));
    sock.once("error",   () => done(false));
    setTimeout(() => done(false), 800);
  });
}

async function waitForPort(port, label, timeoutMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await portOpen(port)) return true;
    await sleep(500);
  }
  throw new Error(`${label} did not come up on port ${port} within ${timeoutMs / 1000}s`);
}

function shutdown(code = 0) {
  for (const { child } of children) {
    try { isWin ? spawn("taskkill", ["/pid", child.pid, "/f", "/t"]) : child.kill("SIGTERM"); }
    catch { /* already gone */ }
  }
  setTimeout(() => process.exit(code), 500);
}
process.on("SIGINT",  () => { console.log("\nShutting down…"); shutdown(0); });
process.on("SIGTERM", () => shutdown(0));

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  KUE BOXS Care — local development environment                 ║
║  project ${PROJECT_ID}  ·  emulator only, production unreachable  ║
╚════════════════════════════════════════════════════════════════╝
`);

  if (!SEED_ONLY) {
    // Pre-flight: a port already in use is almost always a leftover emulator
    // from an earlier run. Without this check, waitForPort() below sees the
    // STALE listener, reports "emulators up", and the seed then fails against
    // a half-dead environment with a confusing ECONNREFUSED.
    for (const [port, label] of [[FIRESTORE_PORT, "Firestore"], [AUTH_PORT, "Auth"], [WEB_PORT, "web"]]) {
      if (await portOpen(port)) {
        throw new Error(
          `Port ${port} is already in use (${label}).\n` +
          "   A previous run is probably still alive. Stop it, then re-run:\n" +
          (isWin
            ? `     powershell "Get-NetTCPConnection -LocalPort ${port} | %{ Stop-Process -Id $_.OwningProcess -Force }"`
            : `     lsof -ti:${port} | xargs kill -9`),
        );
      }
    }

    const javaBin = findJavaBin();
    if (javaBin === undefined) {
      throw new Error(
        "The Firestore emulator needs a JRE and none was found.\n" +
        "   Install one, then re-run:\n" +
        "     winget install EclipseAdoptium.Temurin.21.JRE   (Windows)\n" +
        "     brew install --cask temurin                      (macOS)",
      );
    }
    if (javaBin) {
      // Found off-PATH — typically a JRE installed since this shell started.
      EMULATOR_ENV.PATH = `${EMULATOR_ENV.PATH || ""}${isWin ? ";" : ":"}${javaBin}`;
      EMULATOR_ENV.Path = EMULATOR_ENV.PATH;   // Windows env keys are case-sensitive in spawn
      console.log(`☕ using JRE at ${javaBin}`);
    }

    run("emulators", "npx", [
      "firebase", "emulators:start",
      "--project", PROJECT_ID,
      "--only", "auth,firestore",
    ], ".");

    // Generous: the first run downloads the Firestore emulator JAR (~60 MB),
    // which can easily outlast a normal startup budget on a cold machine.
    console.log("⏳ waiting for Firestore + Auth emulators (first run downloads the emulator JAR)…");
    await waitForPort(FIRESTORE_PORT, "Firestore emulator", 300_000);
    await waitForPort(AUTH_PORT, "Auth emulator", 60_000);
    console.log("✅ emulators up\n");
  } else if (!(await portOpen(FIRESTORE_PORT))) {
    throw new Error("--seed-only needs the emulators already running (npm run dev:local)");
  }

  if (!NO_SEED) {
    await new Promise((resolve, reject) => {
      const seed = run("seed", "node", ["scripts/seedEmulator.js"], "yellowdot-backend");
      seed.on("exit", c => (c === 0 ? resolve() : reject(new Error(`seed exited ${c}`))));
    });
  }

  if (SEED_ONLY) { console.log("\n✅ seed-only complete"); shutdown(0); return; }

  run("api", "npm", ["run", "dev"], "yellowdot-backend");
  await waitForPort(API_PORT, "backend API", 60_000).catch(e => console.warn(`⚠️  ${e.message}`));

  run("web", "npm", ["run", "dev"], "yellowdot-frontend");
  await waitForPort(WEB_PORT, "frontend", 60_000).catch(e => console.warn(`⚠️  ${e.message}`));

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  Ready                                                         ║
╠════════════════════════════════════════════════════════════════╣
║  App          http://localhost:${WEB_PORT}                             ║
║  API          http://localhost:${API_PORT}                             ║
║  Emulator UI  http://localhost:${UI_PORT}                             ║
╠════════════════════════════════════════════════════════════════╣
║  Sign in with any demo account, password: demo1234             ║
║    principal@demo.local   teacher@demo.local                   ║
║    reception@demo.local   accountant@demo.local                ║
║    owner@demo.local       super@demo.local                     ║
╚════════════════════════════════════════════════════════════════╝

Ctrl+C stops everything.
`);
}

main().catch(err => { console.error("\n❌", err.message); shutdown(1); });
