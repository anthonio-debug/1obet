const mongoose = require('mongoose');

const runnerSchema = new mongoose.Schema({
  selectionId: { type: Number, required: true },
  runnerName: { type: String, required: true },
});

const marketSchema = new mongoose.Schema({
  Updatetime: { type: Date, default: null },
  marketId: { type: String, required: true },
  marketName: { type: String, required: true },
  totalMatched: { type: Number, required: true },
  status: { type: String, required: true },
  runners: [runnerSchema],
});

const Market = mongoose.model('listMarket', marketSchema);

module.exports = Market;
