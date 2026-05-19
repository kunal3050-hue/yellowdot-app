const express          = require("express");
const router           = express.Router();
const { authenticate } = require("../middleware/authMiddleware");
const {
  getCameras,
  addCamera,
  updateCamera,
  deleteCamera,
} = require("../controllers/cctvController");

router.use(authenticate);

// Primary routes (slash form — matches user spec and frontend service)
router.get   ("/api/cctv/cameras",      getCameras);
router.post  ("/api/cctv/cameras",      addCamera);
router.put   ("/api/cctv/cameras/:id",  updateCamera);
router.delete("/api/cctv/cameras/:id",  deleteCamera);

// Legacy dash-form aliases — keep working during transition
router.get   ("/api/cctv-cameras",      getCameras);
router.post  ("/api/cctv-cameras",      addCamera);
router.put   ("/api/cctv-cameras/:id",  updateCamera);
router.delete("/api/cctv-cameras/:id",  deleteCamera);

module.exports = router;
