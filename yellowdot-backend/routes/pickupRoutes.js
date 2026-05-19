const express          = require("express");
const router           = express.Router();
const { authenticate } = require("../middleware/authMiddleware");

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

router.use(authenticate);

// ── Pickup Authorization ──────────────────────────────────────────
router.get   ("/api/pickup-authorization",      getPickupPersons);
router.post  ("/api/pickup-authorization",      createPickupPerson);
router.put   ("/api/pickup-authorization/:id",  updatePickupPerson);
router.delete("/api/pickup-authorization/:id",  deletePickupPerson);

// ── Pickup History ────────────────────────────────────────────────
router.get ("/api/pickup-history",      getPickupHistory);
router.get ("/api/pickup-history/:id",  getPickupHistoryEntry);
router.post("/api/pickup-history",      createPickupHistory);

module.exports = router;
