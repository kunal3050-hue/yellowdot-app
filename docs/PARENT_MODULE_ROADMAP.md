# Parent Module — Roadmap

> Status: **✅ PRODUCTION READY (V1 — Phases 1–5 complete & verified live).**
> Deployed commit `d3afa2e` · backend on Railway · frontend on Firebase Hosting
> (`yellowdot-app`) · verified 2026-06-08.
>
> **No new Parent Module features for now.** Future work is tracked below under
> "Enhancements (post-V1, non-blocking)" and must NOT block this release.

## Navigation v2 — ✅ PRODUCTION READY (redesign phase closed)

Deployed commit `8c3e7ea` (Firebase Hosting `yellowdot-app`), verified 2026-06-08.

```
Bottom nav:  🏠 Home   ·   ☀️ Daily Care (raised center hub)   ·   👤 Profile
Home:        Greeting · Today's Feed/Announcements · 📸 Memories card · 💳 Fees card
Daily Care:  📅 Attendance (live) · 😴 Nap · 🍽️ Food Menu · 🍎 Consumption (non-clickable "Coming Soon")
Profile:     Parent info · Child info · Sign out   (no Settings)
```
- Attendance/Fees/Memories removed from the dock; Memories & Fees now on Home.
- Daily Care FAB launcher + Memories pill removed; dead-end Coming Soon routes
  removed. Every clickable item performs a real action; unbuilt modules are
  visible but non-clickable.
- Verified: Home (feed + cards), Daily Care (Attendance opens; 3 Coming Soon
  badges), Profile (parent/child/sign-out), all 3 tabs navigate, no orphan
  routes, no dead-ends.

## Production status

V1 shipped: **Parent Authentication, Parent Profile, Child Profile, Home Feed,
Attendance (view), Fees (view), Memories (view)**. Final production verification
(authenticated as a real parent) — all green:

| Check | Result |
|-------|--------|
| `/api/version` | ✅ `commit=d3afa2e`, `environment=production`, `version=1.0.0` |
| Parent login (`/api/auth/me`) | ✅ role=parent |
| Profile (`/api/parent/me`) | ✅ parent + linked children |
| Home Feed (`/api/parent/feed`) | ✅ |
| Attendance (`/api/parent/child/:id/attendance`) | ✅ today/%/calendar/history |
| Fees (`/api/parent/fees`) | ✅ balance/invoices/payments |
| Child Profile (`/api/parent/child/:id`) | ✅ |

Production hardening done: enriched `/api/version`, parent-auth path-scoping
(~5× → 1× `authenticate` per request), parent-child link self-heal on `/me`,
and a 26-test backend suite (`npm test`).

## Enhancements (post-V1, non-blocking)

Tracked as future enhancements — **not** part of the current release:
- **Memories producer** — staff upload UI + Storage integration (parents can
  view; there is no in-app way to create memories yet).
- **Notifications** (parent bell / `parentNotifications`).
- **Phase 6 — Leave Requests**; **Phase 7 — Events**.
- Fees: online payment / receipts / PDF. Attendance: any write features.
- Security: enforce `email_verified`; review Storage rules before media.
- Scalability: bound/paginate feed & fees reads; add caching; TTL-gate the
  `/me` link re-sync.
- Tooling: frontend tests; move Firebase web config to env; GitHub-triggered
  Railway deploys (auto commit SHA).

---

> Historical phase plan below.

> Status: **Phases 1–5 complete.**

The Parent Module is the warm, cheerful, mobile-first parent experience for
Yellow Dot. It is **completely separate** from the staff CRM (`MainLayout`) and
lives entirely under `src/modules/parent/`, with its own shell (`ParentLayout`)
and its own centralized Yellow theme (`src/modules/parent/theme/`).

---

## Scope decisions (V1)

- ✅ Centralized Yellow theme system (`modules/parent/theme/`).
- ✅ All parent code consolidated under `src/modules/parent/`.
- ❌ **CCTV removed from the Parent Module.** `ParentLiveCCTV` was deleted. If
  CCTV returns it will be a separate module with its own architecture,
  permissions, and roadmap.
- ❌ **Self check-in excluded from V1.** `/parent-checkin` remains a *legacy*
  route outside the module until removed.
- ❌ **Pickup history** is a security feature, not in the 7-phase plan.

---

## Phases

| Phase | Feature | Status | Primary data sources |
|------:|---------|--------|----------------------|
| **1** | Parent Authentication | ✅ Completed | Firebase Auth, `authMiddleware`, `parents/` |
| **1** | Parent Profile | ✅ Completed | `parents/{uid}` |
| **1** | Child Profile | ✅ Completed | `students/{id}` |
| **2** | Home Feed | ✅ Completed | `announcements`, `holidays`, `notices` |
| **3** | Attendance | ✅ Completed | `attendance`, `holidays` |
| **4** | Memories | ✅ Completed | `memories` (new) |
| **5** | Fees | ✅ Completed | `invoices`, `payments` |
| **6** | Leave Requests | ⬜ Not started | `leaveRequests` (new) |
| **7** | Events | ⬜ Not started | `announcements`, `holidays`, `notices` |

---

## Phase 1 — Completed ✅

**Auth, Parent Profile, Child Profile.**

- `parents/{uid}` identity collection (multi-child via `studentIds[]`), lazily
  provisioned from student email links on first parent API call.
- API: `GET /api/parent/me`, `GET /api/parent/children`,
  `GET /api/parent/child/:studentId` (parent-only; child access scoped to
  `studentIds`).
- Screens: `ParentProfile`, `ChildProfile` (+ `ComingSoon` placeholder).
- Security rules: `parents/{uid}` match + parent-account read clause on
  `students`.
- Permissions: `parent` → `["dashboard","profile","fees"]`.

### Known tech debt carried forward
- Email-match provisioning does not auto-refresh `studentIds` if a parent email
  changes later.
- `parents/` is populated lazily (no backfill script yet).
- `/fees` still renders the shared staff screen without `ParentLayout`
  (Phase 5).
- Theme files are `.ts` in a JS repo (transpiled, not type-checked/ESLinted).

---

## Phase 5 — Fees ✅ (shipped)

**Goal:** a parent-facing fees view. Read-only in V1. Fixes the current gap
where the dock "Fees" tab opens the shared **staff** screen without
`ParentLayout`.

**V1 scope**
- Outstanding balance summary (total due across linked children).
- Per-child invoice list: amount, due date, status.
- Invoice detail: amount, GST, discount, total, paid, balance, due date, status.
- Payment history (from `payments`).
- Multi-child switcher.
- Status colours: **green only for Paid/Success**; Overdue = red; Pending/
  Partial = amber. Theme tokens only.
- New `/parent-fees` route in `ParentLayout`; repoint dock "Fees" tab to it.

**Excluded (V1):** online payments / gateway, receipt PDFs, editing, refunds,
reminders, analytics.

**Data (reuse — no new collections)**
- `invoices/{id}` (studentId, amount, gst, discount, totalAmount, paidAmount,
  balance, status, dueDate) — read.
- `payments/{id}` — read.

**API (planned)**
- `GET /api/parent/fees?studentId=` → `{ summary:{ totalDue, counts }, invoices[], payments[] }`,
  scoped to linked children; ownership enforced (`studentId ∈ parents.studentIds`).

**Security rules (planned)**
- Add parent-account read clauses (`studentId in myLinkedStudentIds()`) to
  `invoices` and `payments`, mirroring `students` / `attendance` (multi-child,
  ordered first via `exists()`).

**Files (planned)**
- Backend: `services/parentFeesService.js`; new route in `routes/parentRoutes.js`.
- Frontend: `modules/parent/pages/Fees.jsx`, `hooks/useFees.js`,
  `services/parentService.js` (+`getFees`), route in `routes/parentRoutes.jsx`,
  dock update in `components/ParentLayout.jsx`.

**Deliverables on completion:** files created/modified, endpoints, collections,
rules, manual testing checklist, screenshots — then pause for approval (no
Phase 6 auto-start).

---

## Phase 4 — Memories ✅

A simple, beautiful timeline of photos & videos shared by school.

- Timeline feed · filter by child · date per memory · caption · photo
  fullscreen (gallery) view · inline video playback · empty state.
- Multi-child from day one; parents read only their linked children's media
  (ownership enforced against `parents.studentIds`).
- New collection `memories/{id}` (staff write, parent read). No existing media
  system fit this use case.
- API: `GET /api/parent/memories?studentId=` (optional child filter).
- Entry points: "📸 Memories" on Home header + "View memories" on Child
  Profile (deep-links `?child=`). Not a dock tab (dock stays at 4).
- Excluded (by design): likes, comments, downloads, sharing, albums, tags,
  reactions, AI.

---

## Phase 3 — Attendance ✅

**Read-only** attendance view for linked children. Intentionally small.

- Widgets: today's status (Present/Absent/Holiday/Not marked), monthly
  percentage, month calendar (colour-coded), history list.
- Multi-child switcher; data refetches per child + month.
- Green is used **only** for Present.
- Composes existing data — **no parallel attendance system**:
  `attendance` (via `attendanceService.getAttendanceHistory`) + `holidays`
  (via `communicationService.getHolidays`).
- API: `GET /api/parent/child/:studentId/attendance?month=YYYY-MM`
  (ownership enforced against `parents.studentIds`).
- Not built (by design): reports, analytics, charts, exports, PDF, editing,
  teacher actions.

---

## Phase 2 — Home Feed ✅

**Goal:** an Instagram-style parent feed. Beautiful, simple, Yellow Dot.

**Card types (only three):**
- **Announcement** — general school updates.
- **Activity** — what the children did (art, play, learning).
- **Event** — dated happenings (holidays, special days).

**Explicitly out of scope:** likes, comments, chat, CCTV, notifications.

**Data model (content-driven, no new collections):**
- Announcement ← `announcements` where `type !== "Activity"`.
- Activity ← `announcements` where `type === "Activity"`.
- Event ← `holidays` + `notices` where `type === "Event"`.

A single endpoint merges and date-sorts these into a feed:
`GET /api/parent/feed → { feed: FeedItem[] }`.

```
FeedItem = {
  id, type: "announcement" | "activity" | "event",
  title, body, image, date, tag
}
```

---

## Module structure (actual)

```
src/modules/parent/
├── components/
│   └── ParentLayout.jsx        # shell: top bar + bottom dock
├── pages/
│   ├── ParentProfile.jsx       # Phase 1
│   ├── ChildProfile.jsx        # Phase 1
│   ├── HomeFeed.jsx            # Phase 2
│   ├── Attendance.jsx          # Phase 3
│   ├── Memories.jsx            # Phase 4
│   └── ComingSoon.jsx          # reusable placeholder for future phases
├── services/
│   └── parentService.js        # parent API client
├── hooks/
│   ├── useParentProfile.js
│   ├── useParentFeed.js        # Phase 2
│   ├── useChildAttendance.js   # Phase 3
│   └── useMemories.js          # Phase 4
├── routes/
│   └── parentRoutes.jsx        # <Route> table consumed by App.jsx
├── types/
│   └── parent.js               # JSDoc typedefs
├── theme/                      # centralized Yellow theme
│   ├── colors.ts
│   ├── spacing.ts
│   ├── typography.ts
│   └── index.ts
└── index.js                    # module barrel
```

Backend (in `yellowdot-backend/`, not part of the frontend module):
`services/parentProfileService.js`, `services/parentFeedService.js`,
`services/parentAttendanceViewService.js`, `services/memoriesService.js`,
`routes/parentRoutes.js`.

### Bottom navigation (V1)

```
Home · Attendance · Fees · Profile
```

No Camera/CCTV. Attendance is a themed placeholder until Phase 3.

---

## Theme rules (every Parent Module screen)

- Primary identity = **Yellow Dot Yellow** (`colors.yellow500`).
- Secondary = lighter/darker shades of the same yellow.
- Neutrals = white, light gray, dark gray (text).
- **Green is not a primary UI color** — only positive semantics (success,
  Attendance "Present", payment success, positive indicators) via
  `colors.success`.
- No hardcoded colors/sizes/radii/shadows — import from `modules/parent/theme`.
