# YELLOW DOT CRM — SYSTEM AUDIT
**Date:** 2026-06-01  
**Auditor:** CTO (AI-assisted, read-only, zero code changes)  
**Scope:** Full codebase — backend + frontend. No changes made.

---

## 1. EXECUTIVE SUMMARY

Yellow Dot CRM is a **multi-center childcare management platform** serving preschools in India. It covers student admissions, daily operations (attendance, nap, food), fee management, parent-facing features, and safety/surveillance infrastructure.

The system is a **modern, well-structured SPA** with a dedicated React 19 + Vite frontend and an Express 5 + Firebase Admin backend. Firebase Authentication handles all identity; Firestore is the only database. The application is currently deployed with the frontend on Vercel and the backend on Railway.

**Overall health: GOOD with some gaps.** Core operational modules (students, attendance, fees, food, nap, pickup) are production-ready. Several modules (Analytics, CCTV, Recurring Billing, OTP login, email notifications) are partially built or explicitly stubbed. No critical security holes were found — RBAC is consistently enforced at both the route and middleware layers.

**Key findings:**
- Firebase credentials partially hardcoded in `firebase.js` (`messagingSenderId` and `appId` are still `PASTE_*` placeholders — these must be populated before the frontend works in production)
- `recurringBilling.js` is **1 line** (empty stub)
- `invoiceAutomation.js` and `paymentTracking.js` exist but have unknown/limited implementation
- Email delivery is **not wired** — password-reset links are generated and logged server-side only
- OTP login is stubbed (`throw new Error("OTP login not available")`)
- CCTV streaming (Phase 2+) is not implemented — Phase 1 (metadata) is complete
- `payment-receipt` endpoint returns HTTP 501 (not implemented)
- Two separate `Sidebar.jsx` components exist (`components/Sidebar.jsx` and `components/common/Sidebar.jsx`) — likely dead code duplication
- `center_owner` role defined in frontend permissions but **missing** from backend `permissionsBackend.js` static map (present in `roleService.js` static fallback only)

---

## 2. FOLDER STRUCTURE

```
C:\yellowdotapp\
├── yellowdot-backend\           # Express 5 / Node 18 API server
│   ├── server.js                # App entry point — mounts all routes
│   ├── firebaseAdmin.js         # Firebase Admin SDK init
│   ├── package.json
│   ├── .env / .env.example
│   ├── config\
│   │   └── permissionsBackend.js  # RBAC role→permissions map (backend)
│   ├── routes\                  # 14 route modules
│   │   ├── authRoutes.js
│   │   ├── userRoutes.js
│   │   ├── attendanceRoutes.js
│   │   ├── napRoutes.js
│   │   ├── foodMenuRoutes.js
│   │   ├── foodConsumptionRoutes.js
│   │   ├── parentAttendanceRoutes.js
│   │   ├── pickupRoutes.js
│   │   ├── roleRoutes.js
│   │   ├── communicationRoutes.js
│   │   ├── securityRoutes.js
│   │   ├── qrRoutes.js
│   │   ├── cctvRoutes.js
│   │   └── invoiceRoutes.js     # (file exists — not mounted in server.js)
│   ├── controllers\             # Referenced by routes but NOT listed separately
│   │   (attendanceController, napController, parentAttendanceController,
│   │    pickupAuthorizationController, pickupMigrationController,
│   │    pickupHistoryController, securityController, cctvController)
│   ├── services\                # 24 service files
│   │   ├── studentService.js
│   │   ├── invoiceService.js
│   │   ├── attendanceService.js
│   │   ├── napService.js
│   │   ├── foodMenuService.js
│   │   ├── foodConsumptionService.js
│   │   ├── pickupAuthorizationService.js
│   │   ├── pickupHistoryService.js
│   │   ├── parentAttendanceService.js
│   │   ├── communicationService.js
│   │   ├── settingsService.js
│   │   ├── studentMedicalService.js
│   │   ├── studentNotesService.js
│   │   ├── userService.js
│   │   ├── roleService.js
│   │   ├── qrService.js
│   │   ├── securityService.js
│   │   ├── cctvService.js
│   │   ├── cameraTestService.js
│   │   ├── cryptoService.js
│   │   ├── otpService.js
│   │   ├── invoiceAutomation.js
│   │   ├── recurringBilling.js   # EMPTY (1 line)
│   │   └── paymentTracking.js
│   ├── middleware\
│   │   └── authMiddleware.js     # authenticate, authorize, blockUnknown, staffOnly, requireOwnChild
│   └── node_modules\
│
└── yellowdot-frontend\          # React 19 / Vite 8 SPA + PWA
    ├── src\
    │   ├── main.jsx
    │   ├── App.jsx              # Router + lazy page loading
    │   ├── firebase\
    │   │   └── firebase.js      # Firebase SDK init (⚠ 2 placeholders)
    │   ├── contexts\
    │   │   └── AuthContext.jsx  # Global auth state + permission helpers
    │   ├── config\
    │   │   ├── permissions.js   # Frontend RBAC (routes, roles, labels)
    │   │   ├── sidebarConfig.js # Nav menu groups + items
    │   │   └── rbacConfig.js
    │   ├── layouts\
    │   │   ├── MainLayout.jsx
    │   │   ├── AuthLayout.jsx
    │   │   └── ParentLayout.jsx
    │   ├── pages\               # 50+ page components
    │   ├── components\          # Shared components + UI primitives
    │   ├── services\            # 15 frontend API service files
    │   ├── utils\               # Helpers (currency, dates, invoices)
    │   └── design-system\
    │       └── theme.js
    ├── vite.config.js           # Vite + PWA + chunking config
    ├── .env / .env.example / .env.production
    └── node_modules\
```

---

## 3. FRONTEND ARCHITECTURE

| Attribute | Detail |
|-----------|--------|
| Framework | React 19.2 |
| Build Tool | Vite 8 |
| Router | React Router v7 |
| Styling | Tailwind CSS 3.4 + custom `yd-*` design system classes |
| Charts | Recharts 3.8 |
| PDF | jsPDF 4.2 + jsPDF-AutoTable 5 |
| QR Scan | html5-qrcode 2.3 |
| QR Render | qrcode.react 4.2 |
| Face Detection | @vladmandic/face-api 1.7 (TensorFlow.js based) |
| Animations | Framer Motion 12 |
| PWA | vite-plugin-pwa 1.3 / Workbox service worker |
| Google OAuth | @react-oauth/google 0.13 |
| HTTP Client | Axios 1.16 (shared instance with token interceptor in `authService.js`) |
| Firebase SDK | firebase 12.13 |

**Architecture patterns:**
- All API calls go through a single Axios instance (`api`) in `authService.js` which auto-attaches the Firebase ID token
- Auth state is managed in `AuthContext.jsx` using `onAuthStateChanged` and `/api/auth/me`
- Routes are protected by `ProtectedRoute` which calls `can(routeKey)` from `AuthContext`
- Pages are **lazy-loaded** (each becomes its own JS chunk)
- Code splitting: react/router, firebase, jspdf, recharts, face-api, qrcode — separate vendor chunks
- 30-minute inactivity auto-logout on all authenticated sessions
- Dev-only floating `DevRoleSwitch` component (tree-shaken in production)
- **Duplicate sidebar**: `src/components/Sidebar.jsx` AND `src/components/common/Sidebar.jsx` — need to audit which one `MainLayout` imports

---

## 4. BACKEND ARCHITECTURE

| Attribute | Detail |
|-----------|--------|
| Runtime | Node.js 18 |
| Framework | Express 5.2 |
| Auth | Firebase Admin SDK 13.10 (ID token verification) |
| Database | Firestore (Firebase Admin) |
| PDF | pdfkit 0.18 + jsPDF 4.2 |
| QR Server | qrcode 1.5 |
| Scheduling | node-cron 4.2 |
| Crypto | Node built-in `crypto` via `cryptoService.js` (AES-256-GCM for CCTV passwords) |
| OTP | `otpService.js` (exists, purpose unclear — no active route) |

**Architecture patterns:**
- `server.js` is the monolithic entry point — mounts all route modules plus inline student/invoice/settings/medical/notes routes
- `firebaseAdmin.js` initializes once and exports `{ admin, db, auth }`
- Two-layer auth: `authenticate` (Firebase token → `req.user`) + `authorize(...roles)` / `authorizeRoute(key)`
- Multi-tenant: every Firestore document stores `schoolId`; most store `centerId`
- `resolveContext(req)` helper inlines `schoolId`, `centerId`, `actorUserId` for all route handlers
- Services are pure Firestore wrappers (no ORM)
- Controllers folder exists but is referenced implicitly — not in the folder listing from glob (likely exists alongside routes)
- `invoiceRoutes.js` file exists in the routes folder but is **NOT mounted** in `server.js` — functionality is inline in `server.js` instead

---

## 5. FIRESTORE COLLECTIONS

| Collection | Purpose | Key Fields |
|---|---|---|
| `users` | Staff accounts | userId, email, name, role, schoolId, centerId, centers[], status, photoUrl |
| `students` | Student records | studentId (YD001…), studentName, dob, class, fatherEmail, motherEmail, centerId, schoolId, profileImage, qrEnabled |
| `attendance` | Daily check-in/out | entryId (ATT-date-studentId), date, studentId, status, checkIn, checkOut, method, markedBy |
| `naps` | Nap sessions | napId, studentId, startTime, wakeTime, date, duration, schoolId |
| `foodMenus` | Weekly menu items | menuId, week, day, meal, items[], schoolId, centerId |
| `foodConsumption` | Daily food log | id, studentId, date, meal, items consumed, schoolId |
| `invoices` | Fee invoices | invoiceId, invoiceNumber (INV-YYYYMM-NNNNN), studentId, amount, status (draft/sent/paid/partial/overdue), lineItems[], schoolId, centerId |
| `payments` | Payment records | paymentId, receiptNumber (RCPT-YYYYMM-NNNN), invoiceNumber, amount, mode, schoolId |
| `feeTemplates` | Reusable fee structures | templateId (TPL-…), name, lineItems[], schoolId, centerId |
| `pickupAuthorization` | Authorized pickup persons | id, studentId, pickupName, relation, mobile, photoUrl, isParent, isProtected, emergency |
| `pickupHistory` | Pickup event log | id, studentId, pickupPersonId, timestamp, method, staffId |
| `parentAttendance` | Parent check-in/out | id, studentId, date, gate, entryTime, exitTime, createdBy |
| `holidays` | School holidays | id (HOL-…), schoolId, title, startDate, endDate, type, recurring |
| `notices` | Formal communications | id, schoolId, title, body, type, status, targetRoles[], attachments[] |
| `announcements` | Quick feed posts | id, schoolId, title, body, type, createdBy |
| `cameras` | CCTV camera metadata | cameraId, cameraCode, cameraName, classroom, classrooms[], brand, ip, port, streamUrl, username, password (encrypted), channel, streamType, status, schoolId, centerId |
| `roles` | Dynamic role definitions | roleId (slug), schoolId, name, isSystem, permissions {moduleId: {action: bool}}, homeRoute |
| `settings` | App configuration | sectioned by key (school, branding, notifications, etc.) |
| `auditLogs` | System audit trail | userId, action, email, ip, timestamp |
| `qrCodes` | Center QR configs | centerId, qrDataUrl, qrPayload, generatedBy, generatedAt |
| `_counters` | Auto-increment IDs | doc `students` → count; doc `rcpt-{schoolId}-{YYYYMM}` → seq |
| `counters` | Receipt number sequences | seq, schoolId, period, updatedAt |

---

## 6. AUTHENTICATION SYSTEM

**Provider:** Firebase Authentication (Email/Password + Google OAuth)

**Flow:**
1. User signs in via Firebase Auth SDK (client-side)
2. Firebase issues an ID token (JWT, auto-refreshes every hour)
3. Every API request attaches `Authorization: Bearer <token>` via Axios interceptor
4. Backend `authMiddleware.js` calls `auth.verifyIdToken(token)` on every request
5. After token verification, middleware resolves the user profile in 3 steps:
   - **Step 1:** Direct UID lookup in `users/{uid}`
   - **Step 1b:** Email fallback (handles Google OAuth UID mismatch — auto-links new Google UID to existing password-based profile)
   - **Step 2:** Parent lookup (checks `students.fatherEmail` and `students.motherEmail`)
   - **Step 3:** Unknown role (no profile found — `profileMissing: true`)
6. `req.user` is attached with `{userId, email, role, schoolId, centerId, centers[], permissions, roleMatrix}`
7. Frontend `/api/auth/me` returns role + permissions → stored in `AuthContext`

**Account linking:** When a staff member with email/password tries Google OAuth for the first time, the `auth/account-exists-with-different-credential` error is caught. The Google credential is stored in `_pendingGoogleLink` and the user is directed to email login. After successful email login, the Google credential is linked via `linkWithCredential()`.

**Session security:**
- 30-minute inactivity auto-logout (browser events reset timer)
- Logout writes to `auditLogs` collection
- `/api/auth/refresh-permissions` busts server-side permission cache (60s TTL in `roleService.js`)

---

## 7. USER ROLES & PERMISSIONS

### Defined Roles

| Role | Bypass All? | Home Route | Key Access |
|------|-------------|------------|------------|
| `developer` | ✅ | `/` | Everything |
| `super_admin` | ✅ | `/` | Everything |
| `admin` | ❌ | `/` | All modules |
| `center_admin` | ❌ | `/` | All modules |
| `center_owner` | ❌ | `/` | Same as center_admin |
| `teacher` | ❌ | `/attendance` | Attendance, Nap, Food, Students (read), Comms |
| `accountant` | ❌ | `/invoice` | Fees, Invoices, Analytics, Students (read) |
| `reception` | ❌ | `/` | Students, Attendance, Parent Check-in, Pickup |
| `parent` | ❌ | `/parent-checkin` | Parent Check-In, Pickup History, Fees |

### Permission System Architecture
- **Route-level:** `can(routeKey)` in frontend; `authorize(...roles)` middleware in backend
- **Action-level:** `canDo(moduleId, action)` in frontend using `roleMatrix` from `/api/auth/me`
- **Dynamic roles:** `roles` Firestore collection allows per-school custom permission matrices (seeded from defaults via `POST /api/roles/seed`)
- **Static fallback:** `permissionsBackend.js` and `roleService.js` static maps used when no Firestore role doc exists

### ⚠️ Inconsistency Found
`center_owner` is defined in `permissions.js` (frontend) and `roleService.js` (static fallback) but is **absent** from `config/permissionsBackend.js`. This means center_owner users who hit a role that uses the static backend map may get degraded permissions.

---

## 8. SIDEBAR / NAVIGATION INVENTORY

### Staff Navigation Groups (sidebarConfig.js)

| Group | Items | Route Keys Required |
|-------|-------|---------------------|
| Overview | Live Dashboard, Quick Navigation | `dashboard` |
| People | Students, Staff, Roles & Permissions | `students`, `user-management`, `roles-permissions` |
| Finance | Fees, Invoices, Analytics | `fees`, `invoice`, `analytics` |
| Daily Ops | Nap Tracker, Food Menu, Consumption Log | `nap-tracker`, `food-menu`, `food-consumption` |
| Communications | Holidays, Notices, Announcements | `holidays`, `notices`, `announcements` |
| Presence & Safety | Attendance, Parent Entry, Pickup, Staff Checkout, QR Management | `attendance`, `parent-checkin`, `pickup-authorization`, `staff-checkout`, `qr-management` |
| Surveillance | CCTV | `cctv` |
| System | Settings | `settings` |
| Developer *(bypass only)* | Role Switcher, Module Explorer | — / `dev-tools` |

### Parent Navigation (flat, no groups)
Parent Check-In, Pickup History, My Fees

---

## 9. MODULE INVENTORY

### 9.1 Students Module
- **Purpose:** Full student lifecycle management — admissions, profiles, edit, medical records, notes
- **Pages:** `Students.jsx`, `NewAdmission.jsx`, `AddStudent.jsx`, `EditStudent.jsx`, `StudentProfile.jsx`
- **APIs:** `GET/POST /students`, `PUT /update-student/:id`, `DELETE /delete-student/:id`, `GET/PUT /api/student-medical/:studentId`, `GET/POST/DELETE /api/student-notes/:studentId`
- **Firestore:** `students`, `_counters`
- **Status:** ✅ Production-ready
- **Notes:** Parent records (Father/Mother) auto-created as protected pickup persons on admission. Student IDs are sequential (YD001, YD002…). Dual camelCase + PascalCase field mapping for legacy compatibility.

### 9.2 Attendance Module
- **Purpose:** Daily student check-in/out; QR scan; summary & history views
- **Pages:** `Attendance.jsx`
- **APIs:** `GET /api/attendance`, `POST /api/attendance/mark`, `PUT /api/attendance/:id/checkout`, `GET /api/attendance/summary`, `GET /api/attendance/inside`, `GET /api/attendance/history`, `POST /api/attendance/qr-scan`, `GET /api/qr/:studentId`, `GET /api/qr/batch`
- **Firestore:** `attendance`
- **Status:** ✅ Production-ready
- **Notes:** QR-based check-in supported. Method field tracks `Manual` vs `QR`. Deterministic IDs prevent duplicates.

### 9.3 Nap Tracker
- **Purpose:** Track daily nap sessions per student
- **Pages:** `NapTracker.jsx`
- **APIs:** `GET /naps/active`, `GET /naps/history`, `GET /naps/stats/today`, `POST /naps/start`, `POST /naps/wakeup`
- **Firestore:** `naps`
- **Status:** ✅ Production-ready

### 9.4 Food Menu Module
- **Purpose:** Manage weekly food menus
- **Pages:** `FoodMenu.jsx`, `ViewMenu.jsx`
- **Components:** `MenuCard.jsx`, `MenuEntryModal.jsx`, `EditMenuModal.jsx`, `DeleteConfirmModal.jsx`, `MealRow.jsx`
- **APIs:** food menu routes (from `foodMenuRoutes.js`)
- **Firestore:** `foodMenus`
- **Status:** ✅ Production-ready

### 9.5 Food Consumption Log
- **Purpose:** Record what each student ate per meal
- **Pages:** `FoodConsumption.jsx`
- **APIs:** food consumption routes (from `foodConsumptionRoutes.js`)
- **Firestore:** `foodConsumption`
- **Status:** ✅ Production-ready

### 9.6 Fees & Invoicing Module
- **Purpose:** Create/manage fee invoices, record payments, manage fee templates
- **Pages:** `Fees.jsx`, `Invoice.jsx`, `NewInvoice.jsx`, `InvoiceView.jsx`, `ReceiptView.jsx`, `FeeTemplates.jsx`, `GenerateInvoice.jsx`, `RecordPayment.jsx`
- **Components:** `InvoiceCard.jsx`, `InvoiceTable.jsx`, `PaymentCard.jsx`, `BillingStats.jsx`, `PaymentDrawer.jsx`, `PaymentCollectDrawer.jsx`, `ui/InvoiceCard.jsx`
- **APIs:** `GET/POST/PUT/DELETE /api/invoices`, `GET/POST /api/payments`, `GET/POST/PUT/DELETE /api/fee-templates`, legacy shims: `POST /save-invoice`, `GET /invoices`, `GET /invoice/:invoiceNumber`, `POST /record-payment`, `GET /payments`
- **Firestore:** `invoices`, `payments`, `feeTemplates`, `counters` (receipt numbers)
- **Status:** ✅ Mostly production-ready. Receipt PDF stub returns HTTP 501.
- **Missing:** `GET /payment-receipt/:invoiceNumber` returns 501. Email delivery not wired. `invoiceRoutes.js` file exists but is not mounted (all invoice routes inline in `server.js`).

### 9.7 Analytics Module
- **Purpose:** Financial analytics — revenue charts, collection rates, fee breakdown
- **Pages:** `Analytics.jsx`, `Reports.jsx`
- **APIs:** `/api/invoices`, `/api/payments` (aggregated in frontend)
- **Firestore:** `invoices`, `payments`
- **Status:** ⚠️ Partially complete — UI exists with Recharts but may be limited in depth.

### 9.8 Parent Check-In Module
- **Purpose:** Log parent entry/exit at gate; QR-validated gate workflow
- **Pages:** `ParentCheckIn.jsx`, `ParentDashboard.jsx`
- **APIs:** `GET /api/parent-attendance/validate-gate`, `GET /api/parent-attendance`, `POST /api/parent-attendance`
- **Firestore:** `parentAttendance`
- **Status:** ✅ Production-ready

### 9.9 Pickup Authorization Module
- **Purpose:** Manage authorized persons who can pick up a child; audit log
- **Pages:** `PickupAuthorization.jsx`, `PickupHistory.jsx`, `PickupMigration.jsx`
- **APIs:** `GET/POST/PUT/DELETE /api/pickup-authorization`, `GET /api/pickup-authorization/audit`, `GET/POST /api/pickup-history`, `POST /api/pickup-authorization/migrate-student`, `POST /api/pickup-authorization/migrate-bulk`, `GET /api/pickup-authorization/migration-status`
- **Firestore:** `pickupAuthorization`, `pickupHistory`
- **Status:** ✅ Production-ready. Migration tool included for bulk back-fill.
- **Notes:** Father/Mother auto-created as `isProtected` pickup persons on student admission.

### 9.10 Staff Checkout Module
- **Purpose:** Track staff departure from campus
- **Pages:** `StaffCheckout.jsx`
- **APIs:** (TBD — route via `securityRoutes.js` or inline)
- **Firestore:** TBD
- **Status:** ⚠️ Page exists; full backend implementation unclear from audit.

### 9.11 QR Management Module
- **Purpose:** Generate and manage center-level static QR codes for gate check-in
- **Pages:** `QRManagement.jsx`
- **APIs:** `GET /api/qr/center/:centerId`, `POST /api/qr/center/:centerId/generate`, `POST /api/qr/validate`
- **Firestore:** `qrCodes`
- **Status:** ✅ Production-ready (Phase 1 static QR)

### 9.12 CCTV Module
- **Purpose:** Register and manage security cameras; classroom mapping; connection testing
- **Pages:** `CCTV.jsx`
- **APIs:** `GET /api/cctv/cameras`, `GET /api/cctv/cameras/:id`, `POST /api/cctv/cameras`, `PUT /api/cctv/cameras/:id`, `DELETE /api/cctv/cameras/:id`, `POST /api/cctv/cameras/test`
- **Firestore:** `cameras`
- **Status:** ⚠️ Phase 1 (metadata) complete. No streaming, no live view, no HLS/WebRTC.
- **Missing:** Phase 2 (Live View), Phase 3 (Parent Access), Phase 4 (Streaming Engine / FFmpeg)
- **Notes:** Camera passwords stored encrypted (AES-256-GCM) when `CCTV_ENCRYPTION_KEY` env var is set; plaintext stored with a loud warning if key is absent.

### 9.13 Communications Module (Holidays / Notices / Announcements)
- **Purpose:** School calendar, parent notices, announcement feed
- **Pages:** `Holidays.jsx`, `Notices.jsx`, `Announcements.jsx`
- **APIs:** Full CRUD for each: `/api/holidays`, `/api/notices`, `/api/announcements`
- **Firestore:** `holidays`, `notices`, `announcements`
- **Status:** ✅ Production-ready

### 9.14 User Management Module
- **Purpose:** Create/edit/deactivate staff accounts; reset passwords
- **Pages:** `UserManagement.jsx`
- **APIs:** `GET/POST/PUT/DELETE /api/users`, `POST /api/users/:userId/reactivate`, `POST /api/users/:userId/reset-password`
- **Firestore:** `users`
- **Status:** ✅ Production-ready. Creates Firebase Auth + Firestore doc atomically.
- **Missing:** Email delivery for password-reset links (generated + logged, not sent).

### 9.15 Roles & Permissions Module
- **Purpose:** View and edit per-role permission matrices; create custom roles
- **Pages:** `RolesPermissions.jsx`
- **APIs:** `GET/POST/PUT/DELETE /api/roles`, `POST /api/roles/seed`, `PUT /api/roles/:roleId/permissions`, `GET /api/roles/:roleId/audit`
- **Firestore:** `roles`
- **Status:** ✅ Production-ready (CRUD + dynamic permission matrix)

### 9.16 Settings Module
- **Purpose:** School/app configuration by section
- **Pages:** `Settings.jsx`
- **APIs:** `GET /api/settings`, `PUT /api/settings/:section`, `GET/POST/PUT /api/settings/users`
- **Firestore:** `settings`
- **Status:** ⚠️ Partially complete — sections exist but depth of each section's UI is unknown from audit alone.

### 9.17 Auth & Profile Module
- **Purpose:** Login, Google OAuth, forgot/reset password, profile management, center selector
- **Pages:** `Login.jsx`, `Profile.jsx`, `SecuritySettings.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx`, `SelectCenter.jsx`, `ProfileIncomplete.jsx`, `Unauthorized.jsx`
- **APIs:** `GET /api/auth/me`, `POST /api/auth/logout`, `POST /api/auth/select-center`, `POST /api/auth/sync-user`, `POST /api/auth/refresh-permissions`
- **Status:** ✅ Production-ready
- **Notes:** Complex account-linking flow handled for Google-vs-password UID mismatch.

### 9.18 Live Dashboard
- **Purpose:** Real-time overview of today's attendance, fees, naps, alerts
- **Pages:** `LiveDashboard.jsx`
- **APIs:** Multiple aggregate calls to attendance/invoice/payment endpoints
- **Status:** ✅ Production-ready (UI confirmed, data driven)

### 9.19 Developer Tools
- **Purpose:** Role simulation, module explorer
- **Pages:** `dev/ModuleExplorer.jsx`, `DevRoleSwitch.jsx`
- **Status:** ✅ Dev-only (tree-shaken in production via `import.meta.env.DEV` guards)

### 9.20 Recurring Billing / Invoice Automation
- **Purpose:** Auto-generate monthly fee invoices
- **Services:** `recurringBilling.js` (empty), `invoiceAutomation.js`, `paymentTracking.js`
- **Status:** ❌ Not implemented. `recurringBilling.js` is a 1-line empty file.

---

## 10. API INVENTORY

### Auth
| Method | Path | Auth | Roles |
|--------|------|------|-------|
| GET | `/api/auth/me` | ✅ | All |
| POST | `/api/auth/logout` | ✅ | All |
| POST | `/api/auth/select-center` | ✅ | All |
| POST | `/api/auth/sync-user` | ✅ | All |
| POST | `/api/auth/refresh-permissions` | ✅ | All |

### Students
| Method | Path | Roles |
|--------|------|-------|
| GET | `/students` | All (parent: own child only) |
| GET | `/students/:id` | All |
| POST | `/add-student` | admin, center_admin, reception, super_admin, developer |
| PUT | `/update-student/:id` | admin, center_admin, teacher, reception, super_admin, developer |
| DELETE | `/delete-student/:id` | admin, super_admin, developer |

### Attendance
| Method | Path | Roles |
|--------|------|-------|
| GET | `/api/attendance` | Staff only |
| POST | `/api/attendance/mark` | Staff only |
| PUT | `/api/attendance/:id/checkout` | Staff only |
| GET | `/api/attendance/summary` | Staff only |
| GET | `/api/attendance/inside` | Staff only |
| GET | `/api/attendance/history` | Staff only |
| POST | `/api/attendance/qr-scan` | Staff only |
| GET | `/api/qr/:studentId` | Staff only |
| GET | `/api/qr/batch` | Staff only |

### Invoices & Payments (REST)
| Method | Path | Roles |
|--------|------|-------|
| GET | `/api/invoices` | Authenticated |
| POST | `/api/invoices` | admin, center_admin, accountant, super_admin, developer |
| PUT | `/api/invoices/:invoiceNumber` | admin, center_admin, accountant, super_admin, developer |
| DELETE | `/api/invoices/:invoiceNumber` | admin, super_admin, developer |
| GET | `/api/payments` | Authenticated |
| POST | `/api/payments` | admin, center_admin, accountant, super_admin, developer, teacher |
| GET | `/api/fee-templates` | Authenticated |
| POST/PUT/DELETE | `/api/fee-templates/:id` | admin, center_admin, accountant, super_admin, developer |
| POST | `/save-invoice` *(legacy)* | admin, center_admin, accountant, super_admin, developer, teacher |
| GET | `/invoices` *(legacy)* | Authenticated |
| POST | `/record-payment` *(legacy)* | admin, center_admin, accountant, super_admin, developer, teacher |
| GET | `/payments` *(legacy)* | Authenticated |
| GET | `/payment-receipt/:invoiceNumber` | Authenticated — **returns HTTP 501** |

### Student Medical / Notes
| Method | Path | Roles |
|--------|------|-------|
| GET | `/api/student-medical/:studentId` | Authenticated |
| PUT | `/api/student-medical/:studentId` | admin, center_admin, teacher, super_admin, developer |
| GET | `/api/student-notes/:studentId` | Authenticated |
| POST | `/api/student-notes/:studentId` | admin, center_admin, teacher, super_admin, developer |
| DELETE | `/api/student-notes/:studentId/:noteId` | admin, center_admin, teacher, super_admin, developer |

### Users
| Method | Path | Roles |
|--------|------|-------|
| GET | `/api/users` | admin, center_admin, center_owner, super_admin, developer |
| GET | `/api/users/:userId` | admin, center_admin, center_owner, super_admin, developer |
| POST | `/api/users` | admin, center_admin, center_owner, super_admin, developer |
| PUT | `/api/users/:userId` | admin, center_admin, center_owner, super_admin, developer |
| DELETE | `/api/users/:userId` | Soft-deactivate; admin+ |
| POST | `/api/users/:userId/reactivate` | admin+ |
| POST | `/api/users/:userId/reset-password` | admin+ |

### Roles
| Method | Path |
|--------|------|
| GET | `/api/roles` |
| POST | `/api/roles/seed` |
| GET/PUT/DELETE | `/api/roles/:roleId` |
| PUT | `/api/roles/:roleId/permissions` |
| GET | `/api/roles/:roleId/audit` |

### Communication
| Method | Path |
|--------|------|
| GET/POST/PUT/DELETE | `/api/holidays`, `/api/notices`, `/api/announcements` |

### Nap Tracker
| Method | Path |
|--------|------|
| GET | `/naps/active`, `/naps/history`, `/naps/stats/today` |
| POST | `/naps/start`, `/naps/wakeup` |

### Food
| Method | Path |
|--------|------|
| (CRUD) | Routes from `foodMenuRoutes.js` and `foodConsumptionRoutes.js` |

### Pickup
| Method | Path |
|--------|------|
| GET/POST/PUT/DELETE | `/api/pickup-authorization` |
| GET | `/api/pickup-authorization/audit` |
| POST | `/api/pickup-authorization/migrate-student`, `/api/pickup-authorization/migrate-bulk` |
| GET | `/api/pickup-authorization/migration-status` |
| GET/POST | `/api/pickup-history` |
| GET | `/api/pickup-history/:id` |

### Parent Attendance
| Method | Path |
|--------|------|
| GET | `/api/parent-attendance/validate-gate` |
| GET/POST | `/api/parent-attendance` |

### Security
| Method | Path |
|--------|------|
| GET | `/api/child-status/:studentId` |
| POST | `/api/pickup-request` |
| GET | `/api/pickup-requests` |
| PUT | `/api/pickup-requests/:id/approve`, `/api/pickup-requests/:id/reject` |

### QR Management
| Method | Path |
|--------|------|
| GET | `/api/qr/center/:centerId` |
| POST | `/api/qr/center/:centerId/generate` |
| POST | `/api/qr/validate` |

### CCTV
| Method | Path |
|--------|------|
| GET | `/api/cctv/cameras`, `/api/cctv/cameras/:id` |
| POST | `/api/cctv/cameras`, `/api/cctv/cameras/test` |
| PUT | `/api/cctv/cameras/:id` |
| DELETE | `/api/cctv/cameras/:id` |

### Settings
| Method | Path |
|--------|------|
| GET | `/api/settings` |
| PUT | `/api/settings/:section` |
| GET/POST/PUT | `/api/settings/users` |

### Health Check
| Method | Path |
|--------|------|
| GET | `/` — returns `{status, service, backend, uptime}` |

---

## 11. FIREBASE CONFIGURATION

**Project ID:** `yellowdot-app`  
**Auth Domain:** `yellowdot-app.firebaseapp.com`  
**Storage Bucket:** `yellowdot-app.firebasestorage.app`

### ⚠️ CRITICAL: Hardcoded Placeholders in firebase.js
```js
messagingSenderId: "PASTE_SENDER_ID",   // NOT SET
appId: "PASTE_APP_ID",                  // NOT SET
```
The `apiKey` and `authDomain` are real values. The `messagingSenderId` and `appId` are still placeholder strings. If these are needed for Cloud Messaging (push notifications), they must be filled in. If the app is working in production currently, these fields aren't blocking Firebase Auth/Firestore but they should be corrected regardless.

**Backend credential strategy:**
- Production: `FIREBASE_SERVICE_ACCOUNT` env var (JSON string) → Railway
- Local dev: `GOOGLE_APPLICATION_CREDENTIALS` env var (file path)
- Cloud Functions: GCP Application Default Credentials (auto-detected)

**Services used:**
- Firebase Authentication (Email/Password + Google OAuth)
- Firestore (all data)
- Firebase Admin SDK (backend only — token verification + Firestore)
- Firebase SDK (frontend — auth client only; Firestore read via `db` in `firebase.js` but most data fetched via REST API)

---

## 12. DEPLOYMENT ARCHITECTURE

| Layer | Platform | URL |
|-------|----------|-----|
| Frontend | Vercel (inferred) | Production build via `vite build` |
| Backend | Railway | `https://backend-production-3608.up.railway.app` |
| Database | Firestore | `yellowdot-app` project |
| Auth | Firebase Authentication | `yellowdot-app.firebaseapp.com` |

**Frontend → Backend communication:**
- Dev: `http://localhost:5000` (via `VITE_API_URL` in `.env`)
- Production: `https://backend-production-3608.up.railway.app` (via `.env.production`)

**CORS:** Backend reads `CORS_ORIGIN` env var (comma-separated list). Defaults to `http://localhost:5173,http://localhost:3000`. Production origin must be added.

**PWA:** Service worker with Workbox — precaches all static assets, SPA fallback for navigation, Network-First for Firestore/Cloud Functions, CacheFirst for ML models (30-day TTL).

**Node version:** Pinned to Node 18 in `package.json` `engines` field.

---

## 13. ENVIRONMENT VARIABLES

### Backend (`.env` / Railway)
| Variable | Required | Purpose |
|----------|----------|---------|
| `PORT` | Optional | HTTP port (default 5000) |
| `SCHOOL_ID` | Required | Default school tenant ID (e.g. `ydseawoods`) |
| `CORS_ORIGIN` | Required in prod | Allowed frontend origin(s) |
| `FIREBASE_SERVICE_ACCOUNT` | Required in prod | JSON string of Firebase service account key |
| `GOOGLE_APPLICATION_CREDENTIALS` | Local dev | Path to service account key file |
| `CCTV_ENCRYPTION_KEY` | Required before Phase 3 | 32-byte hex key for AES-256-GCM camera password encryption |

### Frontend (`.env` / Vercel)
| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_API_URL` | Required | Backend base URL |
| `VITE_FIREBASE_API_KEY` | Required | Firebase Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Required | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Required | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Required | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Required | FCM sender ID |
| `VITE_FIREBASE_APP_ID` | Required | Firebase app ID |

**⚠️ Note:** The frontend currently reads Firebase config from **hardcoded values** in `firebase.js` rather than from these `VITE_*` env vars. The env vars in `.env.example` are defined but the `firebase.js` file does not use them. This is a configuration debt — the file should be refactored to read `import.meta.env.VITE_FIREBASE_*`.

---

## 14. DATABASE SCHEMA

### `students/{studentId}`
```
studentId        string  YD001 format (atomic counter)
studentName      string
dob              string  YYYY-MM-DD
class            string  Daycare/Playgroup/Nursery/LKG/UKG/Class 1-5
admissionDate    string
gender           string
fatherName       string
fatherWhatsApp   string
fatherEmail      string  Used for parent auth lookup
motherName       string
motherWhatsApp   string
motherEmail      string  Used for parent auth lookup
status           string  Active/Inactive
centerId         string
schoolId         string
profileImage     string  base64 or URL
parentRegistered boolean
qrEnabled        boolean
createdAt        ISO8601
updatedAt        ISO8601
```

### `users/{uid}`
```
userId       string  Firebase UID
email        string
name         string
role         string  developer/super_admin/admin/center_admin/center_owner/teacher/accountant/reception
schoolId     string
centerId     string
center       string  (alias for centerId)
centers      string[]
phone        string
photoUrl     string
status       string  active/inactive
linkedUid    string  (present when Google UID was auto-linked to email UID)
createdAt    ISO8601
updatedAt    ISO8601
```

### `attendance/{ATT-date-studentId}`
```
entryId      string  ATT-{date}-{studentId}
date         string  YYYY-MM-DD
studentId    string
studentName  string
class        string
status       string  Present/Absent/Late
checkIn      string  HH:MM:SS
checkOut     string  HH:MM:SS
method       string  Manual/QR
centerId     string
schoolId     string
markedBy     string  userId
createdAt    ISO8601
updatedAt    ISO8601
```

### `invoices/{invoiceId}`
```
invoiceId       string  INV-{timestamp}
invoiceNumber   string  INV-YYYYMM-NNNNN
studentId       string
studentName     string
centerId        string
schoolId        string
amount          number
amountPaid      number
balance         number
status          string  draft/sent/paid/partial/overdue
lineItems       array   [{description, amount, quantity}]
dueDate         string
createdAt       ISO8601
updatedAt       ISO8601
createdBy       string
```

### `payments/{paymentId}`
```
paymentId       string  PAY-{timestamp}
receiptNumber   string  RCPT-YYYYMM-NNNN (Firestore transaction, monthly reset)
invoiceNumber   string
studentId       string
amount          number
mode            string  Cash/UPI/NEFT/Cheque
schoolId        string
centerId        string
createdAt       ISO8601
```

### `cameras/{cameraId}`
```
cameraId     string  (auto-ID)
cameraCode   string  unique within center
cameraName   string
classroom    string
classrooms   string[]
brand        string  Hikvision/Dahua/CP Plus/TP-Link/Other
ip           string
port         string
streamUrl    string  RTSP URL (credential-free)
username     string
password     string  AES-256-GCM encrypted (if key configured)
channel      string
streamType   string  main/sub
status       string  active/inactive/unknown
deleted      boolean
deletedAt    ISO8601
schoolId     string
centerId     string
createdAt    ISO8601
updatedAt    ISO8601
createdBy    string
updatedBy    string
```

### `roles/{roleId}`
```
roleId        string  slug (e.g. "teacher") or auto-ID
schoolId      string
name          string
description   string
color         string  hex
isSystem      boolean
isActive      boolean
homeRoute     string
permissions   object  { moduleId: { action: boolean } }
centerAccess  string[]
classAccess   string[]
usersCount    number
createdAt     ISO8601
updatedAt     ISO8601
createdBy     string
updatedBy     string
```

---

## 15. FEATURE STATUS MATRIX

| Module | Status | Frontend | Backend | Notes |
|--------|--------|----------|---------|-------|
| Login (Email/Google) | ✅ Complete | ✅ | ✅ | Account-linking handled |
| Student CRUD | ✅ Complete | ✅ | ✅ | Auto-creates pickup persons |
| Student Medical Records | ✅ Complete | ✅ | ✅ | |
| Student Notes | ✅ Complete | ✅ | ✅ | |
| Attendance (Manual) | ✅ Complete | ✅ | ✅ | |
| Attendance (QR scan) | ✅ Complete | ✅ | ✅ | |
| Nap Tracker | ✅ Complete | ✅ | ✅ | |
| Food Menu | ✅ Complete | ✅ | ✅ | |
| Food Consumption Log | ✅ Complete | ✅ | ✅ | |
| Invoices (CRUD) | ✅ Complete | ✅ | ✅ | Legacy + REST API |
| Payments (CRUD) | ✅ Complete | ✅ | ✅ | Receipt number auto-increments |
| Fee Templates | ✅ Complete | ✅ | ✅ | |
| Payment Receipt PDF | ❌ Stub | ✅ | ❌ | HTTP 501 |
| Parent Check-In | ✅ Complete | ✅ | ✅ | |
| Pickup Authorization | ✅ Complete | ✅ | ✅ | Migration tool included |
| Pickup History | ✅ Complete | ✅ | ✅ | |
| Staff Checkout | ⚠️ Partial | ✅ | ⚠️ | Page exists; backend TBC |
| Holidays | ✅ Complete | ✅ | ✅ | |
| Notices | ✅ Complete | ✅ | ✅ | |
| Announcements | ✅ Complete | ✅ | ✅ | |
| QR Management | ✅ Complete | ✅ | ✅ | Center-level static QR |
| CCTV (Metadata) | ✅ Complete | ✅ | ✅ | Phase 1 only |
| CCTV (Live View) | ❌ Not built | ❌ | ❌ | Phase 2 |
| CCTV (Parent Access) | ❌ Not built | ❌ | ❌ | Phase 4 |
| User Management | ✅ Complete | ✅ | ✅ | Password email: generated not sent |
| Roles & Permissions | ✅ Complete | ✅ | ✅ | Dynamic per-school permissions |
| Settings | ⚠️ Partial | ✅ | ✅ | Sections exist; depth TBC |
| Analytics / Reports | ⚠️ Partial | ✅ | ⚠️ | Frontend aggregates; no dedicated analytics endpoint |
| Recurring Billing | ❌ Not built | ❌ | ❌ | `recurringBilling.js` is empty |
| Email Notifications | ❌ Not built | ❌ | ❌ | Only console.log / link generation |
| OTP Login | ❌ Stubbed | ❌ | ❌ | Throws error in both layers |
| Push Notifications (FCM) | ❌ Not built | ❌ | ❌ | FCM config placeholders in firebase.js |
| Parent App (Dashboard) | ✅ Complete | ✅ | ✅ | Scoped to own child |
| Live Dashboard | ✅ Complete | ✅ | ✅ | Aggregates from multiple APIs |
| Developer Tools | ✅ Complete | ✅ | N/A | Tree-shaken in prod |
| Face Recognition (Pickup) | ⚠️ Partial | face-api loaded | ❌ | Library present, use unclear |

---

## APPENDIX A — COMPLETED MODULES

The following modules are fully functional and production-ready:

1. **Authentication** — email/password, Google OAuth, account-linking, inactivity logout, profile-missing state
2. **Students** — full CRUD, medical records, notes, QR flags, auto-create parent pickup records
3. **Attendance** — manual mark, QR scan, check-out, history, inside-now view
4. **Nap Tracker** — start/wake, history, today stats
5. **Food Menu** — weekly menu CRUD
6. **Food Consumption** — daily log CRUD
7. **Invoices & Payments** — full CRUD, legacy shims, receipt number auto-increment
8. **Fee Templates** — create/edit/delete
9. **Parent Check-In** — gate QR validation, entry/exit log
10. **Pickup Authorization** — authorized persons CRUD, audit log, bulk migration tool
11. **Pickup History** — log + lookup
12. **Holidays / Notices / Announcements** — full CRUD
13. **QR Management** — center QR generate + validate
14. **CCTV Phase 1** — camera metadata CRUD, classroom mapping, TCP connection test
15. **User Management** — create Firebase Auth + Firestore doc, deactivate, reactivate, reset link
16. **Roles & Permissions** — dynamic per-school permission matrix, seed defaults
17. **Live Dashboard** — real-time aggregate stats
18. **Parent Dashboard** — child-scoped view

---

## APPENDIX B — PARTIALLY COMPLETED MODULES

1. **Analytics** — UI exists with Recharts bar/pie charts; backend has no dedicated analytics aggregation endpoint; data is aggregated in the frontend from raw invoice/payment lists (not scalable at volume)
2. **Settings** — API exists for sectioned settings; UI page exists; completeness of individual setting sections not verified
3. **Staff Checkout** — Frontend page exists; backend route references a `securityController` but the staffCheckout use-case is not fully mapped in the audit
4. **CCTV Phase 2+** — Metadata phase complete; streaming/live view phases documented as future work but no implementation exists
5. **Student Profile Page** — Page exists; full feature set (tabs for medical, notes, invoices, attendance history) not fully audited

---

## APPENDIX C — EXPERIMENTAL / STUB MODULES

1. **OTP Login** — Both frontend (`loginWithOTP()`) and backend (`otpService.js`) stubs exist. Throws error when called.
2. **Payment Receipt PDF** — `GET /payment-receipt/:invoiceNumber` returns HTTP 501 intentionally.
3. **Recurring Billing** — `recurringBilling.js` is a single empty line. `invoiceAutomation.js` and `paymentTracking.js` exist but were not fully read; likely incomplete.
4. **Face Recognition** — `@vladmandic/face-api` is a production dependency. It is referenced in `vite.config.js` chunk config but its active usage in the app is not clear from the audit. Possibly used in pickup authorization photo matching.

---

## APPENDIX D — DEAD / UNUSED CODE

1. **`src/components/Sidebar.jsx`** — Duplicate of `src/components/common/Sidebar.jsx`. One is likely stale. Need to verify which one `MainLayout.jsx` imports.
2. **`routes/invoiceRoutes.js`** — The file exists in the `routes/` directory but is **never imported or mounted** in `server.js`. All invoice routes are defined inline in `server.js`. This file is dead.
3. **Legacy invoice API shims** (`/save-invoice`, `GET /invoices`, `POST /record-payment`, `GET /payments`) — These exist for backward compatibility but new frontend code should use `/api/invoices` and `/api/payments`. Long-term, the shims can be removed.
4. **`recurringBilling.js`** — 1-line empty file; effectively dead code.
5. **`src/pages/Reports.jsx`** — Page exists in the file listing but has no route in `App.jsx`. It is unreachable from the running app.

---

## APPENDIX E — RECOMMENDED NEXT PRIORITIES

Listed by impact and estimated effort:

### 🔴 Critical Fixes (do immediately)
1. **Fix `firebase.js` hardcoded placeholders** — Replace `"PASTE_SENDER_ID"` and `"PASTE_APP_ID"` with real values from the Firebase Console. Refactor to use `VITE_*` env vars.
2. **Add `center_owner` to `permissionsBackend.js`** — The role is defined everywhere else but missing from the backend static map, causing potential permission degradation.
3. **Add `CORS_ORIGIN` for production frontend** on Railway backend env.

### 🟡 High Value (next sprint)
4. **Wire email delivery** — Integrate SendGrid, Resend, or nodemailer to actually send password-reset emails. Currently the link is only logged server-side.
5. **Payment Receipt PDF** — Implement `GET /payment-receipt/:invoiceNumber` using pdfkit (library already installed). Returns 501 today.
6. **Remove dead `routes/invoiceRoutes.js`** — Or mount it and remove the inline routes from `server.js` to reduce server.js bloat.
7. **Resolve Sidebar.jsx duplication** — Confirm which file is live, delete the other.
8. **`Reports.jsx` route** — Either add a `/reports` route in `App.jsx` or delete the page.

### 🟢 Medium Priority (next month)
9. **Analytics backend endpoint** — Create `/api/analytics` that returns pre-aggregated revenue, collection-rate, class-breakdown. Frontend aggregating raw lists won't scale.
10. **Set `CCTV_ENCRYPTION_KEY` in production** — Before Phase 2 (Live View), all camera passwords must be encrypted at rest.
11. **Implement Recurring Billing** — `recurringBilling.js` is completely empty; `node-cron` is already installed for scheduling.
12. **CCTV Phase 2 (Live View)** — HLS/WebRTC streaming behind the RTSP URL infrastructure already built in Phase 1.
13. **Audit `face-api` usage** — Determine if `@vladmandic/face-api` is actively used. If not, remove it (it's a large dependency adding ~30MB to the vendor-face-api chunk).
14. **Staff Checkout** — Clarify and complete backend implementation.

### 🔵 Long-term / Future
15. **OTP / Phone login** — Firebase Phone Auth integration.
16. **Push Notifications (FCM)** — Announcements and parent alerts via FCM.
17. **CCTV Phase 3 (Parent Access)** — Gated live feed for parents.
18. **Multi-school support** — `schoolId` is already on every document; admin console for managing multiple schools would unlock B2B scaling.
19. **Migrate `server.js` inline routes to route modules** — Students, invoices, medical, notes, settings are all inline. Moving them to their own route files (like the rest) would improve maintainability.
