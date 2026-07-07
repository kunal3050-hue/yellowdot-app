# Presence & Safety — Domain Model

**Source:** Operational Workflow Report (presence-safety-operational-workflow.md)
**Purpose:** Establish the conceptual structure of the Presence & Safety domain before any UI is rebuilt. This document defines what things are, how they relate, and how they move through time.

---

## Part 1 — Module Classification

Each module has a distinct role in the domain. Mixing modules of different types in the same navigation tier is a common source of confusion for users.

---

### Attendance
**Classification: Operational Module**

Attendance is a time-bounded daily transaction. A teacher opens it, records a set of events (marks), and closes it. Its output — the attendance record — is consumed by notifications and the Inside count. It repeats every session, every day.

---

### Parent Entry
**Classification: Operational Module**

Parent Entry processes real-time gate events. Each interaction is a discrete transaction: a parent arrives, identity is confirmed, a child's presence state changes. It is event-driven and time-sensitive. It cannot be done retroactively — the selfie and gate scan are live.

---

### Pickup Authorization
**Classification: Master Data Module**

Pickup Authorization is not transactional. It is a reference dataset: the pre-configured list of who is allowed to do what. It changes rarely (on enrollment, on parent request, when circumstances change). Other modules read it but do not write to it. It is closer to a student profile than to a daily workflow.

---

### Pickup History
**Classification: Audit Module**

Pickup History is a read-only log of completed events. It is never edited. It grows only by appending. Its purpose is retrospective: to answer questions after events have occurred. It has no operational function during a normal school day — it does not change what staff do, only what they can verify later.

---

### Staff Checkout
**Classification: Operational Module**

Staff Checkout is the front-desk equivalent of Parent Entry. It processes departures in real time, on behalf of parents who do not use the self-service gate flow. It is event-driven, time-sensitive, and transactional.

---

### QR Management
**Classification: Infrastructure Module**

QR Management configures the physical access point for the entire gate entry system. Its output is a printed artifact — a QR code on a wall. It is used once at setup, and only touched again if the physical QR needs replacement. It is infrastructure, not operations.

---

### CCTV
**Classification: Monitoring Module**

CCTV provides real-time observation without producing transactional records. It does not mark attendance, authorize pickups, or change any child's state. Its output is a video stream and an access audit log. It is passive monitoring.

---

### Classification Summary

| Module | Type | Frequency | Primary Actor |
|--------|------|-----------|--------------|
| Attendance | Operational | Multiple times/day | Teacher |
| Parent Entry | Operational | Multiple times/day | Parent / Gate Staff |
| Staff Checkout | Operational | Multiple times/day | Reception / Teacher |
| Pickup Authorization | Master Data | Weekly or less | Admin |
| Pickup History | Audit | Daily review | Admin |
| CCTV | Monitoring | Daily (ongoing) | Staff / Parent |
| QR Management | Infrastructure | Rarely | Admin |

---

## Part 2 — Entity Diagram

### Core Entities and Relationships

```
┌──────────────┐           ┌──────────────────┐
│   CLASSROOM  │           │      CHILD        │
│              │◄──────────│                   │
│  - name      │  enrolled │  - name           │
│  - level     │    in     │  - class          │
│              │           │  - studentId      │
└──────┬───────┘           └────────┬──────────┘
       │                            │
       │ assigned to                │ has
       │                     ┌──────┴──────────────────┐
       │                     │                          │
       ▼            ┌────────┴────────┐    ┌────────────┴────────┐
┌──────────────┐    │     PARENT      │    │  AUTHORIZED PERSON   │
│    CAMERA    │    │                 │    │                      │
│              │    │  - name         │    │  - name              │
│  - name      │    │  - relation     │    │  - relation          │
│  - classroom │    │  - mobile       │    │  - photo             │
│  - RTSP      │    │  - fcmToken     │    │  - mobile            │
│  - status    │    │                 │    │  - status            │
└──────────────┘    │  isProtected    │    │  - emergency flag    │
                    │  = true         │    │                      │
                    │  (Father/Mother)│    │  Father/Mother are   │
                    └────────┬────────┘    │  a protected subtype │
                             │             │  of Authorized Person │
                             │             └────────────┬─────────┘
                             │                          │
                             └─────────────┬────────────┘
                                           │
                                    both receive
                                           │
                             ┌─────────────▼────────────┐
                             │      NOTIFICATION         │
                             │                           │
                             │  CHILD_CHECKED_IN         │
                             │  CHILD_CHECKED_OUT        │
                             │  ATTENDANCE_MARKED        │
                             └───────────────────────────┘
```

---

### Transactional Entities

These are created during operations, tied to a specific child on a specific date.

```
CHILD
  │
  ├──── ATTENDANCE RECORD (one per session per day, written by staff)
  │         - date, status (Present/Absent/Late)
  │         - checkIn time, checkOut time
  │         - method (manual / QR scan)
  │         - batch code
  │         - written by: Teacher via Attendance module
  │
  ├──── PARENT ATTENDANCE RECORD (one per gate event)
  │         - action (Check_In / Check_Out)
  │         - actor (parent name, relation)
  │         - actorType (Parent / Staff)
  │         - gate identifier
  │         - selfie image
  │         - faceDetected flag
  │         - GPS coordinates
  │         - written by: Parent Entry OR Staff Checkout
  │         - NOTE: this collection is the source of child status
  │
  ├──── PICKUP EVENT (one per completed departure)
  │         - person who collected (name, relation, photo)
  │         - approvalStatus (Authorized / Emergency_Authorized / Unauthorized)
  │         - selfie image
  │         - verifiedBy (staff member)
  │         - written by: Parent Entry (on Check Out) OR Staff Checkout
  │
  └──── PICKUP REQUEST (one per unknown-person incident)
            - photo of the unknown person
            - person name and relation (if given)
            - staff member who created it
            - status (pending / approved / rejected)
            - written by: Staff Checkout
            - responded to by: Parent via parent app
```

---

### Infrastructure Entities

These exist at the center level, not the child level.

```
CENTER
  │
  ├──── GATE QR CONFIG (one per center, sometimes one per gate)
  │         - centerName
  │         - QR payload: { type, centerId, version }
  │         - base64 PNG of the physical QR
  │         - isActive flag
  │         - generated by: QR Management
  │         - consumed by: Parent Entry Step 1
  │
  └──── CAMERA (many per center)
            - assigned to a Classroom
            - RTSP connection config (encrypted)
            - status (Active / Inactive)
            - managed by: CCTV module
            - consumed by: CCTV live view (staff and parent)
```

---

### Full Entity Map

```
CENTER
├── GATE QR CONFIG
│     └── consumed by ──► PARENT ENTRY (gate scan step)
│
└── CLASSROOM
      ├── CAMERA ──────────► CCTV live view
      │
      └── CHILD
            ├── AUTHORIZED PERSON (many)
            │     └── read by ──► PARENT ENTRY (checkout step)
            │     └── read by ──► STAFF CHECKOUT (verified persons list)
            │
            ├── ATTENDANCE RECORD (per session/day)
            │     └── written by ──► ATTENDANCE MODULE
            │     └── notifies ───► PARENT (ATTENDANCE_MARKED)
            │
            ├── PARENT ATTENDANCE RECORD (per gate event)
            │     └── written by ──► PARENT ENTRY
            │     └── written by ──► STAFF CHECKOUT
            │     └── derives ────► CHILD STATUS (PRESENT/CHECKED_OUT/NOT_ARRIVED)
            │     └── notifies ───► PARENT (CHILD_CHECKED_IN / CHILD_CHECKED_OUT)
            │     └── gates ──────► CCTV parent live view
            │
            ├── PICKUP EVENT (per departure)
            │     └── written by ──► PARENT ENTRY (on Check Out)
            │     └── written by ──► STAFF CHECKOUT (on authorized checkout)
            │     └── read by ────► PICKUP HISTORY screen
            │     └── read by ────► PARENT APP
            │
            └── PICKUP REQUEST (per unknown-person incident)
                  └── written by ──► STAFF CHECKOUT
                  └── responded to by ──► PARENT APP
                  └── on approval: creates ──► PICKUP EVENT
```

---

## Part 3 — Lifecycle Diagrams

### A. Morning Arrival

Two parallel events occur when a child arrives. They are independent but should both happen.

```
CHILD ARRIVES AT SCHOOL
         │
         ├─────────────────────────────────────────────┐
         │                                             │
         ▼                                             ▼
  [GATE — Parent Entry]                    [CLASSROOM — Attendance]
         │                                             │
  Parent scans gate QR                    Teacher marks child Present
         │                                             │
  Parent takes selfie                     (or scans child's QR badge)
         │                                             │
  Taps "Check In"                         Record saved immediately
         │                                             │
  Parent Attendance Record created        Attendance Record created
  action = Check_In                       status = Present
         │                                             │
  Child status → PRESENT                  Summary bar updates
         │                                             │
  CHILD_CHECKED_IN notification ──────►  ATTENDANCE_MARKED notification
  sent to other parent                    sent to parent if absent
         │
         └──────────────► Child is now accessible for:
                           - CCTV parent live view
                           - Staff Checkout (shows PRESENT)
                           - Pickup authorization checks
```

**What can go wrong operationally:**
- Parent skips gate QR → child is Present in Attendance but NOT_ARRIVED in gate system → CCTV parent live view blocked
- Teacher skips Attendance → no roll call record → Inside count unreliable
- Both skip → child is physically in school with no system record

---

### B. Midday Child Status

Child status is derived from the most recent gate event, not from classroom attendance.

```
CHILD STATUS AT ANY POINT IN THE DAY
                │
                ▼
  Query: most recent Parent Attendance Record for this child today
                │
         ┌──────┴────────┬────────────────┐
         │               │                │
         ▼               ▼                ▼
   No record        action =          action =
   today            Check_In          Check_Out
         │               │                │
         ▼               ▼                ▼
   NOT_ARRIVED       PRESENT          CHECKED_OUT
         │               │                │
    ┌────┤           ┌────┤           ┌────┤
    │    │           │    │           │    │
    ▼    ▼           ▼    ▼           ▼    ▼
 CCTV  Staff      CCTV  Staff      CCTV  Staff
parent blocked   parent  can       parent blocked
 view   can't    view  check      view   shows
blocked check    works  out      blocked already
        out                             out
```

**Key implication:** Child status has nothing to do with the Attendance module. A child marked Present by the teacher is NOT_ARRIVED to the gate system if the parent never scanned the gate.

---

### C. Authorized Pickup Process

Two paths for a child's authorized departure.

```
AUTHORIZED PICKUP — PATH A (Parent self-service at gate)

Parent arrives at gate
         │
  Scans gate QR [Parent Entry Step 1]
         │
  Takes face selfie [Parent Entry Step 3]
         │
  Taps "Check Out"
         │
  System displays authorized persons list ◄── reads PICKUP AUTHORIZATION
         │
  Parent selects themselves
         │
  Parent Attendance Record created (action = Check_Out)
  Pickup Event created (status = Authorized)
  Child status → CHECKED_OUT
         │
  CHILD_CHECKED_OUT notification sent to other parent


AUTHORIZED PICKUP — PATH B (Staff at front desk)

Person arrives at reception
         │
  Staff opens Staff Checkout
  Searches child → child shows PRESENT
         │
  Staff sees authorized persons list ◄───── reads PICKUP AUTHORIZATION
         │
  Staff selects authorized person
         │
  Parent Attendance Record created (action = Check_Out)
  Pickup Event created (status = Authorized)
  Child status → CHECKED_OUT
         │
  CHILD_CHECKED_OUT notification sent to parent(s)
```

---

### D. Unknown Person Pickup

The most operationally complex flow. Involves four actors.

```
UNKNOWN PERSON ARRIVES AT RECEPTION

Staff: "Are you listed as an authorized person for [child]?"
         │
  Staff opens Staff Checkout
  Searches child → PRESENT
  Checks authorized list → person NOT found
         │
  Staff taps "Unknown Person"
         │
  ┌──────────────────────────────────────────────────────────┐
  │  STAFF CHECKOUT — PHOTO STEP                             │
  │                                                          │
  │  Rear camera activates                                   │
  │  Staff photographs the person's face                     │
  │  Enters name (optional) and relation                     │
  │  Taps "Send to Parent for Approval"                      │
  │                                                          │
  │  Pickup Request created:                                 │
  │    - person photo                                        │
  │    - person name + relation                              │
  │    - staff name                                          │
  │    - status = pending                                    │
  └──────────────────────────────┬───────────────────────────┘
                                 │
                   Push notification sent to parent:
                   "Unknown person requesting to collect [child]"
                   Photo included
                                 │
               ┌─────────────────┴─────────────────┐
               │                                   │
               ▼                                   ▼
      PARENT APPROVES                     PARENT REJECTS
               │                                   │
  Pickup Request → approved          Pickup Request → rejected
  Staff screen updates                              │
               │                      Child held at school
  Child released                      [No defined escalation
               │                       in current system]
  Parent Attendance Record (Check_Out)
  Pickup Event (Emergency_Authorized)
  Child status → CHECKED_OUT
  CHILD_CHECKED_OUT notification
```

**Gap:** The rejection path has no defined next step. The system records the rejection but does not alert management, create an incident, or guide staff on what to do next.

---

### E. CCTV Access

Two separate access paths with different gate conditions.

```
STAFF LIVE VIEW REQUEST

Staff opens CCTV → Live View tab
         │
  Selects a camera
         │
  System checks: does this staff member have
  access to this classroom?
         │
    ┌────┴────┐
    │         │
  YES         NO
    │         │
  Stream    Access
  token     denied
  issued    (logged)
    │
  HLS stream loads
  in video player
         │
  Session logged: LIVE_VIEW_STARTED
         │
  Staff closes stream
         │
  Session logged: LIVE_VIEW_STOPPED


PARENT LIVE VIEW REQUEST

Parent opens parent app → taps Live View
         │
  System runs four checks in sequence:
         │
  1. Is parent live view ENABLED by admin?
         │ NO → blocked
         │ YES ↓
  2. Is current time within school hours window?
         │ NO → blocked
         │ YES ↓
  3. Is child currently PRESENT? ◄─── reads parentAttendance
         │ NO → blocked
         │ YES ↓
  4. Does a camera exist for child's classroom?
         │ NO → blocked
         │ YES ↓
  Stream token issued (time-limited)
  HLS stream loads
         │
  Session logged: LIVE_VIEW_STARTED
  Any block: LIVE_VIEW_DENIED logged
```

---

## Part 4 — Recommended Navigation Structure

This section recommends how to organize the Presence & Safety navigation based on module type and usage frequency. No screens are redesigned — only how they are grouped and surfaced.

---

### The Problem with the Current Structure

All seven modules appear as peers in a flat sidebar list. This creates three problems:

1. **Type mixing.** Daily operational modules (Attendance, Parent Entry, Staff Checkout) share navigation space with a one-time infrastructure setup tool (QR Management). A teacher looking for attendance may accidentally open QR Management.

2. **Frequency mismatch.** A module used 60 times a day (Parent Entry) and a module used once a year (QR Management) have equal visual weight.

3. **Actor confusion.** A teacher, a receptionist, and an admin see the same sidebar. The teacher has no use for QR Management or Pickup Authorization. The admin rarely needs the Attendance screen.

---

### Organizing Principle

Group modules by **type and actor**, not by topic.

```
PRESENCE & SAFETY NAVIGATION

┌─────────────────────────────────────────────────────┐
│  DAILY OPERATIONS                                   │
│  (Used multiple times per day — staff + teachers)   │
│                                                     │
│  ○  Attendance                                      │
│  ○  Parent Entry                                    │
│  ○  Staff Checkout                                  │
├─────────────────────────────────────────────────────┤
│  MONITORING                                         │
│  (Real-time observation — staff + parents)          │
│                                                     │
│  ○  CCTV                                            │
├─────────────────────────────────────────────────────┤
│  RECORDS                                            │
│  (Review and lookup — admin + management)           │
│                                                     │
│  ○  Pickup History                                  │
├─────────────────────────────────────────────────────┤
│  CONFIGURATION                                      │
│  (Setup and maintenance — admin only)               │
│                                                     │
│  ○  Pickup Authorization                            │
│  ○  QR Management  →  move to Settings              │
└─────────────────────────────────────────────────────┘
```

---

### Module-by-Module Placement Rationale

**Attendance → Daily Operations**
Used every session by every teacher. First item in the section because it is the first operational task of the day.

**Parent Entry → Daily Operations**
Used during drop-off and pickup waves. High-frequency, time-sensitive. Belongs beside Attendance as the parallel gate operation.

**Staff Checkout → Daily Operations**
Used throughout the afternoon by reception. Operationally paired with Parent Entry — both process departures, from different positions in the building.

**CCTV → Monitoring**
The only module that is purely observational. Does not produce attendance records, authorize pickups, or change any state. It belongs in its own tier, separate from operational tools. Parents who have live-view access also access it from a different entry point (the parent app), which reinforces its distinct nature.

**Pickup History → Records**
A read-only audit log. Staff open it to review, not to act. Grouping it under Records signals its purpose: it is evidence, not a task.

**Pickup Authorization → Configuration**
Setup and maintenance, not daily operations. Used on enrollment and when parent circumstances change. It should be reachable within Presence & Safety (not buried in global Settings) because it is conceptually part of safeguarding — but it should be visually distinguished from daily operational modules. A "Configuration" or "Setup" section in the sidebar achieves this without changing the screen.

**QR Management → Settings (Admin)**
The only true infrastructure module. Used once, then forgotten. It does not belong in the same navigation as Attendance or Parent Entry. Moving it to Settings > Gates (or Settings > School Setup) removes it from daily-use navigation without removing it from the product.

---

### Navigation by Role

The groupings above naturally align with role-based access:

```
TEACHER
  ├── Daily Operations: Attendance ✓
  ├── Daily Operations: Parent Entry ✓ (front desk / classroom)
  ├── Daily Operations: Staff Checkout ✓ (classroom pickups)
  └── Monitoring: CCTV ✓ (own classroom only)

RECEPTION / FRONT DESK
  ├── Daily Operations: Parent Entry ✓
  ├── Daily Operations: Staff Checkout ✓
  ├── Records: Pickup History ✓
  └── Configuration: Pickup Authorization ✓ (read + update)

ADMIN
  ├── All of the above
  ├── Configuration: Pickup Authorization ✓ (full access)
  └── Settings: QR Management ✓

PARENT (parent app — different surface entirely)
  ├── Notifications (passive receipt)
  ├── Pickup History (own child, read-only)
  ├── Pickup Authorization (own child, read-only)
  ├── Pickup Requests (approve/reject)
  └── CCTV live view (own child's classroom, gated)
```

---

### The Two Entry Points That Should Be Explicit

The domain model reveals that Presence & Safety has two distinct physical entry points into the school building, each with its own workflow:

```
ENTRY POINT 1 — THE GATE
  Managed by: Parent Entry + Staff Checkout
  Infrastructure: Gate QR (from QR Management)
  Record produced: Parent Attendance Record
  Drives: Child status (PRESENT / CHECKED_OUT / NOT_ARRIVED)

ENTRY POINT 2 — THE CLASSROOM
  Managed by: Attendance
  Record produced: Attendance Record
  Drives: Inside count, roll call, parent notifications
```

These two entry points serve different purposes and should never be collapsed into one flow. Any navigation redesign should make this distinction clear — the gate and the classroom are separate concerns that happen to involve the same children.

---

## Part 5 — Domain Summary

### What Presence & Safety actually is

Presence & Safety is not one thing. It is five distinct concerns that share a domain:

| Concern | Modules | Core Question |
|---------|---------|--------------|
| Classroom presence | Attendance | Is this child in class today? |
| Gate presence | Parent Entry, Staff Checkout | Did this child cross the school boundary? |
| Departure authorization | Pickup Authorization | Who is allowed to take this child home? |
| Departure evidence | Pickup History | Who actually took this child home, when, and what did they look like? |
| Physical environment | CCTV | What is happening in this space right now? |

### What determines a child's "status"

There is one source of truth for child status: the most recent Parent Attendance Record. Classroom attendance (the Attendance module) does not affect it. This is the most important conceptual fact in the domain — and the most common source of operational confusion.

### The handoff chain

Every child's day passes through a handoff chain. Each handoff is a discrete event with an owner, a record, and a notification:

```
PARENT → GATE STAFF          [Parent Entry / Staff Checkout]
    creates: Parent Attendance Record (Check_In)
    fires: CHILD_CHECKED_IN notification

GATE STAFF → TEACHER         [Attendance]
    creates: Attendance Record (Present)
    fires: ATTENDANCE_MARKED notification (if absent)

TEACHER → GATE STAFF         [Attendance checkout]
    updates: Attendance Record (checkOut time)
    fires: CHILD_CHECKED_OUT notification

GATE STAFF → PARENT          [Parent Entry / Staff Checkout]
    creates: Parent Attendance Record (Check_Out)
    creates: Pickup Event
    fires: CHILD_CHECKED_OUT notification
```

Each handoff is its own module because each handoff involves different actors, different verification steps, and different legal responsibilities.
