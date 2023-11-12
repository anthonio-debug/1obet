const mongoose = require("mongoose");

const AsianTableResultSchema = new mongoose.Schema({
  tableId: { type: String },
  resultId: { type: String },
  roundId: { type: String },
  result: { type: Array, default: [] },
});

const AsianTableResult = mongoose.model(
  "asiantableresult",
  AsianTableResultSchema
);
module.exports = AsianTableResult;
