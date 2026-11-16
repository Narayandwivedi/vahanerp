const { summarizer } = require("../utils/activity");
const { Expense, ExpenseType } = require("../models");
const { ownVehicle } = require("../utils/guards");
const { refreshVehicleKm } = require("../utils/stock");

const DEFAULT_CATEGORIES = [
  "Diesel", "Tyre", "Repair & Maintenance", "Spare Parts", "Oil & Lubricants", "Driver Salary", "Driver Bata",
  "Staff Salary", "Toll", "Tyre Puncture", "Loading / Unloading", "Insurance", "Road Tax", "Permit", "Fitness", "PUC", "GPS", "EMI",
  "Fine / Challan", "Parking", "Washing", "Office", "Other",
];

// Entered here: manual. Made elsewhere (stock issue, payroll, trip, diesel): changed only where they came from.
const crudOptions = {
  // Staff can add these; see utils/crud.js
  entity: "expense",
  summarize: summarizer("expense"),
  sort: { date: -1, createdAt: -1 },
  populate: "vehicleId",
  dateField: "date",
  filters: ["vehicleId", "category", "source"],
  searchFields: ["category", "paidTo", "notes"],
  prepare: async (req, data) => {
    await ownVehicle(req, data.vehicleId);
    data.source = "manual";
    data.inventoryTxnId = null;
    data.tripId = null;
    return data;
  },
  canChange: (doc) => ({
    inventory: "This expense came from issuing store stock. Change or delete it in Inventory.",
    payroll: "This expense is a salary / advance / bata payment. Change or delete it in Payroll.",
    trip: "This expense was added on a trip. Change or delete it in that trip.",
    diesel: "This expense is a diesel purchase. Change or delete it in Diesel.",
  })[doc.source] || "",
  afterSave: (req, doc) => refreshVehicleKm(req.userId, doc.vehicleId),
  afterDelete: (req, doc) => refreshVehicleKm(req.userId, doc.vehicleId),
};

// GET /expense-categories: my expense types first, then the usual ones and any typed before
const categories = async (req, res) => {
  const [types, used] = await Promise.all([
    ExpenseType.find({ userId: req.userId }).sort({ name: 1 }).select("name").lean(),
    Expense.distinct("category", { userId: req.userId }),
  ]);
  res.json([...new Set([...types.map((type) => type.name), ...DEFAULT_CATEGORIES, ...used])]);
};

module.exports = { crudOptions, categories };
