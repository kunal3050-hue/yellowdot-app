const express          = require("express");
const router           = express.Router();
const { authenticate, blockUnknown, staffOnly } = require("../middleware/authMiddleware");

const {
  getPickupPersons,
  createPickupPerson,
  updatePickupPerson,
  deletePickupPerson,
} = require("../controllers/pickupAuthorizationController");

const {
  getPickupHistory,
  getPickupHistoryEntry,
  createPickupHistory,
} = require("../controllers/pickupHistoryController");

// All pickup routes require a registered account (no "unknown" role).
router.use(authenticate, blockUnknown);

// ── Pickup Authorization ──────────────────────────────────────────
// GET:  parents see their own child's list (scoped in controller)
// POST/PUT/DELETE: staff only — parents manage pickup persons through the parent app UI
//   but mutations (adding/removing) are center-admin / teacher ops
router.get   ("/api/pickup-authorization",      getPickupPersons);
router.post  ("/api/pickup-authorization",      staffOnly, createPickupPerson);
router.put   ("/api/pickup-authorization/:id",  staffOnly, updatePickupPerson);
router.delete("/api/pickup-authorization/:id",  staffOnly, deletePickupPerson);

// ── Pickup History ────────────────────────────────────────────────
// GET:  parents see their own child's history (scoped in controller)
// POST: staff only — recorded by gate staff, not parents
router.get ("/api/pickup-history",      getPickupHistory);
router.get ("/api/pickup-history/:id",  getPickupHistoryEntry);
router.post("/api/pickup-history",      staffOnly, createPickupHistory);

module.exports = router;
