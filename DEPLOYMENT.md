# Yellow Dot — Deployment Guide (Parent Module)

> Covers deploying the Parent Module (Phases 1–4: Auth, Profile, Child Profile,
> Home Feed, Attendance, Memories). Feature development is paused after Phase 4.

> ## ⚠️ The backend is no longer on Railway
>
> It runs on a self-managed VPS (the same host as the apex `kueboxs.com`):
> the Express app as the `yd-backend` Docker container, behind **Caddy** which
> terminates TLS for `api.kueboxs.com`. The old Railway app is gone —
> `backend-production-3608.up.railway.app` now returns "Application not found".
>
> **The container is managed with plain `docker run`, not compose.**
> `docker inspect yd-backend` shows no compose labels, and
> `MASTER_PLATFORM_STATUS.md` §3 has recorded this for some time. The
> `deploy/docker-compose.yml` in this repo is reference material only and does
> not describe the live host.
>
> Deploy with
> `bash /opt/yd/backend/yellowdot-backend/deploy/deploy.sh` on the VPS.
>
> **Anything below that refers to Railway, `railway up`, `railway variables`
> or the `backend-production-3608` URL is superseded by this note.** Those
> sections are left in place as a record of the Parent Module release rather
> than rewritten, because their non-Railway detail has not been re-verified.

## Deployment status (latest run)

| Step | Target | Status |
|------|--------|--------|
| Firebase web config | `src/firebase/firebase.js` | ✅ **Fixed** — real appId/senderId/measurementId; verified in prod bundle |
| Firestore rules | `yellowdot-app` | ✅ **Deployed** (compiled successfully, released) |
| Frontend build | `yellowdot-frontend/dist` | ✅ **Built & verified** — Firebase config and `VITE_API_URL=https://api.kueboxs.com` embedded (not the dead Railway URL; see the verification greps below) |
| Backend (VPS) | `api.kueboxs.com` | ✅ **Current** — `329fb12`, deployed 2026-11-24. Check with `curl https://api.kueboxs.com/api/version`. |
| Hosting | `yellowdot-app` | ✅ **Current** — deployed 2026-11-24 from `329fb12`. The earlier "held pending backend" note is cleared: the backend has `/api/parent/*`. |

> Both rows above were wrong for roughly three months — the table claimed the
> backend sat at `1f631fe` (2026-08-18) when it had been redeployed several
> times since, and claimed Hosting was deliberately held when the reason for
> the hold no longer applied. **Treat this table as a hint and
> `/api/version` as the truth**; it is the only source that cannot drift,
> because the build stamps it in. Same for Hosting: compare the entry chunk in
> the live `index.html` against a fresh build.

**To deploy:**
```bash
# 1. Backend — on the VPS, as root. Pulls origin/master, builds an image
#    tagged with the commit SHA, recreates the container, smoke-tests it.
bash /opt/yd/backend/yellowdot-backend/deploy/deploy.sh

# 2. Frontend — locally, from the REPO ROOT (firebase.json lives there and
#    points at yellowdot-frontend/dist).
cd yellowdot-frontend && npm run build:production   # reads .env.production
cd .. && npx firebase deploy --only hosting
```

`build:production`, not `build`: a plain `npm run build` can pick up an empty
`VITE_API_URL` from the local dev setup, and that bundle calls `/api/*` on the
hosting domain, where every request 404s. Before deploying, confirm the API
URL is actually baked in:

```bash
grep -rl "api.kueboxs.com" yellowdot-frontend/dist/assets | head   # must match
grep -rn "localhost:" yellowdot-frontend/dist/assets | head        # must be empty
```

Rollback the backend to a previous image (tags are kept — `docker images yd-backend`):
```bash
docker stop yd-backend && docker rm yd-backend
docker run -d --name yd-backend --restart unless-stopped   -p 127.0.0.1:4000:8080 -v /opt/yd/secrets:/opt/yd/secrets   --env-file /opt/yd/backend.env yd-backend:<previous-sha>
```

### After a release that adds a module

`seedDefaultRoles()` is create-only — it never adds a newly introduced module
to a role document that already exists. A new module is therefore invisible to
every non-bypass account until its permission is granted, while `developer`
and `super_admin` see it working, because `can()` short-circuits for bypass
roles. Grant it on the live role docs:

```bash
cd /opt/yd/backend/yellowdot-backend
NODE_ENV=production SCHOOL_ID=<school>   GOOGLE_APPLICATION_CREDENTIALS=/opt/yd/secrets/firebase-service-account.json   node scripts/grantBillingRbac.js            # dry run; add --confirm to apply
```

> ⚠️ `deploy.sh` pulls **`origin/master`** — there is no way to ship a subset.
> Whatever is on master at that moment goes live, so check `git log` against
> the currently deployed commit (`curl https://api.kueboxs.com/api/version`)
> before running it.

---

## Architecture (as wired today)

| Layer | Host | Notes |
|-------|------|-------|
| Frontend (SPA) | **Firebase Hosting** — project `yellowdot-app` | Vite build → `yellowdot-frontend/dist` |
| Backend (Express API) | **VPS** — `https://api.kueboxs.com` (Caddy → `127.0.0.1:4000` → `yd-backend` container) | Frontend prod build targets this via `VITE_API_URL` |
| Auth / Firestore / Storage | **Firebase project `yellowdot-app`** | Web config hardcoded in `src/firebase/firebase.js` |

> ⚠️ **Two Firebase projects exist:** `yellowdot-app` (wired into the app) and
> `yellowdot-production-164d7` (not referenced in code/config). The app currently
> uses **`yellowdot-app`** for everything. Confirm the intended production target
> before deploying.
>
> ⚠️ **Backend is NOT Firebase Functions.** `firebase.json` contains a `functions`
> block and an `/api/**` rewrite, but production builds call the **Railway** URL
> directly (`.env.production`), bypassing the rewrite. The new `/api/parent/*`
> routes go live only when **Railway** is redeployed.
>
> ⚠️ **Deploy order matters:** backend (Railway) **before** frontend (Hosting),
> because the new parent screens depend on `/api/parent/*` existing.

---

## Firebase collections used (Parent Module)

| Collection | New? | Access in module | Purpose |
|------------|------|------------------|---------|
| `parents/{uid}` | **new** | read own / write backend (Admin SDK) | Parent identity, `studentIds[]` |
| `students/{id}` | existing | read (own children only) | Child profiles |
| `attendance/{id}` | existing | read (own children) | Attendance view |
| `holidays/{id}` | existing | read (backend) | Holidays (attendance + feed events) |
| `announcements/{id}` | existing | read (backend) | Feed: Announcement + Activity cards |
| `notices/{id}` | existing | read (backend, `type=Event`) | Feed: Event cards |
| `memories/{id}` | **new** | read (own children) / write staff | Photos & videos |

New collections this release: **`parents`**, **`memories`**.

---

## Storage paths used

The Parent Module is **read-only** for media — it renders URLs stored on
`memories/{id}`. It does **not** upload.

- **Bucket:** `yellowdot-app.firebasestorage.app`
- **Memory media (recommended convention):**
  `memories/{schoolId}/{studentId}/{memoryId}.<ext>`
  stored on the doc as `mediaUrl` (and `thumbnailUrl` for videos).
- **Storage security rules** are **not** managed in this repo (no `storage`
  block in `firebase.json`). Ensure memory media is readable by authenticated
  users (or use signed download URLs). Verify before relying on prod media.
- Note: student profile images are stored as **base64 in Firestore**
  (`students.profileImage`), not in Storage.

---

## Required environment variables

### Frontend (build-time, Vite)
| Var | Where | Value |
|-----|-------|-------|
| `VITE_API_URL` | `yellowdot-frontend/.env.production` | `https://api.kueboxs.com` |

> The Firebase **web** config is currently hardcoded in
> `src/firebase/firebase.js` (not read from `VITE_FIREBASE_*`). `messagingSenderId`
> and `appId` are **placeholders** — fill real values before/at deploy. Recommended:
> move config to `VITE_FIREBASE_*` env vars to avoid committing keys.

### Backend (Railway)
| Var | Purpose |
|-----|---------|
| `FIREBASE_SERVICE_ACCOUNT` | Admin SDK service-account JSON (string). Determines the Firestore project. |
| `SCHOOL_ID` | Tenant id (e.g. `ydseawoods`). |
| `PORT` | Provided by Railway. |
| (CORS / any others already set on Railway) | Keep existing values. |

---

## Deployment commands

```bash
# 0. From repo root: C:\yellowdotapp
PROJECT=yellowdot-app          # confirm target before running

# 1. BACKEND FIRST (Railway) — ships /api/parent/* routes
cd yellowdot-backend
railway up                     # (requires `railway link` to the backend project)
#   …or trigger a deploy by pushing to the Railway-connected branch.

# 2. Firestore rules (additive: parents, memories, parent read clauses)
cd ..
firebase deploy --only firestore:rules --project $PROJECT
# (optional) firebase deploy --only firestore:indexes --project $PROJECT

# 3. Frontend build + Hosting
cd yellowdot-frontend
npm ci
npm run build                  # outputs dist/ (uses .env.production)
cd ..
firebase deploy --only hosting --project $PROJECT
```

---

## Rollback steps

| Component | Rollback |
|-----------|----------|
| **Hosting** | `firebase hosting:rollback --project yellowdot-app` (or Firebase Console → Hosting → release history → roll back). |
| **Firestore rules** | `git revert` the `firestore.rules` change, then `firebase deploy --only firestore:rules --project yellowdot-app`. Rules are additive, so reverting only removes parent/memories access. |
| **Backend (VPS)** | `BACKEND_TAG=<previous-sha> docker compose -f /opt/yd/docker-compose.yml up -d` — `deploy.sh` tags each image with its commit SHA and keeps the last three. |

> Rules changes in this release are **additive and backward-compatible** — they
> only grant parents read access to their own children's docs and add the
> `parents`/`memories` collections. No existing staff access is removed.

---

## Deployment Readiness Checklist

### Pre-verified locally ✅
- [x] Production build passes (`vite build`).
- [x] Parent module is 100% theme-driven (0 hardcoded colours — grep verified).
- [x] Access control enforced in code: every `/api/parent/*` route runs
      `authenticate → blockUnknown → parentOnly → loadParent`; child / attendance
      / memories endpoints check `studentId ∈ parents.studentIds`.
- [x] Firestore rules add parent-account read clauses (ordered first via
      `exists()` so staff short-circuit safely) + `parents` & `memories` blocks.
- [x] Mobile layout reviewed at 390px (review-package screenshots).
- [x] Attendance aggregation unit-tested.

### Requires the actual deploy / live environment ⏳
- [ ] Backend deployed to Railway with `/api/parent/*` live. ⛔ blocked (Railway login)
- [x] Firestore rules deployed successfully (`firebase deploy --only firestore:rules`). ✅
- [ ] Hosting deploy succeeds. ⏸️ held until backend live
- [ ] Google login works for real parent accounts.
- [ ] Parent can access **only** linked children (test with 2 real parents).
- [ ] Feed loads from production data.
- [ ] Attendance loads from production data.
- [ ] Memories load from production Storage URLs.
- [ ] Multi-child switching works (test with a multi-child parent).
- [ ] No console errors on the live site.
- [ ] Mobile responsive check on a real device.

### Flags — resolution status
- [x] Firebase target confirmed: **`yellowdot-app`**.
- [x] Real `messagingSenderId` (`230256365087`) + `appId`
      (`1:230256365087:web:125297908a30fb5e28cf2a`) + `measurementId` set in
      `src/firebase/firebase.js`; verified embedded in the prod bundle, no
      placeholders remain.
- [ ] **Railway `FIREBASE_SERVICE_ACCOUNT` + `SCHOOL_ID`** — cannot verify from
      here (Railway CLI unauthorized). The existing backend already runs in prod
      against `yellowdot-app`, so `FIREBASE_SERVICE_ACCOUNT` is presumably set;
      the new parent routes reuse the same Admin SDK connection (no new secret).
      **Verify `SCHOOL_ID=ydseawoods`** (services fall back to `yd-main` if unset).
      Check: `railway variables` in `yellowdot-backend`.
- [ ] **Storage read for memory media** — no memories exist in prod yet (new
      collection, no upload UI built), so nothing to load today. Access model:
      the parent app renders `mediaUrl` directly via `<img>`/`<video>` (no Storage
      SDK/auth), so memory docs must store **tokenized Firebase download URLs**
      (`…?alt=media&token=…`) or public objects — then Storage rules don't block
      parents. Storage rules are console-managed (not in this repo). Verify when
      the first memory is added.
