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
  sportsId: { type: Number },
  runners: [
    {
      selectionId: Number,
      runnerName: String,
      status: String,
      lastPriceTraded: Number,
      totalMatched: Number,
      exchangePrices: {
        availableToBack: [
          {
            price: Number,
            size: Number,
          },
        ],
        availableToLay: [
          {
            price: Number,
            size: Number,
          },
        ],
      },
    },
  ],
});

const Odds = mongoose.model('Odds', oddsSchema);
