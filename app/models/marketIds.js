const mongoose = require('mongoose');

const MarketIDsSchema = new mongoose.Schema({
  eventId: { type: Number,index: true },
  marketId: { type: String,index: true },
  marketName:{ type: String},
  inPlay: { type: Boolean, default: false },
  lastCheck: { type: Number,default: 0 },
  sportID: { type: Number,default: 0 },
  index: { type: Number, default: 0 },
  status: {type: String}
});

const MarketIDS = mongoose.model('MarketIDS', MarketIDsSchema);
module.exports = MarketIDS;