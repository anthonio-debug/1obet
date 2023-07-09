const mongoose = require('mongoose');

const runnerSchema = new mongoose.Schema({
  selectionId: { type: Number, required: false },
  runnerName: { type: String, required: false },
});

const marketSchema = new mongoose.Schema({
  Updatetime: { type: Date, default: null },
  marketId: { type: String, required: false },
  marketName: { type: String, required: false },
  totalMatched: { type: Number, required: false },
  status: { type: String, required: false },
  runners: [runnerSchema],
  eventId: { type: String },
  sportsId: { type: String },
  updatedCronTime:{ type: Date, default: '' },
  islocked: { type: Number, default: 0 }
});

const Market = mongoose.model('listMarket', marketSchema);

module.exports = Market;
