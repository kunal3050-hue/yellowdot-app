const express          = require("express");
const router           = express.Router();
const { authenticate } = require("../middleware/authMiddleware");
const streamController = require("../controllers/streamController");

router.use(authenticate);

router.get( "/api/stream/status", streamController.getStatus);
router.post("/api/stream/start",  streamController.startStream);
router.post("/api/stream/stop",   streamController.stopStream);

module.exports = router;
