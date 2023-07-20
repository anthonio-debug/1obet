let mongoose = require('mongoose');
let Schema = mongoose.Schema;
mongoose.set('debug', true);
// let Global = require('../global/settings');

let currentPositionSchema = new Schema({
  userId: { type: Number, index: true },
  description: { type: String, required: false },
  amount: { type: Number, default: 0 },
  updatedAt: { type: String },
  createdAt: { type: String },
  matchId: { type: String },
  betId: { type: String }
});


const currentPosition = mongoose.model('currentPosition', currentPositionSchema);
module.exports = currentPosition;
