const express          = require("express");
const router           = express.Router();
const { authenticate } = require("../middleware/authMiddleware");
const {
  getActiveNaps,
  getNapHistory,
  getTodayStats,
  startNap,
  wakeUp,
} = require("../controllers/napController");

router.use(authenticate);

router.get("/naps/active",      getActiveNaps);
router.get("/naps/history",     getNapHistory);
router.get("/naps/stats/today", getTodayStats);
router.post("/naps/start",      startNap);
router.post("/naps/wakeup",     wakeUp);

module.exports = router;
