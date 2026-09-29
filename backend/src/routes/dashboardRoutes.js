const { Router } = require("express");
const dashboardController = require("../controllers/dashboardController");

const router = Router();

router.get("/", dashboardController.getDashboard);

module.exports = router;
