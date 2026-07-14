# Yellow Dot CRM — CTO Context Document
## Version 2.0 — Master Planning Document

> **Single source of truth for project status, architecture, and long-term product strategy.**
> Last updated: 2026-07-14 · Version: 2.0 (Security & Tenant Isolation section added and updated through Milestone 16; HR module status corrected — see that section for detail)
> Update this file after every major feature addition, removal, architectural decision, or module promotion.

---

## Table of Contents

1. [Product Overview](#product-overview)
2. [Current Module Inventory](#current-module-inventory)
3. [System Architecture](#system-architecture)
4. [Roles & Permissions](#roles--permissions)
5. [Current Route Map](#current-route-map)
6. [API Inventory](#api-inventory)
7. [Firestore Collections](#firestore-collections)
8. [Feature Status](#feature-status)
9. [Recent Decisions Log](#recent-decisions-log)
10. [Current Build Roadmap](#current-build-roadmap)
11. [Future Product Roadmap](#future-product-roadmap)
12. [Security & Tenant Isolation](#security--tenant-isolation)
13. [CTO Summary Report](#cto-summary-report)
14. [Vision 2027](#vision-2027)

---

## Product Overview

### Vision

Yellow Dot is a modern preschool management platform that replaces fragmented tools — spreadsheets, paper registers, WhatsApp groups, scattered billing sheets — with a unified digital ecosystem. The platform serves three distinct audiences:

- **School Staff & Admin** — a full CRM for daily operations: attendance, billing, care, academics, CCTV, communication
- **Parents** — a warm, mobile-first app that keeps families connected to their child's day in real time, with a unified child journey timeline
- **Platform Owner (Super Admin)** — a multi-tenant SaaS dashboard to onboard, manage, and monitor multiple preschools

The long-term vision is a complete, AI-enhanced preschool operating system: every action a school takes — from admitting a child to generating a report card — happens inside Yellow Dot.

### Target Users

| Persona | Role in Product |
|---------|----------------|
| **Super Admin / Platform Owner** | Manages all tenant schools, subscription billing, impersonation, platform analytics |
| **School Admin / Center Owner** | Manages their center, configures modules, views analytics, approves settings |
| **Principal** | Oversees academic and operational performance across classrooms |
| **Teacher** | Daily attendance, nap, food, care, observations, artwork, milestones |
| **Accountant** | Invoices, fee templates, payment recording, financial reports |
| **Reception** | Pickup management, visitor gate log, QR scanning, student check-in |
| **Parent** | Mobile-first view of child's daily activity, journey timeline, fees, communication |
| **Student** *(future K-12)* | Personal academic portal, assignments, timetable |

### Deployment Environments

| Environment | App Name | Purpose | URL |
|-------------|----------|---------|-----|
| **Development** | Yellow Dot | Active development & testing | Local / `yellowdot-app` Firebase Hosting |
| **Production** | KUE Boxs Care | Live school in production | Firebase Hosting + Railway backend |

- Backend: **Railway** (Node.js, Express 5)
- Frontend: **Firebase Hosting** (Vite SPA)
- Database: **Firestore** (Firebase project: `yellowdot-app`)
- School ID (Yellow Dot staging): `yd-main`
- School ID (KUE Boxs Care production): `ydseawoods`
- Feature flags control which modules are visible per environment (`src/config/featureFlags.js`)
- New modules default to `isPreProduction` (Yellow Dot only), promoted via Staged Releases dashboard

### Current Development Stage

**Beta — Active Feature Development.** Core staff CRM is fully operational in production (KUE Boxs Care). Parent Module V2 is live. Child Journey Module (Phases 1–3.5) is complete on staging. Multi-tenant SaaS layer is built and deployed. Staged Releases governance dashboard is live.

---

## Current Module Inventory

### Completed Modules

| Module | Area | Production? | Notes |
|--------|------|------------|-------|
| Authentication (Firebase Auth) | Core | ✅ | Email/password + Google OAuth |
| User Management (staff CRUD) | Admin | ✅ | |
| Roles & Permissions (RBAC) | Admin | ✅ | Custom roles + audit trail |
| Student Management | Core | ✅ | |
| Attendance (staff, QR scan) | Daily Ops | ✅ | Check-in/out + QR |
| Nap Tracker (staff) | Daily Ops | ✅ | |
| Food Menu Management | Daily Ops | ✅ | |
| Food Consumption Tracking | Daily Ops | ✅ | |
| Care & Hygiene Logging | Daily Ops | ✅ | Motion/Both/Diaper |
| Billing / Invoices | Finance | ✅ | |
| Fee Templates | Finance | ✅ | |
| Payment Recording | Finance | ✅ | |
| Pickup Authorization | Security | ✅ | |
| Pickup History | Security | ✅ | |
| Staff Checkout | Security | ✅ | |
| Parent Visitor Gate Log | Security | ✅ | parentAttendance |
| Holidays / Notices / Announcements | Communication | ✅ | |
| QR Code Management | Security | ✅ | Per-student, batch, center |
| CCTV — Camera Management | CCTV | ✅ | Internal metadata CRUD only |
| Parent Module — Auth & Profile | Parent App | ✅ | |
| Parent Module — Home Feed | Parent App | ✅ | Priority-first highlights carousel |
| Parent Module — Attendance View | Parent App | ✅ | |
| Parent Module — Fees View | Parent App | ✅ | |
| Parent Module — Daily Care Hub | Parent App | ✅ | Nap / Food / Care |
| Parent Module — Food Menu View | Parent App | ✅ | |
| Parent Module — Food Consumption View | Parent App | ✅ | |
| Parent Module — Care & Hygiene View | Parent App | ✅ | |
| Parent Module — Holidays View | Parent App | ✅ | |
| Parent Module — Push Notifications (V2) | Parent App | ✅ | 17 types, FCM |
| Parent Module — Notification Center | Parent App | ✅ | |
| Multi-Tenant SaaS Layer | Platform | ✅ | tenants collection, impersonation |
| Super Admin — Tenant List | Platform | ✅ | |
| Super Admin — Tenant Create | Platform | ✅ | |
| Super Admin — Tenant Detail | Platform | ✅ | Branches, academic years, audit |
| Super Admin — Platform Analytics | Platform | ✅ | |
| Super Admin — Audit Logs | Platform | ✅ | |
| Super Admin — Impersonation | Platform | ✅ | Firebase custom token |
| Staff Attendance (HR) | HR | ✅ | `staffAttendanceRoutes.js` — not previously reflected in this doc |
| Leave Management (HR) | HR | ✅ | `leaveRoutes.js`; tenant-isolation hardened Milestone 12 (2026-07-14) |
| Payroll (HR) | HR | ✅ | `payrollRoutes.js`; tenant-isolation hardened Milestone 12 (2026-07-14) |
| Performance Management (HR) | HR | ✅ | `performanceRoutes.js`; tenant-isolation hardened Milestone 12 (2026-07-14) |
| Departments & Designations (HR) | HR | ✅ | `departmentRoutes.js`/`designationRoutes.js`; hardened Milestone 12 (2026-07-14) |
| Staged Releases Dashboard | Dev/Ops | ✅ | Module promotion + rollback governance |
| Feature Flags System | Dev/Ops | ✅ | Per-environment flag control |
| Two-Environment Strategy | Dev/Ops | ✅ | Yellow Dot ↔ KUE Boxs Care |
| Child Journey — Observations (Phase 1) | Child Journey | ✅ Staging | journeyEntries collection |
| Child Journey — Parent Journey Timeline (Phase 2) | Child Journey | ✅ Staging | Unified timeline at /parent-journey |
| Child Journey — Artwork Upload (Phase 3) | Child Journey | ✅ Staging | Firebase Storage, 5 categories |
| Child Journey — Milestone Engine (Phase 3) | Child Journey | ✅ Staging | Auto + teacher-created milestones |
| Child Journey — 5-Category UX (Phase 3.5) | Child Journey | ✅ Staging | Hybrid Instagram timeline |

### In Progress

| Module | Area | Status Notes |
|--------|------|-------------|
| Academics — Classes | Academics | Pages scaffolded; backend shallow |
| Academics — Batches | Academics | Pages scaffolded; backend shallow |
| Academics — Teacher Allocation | Academics | Pages scaffolded |
| Academics — Classroom Allocation | Academics | Pages scaffolded |
| Academics — Student Allocation | Academics | Pages scaffolded |
| Analytics Dashboard | Admin | Page exists; data depth limited |
| Live Dashboard | Admin | Currently-checked-in view |
| Pickup Request Approval Workflow | Security | Backend done; frontend partial |
| Memories / Journey Staff Upload UI | Content | Backend done; no upload UI |
| Recurring Billing Automation | Finance | invoiceAutomation.js partial |
| Child Journey — Annual Memory Book PDF | Child Journey | Phase 4 — not started |

### Planned

| Module | Area | Notes |
|--------|------|-------|
| CCTV — Live Streaming (Phase 3) | CCTV | Blocked on CCTV-V2-TD-001 |
| CCTV — Parent Live View (Phase 4) | CCTV | Blocked on Phase 3 |
| Parent Module — Leave Requests (Phase 6) | Parent App | leaveRequests collection needed |
| Parent Module — Events Calendar (Phase 7) | Parent App | |
| Online Payments / Payment Gateway | Finance | Razorpay/Stripe |
| Invoice PDF (parent-facing) | Finance | jsPDF available, not wired |
| Visitor Management (beyond parent gate) | Operations | Not started |
| Transport Management | Operations | Not started |
| Inventory & Asset Management | Operations | Not started |
| AI School Assistant | AI | Not started |
| AI Admission Assistant | AI | Not started |
| AI Report Card Generator | AI | Not started |
| Parent-Teacher Chat | Parent App | Not started |
| Digital Portfolio (downloadable) | Parent App | Annual Memory Book is Phase 4 |
| Parent Document Vault | Parent App | Not started |
| Admissions CRM / Lead Pipeline | Admissions | Not started |
| Enquiry Management | Admissions | Not started |

### Deprecated

| Module | Notes |
|--------|-------|
| Google Sheets Integration | Migrated to Firestore 2026-05-16. Code archived in `yellowdot-backend/_legacy/`. |
| Parent `/parent-memories` route | Replaced by `/parent-journey` — redirects in place |
| `memories` Firestore collection | Superseded by `journeyEntries`. Had 0 documents; never migrated. |

---

## System Architecture

### Frontend Structure

```
yellowdot-frontend/
├── src/
│   ├── components/          # Shared UI components
│   ├── config/
│   │   ├── permissions.js   # Frontend RBAC mirror
│   │   ├── featureFlags.js  # Feature flags (FLAGS map, isEnabled, useFeatureFlag)
│   │   ├── environment.js   # APP_ENV, APP_NAME, isPreProduction
│   │   ├── releaseNotes.js  # Changelog + CURRENT_VERSION
│   │   ├── sidebarConfig.js # Sidebar navigation groups
│   │   └── rbacConfig.js    # Granular RBAC category config
│   ├── contexts/            # AuthContext (Firebase Auth state)
│   ├── design-system/       # Design tokens and theme primitives
│   ├── firebase/            # Firebase client SDK init (auth, db, storage)
│   ├── layouts/
│   │   └── MainLayout.jsx   # Staff shell (sidebar + topbar + ImpersonationBanner)
│   ├── modules/
│   │   └── parent/          # Self-contained parent module
│   │       ├── components/  # ParentLayout.jsx (bottom-nav: Home · Daily Care · Profile)
│   │       ├── pages/       # 14 parent screens
│   │       ├── hooks/       # 13 data hooks
│   │       ├── services/    # parentService.js, notificationService.js
│   │       ├── routes/      # parentRoutes.jsx
│   │       ├── theme/       # Yellow-branded design tokens
│   │       └── types/       # JSDoc typedefs
│   ├── pages/               # 45+ staff-facing page components
│   │   ├── auth/            # Login, SelectCenter, Profile, SecuritySettings
│   │   ├── academics/       # 5 academic management pages
│   │   ├── superadmin/      # TenantList, TenantCreate, TenantDetail, PlatformAnalytics, AuditLogs, ImpersonateLogin
│   │   ├── releases/        # ReleasesDashboard (staged release governance)
│   │   └── dev/             # ModuleExplorer
│   ├── services/            # 24+ API client modules (axios-based)
│   ├── utils/
│   │   └── academicYear.js  # getAcademicYear(), currentAcademicYear()
│   └── styles/              # Global CSS, Tailwind base
├── tailwind.config.js       # yd.* token namespace
├── vite.config.js
└── package.json
```

**Tech stack:**
- React 19 + React Router DOM 7 (SPA)
- Vite 8 (build tooling with per-env .env files)
- Tailwind CSS (`yd.*` token namespace)
- Axios (HTTP client)
- Firebase SDK 12 (auth, Firestore client, FCM web push, Storage)
- Framer Motion (animations)
- Recharts (analytics charts)
- jsPDF + jsPDF-Autotable (PDF generation)
- HLS.js (CCTV video playback, ready)
- html5-qrcode + qrcode.react (QR scanning/display)
- Playwright (E2E testing, scaffolded)
- Font: Plus Jakarta Sans

**Brand tokens (Tailwind `yd.*`):**
- `yd.bg` = `#FFFDF7` · `yd.sidebar-bg` = `#FFFBEA`
- `yd.yellow` = `#F4C400` · `yd.border` = `#ECE7D8`
- `yd.text` = `#2A2A2A` · `yd.charcoal` = `#1E1E1E`

**Parent Module theme** (separate from staff): `src/modules/parent/theme/` — Yellow-first design system (colors, spacing, typography). Green is success-only, never primary.

### Backend Structure

```
yellowdot-backend/
├── config/
│   └── permissionsBackend.js    # Static role→permissions map
├── controllers/
│   ├── careController.js
│   └── tenantController.js
├── middleware/
│   ├── authMiddleware.js        # Firebase token verification + role resolution
│   └── tenantMiddleware.js      # 60s cached tenant status enforcement
├── routes/                      # 20+ route modules
├── services/                    # 46+ business logic modules
├── scripts/
│   ├── seedAdmin.js             # Bootstrap super_admin
│   ├── seedTenant.js            # Seed yd-main tenant doc
│   ├── genBuildInfo.js          # Build metadata
│   └── migrateMemoriesToJourney.js  # One-time migration (0 records)
├── utils/
│   └── academicYear.js          # getAcademicYear(), currentAcademicYear()
├── firebaseAdmin.js             # Firebase Admin SDK (exports admin, db, auth)
├── server.js                    # Express entry point + Cloud Functions export
└── package.json
```

**Tech stack:**
- Node.js 18 + Express 5
- firebase-admin 13 (Firestore, Auth, FCM)
- firebase-functions 4 (Cloud Functions deployment target)
- cors, dotenv, body-parser
- bcryptjs (password hashing)
- jsonwebtoken
- jsPDF + PDFKit (server-side PDF)
- qrcode (QR generation)
- node-cron (scheduled tasks)
- Moment.js (date handling)
- Native crypto (AES-256-GCM for CCTV credential encryption)

### Database Structure

All documents are scoped to `schoolId` (= `tenantId`). Every Firestore query filters by `schoolId` to enforce tenant isolation. See Firestore Collections section for full detail.

Academic year: `June 1 → May 31`, format `"2026-27"`. Auto-assigned from `date` field via `getAcademicYear()` — never set manually by staff.

### Storage Structure

Firebase Cloud Storage (initialized via `firebase.js` `storage` export):
- Student profile photos
- Journey media (artwork, photos, videos) — uploaded via `storageService.uploadArtwork()` / `uploadJourneyMedia()`
- Invoice PDFs (planned)

### Authentication Flow

```
1. User opens app → Firebase Auth SDK checks session
2. No session → redirect to /login
3. Login: email/password or Google OAuth → Firebase ID token issued
4. Every API call: Authorization: Bearer <ID_TOKEN>
5. authMiddleware.js:
   a. Verifies token: firebase-admin auth.verifyIdToken()
   b. Looks up users/{uid} in Firestore (role, schoolId, centerId)
   c. Fallback: email match (handles Google OAuth UID migration; auto-links)
   d. Fallback: parent lookup (fatherEmail/motherEmail in students collection)
   e. Resolves permissions: static map + custom role override from roles collection
   f. Attaches req.user = { userId, email, role, schoolId, centerId, permissions, roleMatrix }
6. tenantMiddleware.js (enforceTenant): checks tenants/{schoolId}.status
   → trial expired → 403 TRIAL_EXPIRED
   → suspended → 403 TENANT_SUSPENDED
7. Route guards: authenticate → enforceTenant → authorize(roles) → staffOnly / requireOwnChild
8. profileMissing=true → frontend redirects /profile-incomplete
9. role="unknown" → blockUnknown middleware → 403
```

**Impersonation flow (Super Admin):**
```
Super Admin → TenantDetail → "Impersonate" → POST /api/tenants/:id/impersonate
→ Firebase custom token (schoolId, role="admin", isImpersonation=true)
→ New tab: /impersonate?token=&tenantId=
→ ImpersonateLogin.jsx: signInWithCustomToken() + sessionStorage flag
→ MainLayout: yellow ImpersonationBanner + "Exit Session"
→ All actions logged in tenantAuditLogs
```

### Feature Flag System

```
src/config/featureFlags.js
  FLAGS = { MODULE_KEY: true | isPreProduction }
  isEnabled(flag): returns bool per current environment
  useFeatureFlag(flag): React hook

Staged Releases Dashboard (/releases):
  releaseModules/{schoolId}_{moduleKey}  — per-module status overrides
  releaseAudits/{auditId}                — immutable audit trail
  Promote workflow: Testing → Production (requires version + release note)
  Rollback workflow: Production → Testing (requires reason)
```

---

## Roles & Permissions

| Role | Bypass RBAC | Home Route | Core Access |
|------|-------------|------------|-------------|
| `developer` | ✅ Yes | `/` | `["*"]` — all modules, all environments |
| `super_admin` | ✅ Yes | `/` | `["*"]` — all modules + platform admin |
| `admin` | No | `/` | All 20+ staff modules |
| `center_owner` | No | `/` | All modules for assigned center |
| `center_admin` | No | `/` | All modules for assigned center |
| `principal` | No | `/` | Dashboard, academics, students, attendance, analytics, communication |
| `teacher` | No | `/attendance` | attendance, nap-tracker, food-*, care-hygiene, students, child-journey, staff-checkout, cctv, holidays, notices, announcements, academics |
| `accountant` | No | `/invoice` | dashboard, fees, invoice, analytics, students |
| `reception` | No | `/` | dashboard, students, attendance, parent-checkin, pickup-authorization, pickup-history, staff-checkout |
| `parent` | No | `/parent-home` | dashboard, profile, fees — all scoped to own children via requireOwnChild |

**RBAC implementation:**
- Static baseline: `yellowdot-backend/config/permissionsBackend.js`
- Custom overrides: `roles` Firestore collection (per-school, editable at `/roles-permissions`)
- `roleMatrix`: granular `{ moduleId: { action: bool } }` for button-level UI enforcement
- Permission cache: 60-second TTL in `roleService.js`
- Audit trail: `permissionAuditLogs` collection
- Frontend mirror: `yellowdot-frontend/src/config/permissions.js`

---

## Current Route Map

### Staff Routes

| Path | Component | Permission Key |
|------|-----------|---------------|
| `/login` | Login | public |
| `/profile-incomplete` | ProfileIncomplete | auth |
| `/select-center` | SelectCenter | protected |
| `/unauthorized` | Unauthorized | protected |
| `/` | RootRedirect | protected |
| `/profile` | Profile | profile |
| `/settings/security` | SecuritySettings | settings |
| `/live-dashboard` | LiveDashboard | dashboard |
| `/quick-nav` | QuickNav | dashboard |
| `/analytics` | Analytics | analytics |
| `/students` | Students | students |
| `/students/new` | NewAdmission | students |
| `/add-student` | AddStudent | students |
| `/edit-student/:id` | EditStudent | students |
| `/student-profile/:id` | StudentProfile | students |
| `/attendance` | Attendance | attendance |
| `/nap-tracker` | NapTracker | nap-tracker |
| `/food-menu` | FoodMenu | food-menu |
| `/food-consumption` | FoodConsumption | food-consumption |
| `/care-hygiene` | CareHygiene | care-hygiene |
| `/child-journey` | ChildJourney | child-journey |
| `/child-journey/observe` | NewObservation | child-journey |
| `/child-journey/artwork` | NewArtwork | child-journey |
| `/child-journey/milestone` | NewMilestone | child-journey |
| `/invoice` | Invoice | invoice |
| `/invoice/new` | NewInvoice | invoice |
| `/invoice/templates` | FeeTemplates | invoice |
| `/invoice-view/:invoiceNumber` | InvoiceView | invoice |
| `/receipt/:receiptId` | ReceiptView | invoice |
| `/fees` | Fees | fees |
| `/generate-invoice` | GenerateInvoice | invoice |
| `/record-payment/:invoiceNumber` | RecordPayment | fees |
| `/cctv` | CCTV | cctv |
| `/qr-management` | QRManagement | qr-management |
| `/pickup-authorization` | PickupAuthorization | pickup-authorization |
| `/pickup-history` | PickupHistory | pickup-history |
| `/staff-checkout` | StaffCheckout | staff-checkout |
| `/pickup-migration` | PickupMigration | attendance |
| `/academics/classes` | AcademicsClasses | academics-classes |
| `/academics/batches` | AcademicsBatches | academics-batches |
| `/academics/teacher-allocation` | AcademicsTeacherAllocation | academics-teacher-allocation |
| `/academics/classroom-allocation` | AcademicsClassroomAllocation | academics-classroom-allocation |
| `/academics/student-allocation` | AcademicsStudentAllocation | academics-student-allocation |
| `/holidays` | Holidays | holidays |
| `/notices` | Notices | notices |
| `/announcements` | Announcements | announcements |
| `/user-management` | UserManagement | user-management |
| `/roles-permissions` | RolesPermissions | roles-permissions |
| `/settings` | Settings | settings |
| `/releases` | ReleasesDashboard | developer |
| `/dev/modules` | ModuleExplorer | dev-tools |

### Super Admin Routes

| Path | Component | Permission |
|------|-----------|-----------|
| `/superadmin/tenants` | TenantList | super_admin / developer |
| `/superadmin/tenants/new` | TenantCreate | super_admin / developer |
| `/superadmin/tenants/:id` | TenantDetail | super_admin / developer |
| `/superadmin/analytics` | PlatformAnalytics | super_admin / developer |
| `/superadmin/audit` | AuditLogs | super_admin / developer |
| `/impersonate` | ImpersonateLogin | token-gated (custom Firebase token) |

### Parent Module Routes

| Path | Component | Purpose |
|------|-----------|---------|
| `/parent-home` | HomeFeed | Home with priority highlights carousel + activity feed |
| `/parent-profile` | ParentProfile | Parent profile + sign out |
| `/parent-child/:studentId` | ChildProfile | Child profile view |
| `/parent-attendance` | Attendance | Child attendance calendar + history |
| `/parent-journey` | ParentJourney | Unified child journey timeline (replaces /parent-memories) |
| `/parent-memories` | Navigate redirect | → `/parent-journey` |
| `/parent-fees` | Fees | Invoices, balance, payment history |
| `/parent-daily-care` | DailyCare | Daily Care hub |
| `/parent-food-menu` | FoodMenu | School food menu |
| `/parent-consumption` | Consumption | Food consumption logs |
| `/parent-nap` | NapTracker | Nap session logs |
| `/parent-holidays` | Holidays | School holiday calendar |
| `/parent-notifications` | Notifications | Push notification center |
| `/parent-care` | CareHygiene | Care & hygiene event timeline |

---

## API Inventory

### Auth
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/me` | Verify token, return profile + permissions |
| POST | `/api/auth/refresh-permissions` | Refresh cached permissions |
| POST | `/api/auth/logout` | Write audit log |
| POST | `/api/auth/select-center` | Switch active center |
| POST | `/api/auth/sync-user` | Upsert Firestore user doc after signup |

### Tenants (Super Admin only)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tenants` | List all tenants with filters |
| POST | `/api/tenants` | Create new tenant (onboard school) |
| GET | `/api/tenants/:id` | Get tenant details |
| PUT | `/api/tenants/:id` | Update tenant |
| PUT | `/api/tenants/:id/status` | Change tenant status (active/suspended/cancelled) |
| POST | `/api/tenants/:id/impersonate` | Generate impersonation token |
| GET | `/api/tenants/:id/analytics` | Tenant usage analytics |
| GET | `/api/tenants/:id/audit` | Tenant audit log |

### Staged Releases
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/releases/modules` | List modules and their stage status |
| POST | `/api/releases/promote` | Promote module to production |
| POST | `/api/releases/rollback` | Rollback module to testing |
| GET | `/api/releases/audit` | Release audit log |

### Students
| Method | Path | Description |
|--------|------|-------------|
| GET | `/students` | List students (role-scoped) |
| GET | `/students/:id` | Get single student |
| POST | `/add-student` | Create student |
| PUT | `/update-student/:id` | Update student |
| DELETE | `/delete-student/:id` | Delete student |
| GET | `/api/student-medical/:studentId` | Get medical info |
| PUT | `/api/student-medical/:studentId` | Save medical info |
| GET | `/api/student-notes/:studentId` | Get student notes |
| POST | `/api/student-notes/:studentId` | Add note |
| DELETE | `/api/student-notes/:studentId/:noteId` | Delete note |

### Attendance
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/attendance` | Get attendance records |
| POST | `/api/attendance/mark` | Mark attendance |
| PUT | `/api/attendance/:id/checkout` | Record checkout |
| GET | `/api/attendance/summary` | Daily summary |
| GET | `/api/attendance/inside` | Currently checked-in students |
| GET | `/api/attendance/history` | Historical records |
| POST | `/api/attendance/qr-scan` | Process QR scan |

### Child Journey
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/journey` | Create journey entry (observation/artwork/photo/milestone) |
| GET | `/api/journey` | List entries (staff, all kinds) |
| PUT | `/api/journey/:id` | Update entry |
| DELETE | `/api/journey/:id` | Delete entry |
| GET | `/api/parent/journey` | Parent-scoped journey timeline |
| POST | `/api/milestones` | Teacher creates milestone |
| POST | `/api/milestones/check` | Trigger auto-milestone check for student |
| GET | `/api/milestones/presets` | Get TEACHER_MILESTONES presets |

### Care & Hygiene
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/care` | Log care activity |
| GET | `/api/care/history` | Care logs for date range |
| GET | `/api/care/summary` | Daily summary |

### Nap Tracker
| Method | Path | Description |
|--------|------|-------------|
| GET | `/naps/active` | Active naps |
| GET | `/naps/history` | Nap history |
| GET | `/naps/stats/today` | Today's nap stats |
| POST | `/naps/start` | Start nap session |
| POST | `/naps/wakeup` | End nap session |

### Food
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/food-menu` | Get menus |
| POST | `/api/food-menu` | Save menu for date |
| PUT | `/api/food-menu/:date` | Update menu |
| DELETE | `/api/food-menu/:date` | Delete menu |
| GET | `/api/food-consumption` | Get consumption records |
| POST | `/api/food-consumption` | Save consumption |
| PUT | `/api/food-consumption` | Update consumption |

### Finance
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/invoices` | List invoices |
| POST | `/api/invoices` | Create invoice |
| PUT | `/api/invoices/:invoiceNumber` | Update invoice |
| DELETE | `/api/invoices/:invoiceNumber` | Delete invoice |
| GET | `/api/payments` | Get payments |
| POST | `/api/payments` | Record payment |
| GET | `/record-payment` | Legacy payment (deprecated) |
| GET | `/api/fee-templates` | List fee templates |
| POST | `/api/fee-templates` | Create fee template |
| PUT | `/api/fee-templates/:templateId` | Update fee template |
| DELETE | `/api/fee-templates/:templateId` | Delete fee template |

### Pickup & Security
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/pickup-authorization` | List authorized pickup persons |
| POST | `/api/pickup-authorization` | Create pickup person |
| PUT | `/api/pickup-authorization/:id` | Update pickup person |
| DELETE | `/api/pickup-authorization/:id` | Delete pickup person |
| GET | `/api/pickup-authorization/audit` | Audit log |
| POST | `/api/pickup-authorization/migrate-student` | Migrate one student |
| POST | `/api/pickup-authorization/migrate-bulk` | Bulk migration |
| GET | `/api/pickup-authorization/migration-status` | Migration progress |
| GET | `/api/pickup-history` | Pickup events |
| POST | `/api/pickup-history` | Record pickup |
| GET | `/api/parent-attendance` | Parent gate check-in records |
| POST | `/api/parent-attendance` | Create parent gate check-in |
| GET | `/api/parent-attendance/validate-gate` | Validate gate entry |
| GET | `/api/child-status/:studentId` | Child's current status |
| POST | `/api/pickup-request` | Create pickup request |
| GET | `/api/pickup-requests` | List pickup requests |
| PUT | `/api/pickup-requests/:id/approve` | Approve request |
| PUT | `/api/pickup-requests/:id/reject` | Reject request |

### Communication
| Method | Path | Description |
|--------|------|-------------|
| GET/POST/PUT/DELETE | `/api/holidays` | Holidays CRUD |
| GET/POST/PUT/DELETE | `/api/notices` | Notices CRUD |
| GET/POST/PUT/DELETE | `/api/announcements` | Announcements CRUD |

### QR & CCTV
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/qr/:studentId` | Generate student QR |
| GET | `/api/qr/batch` | Generate batch QRs |
| POST | `/api/qr/validate` | Validate QR scan |
| GET | `/api/cctv/cameras` | List cameras |
| POST | `/api/cctv/cameras` | Add camera |
| PUT | `/api/cctv/cameras/:id` | Update camera |
| DELETE | `/api/cctv/cameras/:id` | Delete camera |
| POST | `/api/cctv/cameras/verify` | Verify connection |
| POST | `/api/cctv/cameras/:id/live-token` | Request stream token |

### Parent API
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/parent/me` | Parent profile + linked children |
| GET | `/api/parent/children` | List children |
| GET | `/api/parent/feed` | Priority-first activity feed |
| GET | `/api/parent/fees` | Fees & invoices |
| GET | `/api/parent/journey` | Child journey timeline |
| GET | `/api/parent/naps` | Nap logs |
| GET | `/api/parent/food-menu` | Food menu |
| GET | `/api/parent/consumption` | Food consumption |
| GET | `/api/parent/care` | Care & hygiene logs |
| GET | `/api/parent/holidays` | Holidays |
| GET | `/api/parent/child/:studentId` | Child details |
| GET | `/api/parent/child/:studentId/attendance` | Child attendance |
| GET | `/api/parent/notifications` | Notification list |
| GET | `/api/parent/notifications/unread-count` | Unread count |
| PATCH | `/api/parent/notifications/:id/read` | Mark read |
| PATCH | `/api/parent/notifications/read-all` | Mark all read |
| POST | `/api/parent/notifications/fcm-token` | Register FCM token |

### Roles & Settings
| Method | Path | Description |
|--------|------|-------------|
| GET/POST/PUT/DELETE | `/api/roles(/:roleId)` | Role CRUD |
| PUT | `/api/roles/:roleId/permissions` | Update permissions |
| GET | `/api/settings` | Get all settings |
| PUT | `/api/settings/:section` | Save settings section |
| GET | `/api/version` | Server version + build info (public) |
| GET | `/` | Health check (public) |

---

## Firestore Collections

### Platform (Multi-Tenant)

| Collection | Purpose |
|-----------|---------|
| `tenants` | Preschool registry — name, logo, plan (trial/starter/professional/enterprise), status (trial/active/suspended/cancelled), branches, academicYears, trialExpiry |
| `tenantAuditLogs` | Immutable audit trail of all Super Admin actions (impersonation, status changes, etc.) |
| `releaseModules` | Per-module stage status overrides (`{schoolId}_{moduleKey}` doc IDs) |
| `releaseAudits` | Immutable release promotion/rollback events |

### Core School Data

| Collection | Purpose |
|-----------|---------|
| `students` | Student records — studentId, name, DOB, class, fatherEmail, motherEmail, centerId, schoolId, status, parentRegistered, qrEnabled |
| `users` | Staff accounts — uid, email, name, role, centers[], centerId, schoolId, status, photoUrl |
| `parents` | Parent profiles — uid, studentIds[], schoolId, fcmToken. Lazily provisioned from student email fields on first parent login |
| `roles` | Custom role definitions per school |
| `permissionAuditLogs` | Role permission change history |
| `settings` | System config (doc-per-section, e.g. `cctv_parent`) |
| `auditLogs` | General auth/action audit trail |
| `_counters` | Atomic sequence generators (student ID counter) |

### Daily Operations

| Collection | Purpose |
|-----------|---------|
| `attendance` | Daily check-in/out events — studentId, checkinTime, checkoutTime, date, status |
| `parentAttendance` | Parent visitor gate logs — parentId, studentId, gateEntry, gateExit, purpose |
| `careLogs` | Care & hygiene events — type (Motion/Both/Diaper), studentId, staffId, date, notes |
| `napLogs` | Nap session records — studentId, startTime, endTime, duration |
| `foodMenus` | Daily menus — date, items[], centerId |
| `foodConsumption` | Per-student food intake — studentId, date, items[], quantity, notes |

### Child Journey

| Collection | Purpose |
|-----------|---------|
| `journeyEntries` | Unified child development content — kind (photo/video/observation/artwork/milestone/achievement/event-highlight), domain, academicYear, studentId, staffId, mediaUrl, caption, milestoneId, milestoneTitle, milestoneCategory, autoDetected |

### Finance

| Collection | Purpose |
|-----------|---------|
| `invoices` | Financial invoices — invoiceNumber, studentId, amount, gst, discount, totalAmount, paidAmount, balance, status, dueDate |
| `payments` | Payment records — paymentId, invoiceNumber, method, amount, reference |
| `feeTemplates` | Reusable billing templates |

### Security & Pickup

| Collection | Purpose |
|-----------|---------|
| `pickupLogs` | Authorized pickup persons per student |
| `pickupRequests` | Pickup approval workflow — status: pending/approved/rejected |
| `pickupAuditLogs` | Immutable audit trail of pickup person changes |

### Communication

| Collection | Purpose |
|-----------|---------|
| `announcements` | School announcements (also Activity feed source for parents) |
| `holidays` | School holiday calendar |
| `notices` | Administrative notices |
| `notifications` | Parent push notifications — parentId, childId, type, title, message, read, deepLink, priority, batchKey, batchCount |

### CCTV

| Collection | Purpose |
|-----------|---------|
| `cameras` | Camera metadata — rtspUrl, passwordEncrypted (AES-256-GCM when key set), status, lastTested |
| `cctvAuditLogs` | Stream session audit trail |

### Academics

| Collection | Purpose |
|-----------|---------|
| `classes` | Academic class records — className, academicYear, teacher |

### Subcollections

| Path | Purpose |
|------|---------|
| `students/{id}/medical` | Blood group, allergies, medications, doctor contact |
| `students/{id}/notes` | Teacher notes per student |

---

## Feature Status

### Platform & Infrastructure

| Feature | Status | Notes |
|---------|--------|-------|
| Firebase Auth (email + Google) | ✅ Completed | |
| Multi-tenant architecture (tenantId = schoolId) | ✅ Completed | All queries scoped |
| Tenant management dashboard | ✅ Completed | Create, edit, suspend, cancel |
| Subscription plan tiers | ✅ Completed | trial/starter/professional/enterprise |
| Super Admin impersonation | ✅ Completed | Firebase custom token |
| Staged releases governance | ✅ Completed | Promote + rollback with audit |
| Feature flags per environment | ✅ Completed | isPreProduction / true |
| Two-environment strategy | ✅ Completed | Yellow Dot ↔ KUE Boxs Care |
| email_verified enforcement | 🔴 Pending | Deferred |
| CI/CD pipeline (auto-deploy) | 🔴 Pending | Manual deploys currently |
| Frontend test suite (Playwright) | 🔴 Pending | Scaffolded, not populated |

### Student & Academic Operations

| Feature | Status | Notes |
|---------|--------|-------|
| Student CRUD | ✅ Completed | |
| Student medical info | ✅ Completed | Subcollection |
| Teacher notes | ✅ Completed | Subcollection |
| QR code generation + scanning | ✅ Completed | |
| Academics (classes) | 🟡 In Progress | Backend shallow |
| Academics (batches, allocations, timetable) | 🔴 Planned | Pages scaffolded only |
| Bulk student import (CSV) | 🔴 Planned | Not started |
| Admissions CRM / lead pipeline | 🔴 Planned | Not started |
| Enquiry management | 🔴 Planned | Not started |

### Daily Operations

| Feature | Status | Notes |
|---------|--------|-------|
| Attendance mark / checkout | ✅ Completed | |
| QR scan check-in | ✅ Completed | |
| Nap tracker (staff) | ✅ Completed | |
| Food menu management | ✅ Completed | |
| Food consumption tracking | ✅ Completed | |
| Care & Hygiene logging | ✅ Completed | |
| Child Journey — Observations | ✅ Staging | Pending production flag |
| Child Journey — Artwork upload | ✅ Staging | Firebase Storage |
| Child Journey — Milestones (auto + teacher) | ✅ Staging | Auto: First Day/30d/100d/Birthday |
| Child Journey — Annual Memory Book PDF | 🟡 In Progress | Phase 4 — not started yet |
| Staff Attendance | ✅ Completed | Backend live; not previously reflected in this doc |
| Leave Management (Staff) | ✅ Completed | Backend live; tenant-isolation hardened Milestone 12 |

### Finance

| Feature | Status | Notes |
|---------|--------|-------|
| Invoice CRUD | ✅ Completed | |
| Fee templates | ✅ Completed | |
| Payment recording | ✅ Completed | |
| Payment notifications (parent) | ✅ Completed | PAYMENT_RECEIVED type |
| Recurring billing automation | 🟡 In Progress | invoiceAutomation.js partial |
| Invoice PDF for parents | 🔴 Planned | |
| Online payment gateway | 🔴 Planned | Razorpay/Stripe |
| Revenue forecasting | 🔴 Planned | Analytics feature |
| Payroll (staff) | ✅ Completed | Backend live; tenant-isolation hardened Milestone 12 |

### Parent Module

| Feature | Status | Notes |
|---------|--------|-------|
| Auth & profile | ✅ Completed | |
| Home feed + priority highlights carousel | ✅ Completed | |
| Child profile | ✅ Completed | |
| Attendance view | ✅ Completed | |
| Fees view | ✅ Completed | |
| Daily Care hub | ✅ Completed | |
| Food menu / consumption / nap / care views | ✅ Completed | |
| Holidays view | ✅ Completed | |
| Push notifications (17 types, FCM) | ✅ Completed | |
| Notification center (in-app) | ✅ Completed | |
| Parent Journey (unified child timeline) | ✅ Staging | Phase 2–3.5 complete |
| Leave requests (Phase 6) | 🔴 Planned | leaveRequests collection needed |
| Events calendar (Phase 7) | 🔴 Planned | |
| Parent-Teacher Chat | 🔴 Planned | New module |
| Document vault (report cards, docs) | 🔴 Planned | New module |
| Online payments | 🔴 Planned | |
| AI progress reports | 🔴 Planned | AI feature |

### Security & Pickup

| Feature | Status | Notes |
|---------|--------|-------|
| Pickup person management | ✅ Completed | |
| Pickup history | ✅ Completed | |
| Pickup approval workflow | 🟡 In Progress | Backend done; frontend partial |
| Parent gate visitor log | ✅ Completed | |
| Staff checkout | ✅ Completed | |
| Visitor Management (external) | 🔴 Planned | Beyond parent gate |
| Transport Management | 🔴 Planned | New module |

### CCTV

| Feature | Status | Notes |
|---------|--------|-------|
| Camera metadata CRUD | ✅ Completed | |
| Credential encryption | 🟡 In Progress | Code exists; key not set in prod |
| Live streaming (staff) — Phase 3 | 🔴 Planned | Blocked: CCTV-V2-TD-001 |
| Parent live view — Phase 4 | 🔴 Planned | Blocked: Phase 3 |

### Technical Debt Register

| ID | Item | Severity | Resolution Trigger |
|----|------|----------|-------------------|
| CCTV-V2-TD-001 | Camera passwords plaintext in Firestore (encryption key not set) | Low→**High** before streaming | Before CCTV Phase 3 |
| TD-002 | `parents/` not backfilled for existing students | Medium | Before bulk notifications |
| TD-003 | Firebase web config hardcoded in firebase.js (not env vars) | Low | Before open-sourcing |
| TD-004 | Legacy invoice routes (`/save-invoice`, non-prefixed `/invoices`) | Medium | Scheduled cleanup |
| TD-005 | Feed & fees reads unbounded (no pagination) | Medium | Before >500 students |
| TD-006 | No frontend tests (Playwright scaffolded, not populated) | Medium | Before CI/CD pipeline |
| TD-007 | Child Journey awaiting production flag flip | Low | After stakeholder review |
| TD-008 | Recurring billing not triggered in production | Medium | Before monthly billing runs |
| TD-009 | Memories staff upload UI missing | High | Superseded by Child Journey — but need Journey entry UI for staff |
| TD-010 | `/parent-checkin` legacy route outside parent module | Low | Remove or redesign |

---

## Recent Decisions Log

| Date | Decision | Reason |
|------|----------|--------|
| 2026-05-16 | **Migrated from Google Sheets to Firestore** | Scalability, real-time writes. Sheets code archived to `_legacy/`. |
| 2026-05-19 | **Parent Module V1 approved for production** | Phases 1–5 verified. Live on KUE Boxs Care. |
| 2026-06 | **CCTV parent access removed from Parent Module V1** | `ParentLiveCCTV` deleted. CCTV parent access is a separate future module. |
| 2026-06 | **CCTV credential encryption deferred (CCTV-V2-TD-001)** | Phase 1 is internal-only. Encryption code exists; must activate before streaming. |
| 2026-06-08 | **Navigation V2 shipped** | Bottom nav: Home · Daily Care (raised hub) · Profile. Dead-end routes removed. |
| 2026-06-13 | **Care & Hygiene module added** | Staff log hygiene events; parents see real-time updates. `careLogs` collection added. |
| 2026-06-13 | **Push Notification System V2 built** | Firestore `notifications` + FCM. 17 types, anti-spam batching. |
| 2026-06-16 | **Priority-first highlights carousel** | Parent HomeFeed redesigned to surface urgent items first. |
| 2026-06-22 | **Child Journey Module approved — replaces Memories** | `journeyEntries` collection; 7 entry kinds; 5 development domains. `memories` collection had 0 docs; deprecated. `/parent-memories` → `/parent-journey` redirect in place. |
| 2026-06-22 | **Academic year standardized: June 1 → May 31** | Auto-assigned from entry date. Staff never set manually. Format: "2026-27". |
| 2026-06-22 | **Milestone engine built (auto + teacher)** | Auto-milestones: First Day, 30 Days, 100 Days, Birthday. Teacher presets: 5 milestone types. |
| 2026-06-29 | **Multi-tenant SaaS layer shipped** | `tenants` collection. `tenantId = schoolId` — no data migration needed. 4 subscription tiers. Trial enforcement. Impersonation flow. |
| 2026-06-29 | **Staged Releases governance dashboard shipped** | Module promotion + rollback with audit trail. `releaseModules` + `releaseAudits` collections. |
| 2026-06-29 | **Two-environment strategy formalized** | Yellow Dot = staging. KUE Boxs Care = production. Feature flags control promotion. |
| 2026-07-13 → 2026-07-14 | **Production Hardening security program (Milestones 2–12) closed all 8 Critical findings + H1** | Systematic tenant-isolation IDOR fixes across student, finance, incident, events/PTM, journey, pickup/CCTV, and — as of Milestone 12 — payroll/leave/performance/family/department/designation/roles/users. See `SECURITY_ARCHITECTURE.md` (canonical reference) and its new **Tenant Security Baseline** section for the 5 non-negotiable rules every future module must meet. |
| 2026-07-14 | **Role-assignment capping added (`ASSIGNABLE_ROLES`)** | Milestone 12 discovered a cross-tenant privilege-escalation path (any admin could grant `super_admin`/`developer` to any user, any school) alongside the original tenant-isolation gap. Fixed by capping role writes below the bypass tier in `userService.js`, regardless of caller's own role or tenant. |

---

## Current Build Roadmap

### Active — V2 / V3 (Current Sprint)

- ✅ Priority-first highlights carousel
- ✅ Care & Hygiene (full stack)
- ✅ Push Notifications (FCM, 17 types)
- ✅ Child Journey Phases 1–3.5
- ✅ Multi-Tenant SaaS Layer
- ✅ Staged Releases Dashboard
- 🟡 Promote Child Journey to production (KUE Boxs Care)
- 🟡 Pickup request approval UI (frontend completion)
- 🟡 Academics module backend (batches, allocations)

### Next — V3: Engagement & Finance

- Memories / Journey staff upload finalization
- Online payment gateway (Razorpay)
- Invoice PDF for parents
- Recurring billing automation (node-cron trigger)
- Child Journey Phase 4 — Annual Memory Book PDF
- Parents backfill script

### Following — V4: Operations & HR

- Staff Attendance module
- Leave Management (staff)
- Visitor Management (external)
- Enhanced Analytics dashboard
- CSV/Excel exports

### Future — V5: AI & Intelligence

- AI School Assistant (Anthropic Claude)
- AI Report Card Generator
- AI Admission Assistant
- AI-powered parent FAQ chatbot
- Predictive occupancy and revenue analytics

---

## Future Product Roadmap

> This section defines the complete future product scope. Every module is evaluated for priority, dependencies, and development phase. Statuses: Not Started / Planned / In Progress / Completed.

---

### Core School Operations

#### Admissions CRM & Lead Pipeline

**Purpose:** Manage the full journey from first inquiry to enrolled student — lead capture, follow-up tracking, waitlist, conversion funnel.

| Attribute | Detail |
|-----------|--------|
| Status | Not Started |
| Priority | Critical |
| Dependencies | Student Management, Communication |
| Estimated Phase | V4 |

Key features:
- Lead capture form (embeddable on school website)
- Inquiry-to-enrollment pipeline (Kanban view)
- Automated follow-up reminders
- Waitlist management
- Conversion funnel analytics
- Source tracking (WhatsApp, website, referral, walk-in)
- Admission documents collection
- New Firestore collection: `enquiries`, `admissions`

---

#### Enquiry Management

**Purpose:** Track and respond to parent inquiries before formal admission — tours, calls, WhatsApp messages, walk-ins.

| Attribute | Detail |
|-----------|--------|
| Status | Not Started |
| Priority | High |
| Dependencies | Admissions CRM |
| Estimated Phase | V4 |

Key features:
- Inquiry log with source, contact info, status
- Staff assignment and follow-up notes
- Scheduled call/visit reminders
- WhatsApp integration (optional)
- Linked to Admissions CRM pipeline

---

#### Student Management

**Purpose:** Central record of every enrolled child — profile, medical, academic history, linked family.

| Attribute | Detail |
|-----------|--------|
| Status | Completed |
| Priority | Critical |
| Dependencies | None |
| Estimated Phase | ✅ Live |

Enhancements planned:
- Bulk CSV import
- Sibling linking (family module — partially built in `families` collection)
- Student archive / graduation flow
- Profile photo upload

---

#### Attendance

**Purpose:** Daily check-in and checkout for students with QR scanning, manual override, and daily summaries.

| Attribute | Detail |
|-----------|--------|
| Status | Completed |
| Priority | Critical |
| Dependencies | Student Management |
| Estimated Phase | ✅ Live |

Enhancements planned:
- Biometric check-in support (future)
- Attendance trend reports
- Monthly attendance export (CSV/PDF)
- Teacher-level attendance marking per classroom

---

#### Academics

**Purpose:** Manage the academic structure — classes, batches, teacher assignments, classroom allocation, student groupings, timetable.

| Attribute | Detail |
|-----------|--------|
| Status | In Progress |
| Priority | High |
| Dependencies | Student Management, User Management |
| Estimated Phase | V3 |

Current state: 5 frontend pages scaffolded; backend has `classes` collection only.

Remaining work:
- `batches`, `teacherAllocations`, `studentAllocations` backend services
- Timetable / scheduling engine
- Academic year management (already standardized: June–May)
- Lesson plan tracking (future)

---

#### Billing & Finance

**Purpose:** Full invoicing lifecycle — fee templates, invoice generation, payment recording, receipts, overdue tracking.

| Attribute | Detail |
|-----------|--------|
| Status | In Progress |
| Priority | Critical |
| Dependencies | Student Management, Online Payments |
| Estimated Phase | Partial ✅ Live; Automation V3 |

Current state: Invoice CRUD, fee templates, payment recording all live.

Remaining work:
- Recurring billing automation (invoiceAutomation.js wiring)
- Online payment gateway (Razorpay/Stripe)
- Invoice PDF for parents
- Revenue forecasting analytics
- Overdue reminders (automated)
- Payment receipt PDFs

---

#### Communication

**Purpose:** School-to-parent and school-to-staff communication — holidays, notices, announcements, circular management.

| Attribute | Detail |
|-----------|--------|
| Status | Completed |
| Priority | High |
| Dependencies | Notification System |
| Estimated Phase | ✅ Live |

Enhancements planned:
- Rich media announcements (images, attachments)
- Scheduled / draft announcements
- Targeted communication (by class, batch)

---

#### CCTV

**Purpose:** Camera management, staff live monitoring, and secure parent viewing with time-based classroom routing.

| Attribute | Detail |
|-----------|--------|
| Status | In Progress (Phase 1–2 complete) |
| Priority | High |
| Dependencies | CCTV-V2-TD-001 resolved (encryption key) |
| Estimated Phase | Phase 3 = V4; Phase 4 = V5 |

Phases:
- Phase 1: Camera metadata CRUD — ✅ Done
- Phase 2: Many-to-many classroom routing, per-camera schedules — ✅ Done
- Phase 3: Staff live view (HLS.js player ready in frontend bundle) — 🔴 Planned
- Phase 4: Parent live view with per-classroom permissions — 🔴 Planned

Blocker: CCTV-V2-TD-001 — set `CCTV_ENCRYPTION_KEY` + run migration script before Phase 3.

---

#### Parent Module

**Purpose:** Mobile-first parent experience — child's daily activity, journey timeline, fees, communication, push notifications.

| Attribute | Detail |
|-----------|--------|
| Status | In Progress (V2 live; V3+ planned) |
| Priority | Critical |
| Dependencies | All Daily Ops modules, Child Journey, Finance |
| Estimated Phase | V2 ✅ Live; V3+ ongoing |

Current: 14 parent screens, 13 hooks, push notifications, Child Journey timeline (staging).
Next: Leave Requests (Phase 6), Events (Phase 7), Parent-Teacher Chat, Document Vault.

---

#### Reports & Analytics

**Purpose:** Operational insights for admins — attendance trends, fee collection, occupancy, engagement.

| Attribute | Detail |
|-----------|--------|
| Status | In Progress |
| Priority | High |
| Dependencies | All operational modules |
| Estimated Phase | V4 |

Current: Analytics page exists; Live Dashboard shows current attendance; Recharts wired.

Remaining:
- Attendance trend charts with class-level drill-down
- Fee collection and outstanding balance reports
- Occupancy rate over time
- Per-teacher activity summaries
- CSV/Excel export for all reports
- Printable PDF reports

---

### Parent Experience

#### Unified Child Timeline (Child Journey)

**Purpose:** One beautiful, scrollable timeline of a child's entire preschool life — observations, artwork, milestones, achievements, memories. The parent's emotional anchor in the app.

| Attribute | Detail |
|-----------|--------|
| Status | In Progress (Phases 1–3.5 complete on staging) |
| Priority | Critical |
| Dependencies | Firebase Storage, Child Journey staff pages |
| Estimated Phase | V3 (production promotion) |

Current:
- `journeyEntries` collection with 7 kinds
- Auto-milestones (First Day / 30 Days / 100 Days / Birthday)
- Teacher milestones (5 presets + custom)
- Observation creation (staff)
- Artwork upload with 5 categories + Firebase Storage
- Parent timeline: 5-category taxonomy, 4 stat cards, hybrid Instagram layout

Phase 4 (next): Annual Memory Book PDF — auto-generated yearly portfolio, print-ready, downloadable.

---

#### Parent-Teacher Chat

**Purpose:** Secure, asynchronous messaging channel between parents and teachers — replaces WhatsApp for school communication.

| Attribute | Detail |
|-----------|--------|
| Status | Not Started |
| Priority | High |
| Dependencies | Notification System, Parent Module |
| Estimated Phase | V5 |

Key features:
- Thread per student (parent ↔ teacher)
- Read receipts
- Media sharing (photos, voice notes)
- Teacher can message all parents in a class
- FCM push on new message
- New collections: `chatThreads`, `chatMessages`

---

#### Digital Portfolio

**Purpose:** A downloadable / shareable record of a child's complete preschool journey — artwork, milestones, observations — formatted as a beautiful PDF book.

| Attribute | Detail |
|-----------|--------|
| Status | In Progress (Child Journey Phase 4) |
| Priority | High |
| Dependencies | Child Journey, Firebase Storage, jsPDF |
| Estimated Phase | V4 |

The Annual Memory Book PDF is the V1 of this feature — automatically generated at academic year end with all journey entries for the year.

---

#### Parent Document Vault

**Purpose:** Secure, organized storage for all documents a school shares with parents — birth certificates collected, report cards, fee receipts, health forms, permission slips.

| Attribute | Detail |
|-----------|--------|
| Status | Not Started |
| Priority | Medium |
| Dependencies | Firebase Storage, Parent Module |
| Estimated Phase | V5 |

Key features:
- School-uploaded documents visible to parents
- Category tags (Report Card, Health, Fee Receipt, Permission Slip)
- Download + PDF viewer
- Notification when new document is shared
- New collection: `parentDocuments`

---

#### AI Progress Reports

**Purpose:** Auto-generate narrative progress reports for each child using their journey entries (observations, milestones, artwork) as input — saving teachers hours of manual writing.

| Attribute | Detail |
|-----------|--------|
| Status | Not Started |
| Priority | High |
| Dependencies | Child Journey, Claude API (claude-sonnet-4-6 or claude-haiku-4-5) |
| Estimated Phase | V5 |

Key features:
- Teacher reviews and edits draft before publishing
- Parent receives polished PDF report card
- ANNUAL_BOOK_READY notification type already defined in notificationService.js
- Domains: social, emotional, communication, creativity, leadership, confidence, fine_motor, gross_motor

---

#### Online Payments

**Purpose:** Parents pay school fees directly through the app — no cash, no manual receipt tracking.

| Attribute | Detail |
|-----------|--------|
| Status | Not Started |
| Priority | Critical |
| Dependencies | Billing & Finance, Payment Gateway (Razorpay) |
| Estimated Phase | V4 |

Key features:
- Pay outstanding invoice from parent app
- UPI, card, net banking (via Razorpay)
- Automatic invoice status update on payment
- Push notification: PAYMENT_RECEIVED to parent
- Payment receipt PDF auto-generated
- Webhook: Razorpay → backend → Firestore

---

#### Leave Requests

**Purpose:** Parents submit absence notifications and leave requests for their child; staff acknowledge or approve.

| Attribute | Detail |
|-----------|--------|
| Status | Planned (Phase 6) |
| Priority | High |
| Dependencies | Parent Module, Attendance, Notification System |
| Estimated Phase | V4 |

New collection: `leaveRequests` — studentId, parentId, startDate, endDate, reason, status (pending/approved/rejected), staffNote.

---

#### Events & RSVP

**Purpose:** School events (Annual Day, Parent Meeting, Trip) with parent RSVP tracking.

| Attribute | Detail |
|-----------|--------|
| Status | Planned (Phase 7) |
| Priority | Medium |
| Dependencies | Communication, Parent Module |
| Estimated Phase | V4 |

New collection: `events` — title, date, venue, description, rsvpEnabled, rsvps[].

---

### Staff & HR

#### Staff Attendance

**Purpose:** Track teacher and staff daily attendance — check-in, check-out, late arrivals, overtime.

| Attribute | Detail |
|-----------|--------|
| Status | Not Started |
| Priority | High |
| Dependencies | User Management |
| Estimated Phase | V4 |

New collection: `staffAttendance` — userId, date, checkinTime, checkoutTime, status, centerId, schoolId.

---

#### Leave Management (Staff)

**Purpose:** Staff apply for leave; managers approve or reject; leave balance tracked.

| Attribute | Detail |
|-----------|--------|
| Status | Not Started |
| Priority | High |
| Dependencies | Staff Attendance, User Management |
| Estimated Phase | V4 |

New collections: `staffLeaveRequests`, `leaveBalances`.

---

#### Payroll

**Purpose:** Calculate and disburse monthly staff salaries based on attendance, leave deductions, and salary structure.

| Attribute | Detail |
|-----------|--------|
| Status | Not Started |
| Priority | Medium |
| Dependencies | Staff Attendance, Leave Management |
| Estimated Phase | V5 |

New collections: `salaryStructures`, `payrollRuns`, `payslips`.

---

#### Staff Performance Reviews

**Purpose:** Structured periodic performance reviews for teachers and staff — goals, ratings, notes, history.

| Attribute | Detail |
|-----------|--------|
| Status | Not Started |
| Priority | Low |
| Dependencies | User Management |
| Estimated Phase | V6 |

New collection: `performanceReviews`.

---

#### Employee Documents

**Purpose:** Secure HR document storage per staff member — offer letters, contracts, ID proofs, certificates.

| Attribute | Detail |
|-----------|--------|
| Status | Not Started |
| Priority | Low |
| Dependencies | Firebase Storage, User Management |
| Estimated Phase | V6 |

New collection: `employeeDocuments`.

---

### School Operations

#### Visitor Management

**Purpose:** Full visitor gate system beyond parent check-in — vendors, government inspectors, prospective parents, service personnel.

| Attribute | Detail |
|-----------|--------|
| Status | Not Started |
| Priority | Medium |
| Dependencies | Parent Attendance (existing gate log), QR system |
| Estimated Phase | V4 |

Extends existing `parentAttendance` collection or adds `visitorLog` collection with visitor type, purpose, host staff member, photo.

---

#### Inventory & Asset Management

**Purpose:** Track school assets — furniture, toys, stationery, electronics — with purchase records, condition tracking, and reorder alerts.

| Attribute | Detail |
|-----------|--------|
| Status | Not Started |
| Priority | Low |
| Dependencies | None |
| Estimated Phase | V5 |

New collections: `assets`, `inventoryItems`, `stockMovements`.

---

#### Transport Management

**Purpose:** Manage school buses / vans — routes, student assignment, driver profiles, GPS tracking integration.

| Attribute | Detail |
|-----------|--------|
| Status | Not Started |
| Priority | Medium |
| Dependencies | Student Management, Parent Module (parent pickup alerts) |
| Estimated Phase | V5 |

New collections: `vehicles`, `routes`, `studentTransport`, `tripLogs`.

---

#### Classroom Resource Management

**Purpose:** Booking and tracking of shared classroom resources — projectors, tablets, art supplies, outdoor equipment.

| Attribute | Detail |
|-----------|--------|
| Status | Not Started |
| Priority | Low |
| Dependencies | Inventory & Asset Management, Academics |
| Estimated Phase | V6 |

---

#### Maintenance & Complaints

**Purpose:** Log, track, and resolve school maintenance issues and staff complaints — broken equipment, infrastructure requests.

| Attribute | Detail |
|-----------|--------|
| Status | Not Started |
| Priority | Low |
| Dependencies | User Management |
| Estimated Phase | V6 |

New collection: `maintenanceTickets`.

---

### AI Features

#### AI School Assistant

**Purpose:** A conversational AI assistant embedded in the staff CRM — answers questions about students, attendance trends, fee status, and school operations using school data.

| Attribute | Detail |
|-----------|--------|
| Status | Not Started |
| Priority | High |
| Dependencies | All operational modules, Claude API |
| Estimated Phase | V5 |

Implementation: Claude API (`claude-sonnet-4-6` or `claude-haiku-4-5-20251001`) with structured tool use — query student records, attendance, fees, and journey data by natural language. School data never leaves Firestore (tool-based RAG pattern, not fine-tuning).

---

#### AI Admission Assistant

**Purpose:** AI-powered chatbot on the school website that answers prospective parent questions, qualifies inquiries, and schedules tours — captures leads into the Admissions CRM.

| Attribute | Detail |
|-----------|--------|
| Status | Not Started |
| Priority | High |
| Dependencies | Admissions CRM, Claude API |
| Estimated Phase | V5 |

Implementation: Embeddable widget, Claude API with school-specific FAQ and program information. Captures contact details to `enquiries` collection.

---

#### AI Report Card Generator

**Purpose:** Auto-draft narrative progress reports for each child from their journey entries, observations, and milestone records — teacher reviews and publishes.

| Attribute | Detail |
|-----------|--------|
| Status | Not Started |
| Priority | High |
| Dependencies | Child Journey (journeyEntries), Claude API |
| Estimated Phase | V5 |

Implementation: Per-student prompt with recent journey entries → Claude generates domain-specific narrative → teacher edits → published as PDF. ANNUAL_BOOK_READY notification fires when report is published.

---

#### AI Analytics & Insights

**Purpose:** Surface non-obvious patterns in school data — attendance risk flags, fee collection predictions, engagement score drops, teacher performance insights.

| Attribute | Detail |
|-----------|--------|
| Status | Not Started |
| Priority | Medium |
| Dependencies | Business Intelligence module, Claude API |
| Estimated Phase | V6 |

Implementation: Weekly batch analysis job. Claude generates natural language summaries of key metrics and anomalies, surfaced in the executive dashboard.

---

#### AI Parent FAQ Assistant

**Purpose:** In-app parent chatbot that answers common questions — "What time is pickup?", "What's on the menu today?", "How many days has my child attended?" — using live school data.

| Attribute | Detail |
|-----------|--------|
| Status | Not Started |
| Priority | Medium |
| Dependencies | Parent Module, Claude API, all parent-facing data APIs |
| Estimated Phase | V6 |

Implementation: Claude API with tool use (live data fetching from backend APIs). Reduces routine parent support queries for staff.

---

### Multi-School / SaaS

#### Multi-School Dashboard

**Purpose:** Super Admin view of all active schools on the platform — health, usage, revenue, alerts.

| Attribute | Detail |
|-----------|--------|
| Status | Completed (Platform Analytics page) |
| Priority | Critical |
| Dependencies | Tenant Management |
| Estimated Phase | ✅ Live |

Current: PlatformAnalytics page with KPIs by status/plan. Enhancements: charts, trend lines, per-plan breakdowns.

---

#### Franchise Dashboard

**Purpose:** A group/chain owner can view metrics across all their owned schools in one view — aggregate occupancy, revenue, attendance, staff headcount.

| Attribute | Detail |
|-----------|--------|
| Status | Not Started |
| Priority | High |
| Dependencies | Multi-School Dashboard, Tenant Management |
| Estimated Phase | V5 |

New concept: `franchises` collection — a franchise owns multiple tenants. Dashboard aggregates across all tenantIds in a franchise.

---

#### Tenant Management

**Purpose:** Onboard, configure, and manage individual school tenants — plan, status, branches, academic years, impersonation, audit.

| Attribute | Detail |
|-----------|--------|
| Status | Completed |
| Priority | Critical |
| Dependencies | None |
| Estimated Phase | ✅ Live |

Subscription tiers live: `trial` (30-day) → `starter` → `professional` → `enterprise`.
Impersonation flow live. Status enforcement (suspended/cancelled → 403) live.

---

#### Subscription & Billing

**Purpose:** Automated SaaS billing — subscription plans, invoicing the school owner (not parent), Stripe integration, dunning management.

| Attribute | Detail |
|-----------|--------|
| Status | Not Started |
| Priority | Critical |
| Dependencies | Tenant Management, Stripe |
| Estimated Phase | V5 |

Note: This is platform billing (Yellow Dot → school owner), not student billing (school → parent). Separate Stripe integration from Razorpay.

New collections: `platformInvoices`, `platformSubscriptions`.

---

#### Feature Flags

**Purpose:** Control which modules are visible per environment, per tenant, or per subscription plan.

| Attribute | Detail |
|-----------|--------|
| Status | Completed |
| Priority | High |
| Dependencies | None |
| Estimated Phase | ✅ Live |

Current: `featureFlags.js` with `isPreProduction` per flag. `Staged Releases` dashboard for governance.

Enhancement needed: Per-plan feature gating (e.g. AI features = enterprise only). Currently flags are environment-only.

---

#### White Label Support

**Purpose:** Allow franchise schools or large chains to deploy the platform under their own brand — custom domain, logo, colors, app name.

| Attribute | Detail |
|-----------|--------|
| Status | Not Started |
| Priority | Medium |
| Dependencies | Tenant Management, Feature Flags |
| Estimated Phase | V6 |

Current state: `VITE_APP_NAME` in `.env.production` already sets the app name (KUE Boxs Care). Two-environment strategy already a foundation.

Enhancement: Per-tenant branding config stored in `tenants` doc (primaryColor, logo, appName, domain). Frontend reads from tenant context at runtime.

---

### Business Intelligence

#### Executive Dashboard

**Purpose:** One-screen operational health view for the school owner / principal — today's attendance, fee collection, occupancy, key alerts.

| Attribute | Detail |
|-----------|--------|
| Status | In Progress (Analytics page partial) |
| Priority | Critical |
| Dependencies | All operational modules |
| Estimated Phase | V4 |

Key KPIs: Today's attendance %, monthly fee collection vs. target, occupancy rate, students with overdue fees, new admissions this month, staff present today.

---

#### Occupancy Reports

**Purpose:** Track classroom and school-wide occupancy over time — capacity planning, enrollment trends.

| Attribute | Detail |
|-----------|--------|
| Status | Not Started |
| Priority | High |
| Dependencies | Student Management, Academics |
| Estimated Phase | V4 |

---

#### Admission Funnel Analytics

**Purpose:** Visualize the enquiry-to-enrollment conversion funnel — how many inquiries converted, where leads dropped off.

| Attribute | Detail |
|-----------|--------|
| Status | Not Started |
| Priority | High |
| Dependencies | Admissions CRM |
| Estimated Phase | V5 |

---

#### Revenue Forecasting

**Purpose:** Project next month's fee collection based on enrolled students, fee structures, and historical payment behavior.

| Attribute | Detail |
|-----------|--------|
| Status | Not Started |
| Priority | Medium |
| Dependencies | Billing & Finance, Analytics |
| Estimated Phase | V5 |

---

#### Parent Engagement Score

**Purpose:** Score how engaged each parent is with the app — logins, notification opens, payments on time, journey views — surfaces at-risk families.

| Attribute | Detail |
|-----------|--------|
| Status | Not Started |
| Priority | Medium |
| Dependencies | Notification System, Parent Module, Analytics |
| Estimated Phase | V6 |

---

#### Teacher Performance Analytics

**Purpose:** Measure and report teacher-specific metrics — journey entries created, milestone observations per student, response time to parent queries.

| Attribute | Detail |
|-----------|--------|
| Status | Not Started |
| Priority | Medium |
| Dependencies | Child Journey, Staff Attendance, Parent-Teacher Chat |
| Estimated Phase | V6 |

---

## Security & Tenant Isolation

**Canonical reference: `SECURITY_ARCHITECTURE.md`** (repo root). This section is a status pointer only — do not duplicate authorization logic detail here; update the canonical doc instead and link it.

### Tenant Security Baseline (non-negotiable, applies to every module)

1. Every API must validate `schoolId` ownership.
2. Never trust IDs from the client.
3. Every CRUD endpoint must perform authorization before data access.
4. Protected roles (`developer` and `super_admin`) must never be assignable through normal APIs.
5. All future modules must follow this pattern.

### Milestone status (Production Hardening program)

| Milestone | Scope | Status |
|---|---|---|
| M2 | Pickup-authorization IDOR | ✅ Closed |
| M3 | Billing/invoice data leak | ✅ Closed |
| M4 | `sync-user` role self-assignment (C1) | ✅ Closed |
| M5 | Student medical/notes access control | ✅ Closed |
| M6 | Student CRUD tenant isolation | ✅ Closed |
| M7 | Incident reports authorization | ✅ Closed |
| M8 | Events & PTM tenant isolation | ✅ Closed |
| M9 | Journey module ownership | ✅ Closed |
| M10 | Pickup/CCTV config tenant isolation | ✅ Closed |
| M11 | CCTV credential protection | ✅ Closed |
| M12 | HR/finance/admin tenant isolation (H1) + role-escalation cap | ✅ Closed (2026-07-14) |
| M13 | Staff management tenant isolation + second role-escalation path (staff-invite) | ✅ Closed (2026-07-14) |
| M14 | PTM parent-booking ownership + `parent.uid` field-bug fix | ✅ Closed (2026-07-14) |
| M15 | Attendance/QR platform tenant isolation | ✅ Closed (2026-07-14) |
| M16 | Communication module tenant isolation + schoolId-injection fix | ✅ Closed (2026-07-14) |

All 8 original Critical findings (C1–C8) and every High finding identified in the post-M12 module audit (H1 plus the 6 gaps found across `staffRoutes.js`, `parentRoutes.js`, `attendanceRoutes.js`/`staffAttendanceRoutes.js`/`qrRoutes.js`, and `communicationRoutes.js`) are now closed. Full before/after detail, score progression, and remaining backlog: `docs/production-ops/` Security Hardening Phase Completion Report (2026-07-14).

### Known accepted security debt

- **Shared system-role documents** (`roles/admin`, `roles/teacher`, etc.) use a fixed slug ID, not a per-school one — every tenant shares the same doc, and the owning tenant's permission-matrix edits apply platform-wide via an intentional cache bypass. Milestone 12 closed the cross-tenant *mutation* surface but not the underlying data-model sharing. Needs a dedicated migration to per-tenant role documents.
- **Student IDs are globally sequential**, not namespaced per school (accepted since Milestone 6 — tenant checks make ID-guessing irrelevant to authorization, but a full renamespace would require migrating every collection that stores a bare `studentId` foreign key).
- **CCTV credential encryption key must be included in every deploy's `docker run -e` flags** — it isn't in the VPS's `--env-file`, so a deploy that forgets the flag silently reverts to unencrypted storage.
- **`qrConfigs`/centers are not a first-class, `schoolId`-owned collection** — Milestone 15's `centerBelongsToSchool()` is a pragmatic existence check against `users`, not a durable ownership record. A center with zero assigned staff would (conservatively, safely) appear to belong to no school.
- **`incidentSvc.acknowledge()`'s use of `parent.parentId`** (the same nonexistent-field bug fixed for PTM bookings in M14) was found but not fixed at `parentRoutes.js:567` — out of M14's named scope, needs its own check.
- **Tenant-isolation coverage is now complete for every audited backend module** as of M16 except `tenantRoutes.js`, which is intentionally cross-tenant by design (platform Super Admin) and was recommended for a separate privileged-access review rather than a per-school tenant check.

---

## CTO Summary Report

*Generated: 2026-06-30 · Version 2.0*

---

### Overall Product Completion

| Dimension | Completion | Notes |
|-----------|-----------|-------|
| **Overall Product** | **~52%** | Of total future product scope |
| **MVP (core school ops)** | **~82%** | Core CRM fully operational |
| **Premium Features** | **~28%** | Journey, CCTV streaming, Chat, AI — partial |
| **Enterprise Readiness** | **~45%** | Multi-tenant built; compliance, SLA, audit not complete |
| **SaaS Readiness** | **~55%** | Tenant management live; billing automation and white-label missing |
| **Mobile App Readiness** | **~75%** | Parent module V2 live; dedicated native app not yet built |
| **AI Readiness** | **~10%** | Foundation only; no Claude API integration yet |

---

### Module-Level Completion

| Module | Completion | Status |
|--------|-----------|--------|
| Authentication & RBAC | 95% | ✅ Live |
| Student Management | 90% | ✅ Live |
| Attendance | 95% | ✅ Live |
| Care & Hygiene | 95% | ✅ Live |
| Nap / Food / Consumption | 90% | ✅ Live |
| Communication | 95% | ✅ Live |
| Push Notifications | 90% | ✅ Live |
| Pickup & Security | 80% | ✅ Live (approval UI partial) |
| Finance (Billing) | 70% | ✅ Live; automation + online payments missing |
| Child Journey | 70% | ✅ Staging; pending production promotion |
| Parent Module | 85% | ✅ Live (V2); Leave/Events/Chat planned |
| QR Management | 90% | ✅ Live |
| CCTV | 30% | Phase 1–2 only; streaming blocked |
| Academics | 35% | Pages only; backend shallow |
| Analytics | 40% | Exists; depth limited |
| Multi-Tenant Platform | 75% | ✅ Live; SaaS billing missing |
| Staged Releases | 90% | ✅ Live |
| Feature Flags | 85% | ✅ Live; per-plan gating missing |
| **Not-Started Modules** | 0% | Admissions CRM, HR, Transport, AI, Chat, BI |

---

### Risks

| Risk | Severity | Impact | Mitigation |
|------|----------|--------|-----------|
| CCTV credentials plaintext (CCTV-V2-TD-001) | High | Credential exposure if Firestore breached | Set `CCTV_ENCRYPTION_KEY` before any streaming |
| No pagination on parent feed / fees | Medium | Performance at >500 students | Add cursor pagination before scale |
| `parents/` not backfilled | Medium | Bulk notifications miss parents who never logged in | Write backfill script |
| No frontend test suite | Medium | Silent regressions | Populate Playwright; add to CI |
| Recurring billing not triggered | Medium | Manual invoicing bottleneck | Wire invoiceAutomation.js |
| Legacy API routes coexisting | Medium | Maintenance confusion | Audit and deprecate |
| SaaS billing not built | High (for commercial) | Cannot charge schools | Plan Stripe integration for V5 |
| AI dependencies on Claude API not integrated | Medium | AI roadmap blocked | Plan integration for V5 |
| Child Journey on staging only | Low | Parents on KUE Boxs Care can't see Journey | Promote with feature flag flip |
| No native mobile app | Medium | Parent experience limited to web PWA | Plan React Native / Flutter app for V5 |

---

### Missing Dependencies (Blocking Future Work)

| Feature | Blocked On |
|---------|-----------|
| CCTV live streaming | `CCTV_ENCRYPTION_KEY` set + migration script |
| Online payments (parent) | Razorpay integration |
| SaaS platform billing | Stripe integration for school subscriptions |
| Admissions CRM | New module + collection design |
| Staff HR modules | New module design (Attendance, Leave, Payroll) |
| AI features | Claude API integration (`claude-haiku-4-5-20251001` recommended for cost efficiency) |
| Annual Memory Book PDF | Child Journey Phase 4 (pending) |
| Parent-Teacher Chat | New real-time messaging architecture (Firestore subscriptions or websockets) |
| Franchise Dashboard | `franchises` collection + cross-tenant aggregation design |
| White Label | Per-tenant branding in `tenants` doc + runtime CSS injection |
| Per-plan feature gating | Flag system tied to `tenants.plan` field |

---

### Recommended Next Actions (Priority Order)

1. **Promote Child Journey to production** — flip `CHILD_JOURNEY` feature flag, rebuild production. The highest-impact parent feature ready to ship.
2. **Complete Pickup Approval UI** — backend done; reception staff need the frontend to manage daily pickup security.
3. **Activate CCTV encryption (CCTV-V2-TD-001)** — set `CCTV_ENCRYPTION_KEY` in Railway, run migration script. Low effort, removes a security risk.
4. **Wire recurring billing** — connect `invoiceAutomation.js` to node-cron. Monthly billing cannot remain manual.
5. **Write parents backfill script** — query all student emails → create missing `parents/` docs → unblocks bulk announcements.
6. **Build Child Journey Phase 4** — Annual Memory Book PDF. Completes the emotional core of the parent experience.
7. **Finalize Academics backend** — batches, teacher/student allocation services. 5 frontend pages are stranded without them.
8. **Add pagination to feed/fees** — before KUE Boxs Care grows. Firestore cursor pagination.
9. **Start Admissions CRM scoping** — highest-value missing module for school growth. Design `enquiries` and `admissions` collections.
10. **Begin AI integration planning** — evaluate Claude Haiku for cost-effective in-app AI features. Start with AI Report Card Generator as the highest ROI use case.
11. **Plan Razorpay integration** — online payments is the #1 parent finance request and unlocks significant school value.
12. **Populate Playwright tests + add CI/CD** — before the codebase grows further. GitHub Actions → Railway auto-deploy.

---

## Vision 2027

> This section describes the complete Yellow Dot product ecosystem as envisioned by 2027 — the target state the entire roadmap is building toward.

---

### Yellow Dot Preschool CRM (Staff Platform)

The complete school operating system for preschool administrators, teachers, and accountants. Every function of a preschool — from admitting a child to generating their final report card — lives inside Yellow Dot.

**Complete by 2027:**
- Admissions CRM (lead capture → enrollment)
- Full academics (classes, timetable, lesson plans)
- Daily operations (attendance, care, nap, food, CCTV)
- Finance (invoicing, online payments, fee collection analytics)
- HR (staff attendance, leave, payroll)
- Child Journey (observations, artwork, milestones, annual book)
- Communication hub (announcements, notices, chat, events)
- AI Assistant (natural language queries on school data)
- Executive Dashboard (real-time occupancy, revenue, engagement KPIs)
- Visitor & transport management

---

### Parent App

A beautiful, dedicated mobile application (React Native or Flutter) that is the parent's emotional connection to their child's preschool years.

**Complete by 2027:**
- Native iOS + Android apps (current: PWA)
- Child Journey timeline as the emotional core
- Real-time push notifications for every child activity
- Secure parent-teacher messaging
- Online fee payment (Razorpay, UPI, cards)
- Annual Memory Book PDF — downloadable, printable
- Leave requests and event RSVPs
- Document vault (report cards, health forms)
- AI FAQ chatbot (answers "when is pickup?" from live data)
- AI progress report delivery

---

### Teacher App

A lightweight companion app for teachers — focused on classroom workflow, not admin overhead.

**Features (2027 target):**
- Quick observation logging (voice-to-text via AI)
- Artwork photo capture with auto-upload to student journey
- One-tap attendance marking
- Milestone check (auto-detection runs silently; teacher confirms)
- Class-level announcements
- Parent message reading + reply
- Today's nap, food, and care summary per student
- No billing, no admin — teachers see only what's relevant to their classroom

---

### Staff App

An operations-focused companion for reception and admin staff.

**Features (2027 target):**
- QR scan for student check-in / check-out
- Visitor gate management
- Pickup authorization quick-check (scan parent QR → see authorized list)
- Staff check-in / check-out
- Today's operational summary
- Notification center for pickup requests, parent gate entries
- Fee payment recording (cash / UPI)

---

### Super Admin Portal

The platform owner's command center — managing all schools on the Yellow Dot SaaS platform.

**Complete by 2027:**
- All-schools health dashboard (occupancy, revenue, churn risk)
- Tenant onboarding with white-label config
- Subscription and billing management (Stripe)
- Franchise dashboard (group / chain view)
- Impersonation + audit trail
- Feature flag management per tenant and per plan
- Platform-level analytics (MRR, ARR, churn, LTV)
- Per-tenant AI usage metering
- SLA monitoring per tenant

---

### Multi-School SaaS Platform

Yellow Dot is architected as a multi-tenant SaaS platform. By 2027:

- Unlimited schools onboarded as tenants (`tenantId = schoolId`)
- 4-tier subscription model: Trial → Starter → Professional → Enterprise
- Per-plan feature gating (AI features = Enterprise only)
- White-label support (custom domain, logo, app name per tenant)
- Franchise support (one owner, many schools, consolidated dashboard)
- Automated Stripe billing per tenant
- 99.9% uptime SLA for Enterprise tenants (Cloud Functions, Firestore)
- GDPR / DPDP compliance per tenant data residency requirements

---

### CCTV Platform

A dedicated, secure classroom camera platform integrated into the CRM.

**2027 target:**
- Encrypted RTSP camera registration (AES-256-GCM, CCTV-V2-TD-001 resolved)
- Staff live view per classroom (HLS.js, time-based routing)
- Parent live view (per-center permissions, 60-second clips only)
- Motion alerts (AI-detected unusual activity — optional)
- Recording and playback with Firestore audit trail
- Camera health monitoring (uptime, last-tested)
- Per-tenant camera quota per subscription plan

---

### AI Platform

AI features embedded natively throughout Yellow Dot, powered by Anthropic Claude.

**2027 target:**
- **AI Report Card Generator** — Claude reads `journeyEntries` per student → drafts narrative by domain → teacher edits → parent receives PDF
- **AI School Assistant** (staff) — natural language queries: "How many children were absent last week?" "Which students have overdue fees?" "What did Riya do today?"
- **AI Parent FAQ Chatbot** — in parent app, answers routine questions using live school data
- **AI Admission Assistant** — on school website, qualifies leads, schedules tours, captures to CRM
- **AI Analytics** — weekly insights batch: attendance risk flags, fee collection anomalies, engagement score drops
- **Voice observation logging** — teacher speaks → AI transcribes → creates journey entry
- Model strategy: Claude Haiku (`claude-haiku-4-5-20251001`) for high-frequency, low-cost tasks (FAQ, summaries); Claude Sonnet (`claude-sonnet-4-6`) for report generation and complex queries

---

### Future K-12 Compatibility

Yellow Dot is architected for preschool today but designed with K-12 extension in mind.

**2027–2028 pathway:**
- Academic year system (June–May) already standardized
- `classes`, `batches`, `teacherAllocations` collection structure is grade-agnostic
- `journeyEntries` domains (social, emotional, communication, etc.) extend to academic subjects
- Student Management schema supports any age range
- Planned additions: Homework / assignment tracking, exam scheduling, grade book, parent report cards (CBSE / ICSE / IB compatible)
- Timetable engine needed (not yet started)
- The core architecture requires no migration — new module types plug in alongside preschool modules

---

> **Maintainer note:** Update this document after every major feature, architectural decision, module promotion, or strategic pivot. Version the header on each update. This is the single source of truth.

