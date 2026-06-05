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
  getParentSettings,
  updateParentSettings,
} = require("../controllers/cctvController");

// Admin-tier roles that hold CCTV_MANAGE in Phase 1.
const MANAGE_ROLES = ["admin", "center_admin", "center_owner", "super_admin", "developer"];

// ── Media-server auth hook — NOT staff-gated (MediaMTX calls it). ──
// Validates the stream token itself; must be registered before the
// router-level authenticate/staffOnly guard below.
router.post("/internal/cctv/auth", streamAuthHook);

// ── Parent Live View — authenticated but NOT staff (parents are not staff). ──
// Presence + school-hours + classroom scope enforced in the controller.
router.post("/api/cctv/parent/live-token", authenticate, parentLiveToken);

// All remaining CCTV routes require an authenticated staff account.
// Path-scoped to /api/cctv so this guard does not intercept other routers'
// paths (router mounted at the app root via app.use()). The parent live-token
// route above is registered before this guard and is unaffected.
router.use("/api/cctv", authenticate, staffOnly);

// Parent CCTV settings — admin manages (read + write).
router.get("/api/cctv/parent/settings", getParentSettings);
router.put("/api/cctv/parent/settings", authorize(...MANAGE_ROLES), updateParentSettings);

// Read (CCTV_VIEW) — admin-scoped inside the controller.
router.get("/api/cctv/cameras",     getCameras);
router.get("/api/cctv/cameras/:id", getCamera);

// Live View (CCTV_VIEW + classroom scope enforced in controller via resolver).
router.post("/api/cctv/cameras/:id/live-token", liveToken);
router.post("/api/cctv/cameras/:id/live-stop",  liveStop);

// Manage (CCTV_MANAGE) — admin-tier only.
router.post  ("/api/cctv/cameras",        authorize(...MANAGE_ROLES), addCamera);
// Real camera verification (default Test Camera action): TCP + RTSP auth + channel + stream.
router.post  ("/api/cctv/cameras/verify", authorize(...MANAGE_ROLES), verifyCamera);
// TCP-only reachability (hidden developer diagnostic).
router.post  ("/api/cctv/cameras/test",   authorize(...MANAGE_ROLES), testConnection);
router.put   ("/api/cctv/cameras/:id",  authorize(...MANAGE_ROLES), updateCamera);
router.delete("/api/cctv/cameras/:id",  authorize(...MANAGE_ROLES), deleteCamera);

module.exports = router;
