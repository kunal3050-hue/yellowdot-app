const express          = require("express");
const { authenticate, staffOnly } = require("../middleware/authMiddleware");

const {
  getConsumption,
  saveConsumption,
  updateConsumption,
} = require("../controllers/foodConsumptionController");

const router = express.Router();
// Food consumption records are staff-only.
// Path-scoped so this guard only runs for /api/food-consumption (router is
// mounted at the app root; a path-less guard would 403 every request).
router.use("/api/food-consumption", authenticate, staffOnly);

router.get ("/api/food-consumption", getConsumption);
router.post("/api/food-consumption", saveConsumption);
router.put ("/api/food-consumption", updateConsumption);

module.exports = router;
