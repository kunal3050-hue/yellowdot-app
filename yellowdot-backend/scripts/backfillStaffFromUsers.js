/**
 * backfillStaffFromUsers.js — give every login account an employee record
 * ─────────────────────────────────────────────────────────────────────────
 * Usage:
 *   node scripts/backfillStaffFromUsers.js            # dry run (default)
 *   node scripts/backfillStaffFromUsers.js --confirm  # apply
 *
 * Why this exists
 * ───────────────
 * The app has two people-shaped screens — "Login Users" (/user-management,
 * backed by `users`) and "Employees" (/staff/employees, backed by `staff`) —
 * and they look like duplicate modules. They are not. `users` is the login
 * and RBAC record that authMiddleware resolves on every request; `staff` is
 * the HR record that Departments, Designations, Attendance, Shifts, Leave,
 * Payroll and Performance all hang off.
 *
 * The decision is that Employees is the single list people manage, with login
 * as an attribute of an employee. The plumbing for that already exists:
 * staff carries linkedUserId / loginStatus / invitedAt, and
 * POST /api/staff/:id/invite creates the Firebase user and the users/{uid}
 * document from an employee record.
 *
 * What was missing is the data. `staff` was never populated, so Employees
 * reads 0 while real people exist only as login accounts. This script closes
 * that gap in the one direction that is safe to automate: it creates an
 * employee record for each existing login account and links the two.
 *
 * What it does NOT do
 * ───────────────────
 *   • It never creates, modifies or deletes a Firebase Auth user, and never
 *     writes to `users`. Logins are untouched — the worst case is an unwanted
 *     `staff` document, which is soft-deletable from the UI.
 *   • It does not retire /user-management. Removing that page before this
 *     backfill has run and been eyeballed would leave no way to administer
 *     the accounts at all.
 *
 * Safety
 * ──────
 *   • Dry run unless --confirm, matching encryptCameraPasswords.js.
 *   • Idempotent: a user that already has a staff record (matched on
 *     linkedUserId, then email) is skipped, so re-running is harmless.
 *   • Creates through staffService.create(), so the same validation and
 *     _assertNoDuplicate rules apply as a human using the UI. Two login
 *     accounts sharing an email will surface here as a reported conflict
 *     rather than silently producing two employees.
 *   • Parents are skipped — they are not staff and have no HR record.
 */

const { db } = require("../firebaseAdmin");
const staffSvc = require("../services/staffService");

const CONFIRM   = process.argv.includes("--confirm");
const SCHOOL_ID = process.env.SCHOOL_ID || "yd-main";

// staffService.create() requires firstName AND lastName. Several login
// accounts hold a single-word name ("Kunal", "Pratiksha"), which gives
// nothing to split. Rather than invent a surname, those are reported as
// needing a human by default; this flag fills in a placeholder that is
// obviously a placeholder, for when you would rather fix it in the HR screen
// afterwards than in Login Users first.
const PLACEHOLDER_SURNAME = process.argv.includes("--surname-placeholder");
const SURNAME_PLACEHOLDER = "(surname not set)";

/** "Kunal Gudhka" → { firstName: "Kunal", lastName: "Gudhka" }. */
function splitName(full) {
  const parts = String(full || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

// Roles that are not employees of the school.
const NON_STAFF_ROLES = new Set(["parent", "unknown"]);

function line() { console.log("─".repeat(72)); }

async function run() {
  line();
  console.log("Backfill staff from users");
  console.log("  Mode     :", CONFIRM ? "APPLY" : "DRY RUN");
  console.log("  schoolId :", SCHOOL_ID);
  line();

  const usersSnap = await db.collection("users").get();
  if (usersSnap.empty) {
    console.log("No users found — nothing to do.");
    return;
  }

  // Existing staff, indexed both ways so the skip check is one pass.
  const staffSnap = await db.collection("staff").get();
  const byLinkedUserId = new Map();
  const byEmail        = new Map();
  staffSnap.forEach(d => {
    const s = d.data();
    if (s.linkedUserId) byLinkedUserId.set(s.linkedUserId, d.id);
    if (s.email)        byEmail.set(String(s.email).toLowerCase(), d.id);
  });

  // Catch two login accounts sharing one email before writing anything. The
  // auth email fallback resolves these with limit(1), so a collision already
  // makes that person's profile resolution arbitrary; it must be fixed by a
  // human, not guessed at here.
  const emailCounts = new Map();
  usersSnap.forEach(d => {
    const e = String(d.data().email || "").toLowerCase();
    if (e) emailCounts.set(e, (emailCounts.get(e) || 0) + 1);
  });
  const collisions = [...emailCounts.entries()].filter(([, n]) => n > 1);

  const created = [], skipped = [], failed = [], conflicted = [];

  for (const doc of usersSnap.docs) {
    const u     = doc.data();
    const uid   = doc.id;
    const email = String(u.email || "").toLowerCase();
    const label = `${u.name || "(no name)"} <${email || "no email"}>`;

    if (NON_STAFF_ROLES.has(String(u.role || "").toLowerCase())) {
      skipped.push(`${label} — role "${u.role}" is not staff`);
      continue;
    }
    if (byLinkedUserId.has(uid)) {
      skipped.push(`${label} — already linked to staff ${byLinkedUserId.get(uid)}`);
      continue;
    }
    if (email && byEmail.has(email)) {
      skipped.push(`${label} — a staff record already uses this email (${byEmail.get(email)})`);
      continue;
    }
    if (email && emailCounts.get(email) > 1) {
      conflicted.push(`${label} — ${emailCounts.get(email)} login accounts share this email; resolve before backfilling`);
      continue;
    }

    // An HR record needs a real surname, and guessing one would be worse
    // than saying so. displayName keeps the original single-word name either
    // way, so the directory still reads correctly.
    let { firstName, lastName } = splitName(u.name);
    if (!firstName) {
      conflicted.push(`${label} — no name on the login account; set one before backfilling`);
      continue;
    }
    if (!lastName) {
      if (!PLACEHOLDER_SURNAME) {
        conflicted.push(`${label} — single-word name, no surname to split. Add one, or re-run with --surname-placeholder`);
        continue;
      }
      lastName = SURNAME_PLACEHOLDER;
    }

    if (!CONFIRM) {
      created.push(`${label} — would create employee "${firstName} / ${lastName}", role "${u.role}", linked to ${uid}`);
      continue;
    }

    try {
      const staff = await staffSvc.create({
        firstName,
        lastName,
        displayName: u.name || email || uid,
        email,
        mobile:      u.mobile || u.phone || "",
        role:        u.role || "",
        centerId:    u.centerId || u.center || "",
        photoUrl:    u.photoUrl || "",
        employmentStatus: u.status === "inactive" ? "inactive" : "active",
      }, { schoolId: u.schoolId || SCHOOL_ID, actorUserId: "backfill-script" });

      // Link it to the login account it came from. "active" rather than
      // "invitation_sent": these people already sign in today, so no invite
      // is owed and marking one sent would be untrue.
      await staffSvc.setLoginLink(staff.staffId, {
        linkedUserId: uid,
        loginStatus:  u.status === "inactive" ? "disabled" : "active",
        email,
        actorUserId:  "backfill-script",
      });

      // Keep the in-memory index current so a duplicate inside this same run
      // is caught by the checks above rather than created twice.
      byLinkedUserId.set(uid, staff.staffId);
      if (email) byEmail.set(email, staff.staffId);

      created.push(`${label} — staff ${staff.staffId}, linked`);
    } catch (err) {
      failed.push(`${label} — ${err.message}`);
    }
  }

  const report = (title, rows) => {
    if (!rows.length) return;
    console.log(`\n${title} (${rows.length})`);
    rows.forEach(r => console.log("  •", r));
  };

  report(CONFIRM ? "CREATED" : "WOULD CREATE", created);
  report("SKIPPED", skipped);
  report("NEEDS A HUMAN — not backfilled", conflicted);
  report("FAILED", failed);

  line();
  console.log(`users scanned: ${usersSnap.size} | existing staff: ${staffSnap.size}`);
  if (collisions.length) {
    console.log(`\n⚠  ${collisions.length} email(s) are used by more than one login account:`);
    collisions.forEach(([e, n]) => console.log(`     ${e} × ${n}`));
    console.log("   authMiddleware's email fallback resolves these with limit(1),");
    console.log("   so which profile wins is arbitrary. Worth fixing regardless of this script.");
  }
  if (!CONFIRM) {
    console.log("\nDRY RUN — nothing written. Re-run with --confirm to apply.");
  }
  if (failed.length) process.exitCode = 1;
}

run()
  .then(() => process.exit(process.exitCode || 0))
  .catch(err => { console.error("\nFATAL:", err); process.exit(1); });
