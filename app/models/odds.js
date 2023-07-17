const mongoose = require('mongoose');

const oddsSchema = new mongoose.Schema({
  updatetime: String,
  update: String,
  sport: String,
  eventId: String,
  marketId: String,
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
  createdAt: {type: Number },
  //  [
  //   {
  //     selectionId: Number,
  //     runnerName: String,
  //     status: String,
  //     lastPriceTraded: Number,
  //     totalMatched: Number,
  //     ExchangePrices: {
  //       AvailableToBack: [
  //         {
  //           price: Number,
  //           size: Number,
  //         },
  //       ],
  //       AvailableToLay: [
  //         {
  //           price: Number,
  //           size: Number,
  //         },
  //       ],
  //     },
  //   },
  // ],
});

const Odds = mongoose.model('Odds', oddsSchema);
module.exports = Odds;
