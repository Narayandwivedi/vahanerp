const express = require("express");
const { Contract } = require("../models");
const crudRouter = require("../utils/crud");
const { list, crudOptions, addLog, updateLog, deleteLog } = require("../controllers/contractController");

// Monthly hire: vehicles hired in / given out on monthly rent
const router = express.Router();

// The list comes with each contract's status and rent; the rest is plain CRUD
router.get("/", list);
// Day by day: off days, odometer and fuel
router.post("/:id/logs", addLog);
router.put("/:id/logs/:logId", updateLog);
router.delete("/:id/logs/:logId", deleteLog);
router.use("/", crudRouter(Contract, crudOptions));

module.exports = router;
