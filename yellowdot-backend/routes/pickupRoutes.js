const express          = require("express");
const router           = express.Router();
const { authenticate, blockUnknown, staffOnly } = require("../middleware/authMiddleware");

const {
  getPickupPersons,
  getAuditLog,
  createPickupPerson,
  updatePickupPerson,
  deletePickupPerson,
} = require("../controllers/pickupAuthorizationController");

const {
  migrateStudent,
  migrateBulk,
  getMigrationStatus,
} = require("../controllers/pickupMigrationController");

const {
  getPickupHistory,
  getPickupHistoryEntry,
  createPickupHistory,
} = require("../controllers/pickupHistoryController");

// All pickup routes require a registered account (no "unknown" role).
// Path-scoped to this router's own prefixes so the guard does not run for
// other routers' paths (router is mounted at app root via app.use()).
router.use(["/api/pickup-authorization", "/api/pickup-history"], authenticate, blockUnknown);

// ── Pickup Authorization ──────────────────────────────────────────
// GET:  parents see their own child's list (scoped in controller)
// POST/PUT/DELETE: staff only — parents manage pickup persons through the parent app UI
//   but mutations (adding/removing) are center-admin / teacher ops
router.get   ("/api/pickup-authorization",       getPickupPersons);
router.get   ("/api/pickup-authorization/audit", staffOnly, getAuditLog);
router.post  ("/api/pickup-authorization",       staffOnly, createPickupPerson);
router.put   ("/api/pickup-authorization/:id",   staffOnly, updatePickupPerson);
router.delete("/api/pickup-authorization/:id",   staffOnly, deletePickupPerson);

// ── Pickup Authorization Migration ────────────────────────────────
// Staff-only: auto-create Father/Mother pickup persons for existing students.
// These routes are intentionally placed BEFORE the generic :id routes above.
router.post("/api/pickup-authorization/migrate-student", staffOnly, migrateStudent);
router.post("/api/pickup-authorization/migrate-bulk",    staffOnly, migrateBulk);
router.get ("/api/pickup-authorization/migration-status",staffOnly, getMigrationStatus);

// ── Pickup History ────────────────────────────────────────────────
// GET:  parents see their own child's history (scoped in controller)
// POST: staff only — recorded by gate staff, not parents
router.get ("/api/pickup-history",      getPickupHistory);
router.get ("/api/pickup-history/:id",  getPickupHistoryEntry);
router.post("/api/pickup-history",      staffOnly, createPickupHistory);

module.exports = router;
