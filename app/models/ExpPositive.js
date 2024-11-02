const mongoose = require('mongoose');
// const Schema = mongoose.Schema;
const expPositiveSchema = new mongoose.Schema({
    userId: { type: Number, required:false, default: 0},
    userFrom: {type: String, default: ''},
    userRole: {type: String, default: ''},
    source: {type: String, default: ''},
    betSection: {type: String, default: ''},
    highestAmount: {type: String, default: ''},
    betId: {type: String, default: ''},
    roundId: {type: String, default: ''},//this can also be marketId
    expCaptured: {type: Number, default: 0},
    expReleased: {type: Number, default: 0},
    expAfterRelease: {type: Number, default: 0},
    AbAtRelease: {type: Number, default: 0},
    ABForWinAmount: {type: Number, default: 0},
    prevExposure: {type: Number, default: 0},
    maxWinningAmount: {type: Number, default: 0},
    finalShareAmountInLossPrev: {type: Number, default: 0},
    prevAdjustedExposure: {type: Number, default: 0},
    exposureAmount: {type: Number, default: 0}
  }, {
    timestamps: true
  });
  const ExpPositive = mongoose.model('expPositive', expPositiveSchema);
  module.exports = ExpPositive;