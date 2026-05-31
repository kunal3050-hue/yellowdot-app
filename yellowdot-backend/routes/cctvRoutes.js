/**
 * cctvRoutes.js — CCTV V2 Phase 1 (camera management API)
 *
 * Management operations (create/update/delete/test) require an admin-tier
 * role — this is the CCTV_MANAGE capability. Read is staff-gated at the
 * router level and admin-scoped in the controller (CCTV_VIEW).
 *
 * No streaming routes — Phase 1 is metadata only.
 */

const express = require("express");
const router  = express.Router();
const { authenticate, authorize, staffOnly } = require("../middleware/authMiddleware");
const {
  getCameras,
  getCamera,
  addCamera,
  updateCamera,
  deleteCamera,
  testConnection,
} = require("../controllers/cctvController");

// Admin-tier roles that hold CCTV_MANAGE in Phase 1.
const MANAGE_ROLES = ["admin", "center_admin", "center_owner", "super_admin", "developer"];

// All CCTV routes require an authenticated staff account.
router.use(authenticate, staffOnly);

// Read (CCTV_VIEW) — admin-scoped inside the controller.
router.get("/api/cctv/cameras",     getCameras);
router.get("/api/cctv/cameras/:id", getCamera);

// Manage (CCTV_MANAGE) — admin-tier only.
router.post  ("/api/cctv/cameras",      authorize(...MANAGE_ROLES), addCamera);
router.post  ("/api/cctv/cameras/test", authorize(...MANAGE_ROLES), testConnection);
router.put   ("/api/cctv/cameras/:id",  authorize(...MANAGE_ROLES), updateCamera);
router.delete("/api/cctv/cameras/:id",  authorize(...MANAGE_ROLES), deleteCamera);

module.exports = router;
