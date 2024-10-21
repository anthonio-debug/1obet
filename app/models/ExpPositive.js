const mongoose = require('mongoose');
// const Schema = mongoose.Schema;
const expPositiveSchema = new mongoose.Schema({
    userId: { type: Number, required:false},
    userFrom: {type: String},
    userRole: {type: String},
    source: {type: String, enum: ['bet place', 'settlement']},
    betId: {type: String},
    roundId: {type: String},
    exposureAmount: {type: Number}
  }, {
    timestamps: true
  });
  const ExpPositive = mongoose.model('expPositive', expPositiveSchema);
  module.exports = ExpPositive;