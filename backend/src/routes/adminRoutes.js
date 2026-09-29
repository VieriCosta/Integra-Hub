const { Router } = require("express");
const controller = require("../controllers/adminController");
const { requireAdmin } = require("../middlewares/authMiddleware");

const router = Router();
router.use(requireAdmin);
router.get("/users", controller.listUsers);
router.post("/users", controller.createUser);
router.patch("/users/:id", controller.updateUser);
router.post("/users/:id/reset-password", controller.resetPassword);

module.exports = router;
