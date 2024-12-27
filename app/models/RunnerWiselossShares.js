let mongoose = require('mongoose');
let Schema = mongoose.Schema;
mongoose.set('debug', false);
// let Global = require('../global/settings');

let RunnerWiselossSharesSchema = new Schema({
  userId: { type: Number, index: true },
  betId: { type: Number,index: true },
  dealerId: { type: Number,index: true },
  description: { type: String, required: false },
  amount: { type: Number, default: 0 },
  matchsId: { type: String },
  eventId: { type: String },
  event: { type: String },
  marketName: { type: String , default: '0'},
  sportsId: { type: String },
  marketId: { type: String },
  betSession: { type: Number, default: 0 },
  runnersPosition: { type: Array },
  processedTrades: { type: [String], default: [] },
  subMarketId: { type: String, default: '0' },
  betId: { type: String },
  share: { type: Number },
  updatedAt: { type: String },
  createdAt: { type: String }
});

const RunnerWiselossShares = mongoose.model('RunnerWiselossShares', RunnerWiselossSharesSchema);
module.exports = RunnerWiselossShares;
