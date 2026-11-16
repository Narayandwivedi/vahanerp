const { ExpenseType } = require("../models");
const { refuse } = require("../utils/guards");

// The owner's expense types, each a vehicle, trip or office spend
const crudOptions = {
  sort: { kind: 1, name: 1 },
  filters: ["kind"],
  searchFields: ["name"],
  prepare: async (req, data, old) => {
    data.name = String(data.name || "").trim();
    if (!data.name) throw refuse("Enter the expense type name");
    if (!ExpenseType.EXPENSE_KINDS.includes(data.kind)) data.kind = "vehicle";
    // Same name in any capitals counts as the same type
    const clash = await ExpenseType.findOne({ userId: req.userId, name: data.name, ...(old ? { _id: { $ne: old._id } } : {}) })
      .collation({ locale: "en", strength: 2 })
      .lean();
    if (clash) throw refuse("This expense type is already added");
    return data;
  },
};

module.exports = { crudOptions };
