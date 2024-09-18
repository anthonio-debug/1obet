const mongoose = require('mongoose');

const MarketIDsSchema = new mongoose.Schema({
  eventId: { type: String,index: true },
  marketId: { type: String,index: true },
  marketName:{ type: String},
  marketType:{ type: String, require: false},
  hasbetfairFancy: { type: Boolean, default: false },
  inPlay: { type: Boolean, default: false },
  ReadyForOdds: { type: Boolean, default: true },
  lastCheck: { type: Number,default: 0 },
  sportID: { type: Number,default: 0 },
  index: { type: Number, default: 0 },
  status: {type: String},
  openDate: { type: Number, default: 0 },
  runners:  { type: mongoose.Schema.Types.Mixed },
  winnerInfo: { type: mongoose.Schema.Types.Mixed },
  lastResultCheckTime: { type: Number, default: 0 },
  readyForScore: { type: Boolean, default: false },
  manuelClose: { type: Boolean, default: false },
  winnerRunnerData: { type: String },
  totalMatched: { type: String, default: "0" },

});
MarketIDsSchema.index({ marketId: 1 });
MarketIDsSchema.index({ sportID: 1 });
MarketIDsSchema.index({ openDate: 1 });
MarketIDsSchema.index({ eventId: 1, marketName: 1 });
MarketIDsSchema.index({ status: 1 });

const MarketIDS = mongoose.model('MarketIDS', MarketIDsSchema);
module.exports = MarketIDS;