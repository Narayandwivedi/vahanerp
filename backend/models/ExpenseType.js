const { Schema, owner, text, makeModel } = require("./schemaHelpers");

// What kind of spend a type is:
//   vehicle: running cost of a vehicle (repair, tyre…), picked on Add Expense with a vehicle
//   trip:    spent on the way (toll, loading…), picked in a trip's expenses (and on Add Expense)
//   office:  general / office spend with no vehicle, counted only in the business profit
const EXPENSE_KINDS = ["vehicle", "trip", "office"];

// The owner's own expense types, picked from a list when adding an expense or a trip
const expenseTypeSchema = new Schema(
  {
    ...owner,
    name: { type: String, trim: true, required: true },
    kind: { type: String, enum: EXPENSE_KINDS, default: "vehicle" },
    notes: text,
  },
  { timestamps: true }
);
expenseTypeSchema.index({ userId: 1, name: 1 });

const ExpenseType = makeModel("ExpenseType", expenseTypeSchema);
ExpenseType.EXPENSE_KINDS = EXPENSE_KINDS;

module.exports = ExpenseType;
