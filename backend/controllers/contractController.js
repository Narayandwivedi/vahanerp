const { Contract } = require("../models");
const { contractAmount, contractSegments, monthRange, dayNum, todayNum, toNumber, round2 } = require("../utils/common");
const { refuse, ownVehicle } = require("../utils/guards");

// Monthly hire: vehicles hired in / given out on monthly rent
const contractStatus = (contract) => {
  const today = todayNum();
  if (dayNum(contract.startDate) > today) return "upcoming";
  if (contract.endDate && dayNum(contract.endDate) < today) return "ended";
  return "running";
};

// GET /contracts: each contract with its status, this month's rent and the rent run up till today
const list = async (req, res) => {
  const query = { userId: req.userId };
  ["direction", "vehicleId", "partyId"].forEach((field) => {
    if (req.query[field]) query[field] = req.query[field];
  });
  const { from, to } = monthRange(req.query.month);
  const contracts = await Contract.find(query).sort({ startDate: -1 }).populate("vehicleId partyId").lean();
  res.json(contracts.map((contract) => ({
    ...contract,
    status: contractStatus(contract),
    monthAmount: contractAmount(contract, from, to),
    // Days off in the month and the rent they took out
    monthOffDays: contractSegments(contract, from, to).reduce((total, segment) => total + segment.offDays, 0),
    monthOffAmount: contractSegments(contract, from, to).reduce((total, segment) => total + segment.offAmount, 0),
    accruedTillToday: contractAmount(contract, null, new Date()),
    months: contractSegments(contract, null, new Date()),
  })));
};

const crudOptions = {
  populate: "vehicleId partyId",
  number: { field: "contractNo", key: "contract", prefix: "MH" },
  prepare: async (req, data) => {
    // The daily log is changed only through its own routes, so an edit of the hire never overwrites it
    delete data.dailyLog;
    const vehicle = await ownVehicle(req, data.vehicleId);
    if (!vehicle) throw refuse("Pick a vehicle");
    if (!data.partyId) throw refuse("Pick the party");
    if (data.endDate && data.startDate && new Date(data.endDate) < new Date(data.startDate)) {
      throw refuse("End date cannot be before the start date");
    }
    // A vehicle hired in comes from its owner
    if (data.direction === "hire_in" && vehicle.ownership === "own") {
      throw refuse("This is your own vehicle. Use 'Given Out' to rent it to a party.");
    }
    return data;
  },
};

// ---- Daily log: off days (taken out of the rent), odometer and fuel given ----

const sortLog = (contract) => contract.dailyLog.sort((a, b) => dayNum(a.date) - dayNum(b.date));

// Checks one day's entry against the hire and the other days; throws a message to show
const cleanLog = (contract, body, logId = "") => {
  if (!body.date) throw refuse("Pick the date");
  const day = dayNum(body.date);
  if (!Number.isFinite(day)) throw refuse("Pick the date");
  if (day < dayNum(contract.startDate)) throw refuse("This day is before the hire started");
  if (contract.endDate && day > dayNum(contract.endDate)) throw refuse("This day is after the hire ended");
  if (day > todayNum()) throw refuse("You can log only up to today");
  const others = contract.dailyLog.filter((log) => String(log._id) !== String(logId));
  if (others.some((log) => dayNum(log.date) === day)) throw refuse("This day is already in the log. Edit that entry instead.");

  const odometer = Math.max(0, toNumber(body.odometer));
  if (odometer > 0) {
    const before = others.filter((log) => log.odometer > 0 && dayNum(log.date) < day).sort((a, b) => dayNum(b.date) - dayNum(a.date))[0];
    const after = others.filter((log) => log.odometer > 0 && dayNum(log.date) > day).sort((a, b) => dayNum(a.date) - dayNum(b.date))[0];
    if (before && odometer < before.odometer) throw refuse(`Odometer cannot be less than ${before.odometer} (an earlier day)`);
    if (after && odometer > after.odometer) throw refuse(`Odometer cannot be more than ${after.odometer} (a later day)`);
  }
  return {
    date: new Date(body.date),
    status: body.status === "off" ? "off" : "running",
    odometer,
    fuelLitres: round2(Math.max(0, toNumber(body.fuelLitres))),
    fuelAmount: round2(Math.max(0, toNumber(body.fuelAmount))),
    notes: String(body.notes || "").trim(),
  };
};

const findContract = async (req) => {
  const contract = await Contract.findOne({ _id: req.params.id, userId: req.userId });
  if (!contract) throw Object.assign(new Error("Monthly hire not found"), { status: 404 });
  return contract;
};

// Wraps a handler so a refused entry comes back as its message
const handle = (fn) => async (req, res) => {
  try {
    const contract = await findContract(req);
    await fn(req, contract);
    sortLog(contract);
    await contract.save();
    res.json({ dailyLog: contract.dailyLog });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || "Could not save" });
  }
};

// POST /contracts/:id/logs
const addLog = handle(async (req, contract) => {
  contract.dailyLog.push(cleanLog(contract, req.body));
});

// PUT /contracts/:id/logs/:logId
const updateLog = handle(async (req, contract) => {
  const log = contract.dailyLog.id(req.params.logId);
  if (!log) throw Object.assign(new Error("Log entry not found"), { status: 404 });
  log.set(cleanLog(contract, req.body, req.params.logId));
});

// DELETE /contracts/:id/logs/:logId
const deleteLog = handle(async (req, contract) => {
  const log = contract.dailyLog.id(req.params.logId);
  if (!log) throw Object.assign(new Error("Log entry not found"), { status: 404 });
  log.deleteOne();
});

module.exports = { list, crudOptions, addLog, updateLog, deleteLog };
