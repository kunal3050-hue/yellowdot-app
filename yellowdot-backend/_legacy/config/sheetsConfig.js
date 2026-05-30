/**
 * sheetsConfig.js — Centralised Google Sheets range registry
 * ─────────────────────────────────────────────────────────────
 * All sheet names and column mappings live here.
 * Never hard-code "SheetName!A:Z" anywhere else — import from here.
 *
 * Column indices are 0-based and match the actual spreadsheet layout.
 */

// ── Sheet ranges ────────────────────────────────────────────────────────────────
const SHEETS = {
  // Core data
  STUDENTS:              "Students!A:R",
  ATTENDANCE:            "Attendance!A:Z",
  FEES:                  "Fees!A:Z",

  // Finance
  INVOICES:              "Invoices!A:Z",
  PAYMENTS:              "Payments!A:Z",
  FEE_TEMPLATES:         "FeeTemplates!A:P",

  // Daily ops
  NAP_TRACKER:           "NapTracker!A:Z",
  FOOD_MENU:             "FoodMenu!A:Z",
  FOOD_CONSUMPTION:      "FoodConsumption!A:Z",

  // Pickup / security
  PICKUP_AUTHORIZATION:  "PickupAuthorization!A:Z",
  PICKUP_HISTORY:        "PickupHistory!A:Z",

  // Auth infrastructure
  SESSIONS:              "Sessions!A:H",
  AUDIT_LOGS:            "AuditLogs!A:F",

  // Staff / users (all non-parent roles)
  // Columns A–I: User_ID | Name | Email | Mobile | Role | Center | Status | Photo | Password_Hash
  USERS:                 "Users!A:I",
};

// ── Students sheet — column indices (0-based) ────────────────────────────────
// Matches: Students!A:R  →  columns A(0) through R(17)
const STUDENT_COLS = {
  STUDENT_ID:       0,   // A — e.g. "STU001"
  STUDENT_NAME:     1,   // B
  DOB:              2,   // C
  CLASS:            3,   // D
  JOIN_DATE:        4,   // E
  GENDER:           5,   // F
  FATHER_NAME:      6,   // G
  FATHER_WHATSAPP:  7,   // H
  FATHER_EMAIL:     8,   // I  ← matched for parent login
  MOTHER_NAME:      9,   // J
  MOTHER_WHATSAPP:  10,  // K
  MOTHER_EMAIL:     11,  // L  ← matched for parent login
  STATUS:           12,  // M
  CENTER:           13,  // N
  ADDRESS:          14,  // O
  BLOOD_GROUP:      15,  // P
  MEDICAL_NOTES:    16,  // Q
  NOTES:            17,  // R
};

// ── Users sheet — column indices (0-based) ────────────────────────────────────
// Matches: Users!A:I  →  9 columns (A=0 through I=8)
// All non-parent staff: developer, super_admin, center_admin, teacher, accountant, reception
const USER_COLS = {
  USER_ID:       0,  // A — e.g. "USR001"
  NAME:          1,  // B
  EMAIL:         2,  // C
  MOBILE:        3,  // D
  ROLE:          4,  // E — one of the role constants above
  CENTER:        5,  // F — center name or "all" for super_admin/developer
  STATUS:        6,  // G — "active" | "inactive"
  PHOTO:         7,  // H — URL string
  PASSWORD_HASH: 8,  // I — bcrypt hash; empty = Google-only login
};

// ── Parent user ID format ──────────────────────────────────────────────────────
// parent users get a synthetic ID so the token / session layer works identically
// to staff users.  Format: "parent_<studentId>_father" or "parent_<studentId>_mother"
const PARENT_ID_PREFIX = "parent_";

/**
 * Build a stable parent userId from a student row.
 * @param {string} studentId  – the student's ID (col 0)
 * @param {"father"|"mother"} relation
 */
function buildParentId(studentId, relation) {
  return `${PARENT_ID_PREFIX}${studentId}_${relation}`;
}

/**
 * Parse a parent userId back to { studentId, relation }.
 * Returns null if the id is not a parent id.
 */
function parseParentId(userId) {
  if (!userId || !userId.startsWith(PARENT_ID_PREFIX)) return null;
  const rest   = userId.slice(PARENT_ID_PREFIX.length); // "STU001_father"
  const lastUs = rest.lastIndexOf("_");
  if (lastUs === -1) return null;
  return {
    studentId: rest.slice(0, lastUs),
    relation:  rest.slice(lastUs + 1),              // "father" | "mother"
  };
}

module.exports = {
  SHEETS,
  STUDENT_COLS,
  USER_COLS,
  PARENT_ID_PREFIX,
  buildParentId,
  parseParentId,
};
