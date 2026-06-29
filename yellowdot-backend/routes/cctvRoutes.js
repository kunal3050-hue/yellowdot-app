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
  verifyCamera,
  liveToken,
  liveStop,
  streamAuthHook,
  parentLiveToken,
  parentCameras,
  getParentSettings,
  updateParentSettings,
  getAuditLogs,
} = require("../controllers/cctvController");

// Full camera configuration (add / edit / delete) — Super Admin tier only.
const CONFIGURE_ROLES = ["super_admin", "developer", "admin"];
// Classroom assignment + stream verification — Center Head tier and above.
const ASSIGN_ROLES    = ["super_admin", "developer", "admin", "center_admin", "center_owner"];

// ── Media-server auth hook — NOT staff-gated (MediaMTX calls it). ──
// Validates the stream token itself; must be registered before the
// router-level authenticate/staffOnly guard below.
router.post("/internal/cctv/auth", streamAuthHook);

// ── Parent Live View — authenticated but NOT staff (parents are not staff). ──
// Presence + school-hours + classroom scope enforced in the controller.
router.get ("/api/cctv/parent/cameras",    authenticate, parentCameras);
router.post("/api/cctv/parent/live-token", authenticate, parentLiveToken);

// All remaining CCTV routes require an authenticated staff account.
// Path-scoped to /api/cctv so this guard does not intercept other routers'
// paths (router mounted at the app root via app.use()). The parent live-token
// route above is registered before this guard and is unaffected.
router.use("/api/cctv", authenticate, staffOnly);

// Audit logs — super admin only.
router.get("/api/cctv/audit-logs", authorize("super_admin", "developer"), getAuditLogs);

// Parent CCTV settings — admin manages (read + write).
router.get("/api/cctv/parent/settings", getParentSettings);
router.put("/api/cctv/parent/settings", authorize(...MANAGE_ROLES), updateParentSettings);

// Read (CCTV_VIEW) — admin-scoped inside the controller.
router.get("/api/cctv/cameras",     getCameras);
router.get("/api/cctv/cameras/:id", getCamera);

// Live View (CCTV_VIEW + classroom scope enforced in controller via resolver).
router.post("/api/cctv/cameras/:id/live-token", liveToken);
router.post("/api/cctv/cameras/:id/live-stop",  liveStop);

// Configure (add / edit / delete) — Super Admin tier only.
router.post  ("/api/cctv/cameras",        authorize(...CONFIGURE_ROLES), addCamera);
router.put   ("/api/cctv/cameras/:id",    authorize(...CONFIGURE_ROLES), updateCamera);
router.delete("/api/cctv/cameras/:id",    authorize(...CONFIGURE_ROLES), deleteCamera);
// Assign + verify — Center Head tier and above.
router.post  ("/api/cctv/cameras/verify", authorize(...ASSIGN_ROLES), verifyCamera);
router.post  ("/api/cctv/cameras/test",   authorize(...ASSIGN_ROLES), testConnection);

module.exports = router;
