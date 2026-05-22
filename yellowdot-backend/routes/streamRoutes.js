const express          = require("express");
const router           = express.Router();
const { authenticate, staffOnly } = require("../middleware/authMiddleware");
const streamController = require("../controllers/streamController");

// CCTV stream control is staff-only.
router.use(authenticate, staffOnly);

router.get( "/api/stream/status", streamController.getStatus);
router.post("/api/stream/start",  streamController.startStream);
router.post("/api/stream/stop",   streamController.stopStream);

module.exports = router;
