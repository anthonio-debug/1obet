const mongoose = require('mongoose');

const asianOddSchema = new mongoose.Schema({
  roundId: { type: String },
  marketId: { type: String },
  marketName: { type: String },
  status: { type: String },
  numberOfRunners: { type: Number },
  numberOfActiveRunners: { type: Number },
  tableId: { type: String },
  runners: { type: Array },
  timestamp: { type:Number, default: new Date().getTime() / 1000}
});

const AsianOdd = mongoose.model('asianodd', asianOddSchema);
module.exports = AsianOdd;
