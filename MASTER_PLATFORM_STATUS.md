# MASTER PLATFORM STATUS — KUE BOXS Care / Yellow Dot

**This document is the single source of truth for platform status.** It is a status dashboard, not a deep-dive — each section states the current facts and points to the canonical document that owns the full detail. When the two disagree, the canonical document wins and this file is stale; fix this file in the same commit you notice the drift.

> **Maintenance contract: every future milestone, security fix, deploy, or architectural change must update the relevant section(s) of this document as part of its completion — before the milestone is considered done, not as a follow-up.** A milestone report in `docs/production-ops/` is not a substitute for updating this file; it's the source this file summarizes from.

**Last updated:** 2026-07-14 (post-Milestone-16, Security Hardening Phase complete)
**Current production commit:** `b5220ef`

---

## 1. Architecture

**Stack:** React 19 SPA (Firebase Hosting) → Node.js 18 / Express 5 backend (Docker on a single self-managed VPS) → Firestore (no SQL, no Redis). One Firebase project (`yellowdot-app`) serves every tenant school, distinguished by a `schoolId` field on documents — not by separate infrastructure.

| Layer | Detail |
|---|---|
| Frontend | React 19 + React Router 7, Vite 8, Tailwind (`yd.*` tokens), Axios, Firebase SDK 12, Framer Motion, Recharts, jsPDF, HLS.js, html5-qrcode |
| Backend | Node 18 + Express 5, firebase-admin 13, PDFKit/jsPDF, qrcode, node-cron, native crypto (AES-256-GCM for CCTV) |
| Database | Firestore only — ~35 top-level collections, every tenant-scoped one carrying `schoolId` |
| Auth | Firebase Auth, Google Sign-In only (no email/password UI); backend verifies every request via `admin.auth().verifyIdToken()` |
| Multi-tenancy | `tenants` collection + `tenantMiddleware.js` (trial/active/suspended/cancelled enforcement) + Super Admin impersonation flow — separate mechanism from per-school `schoolId` scoping |

**Full detail:** `docs/cto-context.md` §System Architecture (frontend/backend directory trees, feature-flag system, RBAC implementation). **Canonical authorization model:** `SECURITY_ARCHITECTURE.md`.

---

## 2. Security

**Program status: Security Hardening Phase complete (M2–M16).** All 10 Critical findings and all 5 tenant-isolation-shaped High findings across both audits in this program are closed. **9 infrastructure/hardening-shaped High findings from the original 2026-07-13 audit remain open** — see §11 Next Phase.

**Tenant Security Baseline** (the 5 non-negotiable rules every module must meet — full text in `SECURITY_ARCHITECTURE.md`):
1. Every API must validate `schoolId` ownership.
2. Never trust IDs (or `schoolId`) from the client.
3. Every CRUD endpoint must perform authorization before data access.
4. Protected roles (`developer`, `super_admin`) must never be assignable through normal APIs.
5. All future modules must follow this pattern.

**Coverage:** 27 of 28 registered backend modules are confirmed tenant-safe (see `docs/production-ops/29_SECURITY_COVERAGE_MATRIX.md`). One Low-severity gap remains open (`napController.wakeUp()`).

**Canonical reference:** `SECURITY_ARCHITECTURE.md` — authentication flow, authorization model, tenant isolation, ownership verification, per-domain security models (parent/staff/admin/CCTV/journey/billing), "how to secure a new module" checklist, reusable-helpers table.

**Full history:** `docs/production-ops/31_SECURITY_HARDENING_PHASE_COMPLETION_REPORT.md` (before/after, score progression) and the individual milestone reports (`12` through `28` in that directory).

---

## 3. Infrastructure

| Component | Where | Notes |
|---|---|---|
| Backend API | Docker container `yd-backend` on VPS `66.116.245.149` | `docker run --restart unless-stopped`, no PM2/Kubernetes/docker-compose in actual use despite files existing in the repo |
| Reverse proxy + TLS | Caddy, same VPS, host-network mode | Let's Encrypt, automatic renewal |
| CCTV streaming | MediaMTX, same VPS | `stream.kueboxs.com` |
| Frontend | Firebase Hosting | `app.kueboxs.com` |
| Database | Firestore, project `yellowdot-app` | Daily+weekly backup schedules active (confirmed 2026-07-09); PITR/Delete Protection status not re-verified this phase |
| Railway | Still "Online" but **not in the production traffic path** | Needs actual decommissioning — not just doc cleanup — see §12 |

**Exactly one VPS, no load balancer, no redundancy.** This is a real, current limitation.

**Full detail:** `docs/production-ops/00_OPERATIONS_MANUAL.md` (start here), `01_PRODUCTION_INFRASTRUCTURE.md`, `09_CTO_CONTEXT_V3.md` (independently re-verified 2026-07-09).

---

## 4. Production

- **Live commit:** `b5220ef` (verify via `curl https://api.kueboxs.com/api/version`)
- **Health check:** `curl https://api.kueboxs.com/` → `200 {"status":"ok"}`
- **Environments:** Yellow Dot (staging, `schoolId: yd-main`) ↔ KUE BOXS Care (production, `schoolId: ydseawoods`) — two-environment strategy, feature flags control promotion
- **CCTV encryption:** `CCTV_ENCRYPTION_KEY` + `CCTV_REQUIRE_ENCRYPTION=true` are live in production, but **not** in the VPS's `--env-file` — every future deploy's `docker run` must repeat both `-e` flags or camera credential storage silently reverts to plaintext with no error
- **No CI/CD** — every deploy is a manual SSH session following the recipe in §8 below

---

## 5. Modules

Full, current-as-of-2026-06-30 module inventory (Completed / In Progress / Planned / Deprecated) lives in `docs/cto-context.md` §Current Module Inventory. Corrected during this phase's doc-sync: **Staff Attendance, Leave Management, Payroll, Performance Management, Departments & Designations are live production modules**, not "Planned" as that document read before 2026-07-14 — they were built without ever being reflected there, and are now the most recently security-hardened modules in the platform (M12–M13).

**Broader staleness warning:** `docs/cto-context.md` is dated 2026-06-30 and has known drift beyond the HR-module correction above (it predates the VPS migration and the KUE BOXS rebrand in places) — cross-check against `docs/production-ops/09_CTO_CONTEXT_V3.md` for infrastructure facts, and against this file's own sections for anything security-related.

---

## 6. Testing

| Checkpoint | Test count |
|---|---:|
| Pre-Milestone-2 | ~37 |
| Post-M11 (all Critical closed) | 156 |
| Post-M12 | 188 |
| Post-M13 | 199 |
| Post-M14 | 207 |
| Post-M15 | 219 |
| **Post-M16 (current)** | **231** |

**231/231 passing, zero regressions across 15 consecutive milestones (M2–M16).** Run via `node --test "test/*.test.js"` from `yellowdot-backend/` — **do not use bare `npm test`**, its unscoped glob sweeps up two unrelated interactive scripts at the repo root (`e2e-push-test.js`, `fcm-test.js`) and hangs; this is a known, pre-existing issue, not yet fixed.

No frontend test suite exists (Playwright scaffolded, never populated) — tracked as its own open item, not part of this security program.

---

## 7. Performance

Not part of this security program's scope — no dimension-specific re-audit performed. Known, pre-existing items from the 2026-07-13 baseline audit, unverified since:
- No pagination on the parent feed / fees endpoints (risk grows with student count).
- No rate-limiting or Helmet anywhere in the backend (also a security item — see §11).
- 60-second in-process permission cache (`roleService.js`) — acceptable at current scale.

No load testing, no APM/monitoring, no centralized log aggregation exist. Recommend a dedicated Performance/Scalability audit pass before this platform scales meaningfully beyond its current tenant count.

---

## 8. Deployment

**No CI/CD.** Every deploy is a manual SSH session against the standing `yd-vps` alias:

```bash
cd /opt/yd/backend && git pull origin master
COMMIT=$(git rev-parse --short HEAD)
docker build --build-arg APP_COMMIT="$COMMIT" -t yd-backend:$COMMIT yellowdot-backend/
docker stop yd-backend && docker rename yd-backend yd-backend-previous-<old-sha>
docker run -d --name yd-backend --restart unless-stopped \
  --env-file /opt/yd/backend.env -v /opt/yd/secrets:/opt/yd/secrets \
  -e CCTV_ENCRYPTION_KEY=<key> -e CCTV_REQUIRE_ENCRYPTION=true \
  -p 127.0.0.1:4000:8080 yd-backend:$COMMIT
```

Verify via `curl https://api.kueboxs.com/api/version`. Firestore index changes deploy separately (`firebase deploy --only firestore:indexes`) and build asynchronously — always confirm build completion before relying on a new composite query in production. **Check for untracked-file collisions on the VPS before every `git pull`** — this has bitten this exact repo before.

**Rollback:** the renamed previous container is always kept — `docker stop yd-backend && docker rename yd-backend yd-backend-failed-<sha> && docker rename yd-backend-previous-<old-sha> yd-backend && docker start yd-backend`.

**Full runbook:** `docs/production-ops/02_DEPLOYMENT_RUNBOOK.md`.

---

## 9. Roadmap

Full roadmap (Admissions CRM, Online Payments, AI features, Parent-Teacher Chat, Transport, etc.) lives in `docs/cto-context.md` §Future Product Roadmap and §Current Build Roadmap — not duplicated here since it changes independently of security status. As of this document's last update, the standing instruction in effect is:

**Do not begin any new product feature work until the items in §11 Next Phase (WebAuthn, password-reset logging) are resolved.**

**UI/UX Design System initiative (2026-07-14):** a separate, visual-only workstream has started — `KUE_BOXS_DESIGN_SYSTEM.md` (repo root) is now canonical for typography, color, elevation, and every component category. An audit found the token system and component library already largely meet the "premium SaaS, not ERP" bar; the real work is consolidating a stale conflicting color source (`design-system/theme.js`, still driving every `StatusBadge`) and three competing sidebar CSS definitions in `layout.css`, then a module-by-module adoption pass fixing ~2,500 raw hex literals and ~760 raw Tailwind-gray classes across `src/pages` that bypass the tokens. **No backend logic or API contracts are touched by this workstream** — see `KUE_BOXS_DESIGN_SYSTEM.md` §19-20 for the consolidation list and required per-module process (before/after, screenshots, a11y review, performance impact, regression verification).

---

## 10. Current Scores

| Dimension | 2026-07-13 baseline | Current |
|---|---|---|
| **Security** | 38/100 | **Estimated ~68–72/100** — reasoned estimate from closed-finding count/severity, not a re-run of the original scoring methodology; recommend a fresh independent audit to confirm |
| **Overall Production Readiness** | 44/100 | Not re-scored this phase — only Security was targeted |
| Stability / Performance / Scalability / Reliability / Monitoring / Disaster Recovery / Deployment / Code Quality / Testing | (2026-07-13 values, see `production_readiness_report_v1` artifact) | Assume unchanged unless independently re-verified |

Full breakdown: `docs/production-ops/30_PRODUCTION_READINESS_REPORT_V2.md`.

---

## 11. Next Phase

**Recommended: infrastructure/hardening backlog — the 9 open Highs from the 2026-07-13 audit, none tenant-isolation-shaped.** Priority order:

1. **WebAuthn `deviceAuthenticated` is a client-asserted boolean** — no server-side crypto verification. Direct path to pickup-approval bypass.
2. **Password-reset links logged in plaintext to server logs** (account-takeover-capable `oobCode`).
3. **Rate-limiting + Helmet** — broad, low-effort mitigation, no per-module work needed.
4. **`storage.rules`** — `incidents/`, `journey/artwork/`, `journey/media/` upload paths still not tenant-scoped.
5. **Node 18 EOL / Docker runs as root.**
6. **Two localStorage-PII findings** (Aadhaar/medical docs, admission-draft PII) — frontend-side, likely the largest single effort.

**Do not begin new product features until items 1–2 are resolved** — both are live, exploitable account-security gaps.

---

## 12. Known Technical Debt

| Item | Severity | Notes |
|---|---|---|
| 9 open Highs from 2026-07-13 audit (§11 above) | High | Out of this program's scope; highest-value remaining security work |
| `napController.wakeUp()` no tenant check | Low | Same shape as the M15 attendance-checkout fix; not yet applied |
| Shared system-role documents (`roles/admin`, `roles/teacher`, etc.) | Medium | Fixed-slug, first-writer-wins seeding — M12 closed cross-tenant *mutation*, not the underlying data-model sharing; needs a per-tenant-role-document migration |
| `incidentSvc.acknowledge()`'s `parent.parentId` bug | Low–Medium | Same nonexistent-field issue M14 fixed for PTM bookings, found but not fixed at `parentRoutes.js:567` |
| `qrConfigs`/centers not a first-class `schoolId`-owned collection | Low | M15's `centerBelongsToSchool()` is a pragmatic existence check, not a durable ownership record |
| `tenantRoutes.js` needs a dedicated privileged-access review | Medium | Different threat model (intentionally cross-tenant); not a per-school tenant-check candidate |
| Two same-named "CTO Context" documents (`docs/cto-context.md`, `docs/production-ops/09_CTO_CONTEXT_V3.md`) | Low | Documentation-structure issue, not security — risks someone reading the stale copy |
| Student IDs globally sequential, not namespaced per school | Low (accepted) | Since Milestone 6 — tenant checks make ID-guessing irrelevant to authorization; full renamespace would touch every collection with a bare `studentId` foreign key |
| `TECH_DEBT.md` (repo root) references Railway as the production deploy target | Low | Stale — production is the VPS, not Railway; needs a correction pass |
| Railway backend still "Online," not decommissioned | Low–Medium | Not in the traffic path but still running (and likely costing money) |
| No frontend test suite (Playwright scaffolded, unpopulated) | Medium | Tracked separately from this security program |
| No CI/CD, no monitoring/alerting, no load testing | Medium | Explicitly out of this program's scope; recommended as its own future phase |

---

*Canonical sources this document summarizes: `SECURITY_ARCHITECTURE.md` (security), `docs/cto-context.md` (modules/roadmap/architecture detail), `docs/production-ops/09_CTO_CONTEXT_V3.md` (infrastructure), `docs/production-ops/31_SECURITY_HARDENING_PHASE_COMPLETION_REPORT.md` + `29_SECURITY_COVERAGE_MATRIX.md` + `30_PRODUCTION_READINESS_REPORT_V2.md` (this phase's full detail), `CHANGELOG.md` (chronological record). Update this file's relevant section(s) in the same commit as any milestone, deploy, or architectural change that affects it.*
