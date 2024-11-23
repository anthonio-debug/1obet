const mongoose = require('mongoose');

const oddsSchema = new mongoose.Schema({
  updatetime: String,
  update: String,
  sport: String,
  eventId: {type: String, index: true},
  marketId: {type: String, index: true},
  marketName: String,
  source: Number,
  isMarketDataDelayed: Boolean,
  status: String,
  isInplay: Boolean,
  inplay: Boolean,
  numberOfRunners: Number,
  numberOfActiveRunners: Number,
  totalMatched: Number,
  sportsId: { type: String },
  runners: { type: Array },
  createdAt: {type: Number }
  
});
oddsSchema.index({ eventId: 1, marketId: 1 });
oddsSchema.index({ eventId: 1 });
oddsSchema.index({ marketId: 1 });
oddsSchema.index({ sport: 1 });
oddsSchema.index({ createdAt: 1 });
oddsSchema.index({ status: 1 });
oddsSchema.index({ isInplay: 1 });
oddsSchema.index({ numberOfRunners: 1 });
oddsSchema.index({ numberOfActiveRunners: 1 });
oddsSchema.index({ marketName: 'text' });
oddsSchema.index({ runners: 1 }, { sparse: true });
oddsSchema.index({ totalMatched: 1 }, { sparse: true });
const Odds = mongoose.model('Odds', oddsSchema);
module.exports = Odds;
