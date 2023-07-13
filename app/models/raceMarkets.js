const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  eventName: String,
  countryCode: String,
  timezone: String,
  venue: String,
  openDate: Date
});

const stateSchema = new mongoose.Schema({
  betDelay: Number,
  startTime: Date,
  remainingTime: String,
  bspReconciled: Boolean,
  complete: Boolean,
  inplay: Boolean,
  numberOfWinners: Number,
  numberOfRunners: Number,
  numberOfActiveRunners: Number,
  lastMatchTime: Date,
  totalMatched: Number,
  totalAvailable: Number,
  crossMatching: Boolean,
  runnersVoidable: Boolean,
  status: String
});

const descriptionSchema = new mongoose.Schema({
  persistenceEnabled: Boolean,
  bspMarket: Boolean,
  marketName: String,
  marketTime: Date,
  suspendTime: Date,
  turnInPlayEnabled: Boolean,
  marketType: String,
  raceNumber: String,
  raceType: String,
  bettingType: String
});

const runnerSchema = new mongoose.Schema({
  selectionId: Number,
  handicap: Number,
  description: {
    runnerName: String,
    metadata: {
      SIRE_NAME: String,
      CLOTH_NUMBER_ALPHA: String,
      OFFICIAL_RATING: String,
      COLOURS_DESCRIPTION: String,
      COLOURS_FILENAME: String,
      FORECASTPRICE_DENOMINATOR: String,
      DAMSIRE_NAME: String,
      WEIGHT_VALUE: String,
      SEX_TYPE: String,
      DAYS_SINCE_LAST_RUN: String,
      WEARING: String,
      OWNER_NAME: String,
      DAM_YEAR_BORN: String,
      SIRE_BRED: String,
      JOCKEY_NAME: String,
      DAM_BRED: String,
      ADJUSTED_RATING: String,
      runnerId: String,
      CLOTH_NUMBER: String,
      SIRE_YEAR_BORN: String,
      TRAINER_NAME: String,
      COLOUR_TYPE: String,
      AGE: String,
      DAMSIRE_BRED: String,
      JOCKEY_CLAIM: String,
      FORM: String,
      FORECASTPRICE_NUMERATOR: String,
      BRED: String,
      DAM_NAME: String,
      DAMSIRE_YEAR_BORN: String,
      STALL_DRAW: String,
      WEIGHT_UNITS: String
    }
  },
  state: {
    adjustmentFactor: Number,
    sortPriority: Number,
    lastPriceTraded: Number,
    totalMatched: Number,
    status: String
  }
});

const eventNodeSchema = new mongoose.Schema({
  eventId: Number,
  event: eventSchema,
  marketNodes: {
    marketId: String,
    isMarketDataDelayed: Boolean,
    state: stateSchema,
    description: descriptionSchema,
    rates: {
      marketBaseRate: Number,
      discountAllowed: Boolean
    },
    runners: [runnerSchema]
  }
});

const raceMarketsSchema = new mongoose.Schema({
  eventTypeId: Number,
  eventNodes: eventNodeSchema,
  isMarketDataVirtual: Boolean
});

const RaceMarkets = mongoose.model('raceMarkets', raceMarketsSchema);

module.exports = RaceMarkets;
