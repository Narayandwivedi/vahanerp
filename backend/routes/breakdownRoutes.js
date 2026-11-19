const express = require("express");
const { Breakdown } = require("../models");
const crudRouter = require("../utils/crud");
const { crudOptions } = require("../controllers/breakdownController");

// Breakdowns: the breakdown ledger and each vehicle's breakdown history
const router = express.Router();

router.use("/", crudRouter(Breakdown, crudOptions));

module.exports = router;
