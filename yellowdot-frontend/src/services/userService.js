/**
 * userService.js — Yellow Dot Users sheet API client
 * ────────────────────────────────────────────────────
 * Wraps /api/users/* endpoints backed by the Google Sheets "Users" tab.
 *
 * User object shape (mirrors sheet columns):
 *   userId       — row key (email or generated UUID)
 *   name         — display name
 *   email        — login email
 *   mobile       — phone number (optional)
 *   role         — one of ROLE_HIERARCHY values
 *   centers      — comma-separated list of center IDs
 *   activeCenter — currently selected center
 *   status       — "active" | "inactive"
 *   photoUrl     — avatar image URL (optional)
 *   authMethod   — "google" | "email" | "otp"
 *   createdAt    — ISO date string
 *   lastLoginAt  — ISO date string (optional)
 */

import { api } from "./authService";

const BASE = "/api/users";

function qs(params = {}) {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== "" && v != null)
  );
  const q = new URLSearchParams(filtered).toString();
  return q ? `?${q}` : "";
}

/**
 * Extract a human-readable message from an axios error.
 * Tries: response body .error → .message → .details → axios default message
 */
function extractError(err, fallback = "Request failed") {
  const d = err.response?.data;
  if (d) {
    const msg = d.error || d.message || d.details;
    if (msg && typeof msg === "string") return msg;
  }
  return err.message || fallback;
}

const userService = {
  /**
   * Fetch all users, optionally filtered.
   * @param {{ role?, status?, center?, search? }} params
   */
  getAll(params = {}) {
    return api.get(`${BASE}${qs(params)}`)
      .then((r) => r.data)
      .catch((err) => { throw new Error(extractError(err, "Failed to load users")); });
  },

  /** Get a single user by ID. */
  getById(userId) {
    return api.get(`${BASE}/${encodeURIComponent(userId)}`)
      .then((r) => r.data)
      .catch((err) => { throw new Error(extractError(err, "Failed to load user")); });
  },

  /**
   * Create a new staff user.
   * Backend creates the Firebase Auth account and Firestore document.
   * @param {{ name, email, mobile?, role, centers?, status? }} data
   */
  create(data) {
    return api.post(BASE, data)
      .then((r) => r.data?.user ?? r.data)
      .catch((err) => { throw new Error(extractError(err, "Failed to create user")); });
  },

  /**
   * Update any fields on an existing user.
   * @param {string} userId
   * @param {{ name?, mobile?, role?, centers?, status? }} updates
   */
  update(userId, updates) {
    return api
      .put(`${BASE}/${encodeURIComponent(userId)}`, updates)
      .then((r) => r.data?.user ?? r.data)
      .catch((err) => { throw new Error(extractError(err, "Failed to update user")); });
  },

  /**
   * Toggle a user's status between "active" and "inactive".
   * Convenience wrapper around update().
   */
  setStatus(userId, status) {
    return userService.update(userId, { status });
  },

  /**
   * Trigger a password-reset email for the user.
   * Backend generates a Firebase password-reset link.
   */
  resetPassword(userId) {
    return api
      .post(`${BASE}/${encodeURIComponent(userId)}/reset-password`)
      .then((r) => r.data)
      .catch((err) => { throw new Error(extractError(err, "Failed to send password reset")); });
  },
};

export default userService;
