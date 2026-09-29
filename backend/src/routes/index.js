const { Router } = require("express");

const healthRoutes = require("./healthRoutes");
const integrationRoutes = require("./integrationRoutes");
const executionRoutes = require("./executionRoutes");
const dashboardRoutes = require("./dashboardRoutes");
const auditRoutes = require("./auditRoutes");
const authRoutes = require("./authRoutes");
const adminRoutes = require("./adminRoutes");
const { requireAuth } = require("../middlewares/authMiddleware");

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use(requireAuth);
router.use("/admin", adminRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/integrations", integrationRoutes);
router.use("/executions", executionRoutes);
router.use("/audit", auditRoutes);

module.exports = router;
