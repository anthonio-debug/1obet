const mongoose = require('mongoose');

const raceOddsSchema = new mongoose.Schema({
  update: String,
  lastUpdate: Number,
  marketId: String,
  isMarketDataDelayed: Boolean,
  state: {
    betDelay: Number,
    startTime: String,
    remainingTime: String,
    bspReconciled: Boolean,
    complete: Boolean,
    inplay: Boolean,
    numberOfWinners: Number,
    numberOfRunners: Number,
    numberOfActiveRunners: Number,
    lastMatchTime: String,
    totalMatched: Number,
    totalAvailable: Number,
    crossMatching: Boolean,
    runnersVoidable: Boolean,
    status: String,
  },
  runners: [
    {
      selectionId: Number,
      handicap: Number,
      state: {
        adjustmentFactor: Number,
        sortPriority: Number,
        lastPriceTraded: Number,
        totalMatched: Number,
        status: String,
      },
      exchange: {
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
  isMarketDataVirtual: Boolean,
});

const RaceOdds = mongoose.model('RaceOdds', raceOddsSchema);

module.exports = RaceOdds;
