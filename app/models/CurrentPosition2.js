let mongoose = require('mongoose');
let Schema = mongoose.Schema;
mongoose.set('debug', false);
// let Global = require('../global/settings');

let currentPositionSchema = new Schema({
  userId: { type: Number, index: true },
  bettorId: { type: Number, index: true },
  description: { type: String, required: false },
  amount: { type: Number, default: 0 },
  matchsId: { type: String },
  event: { type: String },
  sportsId: { type: String },
  marketId: { type: String },
  betSession: { type: Number, default: 0 },
  runnersPosition: { type: Array },
  
  subMarketId: { type: String, default: '0' },
  betId: { type: String },
  share: { type: Number },
  updatedAt: { type: String },
  createdAt: { type: String }
});

const CurrentPosition2 = mongoose.model('currentPosition2', currentPositionSchema);
module.exports = CurrentPosition2;
