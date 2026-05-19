/**
 * settingsService.js — Yellow Dot Settings API client
 * ─────────────────────────────────────────────────────
 * Communicates with /api/settings/* on the backend.
 * All settings are stored in a "Settings" Google Sheet tab as
 * flat key-value rows: section | key | value | updatedAt | updatedBy
 *
 * Endpoints (backend needs to implement):
 *   GET    /api/settings            → { school:{...}, fees:{...}, ... }
 *   PUT    /api/settings/:section   → { success: true }
 *   GET    /api/settings/users      → [...staff users]
 *   POST   /api/settings/users      → { user }
 *   PUT    /api/settings/users/:id  → { user }
 *
 * Falls back to DEFAULT_SETTINGS if backend is unavailable.
 */

import { api } from "./authService";

/* ── Base request wrapper (uses Firebase-token-carrying axios instance) ── */
async function req(path, options = {}) {
  const { method = "GET", body } = options;
  const data = body ? JSON.parse(body) : undefined;
  const res = await api({ method, url: path, data });
  return res.data;
}

/* ── Defaults — used when backend not yet wired ─────────────────── */
export const DEFAULT_SETTINGS = {
  school: {
    name:              "Yellow Dot Preschool",
    tagline:           "Where Little Minds Grow",
    address:           "",
    phone:             "",
    email:             "",
    website:           "",
    principalName:     "",
    affiliationNumber: "",
    establishedYear:   "2010",
    logoUrl:           "",
  },
  academic: {
    yearLabel:   "2024-25",
    startDate:   "2024-04-01",
    endDate:     "2025-03-31",
    termCount:   "2",
    term1Start:  "2024-04-01",
    term1End:    "2024-09-30",
    term2Start:  "2024-10-01",
    term2End:    "2025-03-31",
    term3Start:  "",
    term3End:    "",
  },
  fees: {
    gstEnabled:       "true",
    gstRate:          "18",
    lateFeeEnabled:   "true",
    lateFeeType:      "percentage",
    lateFeeValue:     "2",
    dueDayOfMonth:    "10",
    gracePeriodDays:  "5",
    paymentMethods:   "cash,upi,bank_transfer",
    remindDaysBefore: "3",
  },
  attendance: {
    workingDays:          "mon,tue,wed,thu,fri",
    checkinOpens:         "07:30",
    lateAfter:            "09:30",
    absentAfter:          "11:00",
    earlyLeaveBefore:     "14:00",
    minAttendancePercent: "75",
  },
  cctv: {
    cameras:         "[]",
    retentionDays:   "30",
    motionDetection: "false",
    streamBaseUrl:   "",
  },
  branding: {
    logoUrl:      "",
    faviconUrl:   "",
    accentColor:  "#F4C400",
    reportHeader: "Yellow Dot Preschool",
    reportFooter: "Thank you for trusting us with your child's education.",
    motto:        "Where Little Minds Grow",
  },
  notifications: {
    attendanceEmail:     "true",
    attendanceWhatsapp:  "false",
    attendanceSms:       "false",
    feeReminderEmail:    "true",
    feeReminderWhatsapp: "true",
    feeReminderSms:      "false",
    invoiceEmail:        "true",
    invoiceWhatsapp:     "false",
    invoiceSms:          "false",
    pickupEmail:         "false",
    pickupWhatsapp:      "true",
    pickupSms:           "false",
    lowAttendanceEmail:    "true",
    lowAttendanceWhatsapp: "false",
    lowAttendanceSms:      "false",
  },
  parent: {
    showAttendance:     "true",
    showFees:           "true",
    showCctv:           "false",
    showFoodMenu:       "true",
    showNapLog:         "true",
    showSiblingInfo:    "false",
    allowCheckinSelfie: "true",
    showPickupHistory:  "true",
    parentNotifications:"true",
  },
};

/* ── Service methods ────────────────────────────────────────────── */
const settingsService = {

  /**
   * Load all settings from the backend.
   * Returns DEFAULT_SETTINGS (merged) on failure — page always renders.
   */
  async getAll() {
    try {
      const remote = await req("/api/settings");
      // Deep merge remote into defaults so missing keys still have values
      const merged = {};
      for (const section of Object.keys(DEFAULT_SETTINGS)) {
        merged[section] = { ...DEFAULT_SETTINGS[section], ...(remote[section] || {}) };
      }
      return merged;
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  },

  /**
   * Save one section of settings.
   * @param {string} section  e.g. "school", "fees"
   * @param {object} data     flat key-value object
   */
  save(section, data) {
    return req(`/api/settings/${encodeURIComponent(section)}`, {
      method: "PUT",
      body:   JSON.stringify({ data }),
    });
  },

  /* ── User Management ──────────────────────────────────────────── */

  getUsers() {
    return req("/api/settings/users");
  },

  inviteUser(userData) {
    return req("/api/settings/users", {
      method: "POST",
      body:   JSON.stringify(userData),
    });
  },

  updateUser(userId, updates) {
    return req(`/api/settings/users/${encodeURIComponent(userId)}`, {
      method: "PUT",
      body:   JSON.stringify(updates),
    });
  },

  deactivateUser(userId) {
    return req(`/api/settings/users/${encodeURIComponent(userId)}/deactivate`, {
      method: "POST",
    });
  },
};

export default settingsService;
