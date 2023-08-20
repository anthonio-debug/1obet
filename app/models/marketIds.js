const mongoose = require('mongoose');

const MarketIDsSchema = new mongoose.Schema({
  eventId: { type: Number,index: true },
  marketId: { type: String,index: true },
  inPlay: { type: Boolean, default: false },
  lastCheck: { type: Number,default: 0 },
  sportID: { type: Number,default: 0 },
  index: { type: Number, default: 0 },
  createdAt: {type: Number },
});

const MarketIDS = mongoose.model('MarketIDS', MarketIDsSchema);
module.exports = MarketIDS;