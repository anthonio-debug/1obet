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
    expCaptured: {type: String, default: ''},
    expReleased: {type: String, default: ''},
    expAfterRelease: {type: String, default: ''},
    AbAtRelease: {type: String, default: ''},
    ABForWinAmount: {type: String, default: ''},
    prevExposure: {type: String, default: ''},
    maxWinningAmount: {type: String, default: ''},
    finalShareAmountInLossPrev: {type: String, default: ''},
    prevAdjustedExposure: {type: String, default: ''},
    exposureAmount: {type: Number}
  }, {
    timestamps: true
  });
  const ExpPositive = mongoose.model('expPositive', expPositiveSchema);
  module.exports = ExpPositive;