const mongoose = require('mongoose');

const raceOddsSchema = new mongoose.Schema({
  update: String,
  lastUpdate: Number,
  marketId: String,
  isMarketDataDelayed: Boolean,
  state: Object,
  runners: Array,
  isMarketDataVirtual: Boolean,
  createdAt: { type: Date, default: new Date().getTime() }
});
raceOddsSchema.index({ marketId: 1 });
const cloneRaceOdds = mongoose.model('cloneRaceOdds', raceOddsSchema);

module.exports = cloneRaceOdds;