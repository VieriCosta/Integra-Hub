const { Router } = require("express");
const integrationController = require("../controllers/integrationController");
const integrationExecutionController = require("../controllers/integrationExecutionController");

const router = Router();

router.get("/", integrationController.listIntegrations);
router.post("/", integrationController.createIntegration);
router.get("/:id", integrationController.getIntegrationById);
router.put("/:id", integrationController.updateIntegration);
router.post("/:id/execute", integrationExecutionController.executeIntegration);
router.post('/:id/duplicate', integrationController.duplicateIntegration);
router.get("/:id/executions", integrationExecutionController.listExecutionsByIntegration);

module.exports = router;
