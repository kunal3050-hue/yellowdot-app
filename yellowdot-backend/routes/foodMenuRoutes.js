const express          = require("express");
const router           = express.Router();
const { authenticate, staffOnly } = require("../middleware/authMiddleware");
const { saveMenu, getMenus, updateMenu, deleteMenu } = require("../controllers/foodMenuController");

// Food menu management is staff-only.
router.use(authenticate, staffOnly);

router.post  ("/api/food-menu",       saveMenu);
router.get   ("/api/food-menu",       getMenus);
router.put   ("/api/food-menu/:date", updateMenu);
router.delete("/api/food-menu/:date", deleteMenu);

module.exports = router;
