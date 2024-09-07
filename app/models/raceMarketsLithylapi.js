const mongoose = require('mongoose');

const eventNodeSchema = new mongoose.Schema({
  eventId: { type: Number },
  event: { type: Object },
  marketNodes: { type: Object }
});

const raceMarketsLithylapiSchema = new mongoose.Schema({
  eventTypeId: { type : Number },
  eventId: { type : String },
  marketId: { type : String },
  status: { type : String },
  eventNodes: [eventNodeSchema],
  isMarketDataVirtual: { type: Boolean },
  islocked: { type: Boolean , default: false }
});

const raceMarketsLithylapi = mongoose.model('raceMarketsLithylapi', raceMarketsLithylapiSchema);

module.exports = raceMarketsLithylapi;