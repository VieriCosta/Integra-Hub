const { Router } = require("express");
const integrationExecutionController = require("../controllers/integrationExecutionController");

const router = Router();

router.get("/", integrationExecutionController.listExecutions);
router.get("/:id", integrationExecutionController.getExecutionById);

module.exports = router;
