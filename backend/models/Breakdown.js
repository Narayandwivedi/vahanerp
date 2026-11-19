const { Schema, ObjectId, owner, ref, money, text, makeModel } = require("./schemaHelpers");

// What broke down, kept as a fixed list so the history can be counted by cause
const BREAKDOWN_CATEGORIES = [
  "engine", "tyre", "brake", "clutch_gearbox", "electrical", "suspension", "cooling", "fuel_system", "hydraulic", "accident", "other",
];
// What a breakdown's money went on; each head is kept as an Expense on the vehicle
const BREAKDOWN_COST_HEADS = ["parts", "labour", "towing", "crane", "other"];

/**
 * A vehicle breaking down: when and where, why, whether it was on a trip, how long it stood,
 * and what the repair cost. Its costs also live as Expense records (source "breakdown"),
 * so vehicle profit and reports count them; a workshop picked as a party gets the bill in its ledger.
 */
const breakdownSchema = new Schema(
  {
    ...owner,
    breakdownNo: { type: String, trim: true, required: true },
    vehicleId: { type: ObjectId, ref: "Vehicle", required: true },
    date: { type: Date, required: true },
    // "HH:mm", optional; with the resolved time it gives the downtime in hours
    time: text,
    onTrip: { type: Boolean, default: false },
    tripId: ref("Trip"),
    driverId: ref("Employee"),
    location: text,
    odometer: money,
    category: { type: String, enum: BREAKDOWN_CATEGORIES, default: "other" },
    reason: { type: String, trim: true, required: true },
    // minor: fixed on the spot; major: towed / sent to a workshop
    severity: { type: String, enum: ["minor", "major"], default: "minor" },
    status: { type: String, enum: ["open", "under_repair", "resolved"], default: "open" },
    resolvedDate: { type: Date, default: null },
    resolvedTime: text,
    // Mechanic / workshop: a party (its bill goes in the party ledger) or just a name
    workshopPartyId: ref("Party"),
    repairedBy: text,
    costs: [
      {
        _id: false,
        head: { type: String, enum: BREAKDOWN_COST_HEADS, default: "parts" },
        amount: money,
        notes: text,
      },
    ],
    totalCost: money,
    // Paid on the spot; with a workshop party the rest stays owed in its ledger (without one, all of it is paid)
    paidAmount: money,
    mode: { type: String, enum: ["cash", "bank", "upi"], default: "cash" },
    notes: text,
  },
  { timestamps: true }
);
breakdownSchema.index({ userId: 1, date: -1 });
breakdownSchema.index({ userId: 1, vehicleId: 1, date: -1 });

const Breakdown = makeModel("Breakdown", breakdownSchema);
Breakdown.BREAKDOWN_CATEGORIES = BREAKDOWN_CATEGORIES;
Breakdown.BREAKDOWN_COST_HEADS = BREAKDOWN_COST_HEADS;

module.exports = Breakdown;
