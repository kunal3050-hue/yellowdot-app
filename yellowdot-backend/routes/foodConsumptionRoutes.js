const express          = require("express");
const { authenticate } = require("../middleware/authMiddleware");

const {
  getConsumption,
  saveConsumption,
  updateConsumption,
} = require("../controllers/foodConsumptionController");

const router = express.Router();
router.use(authenticate);

router.get ("/api/food-consumption", getConsumption);
router.post("/api/food-consumption", saveConsumption);
router.put ("/api/food-consumption", updateConsumption);

module.exports = router;
