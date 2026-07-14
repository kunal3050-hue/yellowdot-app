/**
 * staffService.js — Firestore-backed staff (employee) management
 * ──────────────────────────────────────────────────────────────────
 * Collection: staff/{staffId}
 * Tenant-safe: every document carries tenantId, schoolId, centerId (branch).
 * Timestamps: createdAt + updatedAt; soft-delete adds deletedAt + deletedBy.
 *
 * Employee Number: auto-generated EMP000001 — 6-digit zero-padded, never
 * changes after create (enforced — update() strips the field).
 *
 * Branch & Classroom: one branch per employee (`branch` / `centerId`),
 * multiple classrooms via `assignedClassrooms: string[]`. The legacy
 * single `assignedClassroom` field is auto-migrated when read.
 *
 * Employee Categories: not stored on staff directly. Derived from the
 * linked designation's `category` field at read/aggregate time.
 *
 * Login Account fields:
 *   linkedUserId   — Firebase Auth UID once invited / linked
 *   loginStatus    — not_linked | invitation_sent | active | disabled
 *   invitedAt      — ISO timestamp when invitation was sent
 *
 * Soft delete:
 *   remove() flips status to "inactive", clears active, sets deletedAt /
 *   deletedBy. List queries hide soft-deleted records by default; pass
 *   includeDeleted: true to see them.
 */

const { db }      = require("../firebaseAdmin");
const timelineSvc = require("./employeeTimelineService");
const { _resolveAssignableRole } = require("./userService");

const SCHOOL_ID  = process.env.SCHOOL_ID || "yd-main";
const col        = () => db.collection("staff");
const nowISO     = () => new Date().toISOString();

// ── Enums (validated on write) ─────────────────────────────────────

const EMPLOYMENT_TYPES = new Set([
  "full_time", "part_time", "contract", "intern", "consultant",
]);

const EMPLOYMENT_STATUSES = new Set([
  "draft", "active", "inactive", "on_leave", "notice_period",
  "resigned", "terminated", "retired",
]);

const LOGIN_STATUSES = new Set([
  "not_linked", "invitation_sent", "active", "disabled",
]);

const GENDERS         = new Set(["male", "female", "other", "prefer_not_to_say"]);
const MARITAL_STATUS  = new Set(["single", "married", "divorced", "widowed", "other"]);
const BLOOD_GROUPS    = new Set(["A+","A-","B+","B-","AB+","AB-","O+","O-","Unknown"]);

// ── Document mapper ────────────────────────────────────────────────

function docToStaff(snap) {
  const d  = snap.data ? snap.data() : snap;
  const id = snap.id   || d.staffId || "";

  // Migrate legacy single-classroom field on read
  const classrooms = Array.isArray(d.assignedClassrooms)
    ? d.assignedClassrooms
    : (d.assignedClassroom ? [d.assignedClassroom] : []);

  return {
    staffId:           d.staffId           || id,
    employeeCode:      d.employeeCode      || "",

    tenantId:          d.tenantId          || d.schoolId || SCHOOL_ID,
    schoolId:          d.schoolId          || SCHOOL_ID,
    centerId:          d.centerId          || "",
    branch:            d.branch            || d.centerId || "",

    firstName:         d.firstName         || "",
    lastName:          d.lastName          || "",
    displayName:       d.displayName       || `${d.firstName || ""} ${d.lastName || ""}`.trim(),
    gender:            d.gender            || "",
    dob:               d.dob               || "",
    bloodGroup:        d.bloodGroup        || "",
    maritalStatus:     d.maritalStatus     || "",
    photoUrl:          d.photoUrl          || "",
    photoStoragePath:  d.photoStoragePath  || "",

    mobile:            d.mobile            || d.phone || "",
    email:             d.email             || "",
    address:           d.address           || "",
    city:              d.city              || "",
    state:             d.state             || "",
    pincode:           d.pincode           || "",

    joiningDate:       d.joiningDate       || "",
    confirmationDate:  d.confirmationDate  || "",
    departmentId:      d.departmentId      || "",
    departmentName:    d.departmentName    || "",
    designationId:     d.designationId     || "",
    designationName:   d.designationName   || "",
    category:          d.category          || "",     // denormalised from designation
    role:              d.role              || "",
    reportingManagerId:d.reportingManagerId|| "",
    reportingManager:  d.reportingManager  || "",
    assignedClassrooms:classrooms,
    employmentType:    d.employmentType    || "full_time",
    employmentStatus:  d.employmentStatus  || "draft",

    emergencyContact: {
      name:     d.emergencyContact?.name     || "",
      relation: d.emergencyContact?.relation || "",
      mobile:   d.emergencyContact?.mobile   || "",
    },

    salary: {
      monthlyCtc:       Number(d.salary?.monthlyCtc       || 0),
      currency:         d.salary?.currency                || "INR",
      paymentMode:      d.salary?.paymentMode             || "",
      bankAccountLast4: d.salary?.bankAccountLast4        || "",
    },

    // Login account linkage
    linkedUserId:      d.linkedUserId      || "",
    loginStatus:       d.loginStatus       || "not_linked",
    invitedAt:         d.invitedAt         || "",
    lastInviteEmail:   d.lastInviteEmail   || "",

    // Lifecycle
    active:            d.active !== false,
    deletedAt:         d.deletedAt         || "",
    deletedBy:         d.deletedBy         || "",
    createdAt:         d.createdAt         || "",
    updatedAt:         d.updatedAt         || "",
    createdBy:         d.createdBy         || "",
    updatedBy:         d.updatedBy         || "",
  };
}

// ── Atomic ID generation (6-digit, never reused) ───────────────────

async function _nextStaffId() {
  const counterRef = db.collection("_counters").doc("staff");
  let nextNum = 1;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    nextNum = snap.exists ? (snap.data().count || 0) + 1 : 1;
    tx.set(counterRef, { count: nextNum }, { merge: true });
  });
  const padded = String(nextNum).padStart(6, "0");
  return { staffId: `STF${padded}`, employeeCode: `EMP${padded}` };
}

// ── Field normalisation + validation ───────────────────────────────

function _norm(v) {
  return typeof v === "string" ? v.trim() : v;
}

function _validate(data, { partial = false } = {}) {
  const errors = [];
  if (!partial || data.firstName !== undefined) {
    if (!_norm(data.firstName)) errors.push("firstName is required.");
  }
  if (!partial || data.lastName !== undefined) {
    if (!_norm(data.lastName))  errors.push("lastName is required.");
  }
  if (data.gender           && !GENDERS.has(data.gender))                     errors.push("Invalid gender.");
  if (data.maritalStatus    && !MARITAL_STATUS.has(data.maritalStatus))       errors.push("Invalid maritalStatus.");
  if (data.bloodGroup       && !BLOOD_GROUPS.has(data.bloodGroup))            errors.push("Invalid bloodGroup.");
  if (data.employmentType   && !EMPLOYMENT_TYPES.has(data.employmentType))    errors.push("Invalid employmentType.");
  if (data.employmentStatus && !EMPLOYMENT_STATUSES.has(data.employmentStatus))errors.push("Invalid employmentStatus.");
  if (data.loginStatus      && !LOGIN_STATUSES.has(data.loginStatus))         errors.push("Invalid loginStatus.");

  if (errors.length) {
    const err = new Error(errors.join(" "));
    err.code  = "VALIDATION";
    throw err;
  }
}

// ── Duplicate-prevention helpers ───────────────────────────────────

async function _assertNoDuplicate({ schoolId, email, mobile, employeeCode, excludeStaffId }) {
  const checks = [
    { field: "email",        value: (email || "").toLowerCase(), message: "Email is already in use by another employee." },
    { field: "mobile",       value: mobile,                       message: "Mobile is already in use by another employee." },
    { field: "employeeCode", value: employeeCode,                 message: "Employee Code is already in use." },
  ].filter(c => c.value);

  for (const { field, value, message } of checks) {
    const q = await col()
      .where("schoolId", "==", schoolId)
      .where(field, "==", value)
      .limit(2).get();
    const hit = q.docs.find(d => d.id !== excludeStaffId && !d.data().deletedAt);
    if (hit) {
      const err = new Error(message);
      err.code  = "DUPLICATE";
      err.field = field;
      throw err;
    }
  }
}

// ── Read ───────────────────────────────────────────────────────────

async function getAll({
  schoolId  = SCHOOL_ID,
  centerId,
  departmentId,
  designationId,
  category,
  employmentStatus,
  employmentType,
  loginStatus,
  active,
  search,
  includeDeleted = false,
} = {}) {
  const snap = await col().where("schoolId", "==", schoolId).get();
  let rows   = snap.docs.map(docToStaff);

  if (!includeDeleted) rows = rows.filter(r => !r.deletedAt);

  if (centerId)         rows = rows.filter(r => r.centerId === centerId);
  if (departmentId)     rows = rows.filter(r => r.departmentId === departmentId);
  if (designationId)    rows = rows.filter(r => r.designationId === designationId);
  if (category)         rows = rows.filter(r => r.category     === category);
  if (employmentStatus) rows = rows.filter(r => r.employmentStatus === employmentStatus);
  if (employmentType)   rows = rows.filter(r => r.employmentType   === employmentType);
  if (loginStatus)      rows = rows.filter(r => r.loginStatus      === loginStatus);
  if (active !== undefined) {
    const want = active !== "false" && active !== false;
    rows = rows.filter(r => r.active === want);
  }

  if (search) {
    const q = search.toLowerCase().trim();
    rows = rows.filter(r =>
      r.firstName.toLowerCase().includes(q)        ||
      r.lastName.toLowerCase().includes(q)         ||
      r.displayName.toLowerCase().includes(q)      ||
      r.employeeCode.toLowerCase().includes(q)     ||
      r.email.toLowerCase().includes(q)            ||
      r.mobile.includes(q)                         ||
      r.departmentName.toLowerCase().includes(q)   ||
      r.designationName.toLowerCase().includes(q),
    );
  }

  rows.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return rows;
}

async function getOne(staffId) {
  const ref  = col().doc(staffId);
  const snap = await ref.get();
  if (snap.exists) return docToStaff(snap);

  const q = await col().where("staffId", "==", staffId).limit(1).get();
  if (q.empty) return null;
  return docToStaff(q.docs[0]);
}

async function getByLinkedUserId(userId, schoolId = SCHOOL_ID) {
  const q = await col()
    .where("schoolId", "==", schoolId)
    .where("linkedUserId", "==", userId)
    .limit(1).get();
  if (q.empty) return null;
  return docToStaff(q.docs[0]);
}

async function count(schoolId = SCHOOL_ID) {
  const all = await getAll({ schoolId });
  return all.length;
}

// ── Dashboard aggregates (category-driven) ─────────────────────────

async function dashboardStats({ schoolId = SCHOOL_ID, centerId } = {}) {
  const all = await getAll({ schoolId, centerId });

  const now            = new Date();
  const month          = now.getMonth();
  const year           = now.getFullYear();
  const startOfMonth   = new Date(year, month, 1).toISOString().slice(0, 10);

  let total = 0, active = 0, inactive = 0;
  const byCategory = {
    teaching: 0, non_teaching: 0, administration: 0, management: 0, support: 0, unassigned: 0,
  };
  let teachers = 0, nonTeaching = 0;
  let newJoiningsThisMonth = 0;
  const birthdaysThisMonth         = [];
  const workAnniversariesThisMonth = [];

  for (const s of all) {
    total++;
    if (s.active && s.employmentStatus === "active") active++;
    else if (!s.active
        || s.employmentStatus === "inactive"
        || s.employmentStatus === "terminated"
        || s.employmentStatus === "resigned"
        || s.employmentStatus === "retired") {
      inactive++;
    }

    const cat = s.category || "unassigned";
    if (byCategory[cat] !== undefined) byCategory[cat]++;
    else byCategory.unassigned++;

    if (cat === "teaching")     teachers++;
    else if (cat !== "unassigned") nonTeaching++;

    if (s.joiningDate && s.joiningDate >= startOfMonth) newJoiningsThisMonth++;

    if (s.dob) {
      const parts = s.dob.split("-").map(Number);
      const dobMonth = parts[1], dobDay = parts[2];
      if (dobMonth === month + 1) {
        birthdaysThisMonth.push({
          staffId: s.staffId, displayName: s.displayName, photoUrl: s.photoUrl, day: dobDay,
        });
      }
    }

    if (s.joiningDate) {
      const parts = s.joiningDate.split("-").map(Number);
      const joinYear = parts[0], joinMonth = parts[1], joinDay = parts[2];
      if (joinMonth === month + 1 && joinYear < year) {
        workAnniversariesThisMonth.push({
          staffId: s.staffId, displayName: s.displayName, photoUrl: s.photoUrl,
          day: joinDay, years: year - joinYear,
        });
      }
    }
  }

  birthdaysThisMonth.sort((a, b) => a.day - b.day);
  workAnniversariesThisMonth.sort((a, b) => a.day - b.day);

  return {
    total,
    active,
    inactive,
    teachers,
    nonTeaching,
    byCategory,
    newJoiningsThisMonth,
    birthdaysThisMonth,
    workAnniversariesThisMonth,
  };
}

// ── Helper: pull category off a designation (denormalised onto staff) ──

async function _resolveCategory(designationId) {
  if (!designationId) return "";
  try {
    const snap = await db.collection("designations").doc(designationId).get();
    if (snap.exists) return snap.data().category || "";
  } catch { /* ignore */ }
  return "";
}

// ── Write ──────────────────────────────────────────────────────────

async function create(data, { schoolId = SCHOOL_ID, tenantId, actorUserId = "system" } = {}) {
  _validate(data);
  await _assertNoDuplicate({
    schoolId,
    email:  (data.email || "").toLowerCase().trim(),
    mobile: (data.mobile || "").trim(),
  });

  const { staffId, employeeCode } = await _nextStaffId();

  const firstName   = _norm(data.firstName) || "";
  const lastName    = _norm(data.lastName)  || "";
  const displayName = _norm(data.displayName) || `${firstName} ${lastName}`.trim();

  // Normalise classrooms input — accept array or single-string
  const classrooms = Array.isArray(data.assignedClassrooms)
    ? data.assignedClassrooms.map(c => String(c).trim()).filter(Boolean)
    : (data.assignedClassroom ? [String(data.assignedClassroom).trim()].filter(Boolean) : []);

  const category = data.category || await _resolveCategory(data.designationId);

  const doc = {
    staffId,
    employeeCode,

    tenantId:  tenantId || schoolId,
    schoolId,
    centerId:  _norm(data.centerId) || "",
    branch:    _norm(data.branch)   || _norm(data.centerId) || "",

    firstName,
    lastName,
    displayName,
    gender:        data.gender         || "",
    dob:           _norm(data.dob)     || "",
    bloodGroup:    data.bloodGroup     || "",
    maritalStatus: data.maritalStatus  || "",
    photoUrl:         _norm(data.photoUrl)         || "",
    photoStoragePath: _norm(data.photoStoragePath) || "",

    mobile:    _norm(data.mobile) || "",
    email:     (_norm(data.email) || "").toLowerCase(),
    address:   _norm(data.address)|| "",
    city:      _norm(data.city)   || "",
    state:     _norm(data.state)  || "",
    pincode:   _norm(data.pincode)|| "",

    joiningDate:        _norm(data.joiningDate)       || "",
    confirmationDate:   _norm(data.confirmationDate)  || "",
    departmentId:       _norm(data.departmentId)      || "",
    departmentName:     _norm(data.departmentName)    || "",
    designationId:      _norm(data.designationId)     || "",
    designationName:    _norm(data.designationName)   || "",
    category,
    role:               _resolveAssignableRole(_norm(data.role), ""),
    reportingManagerId: _norm(data.reportingManagerId)|| "",
    reportingManager:   _norm(data.reportingManager)  || "",
    assignedClassrooms: classrooms,
    employmentType:     data.employmentType   || "full_time",
    employmentStatus:   data.employmentStatus || "draft",

    emergencyContact: {
      name:     _norm(data.emergencyContact?.name)     || "",
      relation: _norm(data.emergencyContact?.relation) || "",
      mobile:   _norm(data.emergencyContact?.mobile)   || "",
    },

    salary: {
      monthlyCtc:       Number(data.salary?.monthlyCtc || 0),
      currency:         data.salary?.currency || "INR",
      paymentMode:      data.salary?.paymentMode || "",
      bankAccountLast4: (data.salary?.bankAccountLast4 || "").toString().slice(-4),
    },

    linkedUserId:    _norm(data.linkedUserId) || "",
    loginStatus:     data.loginStatus || "not_linked",
    invitedAt:       "",
    lastInviteEmail: "",

    active:    true,
    deletedAt: "",
    deletedBy: "",
    createdAt: nowISO(),
    updatedAt: nowISO(),
    createdBy: actorUserId,
    updatedBy: actorUserId,
  };

  await col().doc(staffId).set(doc);

  await timelineSvc.log(staffId, {
    type:        "STAFF_CREATED",
    description: `Employee ${employeeCode} (${displayName}) created`,
    actorUserId,
    schoolId,
  });

  return { success: true, staffId, employeeCode, staff: docToStaff(doc) };
}

// Fields that are immutable after create (silently dropped from updates)
const IMMUTABLE_FIELDS = new Set([
  "staffId", "employeeCode", "createdAt", "createdBy", "schoolId", "tenantId",
]);

async function update(staffId, data, { actorUserId = "system" } = {}) {
  _validate(data, { partial: true });

  let ref  = col().doc(staffId);
  let snap = await ref.get();
  if (!snap.exists) {
    const q = await col().where("staffId", "==", staffId).limit(1).get();
    if (q.empty) return null;
    ref  = q.docs[0].ref;
    snap = q.docs[0];
  }

  const existing = snap.data();

  // Duplicate prevention for email / mobile changes
  if (data.email !== undefined || data.mobile !== undefined) {
    await _assertNoDuplicate({
      schoolId: existing.schoolId,
      email:    data.email  !== undefined ? (data.email  || "").toLowerCase().trim() : undefined,
      mobile:   data.mobile !== undefined ? (data.mobile || "").trim() : undefined,
      excludeStaffId: existing.staffId || ref.id,
    });
  }

  // Re-resolve category when designation changes
  let resolvedCategory;
  if (data.designationId !== undefined && data.designationId !== existing.designationId) {
    resolvedCategory = await _resolveCategory(data.designationId);
  }

  const updates = { updatedAt: nowISO(), updatedBy: actorUserId };

  const SCALAR_FIELDS = [
    "firstName","lastName","displayName","gender","dob","bloodGroup","maritalStatus",
    "photoUrl","photoStoragePath",
    "mobile","email","address","city","state","pincode",
    "joiningDate","confirmationDate","departmentId","departmentName","designationId","designationName",
    "role","reportingManagerId","reportingManager",
    "employmentType","employmentStatus","centerId","branch","linkedUserId","loginStatus",
  ];

  for (const k of SCALAR_FIELDS) {
    if (data[k] !== undefined && !IMMUTABLE_FIELDS.has(k)) updates[k] = _norm(data[k]);
  }

  // Never let this field resolve to a bypass role (developer/super_admin) —
  // it's later read by staffController's invite() flow to set a real
  // users/{uid} Firestore role, so it must go through the same cap.
  if (updates.role !== undefined) updates.role = _resolveAssignableRole(updates.role, "");

  if (data.email !== undefined) updates.email = (_norm(data.email) || "").toLowerCase();
  if (data.active !== undefined) updates.active = Boolean(data.active);

  if (Array.isArray(data.assignedClassrooms)) {
    updates.assignedClassrooms = data.assignedClassrooms.map(c => String(c).trim()).filter(Boolean);
  } else if (data.assignedClassroom !== undefined) {
    // Legacy single-string write
    const single = String(data.assignedClassroom).trim();
    updates.assignedClassrooms = single ? [single] : [];
  }

  // Keep displayName in sync if first/last changed and displayName wasn't provided
  if ((data.firstName !== undefined || data.lastName !== undefined) && data.displayName === undefined) {
    const f = updates.firstName ?? existing.firstName ?? "";
    const l = updates.lastName  ?? existing.lastName  ?? "";
    updates.displayName = `${f} ${l}`.trim();
  }

  if (resolvedCategory !== undefined) updates.category = resolvedCategory;

  if (data.emergencyContact) {
    updates.emergencyContact = {
      ...existing.emergencyContact,
      ...(data.emergencyContact.name     !== undefined && { name:     _norm(data.emergencyContact.name) }),
      ...(data.emergencyContact.relation !== undefined && { relation: _norm(data.emergencyContact.relation) }),
      ...(data.emergencyContact.mobile   !== undefined && { mobile:   _norm(data.emergencyContact.mobile) }),
    };
  }

  if (data.salary) {
    updates.salary = {
      ...existing.salary,
      ...(data.salary.monthlyCtc       !== undefined && { monthlyCtc: Number(data.salary.monthlyCtc) || 0 }),
      ...(data.salary.currency         !== undefined && { currency:   data.salary.currency }),
      ...(data.salary.paymentMode      !== undefined && { paymentMode:data.salary.paymentMode }),
      ...(data.salary.bankAccountLast4 !== undefined && {
        bankAccountLast4: String(data.salary.bankAccountLast4).slice(-4),
      }),
    };
  }

  await ref.update(updates);

  // ── Granular timeline events ─────────────────────────────────
  const events = [];

  if (updates.departmentId !== undefined && updates.departmentId !== existing.departmentId) {
    events.push({
      type: "DEPARTMENT_CHANGED",
      description: `Department changed from ${existing.departmentName || "—"} to ${updates.departmentName || "—"}`,
      metadata: { from: existing.departmentName || "", to: updates.departmentName || "" },
    });
  }
  if (updates.designationId !== undefined && updates.designationId !== existing.designationId) {
    events.push({
      type: "DESIGNATION_CHANGED",
      description: `Designation changed from ${existing.designationName || "—"} to ${updates.designationName || "—"}`,
      metadata: { from: existing.designationName || "", to: updates.designationName || "" },
    });
  }
  if (updates.employmentStatus !== undefined && updates.employmentStatus !== existing.employmentStatus) {
    events.push({
      type: "STATUS_CHANGED",
      description: `Status changed from ${existing.employmentStatus} to ${updates.employmentStatus}`,
      metadata: { from: existing.employmentStatus, to: updates.employmentStatus },
    });
  }
  if (updates.photoUrl !== undefined && updates.photoUrl !== existing.photoUrl) {
    events.push({
      type: updates.photoUrl ? "PHOTO_UPDATED" : "PHOTO_REMOVED",
      description: updates.photoUrl ? "Profile photo updated" : "Profile photo removed",
    });
  }

  // Fallback: if no specific event matched but something else changed,
  // record a generic STAFF_UPDATED with the list of changed fields.
  const meaningful = Object.keys(updates).filter(k => !["updatedAt","updatedBy"].includes(k));
  if (events.length === 0 && meaningful.length > 0) {
    events.push({
      type: "STAFF_UPDATED",
      description: "Profile updated",
      metadata: { fields: meaningful },
    });
  }

  for (const ev of events) {
    await timelineSvc.log(staffId, { ...ev, actorUserId, schoolId: existing.schoolId });
  }

  return { success: true, message: "Staff updated successfully" };
}

// ── Soft delete ────────────────────────────────────────────────────

async function remove(staffId, { actorUserId = "system" } = {}) {
  const existing = await getOne(staffId);
  if (!existing) return false;

  await col().doc(existing.staffId).update({
    active:            false,
    employmentStatus:  "inactive",
    deletedAt:         nowISO(),
    deletedBy:         actorUserId,
    updatedAt:         nowISO(),
    updatedBy:         actorUserId,
  });

  await timelineSvc.log(existing.staffId, {
    type:        "STAFF_DELETED",
    description: `Employee ${existing.employeeCode} (${existing.displayName}) marked inactive`,
    actorUserId,
    schoolId:    existing.schoolId,
  });

  return true;
}

async function restore(staffId, { actorUserId = "system" } = {}) {
  const existing = await getOne(staffId);
  if (!existing) return false;

  await col().doc(existing.staffId).update({
    active:           true,
    employmentStatus: "active",
    deletedAt:        "",
    deletedBy:        "",
    updatedAt:        nowISO(),
    updatedBy:        actorUserId,
  });

  await timelineSvc.log(existing.staffId, {
    type:        "STAFF_RESTORED",
    description: `Employee restored`,
    actorUserId,
    schoolId:    existing.schoolId,
  });
  return true;
}

// ── Login account linkage ─────────────────────────────────────────
// These low-level writers are called from the controller after the
// Firebase Auth side-effects (createUser / disableUser / etc.) succeed.

async function setLoginLink(staffId, {
  linkedUserId,
  loginStatus,
  email,
  invitedAt,
  actorUserId = "system",
}) {
  const existing = await getOne(staffId);
  if (!existing) return null;

  const updates = { updatedAt: nowISO(), updatedBy: actorUserId };
  if (linkedUserId !== undefined) updates.linkedUserId = linkedUserId;
  if (loginStatus  !== undefined) {
    if (!LOGIN_STATUSES.has(loginStatus)) {
      const err = new Error("Invalid loginStatus.");
      err.code  = "VALIDATION";
      throw err;
    }
    updates.loginStatus = loginStatus;
  }
  if (invitedAt !== undefined) updates.invitedAt = invitedAt;
  if (email     !== undefined) updates.lastInviteEmail = email;

  await col().doc(existing.staffId).update(updates);

  const evMap = {
    invitation_sent: { type: "USER_INVITED",       description: `Invitation sent${email ? ` to ${email}` : ""}` },
    active:          { type: "USER_ACCOUNT_LINKED",description: `Login account linked${email ? ` (${email})` : ""}` },
    disabled:        { type: "USER_DISABLED",      description: `Login account disabled` },
    not_linked:      { type: "USER_UNLINKED",      description: `Login account unlinked` },
  };
  const ev = evMap[loginStatus];
  if (ev) {
    await timelineSvc.log(existing.staffId, {
      ...ev,
      actorUserId,
      schoolId: existing.schoolId,
      metadata: { linkedUserId: linkedUserId || existing.linkedUserId, email },
    });
  }

  return await getOne(existing.staffId);
}

// ── Search ─────────────────────────────────────────────────────────

async function search(q, { schoolId = SCHOOL_ID, centerId } = {}) {
  return getAll({ schoolId, centerId, search: q });
}

module.exports = {
  getAll,
  getOne,
  getByLinkedUserId,
  count,
  dashboardStats,
  create,
  update,
  remove,
  restore,
  setLoginLink,
  search,
  EMPLOYMENT_TYPES:    [...EMPLOYMENT_TYPES],
  EMPLOYMENT_STATUSES: [...EMPLOYMENT_STATUSES],
  LOGIN_STATUSES:      [...LOGIN_STATUSES],
  GENDERS:             [...GENDERS],
  MARITAL_STATUS:      [...MARITAL_STATUS],
  BLOOD_GROUPS:        [...BLOOD_GROUPS],
};
