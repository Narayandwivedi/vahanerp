const { Schema, ObjectId, owner, text, makeModel } = require("./schemaHelpers");

/**
 * A vehicle on monthly rent.
 * hire_in: I take a vehicle from a party and pay them each month (payable).
 * give_out: I give a vehicle (my own, or one I hired in) to a party and charge them each month (receivable).
 */
/**
 * One day of a monthly hire: did the vehicle run or stay off, its odometer, and the fuel given that day.
 * An "off" day is taken out of the rent: rate × off days ÷ days in that month.
 */
const dailyLogSchema = new Schema(
  {
    date: { type: Date, required: true },
    status: { type: String, enum: ["running", "off"], default: "running" },
    // Odometer at the end of the day; 0 = not noted
    odometer: { type: Number, default: 0, min: 0 },
    fuelLitres: { type: Number, default: 0, min: 0 },
    fuelAmount: { type: Number, default: 0, min: 0 },
    notes: text,
  },
  { timestamps: false }
);

const contractSchema = new Schema(
  {
    ...owner,
    contractNo: { type: String, trim: true, required: true },
    direction: { type: String, enum: ["hire_in", "give_out"], required: true },
    vehicleId: { type: ObjectId, ref: "Vehicle", required: true },
    partyId: { type: ObjectId, ref: "Party", required: true },
    monthlyRate: { type: Number, required: true, min: 0 },
    startDate: { type: Date, required: true },
    // Empty: runs until stopped
    endDate: { type: Date, default: null },
    // Diesel and driver: who bears them is noted for the record
    dieselBy: { type: String, enum: ["owner", "hirer"], default: "hirer" },
    driverBy: { type: String, enum: ["owner", "hirer"], default: "owner" },
    notes: text,
    // Day by day: off days (rent taken out), odometer and fuel. Changed only through /contracts/:id/logs
    dailyLog: { type: [dailyLogSchema], default: [] },
  },
  { timestamps: true }
);

const Contract = makeModel("Contract", contractSchema);

module.exports = Contract;
