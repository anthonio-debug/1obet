/* eslint no-unused-vars: "off" */
let mongoose = require('mongoose');
let Schema = mongoose.Schema;
mongoose.set('debug', false);
// let Global = require('../global/settings')

let userStakesSchema = new Schema({
  userId:      { type: String, required: true },
  updaetedByUserId: { type: Number, required: true },
  isLocked: { type: Boolean, default: false },
  stake1: { type: Number, default: 0 },
  stake2: { type: Number, default: 0 },
  stake3: { type: Number, default: 0 },
  stake4: { type: Number, default: 0 },
  stake5: { type: Number, default: 0 },
  stake6: { type: Number, default: 0 },
  plus1: { type: Number, default: 0 },
  plus2: { type: Number, default: 0 },
  plu3: { type: Number, default: 0 },
  
  dateUpdated: { type: Number }
});

userStakesSchema.pre('save', function (next) {
  var now = new Date().getTime();
  if (!this.dateUpdated) {
    this.dateUpdated = now;
  } else {
    this.dateUpdated = now;
  }
  next();
});

const userStakes = mongoose.model('userStakes', userStakesSchema);

module.exports = userStakes;
