const mongoose = require('mongoose');

const raceOddsLithylapiSchema = new mongoose.Schema({
  update: String,
  lastUpdate: Number,
  marketId: String,
  isMarketDataDelayed: Boolean,
  state: Object,
  runners: Array,
  isMarketDataVirtual: Boolean,
  createdAt: { type: Date, default: new Date().getTime() }
});

const raceOddsLithylapi = mongoose.model('raceOddsLithylapi', raceOddsLithylapiSchema);

module.exports = raceOddsLithylapi;