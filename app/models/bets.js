const mongoose = require('mongoose');
const BetSizes = require('./betSizes');
let Global = require('../global/settings');
/**
 * [betSchema description]
 *  @status [ 1 active), 2 (settled), 3 (cancelled), 4 (voided)]
 */
const betSchema = new mongoose.Schema({
  marketId: { type: String, required: true },
  userId: { type: Number, required: true },
  betAmount: { type: Number, required: true },
  betRate: { type: Number, required: true }, // bet rate chosen by user
  returnAmount: { type: Number, required: true },
  createdAt: { type: Number },
  updatedAt: { type: Number },
  status: { type: Number, default: 1 },
  // team: { type: String },
  matchId: { type: String },
  winningAmount: { type: Number },
  loosingAmount: { type: Number },
  subMarketId: { type: String },

  event: { type: String, default: '' },
  runner: { type: String, default: '' },
  position: { type: Number, default: 0 },
  name: { type: String },
});

betSchema.pre('save', function (next) {
  var now = new Date().getTime() / 1000;
  if (!this.createdAt) {
    this.createdAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});

betSchema.plugin(Global.aggregatePaginate);
betSchema.plugin(Global.paginate);
const Bets = mongoose.model('bet', betSchema);
//   Bets.createIndexes();
module.exports = Bets;
