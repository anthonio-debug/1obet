const mongoose = require('mongoose');
// const Schema = mongoose.Schema;
const expPositiveSchema = new mongoose.Schema({
    userId: { type: Number, required:false, default: 0},
    userFrom: {type: String, default: ''},
    userRole: {type: String, default: ''},
    source: {type: String, default: ''},
    betId: {type: String, default: ''},
    roundId: {type: String, default: ''},
    exposureAmount: {type: Number}
  }, {
    timestamps: true
  });
  const ExpPositive = mongoose.model('expPositive', expPositiveSchema);
  module.exports = ExpPositive;