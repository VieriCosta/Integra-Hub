const { Router } = require("express");
const auditController = require("../controllers/auditController");

const router = Router();
router.get("/", auditController.listAuditEvents);

module.exports = router;
