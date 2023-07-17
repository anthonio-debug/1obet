const mongoose = require('mongoose');

const raceOddsSchema = new mongoose.Schema({
  update: String,
  lastUpdate: Number,
  marketId: String,
  isMarketDataDelayed: Boolean,
  state: Object,
  runners: Array,
  isMarketDataVirtual: Boolean,
});

const RaceOdds = mongoose.model('RaceOdds', raceOddsSchema);

module.exports = RaceOdds;