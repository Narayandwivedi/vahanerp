const { Breakdown, Expense, Trip, Employee, Party } = require("../models");
const { round2, toNumber, idOf } = require("../utils/common");
const { refuse, ownVehicle } = require("../utils/guards");
const { refreshVehicleKm } = require("../utils/stock");

const HEAD_LABELS = { parts: "Parts", labour: "Labour", towing: "Towing", crane: "Crane", other: "Other" };
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// A breakdown's costs live as Expense records on its vehicle (one per cost head), so vehicle profit and reports count them
const syncBreakdownExpenses = async (userId, doc) => {
  await Expense.deleteMany({ userId, breakdownId: doc._id });
  const rows = (doc.costs || []).filter((row) => toNumber(row.amount) > 0);
  if (!rows.length) return;
  const party = doc.workshopPartyId ? await Party.findOne({ _id: doc.workshopPartyId, userId }).select("name").lean() : null;
  // Not fully paid to a workshop party: the rest is on credit in its ledger
  const mode = party && toNumber(doc.paidAmount) < toNumber(doc.totalCost) ? "credit" : doc.mode;
  await Expense.insertMany(rows.map((row, index) => ({
    userId,
    date: doc.resolvedDate || doc.date,
    vehicleId: doc.vehicleId,
    category: "Breakdown",
    amount: row.amount,
    // The meter reading goes on one row only
    odometer: index === 0 ? toNumber(doc.odometer) : 0,
    paidTo: party?.name || doc.repairedBy || "",
    mode,
    notes: [`${doc.breakdownNo} · ${HEAD_LABELS[row.head] || row.head}`, doc.reason, row.notes].filter(Boolean).join(" · "),
    source: "breakdown",
    breakdownId: doc._id,
  })));
};

const validDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const crudOptions = {
  sort: { date: -1, createdAt: -1 },
  populate: [
    { path: "vehicleId", select: "vehicleNo category meterUnit" },
    { path: "tripId", select: "tripNo date from to" },
    { path: "driverId", select: "name mobile" },
    { path: "workshopPartyId", select: "name" },
  ],
  dateField: "date",
  filters: ["vehicleId", "status", "category", "onTrip", "tripId", "workshopPartyId"],
  searchFields: ["breakdownNo", "reason", "location", "repairedBy", "notes"],
  number: { field: "breakdownNo", key: "breakdown", prefix: "BD" },
  prepare: async (req, data) => {
    if (!(await ownVehicle(req, data.vehicleId))) throw refuse("Pick a vehicle");
    data.date = validDate(data.date);
    if (!data.date) throw refuse("Enter the breakdown date");
    if (!String(data.reason || "").trim()) throw refuse("Enter the reason for the breakdown");
    data.time = TIME.test(String(data.time || "")) ? data.time : "";
    data.resolvedTime = TIME.test(String(data.resolvedTime || "")) ? data.resolvedTime : "";

    // On a trip: the trip picked must be of this vehicle; its driver is taken when none was picked
    data.onTrip = data.onTrip === true || data.onTrip === "true";
    if (!data.onTrip || !data.tripId) data.tripId = null;
    if (data.tripId) {
      const trip = await Trip.findOne({ _id: data.tripId, userId: req.userId }).select("vehicleId driverId").lean();
      if (!trip) throw refuse("Trip not found");
      if (idOf(trip.vehicleId) !== idOf(data.vehicleId)) throw refuse("That trip is of another vehicle");
      if (!data.driverId && trip.driverId) data.driverId = trip.driverId;
    }
    if (data.driverId && !(await Employee.exists({ _id: data.driverId, userId: req.userId }))) throw refuse("Driver not found");
    if (data.workshopPartyId && !(await Party.exists({ _id: data.workshopPartyId, userId: req.userId }))) throw refuse("Workshop party not found");
    if (!data.workshopPartyId) data.workshopPartyId = null;

    // Resolved needs the day it was back on the road, not before it broke down
    if (data.status === "resolved") {
      data.resolvedDate = validDate(data.resolvedDate);
      if (!data.resolvedDate) throw refuse("Enter the date it was repaired");
      if (data.resolvedDate < data.date) throw refuse("Repaired date cannot be before the breakdown date");
    } else {
      data.resolvedDate = null;
      data.resolvedTime = "";
    }

    data.costs = (Array.isArray(data.costs) ? data.costs : [])
      .map((row) => ({ head: HEAD_LABELS[row.head] ? row.head : "other", amount: round2(toNumber(row.amount)), notes: String(row.notes || "").trim() }))
      .filter((row) => row.amount > 0);
    data.totalCost = round2(data.costs.reduce((total, row) => total + row.amount, 0));
    // Without a workshop party there is no one to owe: all of it is paid
    data.paidAmount = data.workshopPartyId ? round2(Math.max(0, toNumber(data.paidAmount))) : data.totalCost;
    if (data.paidAmount > data.totalCost) throw refuse("Paid cannot be more than the total cost");
    if (!["cash", "bank", "upi"].includes(data.mode)) data.mode = "cash";
    return data;
  },
  afterSave: async (req, doc, old) => {
    await syncBreakdownExpenses(req.userId, doc);
    await refreshVehicleKm(req.userId, doc.vehicleId);
    if (old && idOf(old.vehicleId) !== idOf(doc.vehicleId)) await refreshVehicleKm(req.userId, old.vehicleId);
  },
  afterDelete: async (req, doc) => {
    await Expense.deleteMany({ userId: req.userId, breakdownId: doc._id });
    await refreshVehicleKm(req.userId, doc.vehicleId);
  },
};

module.exports = { crudOptions, syncBreakdownExpenses };
