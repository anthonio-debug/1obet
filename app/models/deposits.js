/* eslint no-unused-vars: "off" */
let mongoose = require('mongoose');
let Schema = mongoose.Schema;
mongoose.set('debug', false);
let Global = require('../global/settings');

let depositsSchema = new Schema({
  userId: { type: Number, index: true },
  description: { type: String, required: false },
  amount: { type: Number, required: true, default: 0 },
  balance: { type: Number, required: false, default: 0 },
  availableBalance: { type: Number , default: 0},
  maxWithdraw: { type: Number, default: 0 },
  createdBy: { type: String },
  updatedAt: { type: Number },
  createdAt: { type: Number },
  cashOrCredit: { type: String },
  cash: { type : Number, default: 0 },
  marketId : { type : String },
  commissionFrom: { type: Number },
  betId: { type: String },
  sportsId: { type: String },
});

depositsSchema.plugin(Global.aggregatePaginate);
depositsSchema.plugin(Global.paginate);

depositsSchema.pre('save', function (next) {
  var now = new Date().getTime();
  if (!this.createdAt) {
    this.createdAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});

const Deposits = mongoose.model('deposits', depositsSchema);
// Deposits.createIndexes();

module.exports = Deposits;
