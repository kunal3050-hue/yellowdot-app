/**
 * roleService.js — Roles & Permissions API client
 * ─────────────────────────────────────────────────
 * Wraps /api/roles/* endpoints.
 *
 * Role object shape:
 *   roleId        — Firestore doc ID
 *   name          — display name
 *   description   — purpose text
 *   color         — hex colour
 *   isSystem      — cannot be deleted
 *   isActive      — enabled/disabled
 *   homeRoute     — landing path after login
 *   permissions   — { moduleId: { action: bool } }
 *   centerAccess  — [] = all, [id] = restricted
 *   classAccess   — [] = all, [name] = restricted
 *   usersCount    — number
 *   createdAt, updatedAt
 */

import { api } from "./authService";

const BASE = "/api/roles";

const roleService = {
  /** List all roles for the current school. Auto-seeds on first call. */
  getAll() {
    return api.get(BASE).then(r => r.data);
  },

  /** Get a single role by ID. */
  getOne(roleId) {
    return api.get(`${BASE}/${encodeURIComponent(roleId)}`).then(r => r.data);
  },

  /**
   * Create a new custom role.
   * @param {{ name, description?, color?, permissions?, homeRoute? }} data
   */
  create(data) {
    return api.post(BASE, data).then(r => r.data);
  },

  /**
   * Clone a role — creates a new role with the same permissions.
   * @param {string} sourceRoleId  — role to copy from
   * @param {string} newName       — name for the new role
   */
  async clone(sourceRoleId, newName, color) {
    const { role: source } = await roleService.getOne(sourceRoleId);
    return roleService.create({
      name:        newName,
      description: `Cloned from ${source.name}`,
      color:       color || source.color,
      permissions: source.permissions || {},
      homeRoute:   source.homeRoute   || "/",
    });
  },

  /**
   * Update role metadata (name, description, color, isActive, homeRoute).
   * Does NOT update permissions — use updatePermissions() for that.
   */
  update(roleId, data) {
    return api.put(`${BASE}/${encodeURIComponent(roleId)}`, data).then(r => r.data);
  },

  /**
   * Replace the entire permission matrix for a role.
   * @param {string} roleId
   * @param {{ [moduleId]: { [action]: boolean } }} permissions
   */
  updatePermissions(roleId, permissions) {
    return api
      .put(`${BASE}/${encodeURIComponent(roleId)}/permissions`, { permissions })
      .then(r => r.data);
  },

  /** Delete a custom role (system roles will return 400). */
  remove(roleId) {
    return api.delete(`${BASE}/${encodeURIComponent(roleId)}`).then(r => r.data);
  },

  /** Fetch the permission audit log for a role. */
  getAuditLogs(roleId, limit = 50) {
    return api.get(`${BASE}/${encodeURIComponent(roleId)}/audit?limit=${limit}`).then(r => r.data);
  },

  /** Seed default system roles for this school. Idempotent. */
  seed() {
    return api.post(`${BASE}/seed`).then(r => r.data);
  },
};

export default roleService;
