/* eslint no-unused-vars: "off" */
let mongoose = require('mongoose');
let Schema = mongoose.Schema;
mongoose.set('debug', true);
// let Global = require('../global/settings')

let betRatesSchema = new Schema({
  betRate: { type: Number },
  updatedAt: { type: Number },
  createdAt: { type: Number },
});

betRatesSchema.pre('save', function (next) {
  var now = new Date().getTime() / 1000;
  if (!this.createdAt) {
    this.createdAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});

const betRates = mongoose.model('betRates', betRatesSchema);

module.exports = betRates;
