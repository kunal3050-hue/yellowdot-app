/**
 * seedEmulator.js — deterministic demo tenant for the Firebase Emulator Suite
 * ─────────────────────────────────────────────────────────────────────
 * Usage:  npm run seed:emulator        (from yellowdot-backend)
 *         npm run dev:local            (from the repo root — starts + seeds)
 *
 * ⛔ REFUSES TO RUN outside the emulator. assertEmulatorOnly() is the first
 * statement executed, before firebase-admin is even required, so there is no
 * code path in which this file can touch production.
 *
 * ── Deterministic ─────────────────────────────────────────────────────────
 * Every document id is fixed and every value derives from a seeded PRNG, so
 * two runs produce byte-identical data. Re-running is idempotent (documents
 * are overwritten by id, never appended), which means integration results are
 * comparable across runs and a failure is reproducible.
 *
 * Dates are anchored to TODAY so the Dashboard and Care surfaces have live
 * data every day without reseeding: attendance is for today, invoices are
 * overdue relative to today, and one child always has a birthday today.
 */

const { assertEmulatorOnly } = require("../platform/devEnv/emulatorGuard");

// Interlock BEFORE anything else — including the Admin SDK import.
const guard = assertEmulatorOnly("seedEmulator.js");

const { db, auth } = require("../firebaseAdmin");

const SCHOOL_ID = process.env.SCHOOL_ID || "demo-school";
const TENANT_ID = SCHOOL_ID;
const CENTER_ID = "demo-centre-north";

// ── Deterministic PRNG (mulberry32) ──────────────────────────────────────────
let _seed = 0x5eed;
function rnd() {
  _seed |= 0; _seed = (_seed + 0x6D2B79F5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = arr => arr[Math.floor(rnd() * arr.length)];

// ── Date helpers ─────────────────────────────────────────────────────────────
const TODAY = new Date();
const iso = d => d.toISOString().slice(0, 10);
const TODAY_ISO = iso(TODAY);
function daysAgo(n) { const d = new Date(TODAY); d.setDate(d.getDate() - n); return d; }
function atTime(h, m = 0) { const d = new Date(TODAY); d.setHours(h, m, 0, 0); return d.toISOString(); }
/** dd/mm/yyyy — the format the app's DOB parser expects. */
const ddmmyyyy = d => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

// ── Demo users — one per supported role ──────────────────────────────────────
// Emulator-only fixtures. The password is intentionally well-known and appears
// in the console banner; it authenticates nothing outside this local emulator.
const DEMO_PASSWORD = "demo1234";

const DEMO_USERS = [
  { uid: "demo-super",      email: "super@demo.local",      name: "Sana Platform",  role: "super_admin"  },
  { uid: "demo-owner",      email: "owner@demo.local",      name: "Omar Owner",     role: "center_owner" },
  { uid: "demo-principal",  email: "principal@demo.local",  name: "Priya Principal",role: "admin"        },
  { uid: "demo-centeradmin",email: "centeradmin@demo.local",name: "Chandra Admin",  role: "center_admin" },
  { uid: "demo-teacher",    email: "teacher@demo.local",    name: "Tara Teacher",   role: "teacher"      },
  { uid: "demo-reception",  email: "reception@demo.local",  name: "Rhea Reception", role: "reception"    },
  { uid: "demo-accountant", email: "accountant@demo.local", name: "Anil Accounts",  role: "accountant"   },
  { uid: "demo-parent",     email: "parent@demo.local",     name: "Meera Parent",   role: "parent"       },
];

const CLASSES = [
  { id: "cls-butterfly", name: "Butterfly Room", batch: "Morning" },
  { id: "cls-sunflower", name: "Sunflower Room", batch: "Morning" },
  { id: "cls-rainbow",   name: "Rainbow Room",   batch: "Afternoon" },
];

const FIRST = ["Aarav","Diya","Vihaan","Anaya","Kabir","Myra","Reyansh","Saira","Advik","Kiara",
               "Ishaan","Aadhya","Arjun","Navya","Rudra","Prisha","Vivaan","Anvi"];
const LAST  = ["Sharma","Patel","Iyer","Nair","Reddy","Kapoor","Menon","Bose"];

// ─────────────────────────────────────────────────────────────────────────────

async function wipe(collections) {
  for (const name of collections) {
    const snap = await db.collection(name).get();
    if (snap.empty) continue;
    // Batched deletes, 400 at a time — emulator has no quota but batches cap at 500.
    let batch = db.batch(); let n = 0;
    for (const doc of snap.docs) {
      batch.delete(doc.ref); n++;
      if (n % 400 === 0) { await batch.commit(); batch = db.batch(); }
    }
    await batch.commit();
  }
}

async function seedAuthUsers() {
  for (const u of DEMO_USERS) {
    try { await auth.deleteUser(u.uid); } catch { /* not present */ }
    await auth.createUser({
      uid: u.uid, email: u.email, password: DEMO_PASSWORD,
      displayName: u.name, emailVerified: true,
    });
  }
  return DEMO_USERS.length;
}

async function seedUsersAndStaff() {
  const batch = db.batch();
  for (const u of DEMO_USERS) {
    // authMiddleware resolves the profile from users/{uid}
    batch.set(db.collection("users").doc(u.uid), {
      userId: u.uid, email: u.email, name: u.name, role: u.role,
      schoolId: SCHOOL_ID, centerId: CENTER_ID, centers: [CENTER_ID],
      active: true, createdAt: new Date().toISOString(),
    });
    if (u.role !== "parent") {
      batch.set(db.collection("staff").doc(u.uid), {
        staffId: u.uid, userId: u.uid, name: u.name, email: u.email, role: u.role,
        schoolId: SCHOOL_ID, centerId: CENTER_ID,
        departmentId: u.role === "accountant" ? "dept-finance" : "dept-academic",
        // The principal manages everyone — gives `team` scope something real to
        // resolve once HR endpoints become scope-aware (§2c.1).
        reportingManagerId: u.uid === "demo-principal" ? null : "demo-principal",
        active: true,
      });
    }
  }
  await batch.commit();
  return DEMO_USERS.length;
}

/**
 * Role documents — INCLUDING center_owner.
 *
 * D1 in INTEGRATION_VALIDATION.md: production seeds no center_owner role doc,
 * so that role's capability matrix is empty and the new surfaces render blank.
 * The emulator seeds it so the role can actually be validated. This is FIXTURE
 * data — it does not change production, where the fix is still pending review.
 */
async function seedRoles() {
  const full = (...mods) => Object.fromEntries(mods.map(m => [m, {
    view: true, create: true, edit: true, delete: true,
    export: true, approve: true, manage: true, mark: true, upload: true,
  }]));
  const viewOnly = (...mods) => Object.fromEntries(mods.map(m => [m, { view: true }]));

  const ROLES = {
    admin: {
      name: "Principal",
      permissions: {
        ...full("students", "attendance", "fees", "invoices", "payments", "analytics",
                "staff", "settings", "roles_permissions", "notifications",
                "incidents", "care_hygiene", "observations", "nap_tracking",
                "food_menu", "pickup_auth", "classes_batches", "staff_management"),
      },
    },
    center_owner: {
      name: "Centre Owner",
      permissions: {
        ...full("students", "attendance", "fees", "invoices", "payments", "analytics",
                "staff", "settings", "notifications", "incidents", "care_hygiene",
                "observations", "nap_tracking", "food_menu", "pickup_auth",
                "classes_batches", "staff_management"),
      },
    },
    center_admin: {
      name: "Centre Admin",
      permissions: {
        ...full("students", "attendance", "fees", "invoices", "analytics",
                "incidents", "care_hygiene", "observations", "pickup_auth", "food_menu"),
      },
    },
    teacher: {
      name: "Teacher",
      permissions: {
        ...viewOnly("students", "classes_batches"),
        attendance:   { view: true, mark: true, edit: true },
        care_hygiene: { view: true, mark: true, edit: true },
        observations: { view: true, create: true, edit: true },
        nap_tracking: { view: true, mark: true },
        food_menu:    { view: true, mark: true },
        incidents:    { view: true, create: true },
        pickup_auth:  { view: true },
        // Self-service HR at `self` scope — exercises the §2c.1 ladder.
        staff_management: { view: "self" },
      },
    },
    reception: {
      name: "Reception",
      permissions: {
        ...viewOnly("students"),
        attendance:  { view: true, mark: true },
        pickup_auth: { view: true, create: true, edit: true, approve: true },
        incidents:   { view: true },
        notifications: { view: true, create: true },
      },
    },
    accountant: {
      name: "Accountant",
      permissions: {
        ...viewOnly("students"),
        ...full("fees", "invoices", "payments", "receipts", "analytics"),
        finance: { view: true },
      },
    },
  };

  const batch = db.batch();
  for (const [roleId, def] of Object.entries(ROLES)) {
    batch.set(db.collection("roles").doc(roleId), {
      roleId, name: def.name, schoolId: SCHOOL_ID, isSystem: true,
      permissions: def.permissions, updatedAt: new Date().toISOString(),
    });
  }
  await batch.commit();
  return Object.keys(ROLES).length;
}

async function seedTenant() {
  await db.collection("tenants").doc(TENANT_ID).set({
    tenantId: TENANT_ID,
    schoolName: "KUE BOXS Demo Preschool",
    slug: "demo",
    status: "active",
    subscriptionPlan: "premium",
    // Three-layer flags (§2c.2): tenant overrides on top of platform defaults.
    features: { DAILY_CARE: true, CHILD_JOURNEY: true, LIVE_DASHBOARD: true, FINANCE_FOUNDATION: true },
    branches: [{ branchId: CENTER_ID, name: "North Centre", centerId: CENTER_ID }],
    createdAt: new Date().toISOString(),
  });
  await db.collection("settings").doc(SCHOOL_ID).set({
    schoolId: SCHOOL_ID, schoolName: "KUE BOXS Demo Preschool",
    schoolEndTime: atTime(17, 0),
  }, { merge: true });
  return 1;
}

async function seedClasses() {
  const batch = db.batch();
  for (const c of CLASSES) {
    batch.set(db.collection("classes").doc(c.id), {
      classId: c.id, name: c.name, batch: c.batch, schoolId: SCHOOL_ID, centerId: CENTER_ID,
    });
  }
  await batch.commit();
  return CLASSES.length;
}

function buildStudents() {
  const students = [];
  for (let i = 0; i < 18; i++) {
    const cls = CLASSES[i % CLASSES.length];
    // Student 0 always has a birthday TODAY so the birthdays widget is never
    // empty; the rest are spread across the year deterministically.
    const dob = i === 0
      ? new Date(TODAY.getFullYear() - 4, TODAY.getMonth(), TODAY.getDate())
      : new Date(TODAY.getFullYear() - 3 - (i % 3), (TODAY.getMonth() + i) % 12, ((i * 7) % 27) + 1);
    students.push({
      id: `stu-${String(i + 1).padStart(3, "0")}`,
      // CANONICAL Firestore field names. studentService reads `studentName`
      // and `dob` (lowercase) and PROJECTS them to Student_Name / DOB in the
      // API response — writing `name`/`DOB` here produced records the API
      // returned with empty names and no birthdays. Caught by the first
      // emulator integration run.
      studentName: `${FIRST[i]} ${LAST[i % LAST.length]}`,
      dob: ddmmyyyy(dob),
      // Kept for any consumer reading the document directly rather than the API.
      name: `${FIRST[i]} ${LAST[i % LAST.length]}`,
      class: cls.name, classId: cls.id, batch: cls.batch,
      schoolId: SCHOOL_ID, centerId: CENTER_ID,
      admissionDate: iso(daysAgo(200 + i)),
      active: true,
    });
  }
  return students;
}

async function seedStudents(students) {
  const batch = db.batch();
  for (const s of students) batch.set(db.collection("students").doc(s.id), s);
  await batch.commit();
  return students.length;
}

/**
 * Attendance for TODAY — deliberately INCOMPLETE.
 *
 * 12 of 18 children are marked (10 present, 2 absent), leaving 6 unmarked so
 * the `attendance-pending` task provider always has something to report and
 * the attendance widget shows a realistic partial figure.
 */
async function seedAttendance(students) {
  const batch = db.batch();
  let present = 0, absent = 0;
  students.slice(0, 12).forEach((s, i) => {
    const isAbsent = i === 3 || i === 9;
    if (isAbsent) absent++; else present++;
    const id = `ATT-${TODAY_ISO}-${s.id}`;
    batch.set(db.collection("attendance").doc(id), {
      entryId: id, date: TODAY_ISO, studentId: s.id, studentName: s.name,
      class: s.class, status: isAbsent ? "Absent" : "Present",
      checkIn: isAbsent ? null : atTime(8, 30 + (i % 20)),
      checkOut: null, method: i % 4 === 0 ? "QR" : "Manual",
      schoolId: SCHOOL_ID, centerId: CENTER_ID, createdAt: atTime(8, 45),
    });
  });
  await batch.commit();
  return { marked: 12, present, absent, unmarked: students.length - 12 };
}

/** Two pending pickup requests → pickup widget + task provider both populate. */
async function seedPickupRequests(students) {
  const batch = db.batch();
  const rows = [
    { id: "pr-001", student: students[1], by: "Mother",      mins: 25 },
    { id: "pr-002", student: students[5], by: "Grandfather", mins: 8  },
    { id: "pr-003", student: students[2], by: "Father",      mins: 90, status: "approved" },
  ];
  for (const r of rows) {
    batch.set(db.collection("pickupRequests").doc(r.id), {
      id: r.id, requestId: r.id,
      studentId: r.student.id, studentName: r.student.name,
      requestedBy: r.by, status: r.status || "pending",
      schoolEndTime: atTime(17, 0),
      schoolId: SCHOOL_ID, centerId: CENTER_ID,
      createdAt: new Date(Date.now() - r.mins * 60000).toISOString(),
    });
  }
  await batch.commit();
  return rows.filter(r => !r.status).length;
}

/** One open + one under review + one resolved → exercises all three statuses. */
async function seedIncidents(students) {
  const batch = db.batch();
  const rows = [
    { id: "inc-001", student: students[4],  type: "Minor fall",     severity: "low",  status: "open",         mins: 55 },
    { id: "inc-002", student: students[11], type: "Allergic rash",  severity: "high", status: "under_review", mins: 200 },
    { id: "inc-003", student: students[7],  type: "Bumped head",    severity: "low",  status: "resolved",     mins: 1500 },
  ];
  for (const r of rows) {
    batch.set(db.collection("incidentReports").doc(r.id), {
      id: r.id, incidentId: r.id,
      studentId: r.student.id, studentName: r.student.name,
      type: r.type, category: r.type, severity: r.severity, status: r.status,
      description: `${r.type} reported by staff during the session.`,
      schoolId: SCHOOL_ID, centerId: CENTER_ID,
      reportedAt: new Date(Date.now() - r.mins * 60000).toISOString(),
      createdAt: new Date(Date.now() - r.mins * 60000).toISOString(),
    });
  }
  await batch.commit();
  return rows.filter(r => r.status !== "resolved").length;
}

/** Mixed invoice states, including 3 Overdue → finance widget + task populate. */
async function seedInvoices(students) {
  const batch = db.batch();
  let overdue = 0, outstanding = 0;
  students.slice(0, 14).forEach((s, i) => {
    const status = i < 3 ? "Overdue" : i < 6 ? "Pending" : i < 8 ? "Partial" : "Paid";
    const amount = 8000 + (i % 5) * 1500;
    const balance = status === "Paid" ? 0 : status === "Partial" ? Math.round(amount / 2) : amount;
    if (status === "Overdue") overdue++;
    outstanding += balance;
    const id = `INV-${String(i + 1).padStart(4, "0")}`;
    batch.set(db.collection("invoices").doc(id), {
      invoiceNumber: id, invoiceId: id,
      studentId: s.id, studentName: s.name,
      amount, paidAmount: amount - balance, balance, status,
      dueDate: iso(daysAgo(status === "Overdue" ? 12 + i : -10)),
      schoolId: SCHOOL_ID, centerId: CENTER_ID,
      createdAt: iso(daysAgo(30)),
    });
  });
  await batch.commit();
  return { overdue, outstanding };
}

/** Daily Care: hygiene logs, meals and naps for today. */
async function seedDailyCare(students) {
  const batch = db.batch();
  const careTypes = ["Diaper Change", "Water Refilled", "Handwash", "Nappy Change"];
  students.slice(0, 10).forEach((s, i) => {
    batch.set(db.collection("careLogs").doc(`care-${s.id}-1`), {
      id: `care-${s.id}-1`, studentId: s.id, studentName: s.name,
      type: pick(careTypes), notes: "", date: TODAY_ISO,
      schoolId: SCHOOL_ID, centerId: CENTER_ID, createdAt: atTime(10, i),
    });
    batch.set(db.collection("foodConsumption").doc(`food-${s.id}-lunch`), {
      id: `food-${s.id}-lunch`, studentId: s.id, studentName: s.name,
      meal: "Lunch", amount: pick(["All", "Most", "Some"]), date: TODAY_ISO,
      schoolId: SCHOOL_ID, centerId: CENTER_ID, createdAt: atTime(12, 30),
    });
    if (i < 6) {
      batch.set(db.collection("napLogs").doc(`nap-${s.id}`), {
        id: `nap-${s.id}`, studentId: s.id, studentName: s.name, date: TODAY_ISO,
        startTime: atTime(13, 0), endTime: atTime(14, 15),
        schoolId: SCHOOL_ID, centerId: CENTER_ID,
      });
    }
  });
  await batch.commit();
  return 10;
}

/**
 * CRM enquiries.
 *
 * NOTE: the CRM module does not exist yet (confirmed in the Backend Capability
 * Audit — greenfield). This seeds the shape an admissions pipeline would use so
 * the data is ready when the module is built. Nothing reads it today, and no
 * widget or task provider depends on it.
 */
async function seedCrmEnquiries() {
  const batch = db.batch();
  const stages = ["new", "contacted", "tour_scheduled", "follow_up"];
  for (let i = 0; i < 6; i++) {
    const id = `enq-${String(i + 1).padStart(3, "0")}`;
    batch.set(db.collection("enquiries").doc(id), {
      enquiryId: id,
      childName: `${FIRST[(i + 9) % FIRST.length]} ${LAST[(i + 2) % LAST.length]}`,
      parentName: `Parent of ${FIRST[(i + 9) % FIRST.length]}`,
      phone: `+9198${String(10000000 + i * 137).slice(0, 8)}`,
      stage: stages[i % stages.length],
      followUpAt: iso(daysAgo(-(i % 4))),
      schoolId: SCHOOL_ID, centerId: CENTER_ID, createdAt: iso(daysAgo(i + 1)),
    });
  }
  await batch.commit();
  return 6;
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🌱 Seeding demo tenant into the EMULATOR`);
  console.log(`   project : ${guard.projectId}`);
  console.log(`   firestore: ${guard.firestoreHost}   auth: ${guard.authHost}`);
  console.log(`   schoolId: ${SCHOOL_ID}\n`);

  await wipe([
    "students", "attendance", "pickupRequests", "incidentReports", "invoices",
    "careLogs", "foodConsumption", "napLogs", "enquiries", "roles", "users",
    "staff", "classes", "tenants",
  ]);

  const students = buildStudents();

  const counts = {
    authUsers: await seedAuthUsers(),
    profiles:  await seedUsersAndStaff(),
    roles:     await seedRoles(),
    tenant:    await seedTenant(),
    classes:   await seedClasses(),
    students:  await seedStudents(students),
    attendance: await seedAttendance(students),
    pickups:   await seedPickupRequests(students),
    incidents: await seedIncidents(students),
    invoices:  await seedInvoices(students),
    dailyCare: await seedDailyCare(students),
    enquiries: await seedCrmEnquiries(),
  };

  console.log("✅ Seed complete\n");
  console.log(`   students        ${counts.students}`);
  console.log(`   attendance      ${counts.attendance.marked} marked ` +
              `(${counts.attendance.present} present, ${counts.attendance.absent} absent), ` +
              `${counts.attendance.unmarked} UNMARKED → attendance task fires`);
  console.log(`   pickups         ${counts.pickups} pending → pickup widget + task fire`);
  console.log(`   incidents       ${counts.incidents} unresolved → incident widget + task fire`);
  console.log(`   invoices        ${counts.invoices.overdue} overdue, ` +
              `₹${counts.invoices.outstanding.toLocaleString("en-IN")} outstanding → finance widget + task fire`);
  console.log(`   daily care      ${counts.dailyCare} children logged`);
  console.log(`   CRM enquiries   ${counts.enquiries} (no module consumes these yet)`);
  console.log(`   roles           ${counts.roles} (includes center_owner — absent in production, see D1)`);

  console.log(`\n👥 Demo logins — password for ALL: ${DEMO_PASSWORD}`);
  for (const u of DEMO_USERS) console.log(`   ${u.role.padEnd(13)} ${u.email}`);
  console.log("\n   These exist only inside the local Auth emulator.\n");
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error("\n❌ Seed failed:\n", err); process.exit(1); });
