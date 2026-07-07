# Presence & Safety — Operational Workflow Report

**Purpose:** This document describes how Yellow Dot is intended to operate in the real world. It explains who does what, when, and why — not how the code works. It is the reference for deciding what stays, what merges, and what gets rebuilt.

---

## Module 1 — Attendance

### 1. Real-World Scenario

A normal school morning at Yellow Dot:

```
07:45  Teacher opens Yellow Dot on classroom tablet
       → Attendance screen loads, filtered to their class and today's date

08:00  Morning session begins
       Children arrive and enter classrooms

08:05  Teacher method A (manual):
       → Scans down the student list
       → Taps each child's name to mark Present, Absent, or Late
       → Each tap auto-saves immediately — no Submit button

       Teacher method B (QR):
       → Switches to QR Scanner tab
       → Holds tablet camera toward each child's printed QR badge
       → System auto-marks Present on first scan
       → Summary bar updates in real time (12 Present, 2 Absent, 1 Late)

08:20  Teacher checks summary bar:
       → 15 total, 13 Present, 2 Absent, 0 Late
       → Sends notification to parents of absent children

13:00  Afternoon session begins
       Teacher marks afternoon session (different batch code)

16:00  End of day
       Teacher checks "Inside" count — should be zero
       Any child still marked Inside with no checkout is flagged
```

**When a child is checked out** (picked up by parent or staff):
```
Parent arrives at classroom
Teacher (or reception) marks child checkout via Attendance screen
→ PUT /api/attendance/:id/checkout
→ Child moves from Inside to Checked Out
→ CHILD_CHECKED_OUT notification sent to parent
```

---

### 2. Actor Analysis

**Teacher**
Primary user. Opens Attendance every morning and afternoon. Marks each child's status. Uses QR scanner for faster marking in larger classes. Monitors the Inside count throughout the day.

**Center Admin**
Reviews historical attendance for fee calculation, reports, or parent queries. Uses History view with date range filters. Can export individual student attendance records.

**Parent (indirect)**
Receives push notification when their child is marked Present or when their child checks out. Does not interact with the Attendance screen directly — they see the outcome in their notification feed.

**Reception / Front Desk**
May assist with checkout marking when a parent arrives at the gate before reaching the classroom.

---

### 3. Operational Value

**Why it exists:** Attendance is the foundational daily record of every child's presence. It is the classroom register. It drives fee calculations, parent communications, and safety accountability.

**Business problem it solves:** Without attendance, the school has no answer to "Is my child in school today?" or "How many days was my child absent this month?" It also provides the Inside count — the critical end-of-day check that no child has been left behind.

**What happens if staff stop using it:**
- No record of who was present on any given day
- Parents receive no morning check-in notifications
- The Inside count becomes meaningless — no way to confirm all children have been collected
- Historical records for fee disputes, compliance audits, or incident reports disappear

---

### 4. Daily Usage Frequency

**Multiple times per day.** Marked at the start of every session (morning and afternoon), updated throughout the day as children arrive late or are checked out. The summary bar auto-refreshes every 15 seconds during active hours.

---

### 5. Module Relationships

```
Attendance
│
├── → Notifications
│       ATTENDANCE_MARKED sent to parent on manual mark
│       CHILD_CHECKED_IN sent on QR check-in scan
│       CHILD_CHECKED_OUT sent on QR checkout scan
│
├── → Parent App
│       Parents see notification: "Arjun has been marked Present"
│       No direct read access to the Attendance screen
│
├── ← QR Management (student QRs)
│       Student QR codes generated from Attendance > Student QRs tab
│       Each QR encodes the student ID in format: YD-{studentId}
│
└── ← Pickup (contextual)
        Attendance checkout (PUT /checkout) is used when
        staff want to record a child has left the classroom
        Separate from the gate-level checkout in Parent Entry
```

**Relationship with CCTV:** None directly. Attendance records do not gate CCTV access.

**Relationship with Parent Entry:** Both systems track check-in/out but independently. Attendance tracks classroom presence (marked by staff). Parent Entry tracks gate presence (initiated by parent). A child can be Present in Attendance but NOT_ARRIVED in Parent Entry if the parent never scanned the gate.

---

### 6. Current School Workflow

The school operates two Attendance marking methods simultaneously:

**Method 1 — Manual marking** is the default. The teacher reviews their class list and taps each student. Designed for smaller classes or when QR badges are not in use.

**Method 2 — QR scanning** is the intended production path for high-speed morning roll call. Each child wears or carries a printed QR badge. The teacher scans them as they enter the classroom. The system handles the check-in/checkout state machine automatically: first scan = check in, second scan = check out.

The system expects teachers to close out the day with an Inside count of zero. The Inside count (students with a check-in but no check-out) is the system's mechanism for flagging children who have not been collected.

---

---

## Module 2 — Parent Entry

### 1. Real-World Scenario

A parent arrives at the school gate to drop off or collect their child:

**Morning drop-off (Check In):**
```
08:05  Parent arrives at school gate
       Gate has a printed Yellow Dot QR code on display (or a tablet kiosk)

Step 1 — Gate QR Scan:
       Parent opens Yellow Dot app (or uses gate kiosk)
       → Points camera at gate QR
       → System reads: YD-SEAWOODS-GATE-1
       → "Gate 1, Seawoods" confirmed on screen

Step 2 — Identity:
       Parent enters their name
       Selects relation: Mother
       Searches for child → selects "Arjun Sharma (PGB-A)"

Step 3 — Face selfie:
       Front camera activates
       Oval guide appears on screen
       Parent centers their face
       Guide turns green when exactly one face is detected
       Parent taps "Check In"

       → Record saved: selfie + name + relation + gate + child + timestamp
       → CHILD_CHECKED_IN notification sent to the other parent

Step 4 — Confirmation:
       "Checked In! Arjun is now inside."
       Selfie thumbnail displayed
       Parent taps Done → system resets for next family
```

**Afternoon pickup (Check Out):**
```
15:45  Parent arrives at gate

Steps 1–2 same as above (gate scan + face selfie)

Step 3 — Checkout:
       Parent taps "Check Out"
       System shows list of authorized pickup persons for Arjun
       Parent selects themselves: "Priya Sharma — Mother"
       → Checkout recorded in parentAttendance
       → Pickup history entry created
       → CHILD_CHECKED_OUT notification sent

       If the person arriving is NOT on the authorized list:
       → Staff override: "Emergency Authorization" option visible to staff
       → Blocked event logged if unauthorized
```

---

### 2. Actor Analysis

**Parent**
Primary user at the gate. Scans the QR, enters their name, takes the selfie, and confirms whether they are dropping off or picking up. This is a self-service action — no staff involvement required if the parent is on the authorized list.

**Reception / Front Desk Staff**
Monitors the gate or assists parents who are unfamiliar with the system. Can use Emergency Authorization override when a legitimate but unregistered person needs to collect a child. Manages the kiosk device if the school operates a shared tablet at the gate rather than requiring parents to use their own phones.

**Security / Gate Staff** (where applicable)
Responsible for ensuring the gate QR is displayed correctly, the kiosk is charged, and that parents complete the check-in process before entering. Visually confirms the selfie matches the person.

---

### 3. Operational Value

**Why it exists:** Parent Entry is the gate security layer. It answers: "Who physically entered and exited this school, when, with whose child, and what did they look like?" It creates a time-stamped, photo-backed audit trail of every adult who moves a child across the school boundary.

**Business problem it solves:** Schools are legally and operationally responsible for knowing who collected each child. Without this, there is no record of whether a child left with an authorized person or left at all. It also notifies the other parent automatically, which reduces "did you pick up the kids?" miscommunication.

**What happens if staff stop using it:**
- Gate entry becomes unmonitored
- No selfie audit trail for pickup disputes or safeguarding investigations
- The other parent receives no notification when their child leaves school
- Staff Checkout and CCTV parent-view lose their data source — child status becomes unknown

---

### 4. Daily Usage Frequency

**Multiple times per day.** Used during drop-off (08:00–09:00) and pickup (15:30–16:30). In a school with 60 students and two parents per family, this could mean 60–120 interactions per day across both sessions. The system is designed for throughput at peak times.

---

### 5. Module Relationships

```
Parent Entry (parentAttendance collection)
│
├── ← QR Management
│       The gate QR scanned in Step 1 is generated by QR Management
│       Without a valid gate QR, Step 1 cannot be completed
│
├── ← Pickup Authorization
│       At checkout (Check Out), the system reads the authorized
│       persons list for that child
│       Parent must select themselves from the list
│
├── → Pickup History
│       On every Check Out, a record is written to pickupHistory
│       Includes: who collected, selfie, approval status, verifier
│
├── → Notifications
│       CHILD_CHECKED_IN: sent when parent checks child in
│       CHILD_CHECKED_OUT: sent when parent checks child out
│
├── → Staff Checkout (shared collection)
│       Both Parent Entry and Staff Checkout write to parentAttendance
│       Child status (PRESENT / CHECKED_OUT / NOT_ARRIVED) is derived
│       from this shared collection
│
└── → CCTV
        CCTV parent-view checks this collection to confirm
        child is PRESENT before issuing a live stream token
```

---

### 6. Current School Workflow

The school is intended to operate a **gate checkpoint model**. The gate QR code (printed and displayed at the entrance) is the trigger for every parent check-in and check-out. No parent should enter or exit with a child without completing this step.

The face selfie serves two purposes:
1. It confirms a live person is present (face detection requires exactly one face, minimum size).
2. It creates a visual record tied to the timestamp and child — useful if a dispute arises later.

The system is designed so the gate kiosk (a shared tablet) or a parent's own phone can both complete this flow. The school chooses the deployment model: kiosk at gate, or each parent uses the app on their phone.

---

---

## Module 3 — Pickup Authorization

### 1. Real-World Scenario

```
Day 1 (one-time setup, when child enrolls):
       Admin creates student record
       → System auto-creates Father and Mother entries
         from the enrollment form data
       → These are marked "Protected" — cannot be deleted

Day 3:
       Parent calls school: "My mother will pick up Arjun on Fridays"
       Staff opens Pickup Authorization
       → Searches for Arjun
       → Clicks "Add Person"
       → Uploads grandmother's photo (from phone or ID card)
       → Enters: Name, Relation = Grandmother, Mobile = 9XXXXXXXX
       → Status = Active
       → Saves

Day 10:
       Same parent calls: "My driver will collect Arjun for the next two weeks"
       Staff adds driver entry, Status = Active

Day 25:
       Driver arrangement ends
       Staff edits driver entry → Status = Inactive
       (Record is preserved for audit — not deleted)

Emergency scenario:
       Staff adds a person with Emergency toggle = ON
       This person is flagged separately in the pickup verification list
       Pickup History records their checkout as "Emergency_Authorized"
```

---

### 2. Actor Analysis

**Reception / Admin Staff**
Primary user. Manages the authorized persons list for each student throughout their enrollment. Adds new persons on parent request, deactivates persons when arrangements change. Reviews incomplete records (missing photo or mobile number) and follows up with parents.

**Teacher**
Reads the authorized persons list during a pickup if they are releasing a child directly from the classroom. Does not edit the list.

**Parent (indirect)**
Makes requests verbally or by phone — they do not directly edit their child's authorized persons list. They can view the list in the parent app (read-only).

**Admin**
Runs bulk migration when the school migrates to Yellow Dot with an existing student database — ensures every student has at minimum a Father and Mother entry.

---

### 3. Operational Value

**Why it exists:** Before releasing a child to any adult, staff need to verify that person is authorized. Without this list, the verification is informal (staff memory, paper forms). With it, any staff member — including new or substitute staff — can look up who is allowed to collect a child.

**Business problem it solves:** Child safeguarding. Schools are legally responsible for releasing children only to authorized persons. This module provides the mechanism, the audit trail, and the photo reference to enforce that responsibility at scale.

**What happens if staff stop using it:**
- Pickup verification at the gate returns to informal/paper processes
- Staff cannot verify unfamiliar persons against a system record
- The Parent Entry checkout step has no authorized persons list to check against — it would block all checkouts
- Staff Checkout has no verified persons to select from — all pickups default to the unknown-person path

---

### 4. Daily Usage Frequency

**Weekly or less.** This is a setup and maintenance module, not a daily-use screen. Interactions happen when: a new student enrolls, a parent's circumstances change, or an incomplete record needs to be updated. Once the school is fully set up, this module is touched infrequently.

---

### 5. Module Relationships

```
Pickup Authorization (pickupLogs, type=authorization)
│
├── → Parent Entry
│       At checkout step, Parent Entry reads the Active persons
│       list for the child being collected
│       Parent must select an authorized person to proceed
│
├── → Staff Checkout
│       Staff Checkout reads the same Active persons list
│       Staff can immediately release child to an authorized person
│       without sending a request to the parent
│
├── → Pickup History
│       The authorized person's name and relation are recorded
│       in each pickup history entry (denormalized at write time)
│
└── → Parent App (read)
        Parents can view their child's authorized persons list
        in the parent app — read only, no editing
```

---

### 6. Current School Workflow

The school is expected to maintain this list as part of student onboarding and ongoing parent communication. The intended workflow is:

1. At enrollment, admin completes the student record — Father and Mother are auto-created.
2. During the school year, admin updates the list when parents request changes.
3. Staff use the list as a reference during every pickup interaction.

The "Incomplete" flag (triggered when a Father or Mother record is missing a photo or mobile number) is the system's way of prompting admin to follow up with parents who provided incomplete data at enrollment. The migration tool was built for the transition period when the school switched to Yellow Dot with an existing student database.

---

---

## Module 4 — Pickup History

### 1. Real-World Scenario

**Normal end-of-day review:**
```
16:30  All children have been collected

Admin opens Pickup History
→ Date = today, Status = All

Reviews the list:
       15:32  Arjun Sharma — Priya Sharma (Mother) — Authorized ✓
       15:41  Riya Patel — Deepak Patel (Father) — Authorized ✓
       15:55  Kavya Nair — Unknown (Driver) — Emergency_Authorized ⚠
       16:12  Rohan Mehta — Sunita Mehta (Grandmother) — Authorized ✓

Admin notes the Emergency_Authorized entry
→ Clicks photo icon for Kavya Nair's record
→ Reviews selfie: driver photographed at gate
→ Confirms with teacher: parent called ahead to authorize

Separately:
       If Status = Unauthorized appeared:
       → Immediate flag: someone attempted a pickup but was blocked
       → Selfie photo provides identity of the person
       → Incident can be escalated
```

**Parent query scenario:**
```
Parent calls: "Who collected my child yesterday?"
Staff opens Pickup History
→ Filters by student name + date
→ Shows: "Arjun Sharma — 15:32 — Priya Sharma (Mother)"
→ Staff can show the selfie photo if needed
→ Query resolved in under 30 seconds
```

---

### 2. Actor Analysis

**Admin / Reception**
Reviews the daily list to confirm all pickups were authorized. Investigates any Emergency_Authorized or Unauthorized entries. Uses it to respond to parent queries about past pickups.

**Parent (read-only)**
Can view their own child's pickup history in the parent app. Primarily used to confirm who collected their child on a given day if the other parent has a question.

**Management / Safeguarding Lead**
Pulls history for a specific date range or student when an incident is being investigated. The selfie photo is the key piece of evidence.

---

### 3. Operational Value

**Why it exists:** Pickup History is the audit log for child safety at departure. It answers the question "who took which child home, when, and was it authorized?" with a photo record attached to every event.

**Business problem it solves:** Schools face situations where a parent disputes a pickup, a safeguarding concern is raised, or a legal question about who had custody of a child on a specific day arises. Without this log, the school has no answer. With it, every departure is documented with a timestamp, the authorized person's identity, and a selfie.

**What happens if staff stop using it:**
Nothing breaks immediately — the log is written automatically by Parent Entry and Staff Checkout. The module is read-only for staff; it cannot stop being populated unless those upstream modules stop being used. The impact is loss of visibility: blocked pickups go unreviewed, the daily confirmation step is skipped, and historical records are never consulted.

---

### 4. Daily Usage Frequency

**Daily.** The end-of-day review should be a routine 5-minute check: filter today, scan for Emergency_Authorized and Unauthorized entries, confirm count matches expected pickups. In practice, this is the module that gets opened reactively (when a parent calls with a question) as much as proactively.

---

### 5. Module Relationships

```
Pickup History (pickupLogs, type=history)
│
├── ← Parent Entry (writes here on every Check Out)
│       Every gate checkout creates a history record
│       Includes selfie, authorized person, verifier
│
├── ← Staff Checkout (writes here via parent-attendance checkout path)
│       Front-desk checkouts also generate history records
│
├── ← Pickup Authorization (data source for authorized person details)
│       Person name and relation copied into history record at write time
│
├── → Parent App (read)
│       Parent sees a feed of their child's recent pickups
│       Can view the selfie photo
│
└── → Notifications
        No notifications generated by Pickup History itself
        Notifications are fired upstream (Parent Entry, Staff Checkout)
        before the history record is written
```

---

### 6. Current School Workflow

Pickup History is a **passive record** — it receives data from other modules and surfaces it for review. The school workflow around it is:

1. **Automatic population:** Every checkout through Parent Entry or Staff Checkout writes an entry. Staff do not manually create pickup history records.
2. **Daily review:** Admin opens the screen at end of day, filters by today, and scans for anomalies (Emergency_Authorized = needs review, Unauthorized = requires immediate action).
3. **Reactive lookup:** When a parent calls with a question, this is the first screen staff open.

The Unauthorized status is the most operationally significant. It means someone arrived at the gate, attempted to check out a child, and was blocked because they were not on the authorized list. This is a safeguarding event and should trigger an escalation — though the current system logs it without automatically alerting anyone beyond the parent notification sent at the time.

---

---

## Module 5 — Staff Checkout

### 1. Real-World Scenario

**Scenario A — Known authorized person at the front desk:**
```
15:45  A grandmother arrives at reception
       "I'm here to pick up Kavya Nair"

Staff opens Staff Checkout
→ Types "Kavya" in search
→ Selects Kavya Nair (LKG-A)

Screen shows: PRESENT ✓
Authorized persons for Kavya:
       → Sunita Nair (Mother) — Active
       → Ramesh Nair (Father) — Active
       → Lalitha Nair (Grandmother) — Active ← staff selects this

"Checked Out. Kavya released to Lalitha Nair (Grandmother)"
→ Checkout recorded
→ CHILD_CHECKED_OUT notification sent to parents
```

**Scenario B — Unknown person at the front desk:**
```
15:50  A man arrives: "I'm Priya's uncle, she asked me to pick up Arjun"

Staff opens Staff Checkout
→ Searches Arjun Sharma
→ Status: PRESENT
→ Checks authorized list — uncle is NOT listed

Staff taps "Unknown Person"
→ Rear camera activates
→ Staff photographs the man's face
→ Enters: Name = "Rajan Sharma", Relation = Uncle
→ Taps "Send to Parent for Approval"

On parent's phone:
→ Push notification: "Unknown person requesting to collect Arjun"
→ Parent opens app, sees uncle's photo
→ Taps Approve

Staff screen updates: "Request approved by parent"
→ Child is released
→ Checkout recorded
```

**Scenario C — Child already checked out:**
```
Staff searches for a student
→ Status: CHECKED_OUT
→ Screen shows: "Arjun has already been collected"
→ No further action possible
```

---

### 2. Actor Analysis

**Reception / Front Desk Staff**
Primary user. Manages the physical departure queue at the front desk. Processes most afternoon pickups for families who do not use the parent app at the gate. Handles every case where an unregistered person arrives.

**Teacher**
May use Staff Checkout when releasing a child directly from the classroom (e.g., after an activity) rather than routing through reception.

**Security**
Uses Staff Checkout at the gate if there is no parent app kiosk and parents are not doing self-service check-out.

---

### 3. Operational Value

**Why it exists:** In practice, not every parent uses the self-service gate QR flow. Many parents walk up to the front desk, say their child's name, and expect the child to be brought out. Staff Checkout is the system for processing those departures — it gives staff a tool to verify authorization, photograph unknown persons, and request parent approval in real time without requiring the parent at the gate to use any app.

**Business problem it solves:** The gap between the ideal (every parent uses the gate QR flow) and the reality (many parents just show up). Without Staff Checkout, every informal pickup either bypasses the system entirely or requires the parent to go through the full gate QR flow themselves. Staff Checkout also handles the legally sensitive scenario where someone arrives claiming to be authorized but is not on the list.

**What happens if staff stop using it:**
- All pickups by non-app-using parents become undocumented
- Staff have no system-backed mechanism to verify unknown persons
- Unknown person pickups cannot be sent to parents for real-time approval
- The school reverts to paper-based or memory-based pickup verification

---

### 4. Daily Usage Frequency

**Multiple times per day.** Every afternoon pickup that does not go through the parent gate QR flow goes through Staff Checkout. In a school where parents rarely use the app themselves, this is the primary departure-processing tool and could see 30–60 interactions per day.

---

### 5. Module Relationships

```
Staff Checkout
│
├── ← Pickup Authorization
│       Reads the Active persons list for the selected child
│       Authorized persons can be selected for immediate checkout
│
├── → parentAttendance collection (shared with Parent Entry)
│       Checkout records written here
│       Child status updates to CHECKED_OUT
│
├── → Pickup History
│       Checkout event written to pickup history log
│
├── → pickupRequests collection (unknown person path)
│       Creates a request with photo when person is not on authorized list
│       Parent receives notification with the photo
│
├── → Notifications
│       CHILD_CHECKED_OUT on authorized checkout
│       Pickup request notification to parent on unknown person
│
└── ← Parent App
        Parent approves or rejects the unknown person request
        from their phone, completing the Staff Checkout flow
```

---

### 6. Current School Workflow

Staff Checkout is the **front desk interface** for afternoon departures. The school is intended to operate it alongside — not instead of — Parent Entry. The two modules serve different points of interaction:

- **Parent Entry** = parent-initiated, at the gate, self-service
- **Staff Checkout** = staff-initiated, at reception, for walk-in pickups

The two converge on the same data (both write to `parentAttendance`) and the same child status. The critical difference is the unknown-person flow: only Staff Checkout has a mechanism to photograph, log, and seek parent approval for an unregistered person in real time.

---

---

## Module 6 — QR Management

### 1. Real-World Scenario

**One-time setup (when the school joins Yellow Dot):**
```
Admin opens QR Management
→ No QR exists yet for this center

Admin enters center name: "Yellow Dot — Seawoods"
→ Clicks "Generate School QR"
→ System generates a QR code containing:
       { type: "center", centerId: "ydseawoods", v: 1 }

Admin:
→ Clicks "Download PNG"
→ Prints the QR at A4 or A3 size
→ Laminates it
→ Mounts it at the school gate (or loads it onto the kiosk tablet)

That QR now remains in place permanently
→ Every parent check-in/out scans this same QR
→ System validates: centerId matches the school, isActive = true
```

**Rare event — QR regeneration:**
```
Situation: Old QR was photographed by an unknown person
           or the school rebrands

Admin opens QR Management
→ Clicks "Regenerate"
→ Confirmation modal: "Old QR will stop working immediately"
→ Admin updates center name if needed → confirms

New QR generated
→ Old QR is deactivated (isActive = false)
→ Any parent scanning old QR: step 1 fails, shows error

Admin reprints and replaces the physical QR at the gate
```

---

### 2. Actor Analysis

**Center Admin / Center Owner**
Only person who can generate or regenerate the QR. Does this once at setup. Returns only if the QR is compromised or needs updating.

**Admin Staff (non-admin role)**
Can view and download/print the existing QR but cannot generate or regenerate. This allows front desk staff to reprint the QR if the physical copy is damaged without changing the underlying QR.

**No parent interaction.** Parents scan the QR — they never manage it.

---

### 3. Operational Value

**Why it exists:** Parent Entry requires a gate identifier — a way to know which gate the parent is scanning at. Rather than hard-coding gate locations or requiring parents to type a gate code, the system uses a physical QR that the school prints and displays. QR Management is the tool to generate and maintain that physical access point.

**Business problem it solves:** It creates a controlled, verifiable entry point for the gate check-in flow. Without a valid gate QR, the Parent Entry module cannot start. The QR also functions as a passive access control: only parents physically present at the gate can scan it.

**What happens if staff stop using it:**
- On initial setup: Parent Entry cannot be used at all — Step 1 fails for every parent
- Day-to-day: Nothing — once generated, the QR requires no ongoing maintenance

---

### 4. Daily Usage Frequency

**Rarely.** Once at setup, then only if the QR is damaged, compromised, or the school rebrands. Most schools will generate this QR once and never return to this screen.

---

### 5. Module Relationships

```
QR Management (qrConfigs collection)
│
└── → Parent Entry
        The gate QR generated here is scanned in Step 1
        of every parent check-in and check-out

No relationship to:
        Attendance, Pickup Authorization, Pickup History,
        Staff Checkout, CCTV, Notifications
```

QR Management is a unidirectional upstream dependency. It produces the QR; Parent Entry consumes it. No other module interacts with it.

---

### 6. Current School Workflow

The school is expected to treat this as a one-time infrastructure task, similar to setting up a Wi-Fi password or printing a school notice board. The QR is a physical object — it lives on the wall at the gate — and the software is the tool to produce it.

The operational risk is around physical QR management: if the printed QR is damaged, covered, or removed, Parent Entry stops working for all parents until the QR is reprinted. The school needs a standard procedure for checking the gate QR is visible and undamaged each morning.

---

---

## Module 7 — CCTV

### 1. Real-World Scenario

**Setup phase (admin, once):**
```
IT/Admin opens CCTV → Camera Management tab

For each camera in the building:
→ Clicks "Add Camera"
→ Enters: Camera Name = "Playgroup A", Classroom = Playgroup
→ Enters IP, port, channel, username, password
→ Clicks "Verify" → system tests RTSP connection via ffmpeg
→ Green checkmarks: Reachable ✓, Credentials ✓, Channel ✓, Stream ✓
→ Saves camera

After all cameras added:
→ Opens "Classroom Mapping" tab
→ Confirms every classroom has at least one camera assigned
→ No "Unmapped" cards remaining
```

**Daily staff use (live monitoring):**
```
10:30  Teacher covering lunchtime supervision opens CCTV
→ Live View tab
→ Selects "Nursery B" camera
→ HLS stream loads in 3–5 seconds
→ Monitors children during lunch
→ Closes when done (session ended, audit logged)
```

**Parent live view (if enabled by admin):**
```
Parent opens Yellow Dot parent app during school hours
→ Taps "Live View" for their child
→ System checks:
       ✓ School hours window active (e.g. 08:00–17:00)
       ✓ Child is currently PRESENT (checked in via Parent Entry)
       ✓ Camera exists for child's classroom
→ HLS stream loads — parent sees their child's classroom
→ Session time-limited per school settings
```

**Camera verification (admin, occasional):**
```
New camera installed
Admin opens CCTV → Camera Verification tab
→ Selects camera
→ Runs full verification
→ If "Credentials invalid": admin re-enters password
→ If "Channel invalid": admin checks camera channel number
→ Green across all checks: camera confirmed working
```

---

### 2. Actor Analysis

**Center Admin / IT**
Sets up all cameras initially. Returns to add/edit/remove cameras as the school's camera infrastructure changes. Runs verification when a camera is reported as not working. Manages parent view settings (on/off, school hours window).

**Teacher / Supervisor**
Uses Live View for classroom monitoring. Does not manage camera settings. Classroom-scoped: teachers can only view cameras assigned to their classroom (enforced by the system).

**Parent**
Can access a live view of their child's classroom (if admin has enabled this feature). Access is gated: school hours only, child must be physically checked in, camera must be in the child's classroom. Read-only with no controls.

**Management / Safeguarding Lead**
Reviews audit logs of who accessed live streams and when (logged to Firestore as LIVE_VIEW_STARTED/STOPPED/DENIED events).

---

### 3. Operational Value

**Why it exists:** CCTV gives the school real-time visual oversight of classrooms and common areas, and gives parents a level of transparency they increasingly expect. It also provides a deterrent and evidence trail for safeguarding incidents.

**Business problem it solves:** Two separate problems:
1. **For staff:** Real-time remote monitoring of classrooms without requiring physical presence in every room.
2. **For parents:** Transparency and reassurance — parents can see what their child's environment looks like without disrupting the school day.

**What happens if staff stop using it:**
- Camera management: cameras remain configured but no one verifies they are still working
- Live view: staff lose remote monitoring capability — no operational impact unless active monitoring is part of the safety protocol
- Parent view: parents lose the transparency feature — relationship and trust impact, not safety impact

---

### 4. Daily Usage Frequency

**Daily (staff live view)** — if staff use it for monitoring, it is a regular tool during supervision shifts.
**Weekly or less (admin camera management)** — only when a camera has a problem or a new one is added.
**Multiple times per day (parents)** — parents who have the feature enabled may check it during the school day, particularly in the first weeks of enrollment.

---

### 5. Module Relationships

```
CCTV
│
├── ← Parent Entry (parentAttendance)
│       Parent live-view token issuance checks whether
│       the child is currently PRESENT
│       Source: parentAttendance collection (same as child status)
│
├── ← Student records
│       Child's enrolled classroom resolved from student record
│       Parent can only view camera assigned to that classroom
│
├── → Audit logs
│       LIVE_VIEW_STARTED, LIVE_VIEW_STOPPED, LIVE_VIEW_DENIED
│       Logged for every session (staff and parent)
│
└── External dependency: MediaMTX media server
        RTSP → HLS transcoding runs on MediaMTX
        If MediaMTX is offline, live view fails for all users
        Camera management (add/edit/verify) works without it
```

**Relationship with Notifications:** None. CCTV does not send notifications.
**Relationship with Attendance:** None. Attendance status does not gate CCTV access.
**Relationship with Pickup:** None directly. Child status for CCTV parent-view comes from `parentAttendance`, not from Pickup modules.

---

### 6. Current School Workflow

CCTV operates in two distinct phases:

**Phase 1 — Setup:** Admin adds all cameras, assigns them to classrooms, and verifies each one is reachable and streaming. This is a one-time task that may take a few hours depending on the number of cameras.

**Phase 2 — Ongoing use:** Cameras stream continuously (via MediaMTX). Staff access live view on demand. Parents access live view if the feature is enabled. No daily admin action required unless a camera goes offline.

The parent live-view feature is the more operationally complex piece: it requires a live child-status check (is the child checked in?), school-hours enforcement, and classroom-scoped camera matching. This access is logged every time a parent views or attempts to view a stream.

---

---

## Overall: How Yellow Dot Is Intended to Operate on a School Day

This section describes the complete intended operational flow across all modules from the perspective of a normal school day.

---

### Morning (07:45 — 09:00)

```
ADMIN PREP
07:45  Admin confirms gate QR is visible and undamaged at entrance
       [QR Management — one-time setup, checked daily informally]

PARENT DROP-OFF WAVE
08:00  Parents begin arriving

       For each parent:
       Parent opens Yellow Dot app / approaches kiosk
       → Scans gate QR           [QR Management feeds this]
       → Enters name + relation  [Parent Entry — Step 2]
       → Takes face selfie       [Parent Entry — Step 3]
       → Taps Check In
       → Record saved: selfie + gate + child + timestamp
       → CHILD_CHECKED_IN notification sent to other parent

CLASSROOM ROLL CALL (runs in parallel with drop-off)
08:05  Teacher opens Attendance on classroom tablet
       → Marks each child Present / Absent / Late as they arrive
         (manual) or scans QR badges (QR scanner)
       → Summary bar updates: "15 Present, 2 Absent"
       → ATTENDANCE_MARKED notifications sent to parents of absent children

09:00  Morning session begins
       Both Attendance and Parent Entry records are now populated
       for all children who arrived
```

---

### Midday (09:00 — 15:00)

```
MONITORING
       Staff optionally open CCTV > Live View for classroom monitoring
       Parents optionally open parent app > Live View
       (Both gated: child must be PRESENT per parentAttendance)

EXCEPTIONAL EVENTS (handled as they occur)
       If a parent needs to collect their child early:
       → Parent uses gate QR + Check Out flow  [Parent Entry]
         OR
       → Parent comes to reception, staff uses Staff Checkout

       If an authorized person (not parent) collects early:
       → Staff opens Staff Checkout
       → Selects child, selects authorized person from list
       → Checkout recorded

       If an UNREGISTERED person arrives:
       → Staff photographs them  [Staff Checkout — unknown person path]
       → Sends to parent for approval
       → Parent approves or rejects from their phone
       → Child released or held accordingly
```

---

### Afternoon Pickup (15:30 — 16:30)

```
BULK PICKUP WAVE

For each child being collected:

Path A — Parent uses gate QR (self-service):
       Parent arrives at gate
       → Scans gate QR
       → Takes selfie
       → Taps Check Out
       → Selects themselves from authorized list
       → Pickup history record created
       → CHILD_CHECKED_OUT notification sent

Path B — Parent at front desk (staff-assisted):
       Parent or guardian arrives at reception
       → Staff opens Staff Checkout
       → Searches child, selects from authorized persons list
       → Immediate checkout if authorized
       → Unknown person path if not on list

BOTH paths write to parentAttendance
BOTH paths write to pickupHistory
BOTH paths fire CHILD_CHECKED_OUT notification

END-OF-DAY CHECKS (16:30 — 17:00)
       Teacher checks Attendance — Inside count must = 0
       Admin opens Pickup History — reviews today's entries
       → Authorized entries: routine confirmation
       → Emergency_Authorized: verify with teacher, document reason
       → Unauthorized entries: immediate escalation
```

---

### Intended Module Roles at a Glance

| Module | When used | By whom | Purpose on a school day |
|--------|-----------|---------|------------------------|
| Attendance | Morning + end of session | Teacher | Roll call; Inside count |
| Parent Entry | Drop-off + pickup | Parent (self-service) | Gate check-in/out; selfie audit trail |
| Pickup Authorization | Setup + as needed | Admin/Reception | Who is allowed to collect each child |
| Pickup History | End of day + on demand | Admin | Review all pickups; investigate anomalies |
| Staff Checkout | Throughout afternoon | Reception/Teacher | Front desk pickup processing |
| QR Management | One-time setup | Admin | Generate gate QR printed at entrance |
| CCTV | Ongoing | Staff + Parents | Real-time classroom monitoring |

---

### The Two Parallel Systems

Yellow Dot operates two parallel check-in/out systems that serve different actors at different points in the building:

**System 1 — Classroom (Attendance)**
Teacher-managed. Records who is in the classroom. The Inside count is the safety mechanism: at end of day, zero children should remain.

**System 2 — Gate (Parent Entry + Staff Checkout)**
Gate/reception-managed. Records who physically crossed the school boundary. Drives the selfie audit trail, pickup verification, and parent notifications.

These two systems are intentionally separate because they answer different questions:
- Attendance answers: "Is Arjun in my classroom right now?"
- Parent Entry answers: "Did anyone bring Arjun in through the gate this morning?"

A child can be marked Present in Attendance (teacher took roll) and NOT_ARRIVED in the gate system (parent dropped them off informally without scanning). Both records are valid but incomplete. The school's operational discipline in ensuring both systems are used consistently is what makes the full picture accurate.
