# Local development environment

**One command:**

```bash
npm run dev:local
```

Starts the Firebase Emulator Suite (Auth + Firestore + UI), seeds a deterministic
demo tenant, then starts the API and the web app — all wired to the emulator.

| Service | URL |
|---|---|
| App | http://localhost:5173 |
| API | http://localhost:5000 |
| Emulator UI | http://localhost:4000 |

## Prerequisite: Java

The **Firestore emulator requires a JRE** (the Auth emulator does not). Without
it, `npm run dev:local` stops with:

```
Could not spawn `java -version`. Please make sure Java is installed and on your system PATH.
```

Install a JRE 11+ — for example `winget install EclipseAdoptium.Temurin.21.JRE`
— then re-run. This is the only prerequisite beyond `npm install`.

## Demo accounts

All use password **`demo1234`**. They exist only inside the local Auth emulator.

| Role | Email |
|---|---|
| Super Admin | `super@demo.local` |
| Centre Owner | `owner@demo.local` |
| Principal (`admin`) | `principal@demo.local` |
| Centre Admin | `centeradmin@demo.local` |
| Teacher | `teacher@demo.local` |
| Reception | `reception@demo.local` |
| Accountant | `accountant@demo.local` |
| Parent | `parent@demo.local` |

## Why no seed script can reach production

Four independent conditions, all required, checked by
`yellowdot-backend/platform/devEnv/emulatorGuard.js` before any write:

1. **Demo project id** — the project is `demo-kueboxs`. Firebase treats any
   `demo-` prefixed project as offline-only and refuses to contact real Google
   services for it. The CLI confirms this on startup:
   *"Detected demo project ID … attempts to access non-emulated services for
   this project will fail."* This is the guard that holds when every other
   check is misconfigured, because the SDK enforces it, not us.
2. `FIRESTORE_EMULATOR_HOST` points at a loopback address.
3. `FIREBASE_AUTH_EMULATOR_HOST` points at a loopback address.
4. **No real credentials in the environment.** If `FIREBASE_SERVICE_ACCOUNT` or
   `GOOGLE_APPLICATION_CREDENTIALS` is set, a single wrong host variable could
   reach production — so their presence alone fails the check. `dev-local.mjs`
   blanks them for every child process.

`assertEmulatorOnly()` **throws**; it never warns and continues.

Separately, `assertDevNotPointedAtProduction()` runs at Admin SDK init and
refuses to boot when `APP_ENV=development` is wired to a real project — the
configuration this repo shipped with. It fires only for `development`, so
production and staging boots are untouched. `ALLOW_PROD_FROM_DEV=true` is the
explicit, greppable escape hatch.

13 tests cover these paths: `npm test` in `yellowdot-backend`, or
`node --test test/emulatorGuard.test.js`.

## Seeded data

Deterministic — fixed document ids and a seeded PRNG, so runs are byte-identical
and re-running overwrites rather than appends. Dates anchor to **today**, so the
surfaces have live data every day without reseeding.

| Data | Shape | Exercises |
|---|---|---|
| 18 students | 3 classes; one always has a birthday today | Birthdays widget |
| Attendance | 12 marked (10 present, 2 absent), **6 left unmarked** | Attendance widget + `attendance-pending` task |
| Pickup requests | 2 pending, 1 approved | Pickup widget + `pickup-approvals` task |
| Incidents | 1 open, 1 under review, 1 resolved | Incident widget + `open-incidents` task, all three statuses |
| Invoices | 14 across Overdue / Pending / Partial / Paid | Finance widget + `overdue-invoices` task |
| Daily Care | care logs, meals, naps for today | Daily Care module |
| CRM | 6 enquiries | Shape only — **no module consumes these yet** |
| Roles | 6 role documents **including `center_owner`** | The D1 gap, so that role can be validated |

**`center_owner` is seeded here but not in production.** That is discrepancy D1
in [review/INTEGRATION_VALIDATION.md](review/INTEGRATION_VALIDATION.md) — the
emulator seeds it so the role is testable; the production fix is still pending
review.

## Other commands

```bash
npm run dev:local:seed      # reseed against already-running emulators
npm run dev:local:noseed    # start without reseeding
```
