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

const userService = {
  /**
   * Fetch all users, optionally filtered.
   * @param {{ role?, status?, center?, search? }} params
   */
  getAll(params = {}) {
    return api.get(`${BASE}${qs(params)}`).then((r) => r.data);
  },

  /** Get a single user by ID. */
  getById(userId) {
    return api.get(`${BASE}/${encodeURIComponent(userId)}`).then((r) => r.data);
  },

  /**
   * Create a new staff user (written to Users sheet).
   * @param {{ name, email, mobile?, role, centers?, status? }} data
   */
  create(data) {
    return api.post(BASE, data).then((r) => r.data);
  },

  /**
   * Update any fields on an existing user.
   * @param {string} userId
   * @param {{ name?, email?, mobile?, role?, centers?, status? }} updates
   */
  update(userId, updates) {
    return api
      .put(`${BASE}/${encodeURIComponent(userId)}`, updates)
      .then((r) => r.data);
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
   * Backend sends a one-time link.
   */
  resetPassword(userId) {
    return api
      .post(`${BASE}/${encodeURIComponent(userId)}/reset-password`)
      .then((r) => r.data);
  },
};

export default userService;
