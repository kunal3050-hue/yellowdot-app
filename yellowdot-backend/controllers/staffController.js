/**
 * staffController.js — HTTP handlers for the Staff Management module
 * ────────────────────────────────────────────────────────────────────
 * Thin wrappers around staffService — extracted so routes stay declarative.
 *
 * Every handler is shaped like (req, res) and assumes:
 *   • authenticate middleware ran first → req.user is populated
 *   • staffOnly + authorizeRoute ran → role-level access already enforced
 *
 * Tenant context (schoolId, tenantId, centerId, actorUserId) is read from req.user.
 */

const staffSvc    = require("../services/staffService");
const timelineSvc = require("../services/employeeTimelineService");
const { auth, db } = require("../firebaseAdmin");

function _ctx(req) {
  return {
    schoolId:    req.user?.schoolId || process.env.SCHOOL_ID || "yd-main",
    tenantId:    req.user?.schoolId || process.env.SCHOOL_ID || "yd-main", // tenantId === schoolId
    centerId:    req.query?.centerId || req.user?.centerId || "",
    actorUserId: req.user?.userId   || "system",
  };
}

function _err(res, route, err) {
  let code = 500;
  if (err.code === "VALIDATION") code = 400;
  if (err.code === "DUPLICATE")  code = 409;
  console.error(`[${route}]`, err.message);
  res.status(code).json({ success: false, error: err.message || "Server error.", field: err.field });
}

// ── List + counts ─────────────────────────────────────────────────

async function list(req, res) {
  try {
    const { schoolId } = _ctx(req);
    const {
      centerId, departmentId, designationId,
      employmentStatus, employmentType, active, search,
    } = req.query;

    const staff = await staffSvc.getAll({
      schoolId,
      centerId,
      departmentId,
      designationId,
      employmentStatus,
      employmentType,
      active,
      search,
    });
    res.json({ success: true, staff, total: staff.length });
  } catch (err) {
    _err(res, "GET /api/staff", err);
  }
}

async function count(req, res) {
  try {
    const { schoolId } = _ctx(req);
    const total = await staffSvc.count(schoolId);
    res.json({ success: true, total });
  } catch (err) {
    _err(res, "GET /api/staff/count", err);
  }
}

async function dashboard(req, res) {
  try {
    const { schoolId, centerId } = _ctx(req);
    const stats = await staffSvc.dashboardStats({ schoolId, centerId });
    res.json({ success: true, ...stats });
  } catch (err) {
    _err(res, "GET /api/staff/dashboard", err);
  }
}

async function recentActivity(req, res) {
  try {
    const { schoolId } = _ctx(req);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const events = await timelineSvc.getRecent({ schoolId, limit });
    res.json({ success: true, events });
  } catch (err) {
    _err(res, "GET /api/staff/recent-activity", err);
  }
}

// ── Self ───────────────────────────────────────────────────────────

async function getSelf(req, res) {
  try {
    const { schoolId, actorUserId } = _ctx(req);
    const staff = await staffSvc.getByLinkedUserId(actorUserId, schoolId);
    if (!staff) return res.json({ success: true, staff: null });
    res.json({ success: true, staff });
  } catch (err) {
    _err(res, "GET /api/staff/me", err);
  }
}

// ── Single record ─────────────────────────────────────────────────

async function getOne(req, res) {
  try {
    const staff = await staffSvc.getOne(req.params.staffId);
    if (!staff) return res.status(404).json({ success: false, error: "Staff member not found." });

    // Teachers may only view their own profile via this route.
    const isSelf      = staff.linkedUserId && staff.linkedUserId === req.user.userId;
    const canViewAll  = ["developer","super_admin","admin","center_owner","center_admin"].includes(req.user.role);
    if (!isSelf && !canViewAll) {
      return res.status(403).json({ success: false, error: "You may only view your own profile." });
    }

    res.json({ success: true, staff });
  } catch (err) {
    _err(res, "GET /api/staff/:staffId", err);
  }
}

async function getTimeline(req, res) {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const events = await timelineSvc.getForStaff(req.params.staffId, { limit });
    res.json({ success: true, events });
  } catch (err) {
    _err(res, "GET /api/staff/:staffId/timeline", err);
  }
}

// ── Write ──────────────────────────────────────────────────────────

async function create(req, res) {
  try {
    const { schoolId, tenantId, centerId, actorUserId } = _ctx(req);
    const body = { ...req.body };
    if (!body.centerId) body.centerId = centerId;
    const result = await staffSvc.create(body, { schoolId, tenantId, actorUserId });
    res.status(201).json(result);
  } catch (err) {
    _err(res, "POST /api/staff", err);
  }
}

async function update(req, res) {
  try {
    const { actorUserId } = _ctx(req);
    const result = await staffSvc.update(req.params.staffId, req.body, { actorUserId });
    if (!result) return res.status(404).json({ success: false, error: "Staff member not found." });
    res.json(result);
  } catch (err) {
    _err(res, "PUT /api/staff/:staffId", err);
  }
}

async function remove(req, res) {
  try {
    const { actorUserId } = _ctx(req);
    const ok = await staffSvc.remove(req.params.staffId, { actorUserId });
    if (!ok) return res.status(404).json({ success: false, error: "Staff member not found." });
    res.json({ success: true, message: "Staff deleted successfully." });
  } catch (err) {
    _err(res, "DELETE /api/staff/:staffId", err);
  }
}

// ── Login account linkage ─────────────────────────────────────────
//
// Flow:
//   1. Invite     → creates Firebase Auth user (if absent), creates matching
//                   users/{uid} Firestore doc, generates a password-reset link
//                   the front-end emails out, sets loginStatus=invitation_sent.
//   2. Link       → attach an existing Firebase UID to this staff record
//                   (e.g. the user already signed in via Google).
//   3. Unlink     → detach the UID. Auth account is left untouched so the
//                   user can keep signing in elsewhere; only the staff record
//                   loses the link.
//   4. Disable    → flip Auth account's disabled flag → blocks sign-in.
//   5. Enable     → reverse of disable.

async function _ensureAuthUser({ email, displayName, schoolId, role, centerId, actorUserId }) {
  let userRecord = null;
  try {
    userRecord = await auth.getUserByEmail(email);
  } catch (e) {
    if (e.code === "auth/user-not-found") {
      userRecord = await auth.createUser({
        email,
        displayName,
        emailVerified: false,
        disabled: false,
      });
    } else {
      throw e;
    }
  }

  // Ensure a matching users/{uid} Firestore doc exists so the
  // authMiddleware can resolve role + schoolId on first login.
  const userRef  = db.collection("users").doc(userRecord.uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    await userRef.set({
      userId:    userRecord.uid,
      name:      displayName,
      email:     email.toLowerCase(),
      role:      role || "teacher",
      schoolId,
      centerId:  centerId || "",
      center:    centerId || "",
      centers:   centerId ? [centerId] : [],
      status:    "active",
      photoUrl:  "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: actorUserId,
      updatedBy: actorUserId,
    });
  }

  return userRecord;
}

async function invite(req, res) {
  try {
    const { schoolId, centerId, actorUserId } = _ctx(req);
    const staff = await staffSvc.getOne(req.params.staffId);
    if (!staff) return res.status(404).json({ success: false, error: "Staff member not found." });
    if (!staff.email) return res.status(400).json({ success: false, error: "Set the employee's email before sending an invite." });

    const userRecord = await _ensureAuthUser({
      email:       staff.email,
      displayName: staff.displayName,
      schoolId,
      role:        staff.role || "teacher",
      centerId:    staff.centerId || centerId,
      actorUserId,
    });

    // Best-effort password reset link — the front-end (or an email service)
    // delivers it. We never expose Firebase auth tokens to the client other
    // than via this link.
    let resetLink = "";
    try {
      resetLink = await auth.generatePasswordResetLink(staff.email);
    } catch (linkErr) {
      console.warn("[POST /api/staff/:id/invite] reset-link failed:", linkErr.message);
    }

    const updated = await staffSvc.setLoginLink(staff.staffId, {
      linkedUserId: userRecord.uid,
      loginStatus:  "invitation_sent",
      email:        staff.email,
      invitedAt:    new Date().toISOString(),
      actorUserId,
    });

    res.json({ success: true, staff: updated, resetLink, uid: userRecord.uid });
  } catch (err) {
    _err(res, "POST /api/staff/:id/invite", err);
  }
}

async function linkUser(req, res) {
  try {
    const { actorUserId } = _ctx(req);
    const { uid } = req.body || {};
    if (!uid) return res.status(400).json({ success: false, error: "uid is required." });

    let userRecord;
    try { userRecord = await auth.getUser(uid); }
    catch { return res.status(404).json({ success: false, error: "No Firebase user with that UID." }); }

    const updated = await staffSvc.setLoginLink(req.params.staffId, {
      linkedUserId: uid,
      loginStatus:  userRecord.disabled ? "disabled" : "active",
      email:        userRecord.email || "",
      actorUserId,
    });
    if (!updated) return res.status(404).json({ success: false, error: "Staff member not found." });
    res.json({ success: true, staff: updated });
  } catch (err) {
    _err(res, "POST /api/staff/:id/link-user", err);
  }
}

async function unlinkUser(req, res) {
  try {
    const { actorUserId } = _ctx(req);
    const updated = await staffSvc.setLoginLink(req.params.staffId, {
      linkedUserId: "",
      loginStatus:  "not_linked",
      actorUserId,
    });
    if (!updated) return res.status(404).json({ success: false, error: "Staff member not found." });
    res.json({ success: true, staff: updated });
  } catch (err) {
    _err(res, "POST /api/staff/:id/unlink-user", err);
  }
}

async function setUserDisabled(req, res) {
  try {
    const { actorUserId } = _ctx(req);
    const { disabled } = req.body || {};
    const staff = await staffSvc.getOne(req.params.staffId);
    if (!staff) return res.status(404).json({ success: false, error: "Staff member not found." });
    if (!staff.linkedUserId) return res.status(400).json({ success: false, error: "Employee has no linked login account." });

    await auth.updateUser(staff.linkedUserId, { disabled: Boolean(disabled) });

    const updated = await staffSvc.setLoginLink(staff.staffId, {
      loginStatus: disabled ? "disabled" : "active",
      actorUserId,
    });
    res.json({ success: true, staff: updated });
  } catch (err) {
    _err(res, "POST /api/staff/:id/disable-user", err);
  }
}

async function restoreStaff(req, res) {
  try {
    const { actorUserId } = _ctx(req);
    const ok = await staffSvc.restore(req.params.staffId, { actorUserId });
    if (!ok) return res.status(404).json({ success: false, error: "Staff member not found." });
    res.json({ success: true, message: "Staff restored." });
  } catch (err) {
    _err(res, "POST /api/staff/:id/restore", err);
  }
}

module.exports = {
  list, count, dashboard, recentActivity,
  getSelf, getOne, getTimeline,
  create, update, remove,
  invite, linkUser, unlinkUser, setUserDisabled,
  restore: restoreStaff,
};
