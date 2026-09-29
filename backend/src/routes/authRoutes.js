const { Router } = require("express");
const controller = require("../controllers/authController");
const { requireAuth } = require("../middlewares/authMiddleware");

const router = Router();
router.get("/setup-status", controller.setupStatus);
router.post("/setup", controller.setup);
router.post("/login", controller.login);
router.get("/me", requireAuth, controller.me);
router.post("/logout", requireAuth, controller.logout);
router.post("/change-password", requireAuth, controller.changePassword);

module.exports = router;
