const mongoose = require("mongoose");

const AsianTableOddSchema = new mongoose.Schema({
  tableId: { type: String },
  t1: { type: Array, default: [] },
  t2: { type: Array, default: [] },
});

const AsianTableOdd = mongoose.model("asiantableodd", AsianTableOddSchema);
module.exports = AsianTableOdd;
