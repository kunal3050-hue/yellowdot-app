# Technical Debt Register — Yellow Dot CRM

Tracked, accepted debt with explicit pay-down triggers. Each item has an ID,
the current state, why it was deferred, and the condition that makes it blocking.

---

## CCTV-V2-TD-001 — Encrypt camera credentials before Parent Access / Live Streaming

**Status:** Open · Accepted for current phase
**Created:** 2026-06 (CCTV V2 Phase 1)
**Owner:** _unassigned_
**Severity:** Low now → **High before Phase 3/4**

### Current state
- CCTV is **Internal Camera Management only** (metadata CRUD). No live view,
  no parent access, no streaming.
- Camera passwords are stored **as plaintext** in the Firestore `cameras`
  collection.
- Encryption support **already exists in code** (`services/cryptoService.js`,
  AES-256-GCM) and is wired into `cctvService` create/update. It is simply
  **not active** because `CCTV_ENCRYPTION_KEY` is not set in production.
  Without the key the service stores plaintext and logs a warning — it does
  **not** block saving or deployment (intentional for this phase).
- Passwords are never returned to the client (API masks them as `••••••••`).

### Why deferred
Phase 1 is staff-internal camera registration. No credential is exposed to
parents or used to open a live stream yet, so plaintext-at-rest is an accepted
risk for internal-only data. Deployment must not be gated on key setup.

### Future requirement — BLOCKING before either of:
- **Phase 3 — Live View**, or
- **Phase 4 — Parent Access**

Before shipping either, the following MUST be done:
1. **Enable credential encryption** — set `CCTV_ENCRYPTION_KEY` (32-byte,
   64 hex chars) in the production environment (Railway). Generate with:
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   Key must be stable and backed up — rotating it orphans existing ciphertext.
2. **Migrate existing passwords** — write/run a one-off script to read each
   camera, re-encrypt its plaintext password via `cryptoService.encrypt()`,
   and write it back. (`cryptoService.isEncrypted()` makes this idempotent.)
3. **Require the key in production** — fail fast on boot if
   `CCTV_ENCRYPTION_KEY` is missing once streaming/parent features are live
   (flip the current warn-and-continue behavior to an error for those paths).

### Pointers
- Encryption util: `yellowdot-backend/services/cryptoService.js`
- Gated write path: `yellowdot-backend/services/cctvService.js` → `encPassword()`
- Env template: `yellowdot-backend/.env.example` → `CCTV_ENCRYPTION_KEY`
- Code marker: search `CCTV-V2-TD-001`
