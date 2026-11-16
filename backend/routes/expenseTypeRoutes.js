const express = require("express");
const { ExpenseType } = require("../models");
const crudRouter = require("../utils/crud");
const { crudOptions } = require("../controllers/expenseTypeController");

// Expense types: vehicle, trip or office spends
const router = express.Router();

router.use("/", crudRouter(ExpenseType, crudOptions));

module.exports = router;
