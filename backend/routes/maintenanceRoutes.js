const express = require("express");
const { Maintenance } = require("../models");
const crudRouter = require("../utils/crud");
const { list, markDone, crudOptions } = require("../controllers/maintenanceController");
const { alertSwitch } = require("../utils/alertSwitch");

// Maintenance schedules
const router = express.Router();

router.get("/", list);
router.post("/:id/done", markDone);
router.post("/:id/alerts", alertSwitch(Maintenance));
router.use("/", crudRouter(Maintenance, crudOptions));

module.exports = router;
