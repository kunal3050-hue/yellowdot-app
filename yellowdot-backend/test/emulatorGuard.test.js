/**
 * emulatorGuard.test.js — the interlock that keeps seed scripts off production
 * ─────────────────────────────────────────────────────────────────────
 * Run: npm test   (from yellowdot-backend)
 *
 * This guard is the only thing standing between a seed script and real
 * children's records, so its failure modes are tested explicitly — including
 * every partial misconfiguration, since those are the realistic ones. A guard
 * that only passes its happy path is not a guard.
 */

const test = require("node:test");
const assert = require("node:assert");
const path = require("path");

const GUARD = path.join(__dirname, "../platform/devEnv/emulatorGuard.js");

/** Load the guard with a controlled environment. */
function withEnv(env, fn) {
  const saved = { ...process.env };
  for (const k of ["GCLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT", "FIREBASE_PROJECT_ID",
                   "FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST",
                   "GOOGLE_APPLICATION_CREDENTIALS", "FIREBASE_SERVICE_ACCOUNT",
                   "APP_ENV", "NODE_ENV", "ALLOW_PROD_FROM_DEV"]) {
    delete process.env[k];
  }
  Object.assign(process.env, env);
  delete require.cache[require.resolve(GUARD)];
  try { return fn(require(GUARD)); }
  finally { process.env = saved; delete require.cache[require.resolve(GUARD)]; }
}

const EMULATOR = {
  GCLOUD_PROJECT: "demo-kueboxs",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
};

test("isEmulator() true only when every condition holds", () => {
  withEnv(EMULATOR, g => assert.equal(g.isEmulator(), true));
});

test("assertEmulatorOnly passes in a correct emulator environment", () => {
  withEnv(EMULATOR, g => assert.doesNotThrow(() => g.assertEmulatorOnly("test")));
});

test("REFUSES a real project id even with emulator hosts set", () => {
  withEnv({ ...EMULATOR, GCLOUD_PROJECT: "yellowdot-app" }, g => {
    assert.throws(() => g.assertEmulatorOnly("test"), /must start with "demo-"/);
  });
});

test("REFUSES when the project id is unset", () => {
  withEnv({ ...EMULATOR, GCLOUD_PROJECT: undefined }, g => {
    delete process.env.GCLOUD_PROJECT;
    assert.throws(() => g.assertEmulatorOnly("test"), /REFUSING TO RUN/);
  });
});

test("REFUSES when FIRESTORE_EMULATOR_HOST is missing", () => {
  const env = { ...EMULATOR }; delete env.FIRESTORE_EMULATOR_HOST;
  withEnv(env, g => assert.throws(() => g.assertEmulatorOnly("test"), /FIRESTORE_EMULATOR_HOST/));
});

test("REFUSES when the Firestore host is remote, not loopback", () => {
  withEnv({ ...EMULATOR, FIRESTORE_EMULATOR_HOST: "firestore.example.com:8080" }, g => {
    assert.throws(() => g.assertEmulatorOnly("test"), /loopback/);
  });
});

test("REFUSES when the Auth emulator host is missing", () => {
  const env = { ...EMULATOR }; delete env.FIREBASE_AUTH_EMULATOR_HOST;
  withEnv(env, g => assert.throws(() => g.assertEmulatorOnly("test"), /FIREBASE_AUTH_EMULATOR_HOST/));
});

test("REFUSES when real credentials are present, even on a demo project", () => {
  // The dangerous near-miss: everything looks like the emulator, but a service
  // account key is loaded, so one wrong host variable reaches production.
  withEnv({ ...EMULATOR, GOOGLE_APPLICATION_CREDENTIALS: "./serviceAccountKey.json" }, g => {
    assert.throws(() => g.assertEmulatorOnly("test"), /real credentials are present/);
  });
});

test("REFUSES when FIREBASE_SERVICE_ACCOUNT is present", () => {
  withEnv({ ...EMULATOR, FIREBASE_SERVICE_ACCOUNT: '{"type":"service_account"}' }, g => {
    assert.throws(() => g.assertEmulatorOnly("test"), /real credentials are present/);
  });
});

test("startup guard blocks APP_ENV=development against a real project", () => {
  withEnv({ APP_ENV: "development", FIREBASE_PROJECT_ID: "yellowdot-app" }, g => {
    assert.throws(() => g.assertDevNotPointedAtProduction(), /REFUSING TO START/);
  });
});

test("startup guard allows development against the emulator", () => {
  withEnv({ ...EMULATOR, APP_ENV: "development" }, g => {
    assert.doesNotThrow(() => g.assertDevNotPointedAtProduction());
  });
});

test("startup guard does NOT block production or staging boots", () => {
  for (const appEnv of ["production", "staging"]) {
    withEnv({ APP_ENV: appEnv, FIREBASE_PROJECT_ID: "yellowdot-app" }, g => {
      assert.doesNotThrow(() => g.assertDevNotPointedAtProduction(),
        `${appEnv} must boot normally`);
    });
  }
});

test("ALLOW_PROD_FROM_DEV=true is an explicit, deliberate escape hatch", () => {
  withEnv({ APP_ENV: "development", FIREBASE_PROJECT_ID: "yellowdot-app", ALLOW_PROD_FROM_DEV: "true" }, g => {
    assert.doesNotThrow(() => g.assertDevNotPointedAtProduction());
  });
});
