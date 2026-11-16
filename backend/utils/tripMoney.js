/**
 * "Hide trip rate & amount": a staff login with this switch enters trips (vehicle, party, route,
 * quantity, expenses) but never sees or sets the rate, the bill, what was received or the owner's pay.
 * The owner fills those in later.
 */

// Everything priced on a trip; staff with the switch neither send nor see these
const TRIP_MONEY_FIELDS = [
  "rate", "freightAmount", "amount", "receivedAmount", "receivedMode", "paymentType",
  "materialAmount", "materialCost", "materialCostPaid", "materialCostMode", "materialSupplierId",
  "hireRate", "hireAmount",
];
// What the trip form would hold for them on a new trip
const BLANK = { rate: 0, receivedAmount: 0, receivedMode: "cash", materialAmount: 0, materialCost: 0, materialCostPaid: 0, materialCostMode: "cash", materialSupplierId: null, hireRate: 0 };

const hidesTripMoney = (req) => Boolean(req?.staff?.hideTripMoney);

// The money a staff save may not change: kept from the saved trip, or blank on a new one
const keepTripMoney = (data, old) => {
  Object.keys(BLANK).forEach((field) => {
    data[field] = old ? old[field] ?? BLANK[field] : BLANK[field];
  });
  return data;
};

// A trip without its money, for staff with the switch
const redactTrip = (doc) => {
  if (!doc) return doc;
  const copy = { ...doc };
  TRIP_MONEY_FIELDS.forEach((field) => delete copy[field]);
  return copy;
};

// An Activity Center line of a trip without its amount or paid / due text
const PAID_PART = /^(Paid|Credit|₹.* due)$/;
const redactTripSummary = (summary) => (summary
  ? { ...summary, amount: 0, detail: String(summary.detail || "").split(" · ").filter((part) => !PAID_PART.test(part)).join(" · ") }
  : summary);

module.exports = { hidesTripMoney, keepTripMoney, redactTrip, redactTripSummary };
