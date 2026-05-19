/**
 * authService.js — Yellow Dot authentication & session management
 * ──────────────────────────────────────────────────────────────────
 * Login source hierarchy (extensible):
 *   1. Students sheet  →  Father_Email / Mother_Email  → role: parent
 *   2. (future) Admins sheet  → role: center_admin / super_admin
 *   3. (future) Teachers sheet → role: teacher
 *   4. (future) Staff sheet   → role: reception / accountant
 *
 * User IDs:
 *   - Parents: "parent_<studentId>_father" or "parent_<studentId>_mother"
 *   - Staff (future): will use their own sheet's row ID
 *
 * All sheet names come from config/sheetsConfig.js — never hardcoded here.
 */

const jwt     = require("jsonwebtoken");
const axios   = require("axios");
const crypto  = require("crypto");
const bcrypt  = require("bcryptjs");

const { sheets, SPREADSHEET_ID } = require("../googleSheets");
const {
  SHEETS,
  STUDENT_COLS,
  USER_COLS,
  buildParentId,
  parseParentId,
} = require("../config/sheetsConfig");
const { requestOTP: _requestOTP, verifyOTP: _verifyOTP } = require("./otpService");

const JWT_SECRET      = process.env.JWT_SECRET      || "yd-fallback-secret-change-in-production";
const JWT_EXPIRES_IN  = process.env.JWT_EXPIRES_IN  || "15m";
const REFRESH_EXPIRES = process.env.REFRESH_EXPIRES_IN || "7d";

// ── Roles that bypass ALL permission checks ───────────────────────────────────
// Must be checked BEFORE any array lookup. Never produces an unauthorized error.
const BYPASS_ROLES = new Set(["developer", "super_admin"]);

function isBypassRole(role) {
  return BYPASS_ROLES.has(role);
}

// ── Role → allowed route segments ─────────────────────────────────────────────
const ROLE_PERMISSIONS = {
  // Bypass roles: wildcard in the JWT payload so the frontend's array check
  // also passes even before the role-bypass short-circuit fires.
  developer:    ["*"],
  super_admin:  ["*"],

  admin:        [               // alias for center_admin
    "dashboard", "students", "attendance", "fees", "invoice", "analytics",
    "nap-tracker", "food-menu", "food-consumption", "cctv-settings", "live-cctv",
    "parent-checkin", "pickup-authorization", "pickup-history", "profile", "settings",
  ],
  center_admin: [
    "dashboard", "students", "attendance", "fees", "invoice", "analytics",
    "nap-tracker", "food-menu", "food-consumption", "cctv-settings", "live-cctv",
    "parent-checkin", "pickup-authorization", "pickup-history", "profile", "settings",
  ],
  teacher: [
    "dashboard", "attendance", "nap-tracker", "food-menu", "food-consumption",
    "students", "parent-checkin", "profile",
  ],
  parent: [
    "dashboard", "live-cctv", "parent-checkin", "pickup-history", "fees", "profile",
  ],
  accountant: [
    "dashboard", "fees", "invoice", "analytics", "students", "profile",
  ],
  cctv_viewer: ["live-cctv", "cctv-settings", "profile"],
  reception: [
    "dashboard", "students", "attendance", "parent-checkin",
    "pickup-authorization", "pickup-history", "profile",
  ],
};

// ── Role → default home route after login ─────────────────────────────────────
const ROLE_HOME = {
  developer:    "/",
  super_admin:  "/",
  admin:        "/",
  center_admin: "/",
  teacher:      "/attendance",
  parent:       "/parent-checkin",
  accountant:   "/invoice",
  cctv_viewer:  "/live-cctv",
  reception:    "/",
};

// ════════════════════════════════════════════════════════════════════════
// LOW-LEVEL SHEET HELPERS
// ════════════════════════════════════════════════════════════════════════

async function getSheetRows(range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  return res.data.values || [];
}

async function appendRow(range, values) {
  await sheets.spreadsheets.values.append({
    spreadsheetId:   SPREADSHEET_ID,
    range,
    valueInputOption: "RAW",
    requestBody:     { values: [values] },
  });
}

async function updateCell(range, value) {
  await sheets.spreadsheets.values.update({
    spreadsheetId:   SPREADSHEET_ID,
    range,
    valueInputOption: "RAW",
    requestBody:     { values: [[value]] },
  });
}

// ════════════════════════════════════════════════════════════════════════
// STUDENTS-SHEET USER LOOKUP
// ════════════════════════════════════════════════════════════════════════

/**
 * Search Students sheet for a row where Father_Email or Mother_Email
 * matches the supplied email (case-insensitive).
 *
 * Returns a normalised "parent user" object, or null if not found.
 *
 * @param {string} email — the Google account email being authenticated
 * @returns {object|null}
 */
async function getUserByGoogleEmail(email) {
  const normalised = (email || "").toLowerCase().trim();
  if (!normalised) return null;

  let rows;
  try {
    rows = await getSheetRows(SHEETS.STUDENTS);
  } catch (err) {
    // Surface as a clear operational error, not a raw Google API blob
    throw {
      status: 503,
      message: "Could not connect to the school database. Please try again shortly.",
      _internal: err.message,
    };
  }

  if (!rows || rows.length < 2) return null;

  // Skip header row (row[0])
  for (let i = 1; i < rows.length; i++) {
    const row      = rows[i];
    const fEmail   = (row[STUDENT_COLS.FATHER_EMAIL] || "").toLowerCase().trim();
    const mEmail   = (row[STUDENT_COLS.MOTHER_EMAIL] || "").toLowerCase().trim();

    let relation = null;
    if (fEmail && fEmail === normalised) relation = "father";
    else if (mEmail && mEmail === normalised) relation = "mother";

    if (!relation) continue;

    const studentId   = row[STUDENT_COLS.STUDENT_ID]   || `row_${i}`;
    const studentName = row[STUDENT_COLS.STUDENT_NAME] || "";
    console.log(`[AUTH] AUTH_MATCH_FOUND  email=${normalised}  studentId=${studentId}  relation=${relation}  student="${studentName}"`);

    return buildParentUser(row, i + 1, relation, studentId, email);
  }

  console.log(`[AUTH] AUTH_MATCH_FOUND  email=${normalised}  result=NOT_FOUND`);
  return null;
}

/**
 * Public alias — named exactly as requested for clarity.
 * Searches Students!A:R for Father_Email or Mother_Email.
 */
const findParentByEmail = getUserByGoogleEmail;

/**
 * Given a parent userId (e.g. "parent_STU001_father") look up the
 * corresponding student row and rebuild the user object.
 * Used by refreshAccessToken and /api/auth/me.
 *
 * @param {string} userId
 * @returns {object|null}
 */
async function findUserByParentId(userId) {
  const parsed = parseParentId(userId);
  if (!parsed) return null;

  let rows;
  try {
    rows = await getSheetRows(SHEETS.STUDENTS);
  } catch {
    return null;
  }

  if (!rows || rows.length < 2) return null;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if ((row[STUDENT_COLS.STUDENT_ID] || "") === parsed.studentId) {
      return buildParentUser(row, i + 1, parsed.relation, parsed.studentId, null);
    }
  }

  return null;
}

/**
 * Construct a normalised parent-user object from a Students sheet row.
 *
 * @param {string[]} row       — raw sheet row
 * @param {number}   rowIndex  — 1-based sheet row number (for cell updates)
 * @param {"father"|"mother"} relation
 * @param {string}   studentId
 * @param {string|null} emailOverride — pass the verified Google email to ensure
 *                                       exact capitalisation in the user object
 */
function buildParentUser(row, rowIndex, relation, studentId, emailOverride) {
  const isFather  = relation === "father";
  const name      = isFather
    ? (row[STUDENT_COLS.FATHER_NAME]      || "Parent")
    : (row[STUDENT_COLS.MOTHER_NAME]      || "Parent");
  const email     = emailOverride
    || (isFather
      ? row[STUDENT_COLS.FATHER_EMAIL]
      : row[STUDENT_COLS.MOTHER_EMAIL])
    || "";
  const center    = row[STUDENT_COLS.CENTER] || "";

  return {
    rowIndex,
    user_id:      buildParentId(studentId, relation),
    name,
    email,
    role:         "parent",
    centers:      center ? [center] : [],
    status:       "active",   // parents inherit the student's active status
    photo_url:    "",
    last_login:   "",
    // Extended parent-specific fields
    student: {
      studentId,
      studentName: row[STUDENT_COLS.STUDENT_NAME] || "",
      class:       row[STUDENT_COLS.CLASS]         || "",
      center,
    },
    relation,     // "father" | "mother"
  };
}

// ════════════════════════════════════════════════════════════════════════
// USERS SHEET LOOKUP  (staff: teachers, admins, accountants, etc.)
// ════════════════════════════════════════════════════════════════════════

/**
 * Find a staff user row by email (case-insensitive).
 * Searches Users!A:I — the non-parent staff registry.
 *
 * @param {string} email
 * @returns {object|null}  full staff user object (includes password_hash)
 */
async function findStaffByEmail(email) {
  const normalised = (email || "").toLowerCase().trim();
  if (!normalised) return null;

  let rows;
  try {
    rows = await getSheetRows(SHEETS.USERS);
  } catch (err) {
    throw {
      status: 503,
      message: "Could not connect to the school database. Please try again shortly.",
      _internal: err.message,
    };
  }

  if (!rows || rows.length < 2) return null;

  for (let i = 1; i < rows.length; i++) {
    const row   = rows[i];
    const email = (row[USER_COLS.EMAIL] || "").toLowerCase().trim();
    if (email === normalised) {
      console.log(`[AUTH] STAFF_MATCH  email=${normalised}  role=${row[USER_COLS.ROLE]}  userId=${row[USER_COLS.USER_ID]}`);
      return buildStaffUser(row, i + 1);
    }
  }

  return null;
}

/**
 * Find a staff user row by mobile number (normalised, no spaces/dashes).
 * Used for OTP login.
 *
 * @param {string} mobile
 * @returns {object|null}
 */
async function findStaffByMobile(mobile) {
  const clean = (mobile || "").replace(/[\s\-().]/g, "").trim();
  if (!clean) return null;

  let rows;
  try {
    rows = await getSheetRows(SHEETS.USERS);
  } catch (err) {
    throw { status: 503, message: "Could not connect to the school database.", _internal: err.message };
  }

  if (!rows || rows.length < 2) return null;

  for (let i = 1; i < rows.length; i++) {
    const row    = rows[i];
    const stored = (row[USER_COLS.MOBILE] || "").replace(/[\s\-().]/g, "").trim();
    if (stored && stored === clean) {
      console.log(`[AUTH] STAFF_MATCH  mobile=${clean.slice(0, 4)}****  role=${row[USER_COLS.ROLE]}  userId=${row[USER_COLS.USER_ID]}`);
      return buildStaffUser(row, i + 1);
    }
  }

  return null;
}

/**
 * Find a staff user by their User_ID column value.
 */
async function findStaffById(userId) {
  let rows;
  try {
    rows = await getSheetRows(SHEETS.USERS);
  } catch { return null; }
  if (!rows || rows.length < 2) return null;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if ((row[USER_COLS.USER_ID] || "") === userId) {
      return buildStaffUser(row, i + 1);
    }
  }
  return null;
}

/**
 * Construct a normalised staff-user object from a Users sheet row.
 * password_hash is included for internal verification only —
 * it is NEVER passed to safeUser() or the frontend.
 */
function buildStaffUser(row, rowIndex) {
  const center = row[USER_COLS.CENTER] || "";
  const centers = center === "all" || !center ? [] : [center];

  return {
    rowIndex,
    user_id:       row[USER_COLS.USER_ID]  || `usr_row_${rowIndex}`,
    name:          row[USER_COLS.NAME]     || "Staff",
    email:         row[USER_COLS.EMAIL]    || "",
    mobile:        row[USER_COLS.MOBILE]   || "",
    role:          row[USER_COLS.ROLE]     || "reception",
    centers,
    status:        (row[USER_COLS.STATUS]  || "active").toLowerCase(),
    photo_url:     row[USER_COLS.PHOTO]    || "",
    last_login:    "",
    password_hash: row[USER_COLS.PASSWORD_HASH] || "",
    // No student field — staff users are not linked to individual students
  };
}

// ════════════════════════════════════════════════════════════════════════
// UNIFIED USER LOOKUP  (used by refresh + /me endpoint)
// ════════════════════════════════════════════════════════════════════════

/**
 * Find any user by their userId, regardless of role.
 * Routes: parent_ prefix → Students sheet, otherwise → Users sheet.
 */
async function findUserById(userId) {
  if (!userId) return null;

  // Parent user?
  if (parseParentId(userId)) {
    return findUserByParentId(userId);
  }

  // Staff user (all other roles)
  return findStaffById(userId);
}

// ════════════════════════════════════════════════════════════════════════
// GOOGLE TOKEN VERIFICATION
// ════════════════════════════════════════════════════════════════════════

async function verifyGoogleAccessToken(accessToken) {
  try {
    const res = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 8000,
    });
    return res.data;
    // Returns: { sub, email, name, picture, email_verified, ... }
  } catch (err) {
    // Never leak raw Google API errors to the frontend
    const status = err?.response?.status;
    if (status === 401) {
      throw { status: 401, message: "Google authentication failed. Please sign in again." };
    }
    throw { status: 401, message: "Could not verify your Google account. Please try again." };
  }
}

// ════════════════════════════════════════════════════════════════════════
// GOOGLE LOGIN FLOW
// ════════════════════════════════════════════════════════════════════════

/**
 * Full Google login flow:
 *  1. Verify token → get Google profile
 *  2. Search Students sheet for matching parent email
 *  3. (future) Fall through to Admins / Teachers / Staff sheets
 *  4. Issue JWT pair + write session + write audit log
 */
async function loginWithGoogle(accessToken, deviceInfo = {}) {

  // ── Step 1: verify token with Google ─────────────────────────────────
  const googleUser = await verifyGoogleAccessToken(accessToken);

  if (!googleUser.email_verified) {
    throw { status: 401, message: "Your Google email address is not verified." };
  }

  const email = googleUser.email;
  console.log(`[AUTH] AUTH_EMAIL  ${email}  source=google  sheet=Students!A:R`);

  // ── Step 2: look up user ──────────────────────────────────────────────
  let user = null;

  // 2a. Search Students sheet → Father_Email / Mother_Email (parents)
  user = await getUserByGoogleEmail(email);

  // 2b. Search Users sheet → staff / admin / teacher / etc.
  if (!user) user = await findStaffByEmail(email);

  if (!user) {
    console.log(`[AUTH] AUTH_ROLE  email=${email}  result=DENIED  reason=NOT_REGISTERED`);
    await writeAuditLog(null, "LOGIN_FAILED", `${email} — not registered in Students sheet`, deviceInfo.ip);
    throw {
      status: 403,
      code:   "NOT_REGISTERED",
      message: "Account not registered with school. Please contact the administrator.",
    };
  }

  if (user.status !== "active") {
    console.log(`[AUTH] AUTH_ROLE  email=${email}  result=DENIED  reason=INACTIVE`);
    await writeAuditLog(null, "LOGIN_FAILED", `${email} — account inactive`, deviceInfo.ip);
    throw {
      status: 403,
      message: "Your account has been deactivated. Please contact the administrator.",
    };
  }

  console.log(`[AUTH] AUTH_ROLE  email=${email}  role=${user.role}  relation=${user.relation}  student=${user.student?.studentId}`);

  // ── Step 3: issue tokens ──────────────────────────────────────────────
  const accessJWT  = generateAccessToken(user, user.centers[0] || null);
  const refreshJWT = generateRefreshToken(user.user_id);

  // ── Step 4: persist session + audit ──────────────────────────────────
  await writeSession(user.user_id, refreshJWT, deviceInfo);
  await writeAuditLog(
    user.user_id,
    "LOGIN_SUCCESS",
    `${email} — role: ${user.role} — student: ${user.student?.studentId || "n/a"}`,
    deviceInfo.ip
  );

  const safeUserObj = safeUser({ ...user, photo_url: googleUser.picture || "" });
  console.log(`[AUTH] LOGIN_SUCCESS  email=${email}  role=${user.role}  userId=${user.user_id}  homeRoute=${ROLE_HOME[user.role]}`);

  return {
    accessToken:          accessJWT,
    refreshToken:         refreshJWT,
    user:                 safeUserObj,
    permissions:          getPermissions(user.role),
    requiresCenterSelect: user.centers.length > 1,
    homeRoute:            ROLE_HOME[user.role] || "/",
  };
}

// ════════════════════════════════════════════════════════════════════════
// EMAIL + PASSWORD LOGIN FLOW
// ════════════════════════════════════════════════════════════════════════

/**
 * Authenticate a staff user with email + password.
 * Parents do not use this — their passwords are not stored.
 *
 * @param {string} email
 * @param {string} password  — plain text from the login form
 * @param {object} deviceInfo
 */
async function loginWithEmail(email, password, deviceInfo = {}) {
  const normalised = (email || "").toLowerCase().trim();
  console.log(`[AUTH] AUTH_EMAIL  ${normalised}  source=email`);

  if (!normalised || !password) {
    throw { status: 400, message: "Email and password are required." };
  }

  // Look up in Users sheet
  const user = await findStaffByEmail(normalised);

  if (!user) {
    console.log(`[AUTH] AUTH_ROLE  email=${normalised}  result=DENIED  reason=NOT_REGISTERED`);
    await writeAuditLog(null, "LOGIN_FAILED", `${normalised} — email/password — not found`, deviceInfo.ip);
    // Generic message to avoid user enumeration
    throw { status: 401, message: "Invalid email or password." };
  }

  if (!user.password_hash) {
    throw { status: 403, message: "This account requires Google login. Please use the Google Sign-In button." };
  }

  if (user.status !== "active") {
    throw { status: 403, message: "Your account has been deactivated. Please contact the administrator." };
  }

  // Verify password
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    await writeAuditLog(null, "LOGIN_FAILED", `${normalised} — wrong password`, deviceInfo.ip);
    throw { status: 401, message: "Invalid email or password." };
  }

  console.log(`[AUTH] AUTH_ROLE  email=${normalised}  role=${user.role}`);

  const accessJWT  = generateAccessToken(user, user.centers[0] || null);
  const refreshJWT = generateRefreshToken(user.user_id);

  await writeSession(user.user_id, refreshJWT, deviceInfo);
  await writeAuditLog(user.user_id, "LOGIN_SUCCESS", `${normalised} — email/password — role: ${user.role}`, deviceInfo.ip);

  console.log(`[AUTH] LOGIN_SUCCESS  email=${normalised}  role=${user.role}  userId=${user.user_id}  homeRoute=${ROLE_HOME[user.role]}`);

  return {
    accessToken:          accessJWT,
    refreshToken:         refreshJWT,
    user:                 safeUser(user),
    permissions:          getPermissions(user.role),
    requiresCenterSelect: user.centers.length > 1,
    homeRoute:            ROLE_HOME[user.role] || "/",
  };
}

// ════════════════════════════════════════════════════════════════════════
// MOBILE OTP LOGIN FLOW
// ════════════════════════════════════════════════════════════════════════

/**
 * Step 1 — Request an OTP for a registered mobile number.
 * Checks that the mobile is registered before sending.
 *
 * @param {string} mobile
 * @returns {{ sent: true, expiresInSeconds: number }}
 */
async function requestMobileOTP(mobile) {
  console.log(`[AUTH] OTP_REQUEST  mobile=${mobile?.slice(0, 4)}****`);

  // Only send OTP to registered mobiles
  const user = await findStaffByMobile(mobile);
  if (!user) {
    // Avoid timing attacks — still respond with success-ish
    // but log the attempt
    console.log(`[AUTH] OTP_REQUEST  result=NOT_REGISTERED  mobile=${mobile?.slice(0, 4)}****`);
    // Return a fake-success so attackers can't enumerate mobile numbers
    return { sent: true, expiresInSeconds: 300 };
  }

  if (user.status !== "active") {
    throw { status: 403, message: "Your account has been deactivated. Please contact the administrator." };
  }

  return _requestOTP(mobile);
}

/**
 * Step 2 — Verify the OTP and complete login.
 *
 * @param {string} mobile
 * @param {string} code    — 6-digit OTP
 * @param {object} deviceInfo
 */
async function loginWithOTP(mobile, code, deviceInfo = {}) {
  console.log(`[AUTH] AUTH_EMAIL  mobile=${mobile?.slice(0, 4)}****  source=otp`);

  // Verify OTP (throws on failure)
  _verifyOTP(mobile, code);

  // Look up the user
  const user = await findStaffByMobile(mobile);
  if (!user) {
    await writeAuditLog(null, "LOGIN_FAILED", `OTP verified but mobile not registered: ${mobile?.slice(0, 4)}****`, deviceInfo.ip);
    throw { status: 403, message: "Mobile number not registered. Please contact the administrator." };
  }

  if (user.status !== "active") {
    throw { status: 403, message: "Your account has been deactivated. Please contact the administrator." };
  }

  console.log(`[AUTH] AUTH_ROLE  mobile=${mobile?.slice(0, 4)}****  role=${user.role}  userId=${user.user_id}`);

  const accessJWT  = generateAccessToken(user, user.centers[0] || null);
  const refreshJWT = generateRefreshToken(user.user_id);

  await writeSession(user.user_id, refreshJWT, deviceInfo);
  await writeAuditLog(user.user_id, "LOGIN_SUCCESS", `mobile OTP — role: ${user.role}`, deviceInfo.ip);

  console.log(`[AUTH] LOGIN_SUCCESS  role=${user.role}  userId=${user.user_id}  homeRoute=${ROLE_HOME[user.role]}`);

  return {
    accessToken:          accessJWT,
    refreshToken:         refreshJWT,
    user:                 safeUser(user),
    permissions:          getPermissions(user.role),
    requiresCenterSelect: user.centers.length > 1,
    homeRoute:            ROLE_HOME[user.role] || "/",
  };
}

// ════════════════════════════════════════════════════════════════════════
// REFRESH ACCESS TOKEN
// ════════════════════════════════════════════════════════════════════════

async function refreshAccessToken(refreshToken) {
  let payload;
  try {
    payload = verifyToken(refreshToken);
  } catch {
    throw { status: 401, message: "Session expired. Please sign in again." };
  }

  if (payload.type !== "refresh") {
    throw { status: 401, message: "Invalid token type." };
  }

  const user = await findUserById(payload.userId);
  if (!user || user.status !== "active") {
    throw { status: 401, message: "Account not found or deactivated." };
  }

  const accessToken = generateAccessToken(user, user.centers[0]);
  console.log(`[AUTH] TOKEN_REFRESHED  userId=${user.user_id}`);
  return { accessToken, user: safeUser(user) };
}

// ════════════════════════════════════════════════════════════════════════
// SELECT CENTER
// ════════════════════════════════════════════════════════════════════════

async function selectCenter(userId, centerId) {
  const user = await findUserById(userId);
  if (!user) throw { status: 404, message: "User not found." };

  if (user.role !== "super_admin" && !user.centers.includes(centerId)) {
    throw { status: 403, message: "You do not have access to this center." };
  }

  return jwt.sign(
    {
      userId:       user.user_id,
      name:         user.name,
      email:        user.email,
      role:         user.role,
      centers:      user.centers,
      activeCenter: centerId,
      photoUrl:     user.photo_url || "",
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// ════════════════════════════════════════════════════════════════════════
// SAFE USER  (strips internal fields before sending to frontend)
// ════════════════════════════════════════════════════════════════════════

function safeUser(user) {
  const base = {
    userId:       user.user_id,
    name:         user.name,
    email:        user.email,
    role:         user.role,
    centers:      user.centers,
    activeCenter: user.centers[0] || null,
    photoUrl:     user.photo_url || "",
    homeRoute:    ROLE_HOME[user.role] || "/",
  };

  // Include linked student info for parents
  if (user.role === "parent" && user.student) {
    base.student = user.student;
  }

  return base;
}

// ════════════════════════════════════════════════════════════════════════
// JWT HELPERS
// ════════════════════════════════════════════════════════════════════════

function generateAccessToken(user, centerId) {
  return jwt.sign(
    {
      userId:       user.user_id,
      name:         user.name,
      email:        user.email,
      role:         user.role,
      centers:      user.centers,
      activeCenter: centerId || user.centers[0] || null,
      photoUrl:     user.photo_url || "",
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function generateRefreshToken(userId) {
  return jwt.sign(
    { userId, type: "refresh" },
    JWT_SECRET,
    { expiresIn: REFRESH_EXPIRES }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// ════════════════════════════════════════════════════════════════════════
// SESSIONS
// ════════════════════════════════════════════════════════════════════════

async function writeSession(userId, refreshToken, deviceInfo) {
  try {
    const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    const now       = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await appendRow(SHEETS.SESSIONS, [
      sessionId,
      userId,
      tokenHash,
      deviceInfo.userAgent || "",
      deviceInfo.ip        || "",
      now,
      expiresAt,
      "active",
    ]);
  } catch {
    // Non-fatal — don't break login if session write fails
  }
}

// ════════════════════════════════════════════════════════════════════════
// AUDIT LOGS
// ════════════════════════════════════════════════════════════════════════

async function writeAuditLog(userId, action, details, ip) {
  try {
    const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await appendRow(SHEETS.AUDIT_LOGS, [
      logId,
      userId   || "",
      action,
      details  || "",
      ip       || "",
      new Date().toISOString(),
    ]);
    console.log(`[AUDIT] ${action}  userId=${userId || "anonymous"}  details="${details || ""}"`);
  } catch {
    // Non-fatal
  }
}

// ════════════════════════════════════════════════════════════════════════
// PERMISSION HELPERS
// ════════════════════════════════════════════════════════════════════════

function getPermissions(role) {
  return ROLE_PERMISSIONS[role] || [];
}

function hasPermission(role, route) {
  // Bypass roles: never blocked, no array lookup needed
  if (isBypassRole(role)) return true;
  const perms = ROLE_PERMISSIONS[role] || [];
  if (perms.includes("*")) return true;
  return perms.includes(route);
}

// ════════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════════

module.exports = {
  // Core auth — all three login methods
  loginWithGoogle,
  loginWithEmail,
  loginWithOTP,
  requestMobileOTP,
  refreshAccessToken,
  selectCenter,

  // User lookups
  findUserById,
  findUserByParentId,
  findStaffByEmail,
  findStaffByMobile,
  getUserByGoogleEmail,
  findParentByEmail,       // alias — same as getUserByGoogleEmail

  // Token utils
  verifyToken,
  generateAccessToken,

  // Permission utils
  getPermissions,
  hasPermission,

  // Audit
  writeAuditLog,

  // Constants
  ROLE_PERMISSIONS,
  ROLE_HOME,
  BYPASS_ROLES,
  isBypassRole,
};
