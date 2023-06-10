/* eslint no-unused-vars: "off" */
let mongoose = require('mongoose');
let Schema = mongoose.Schema;
mongoose.set('debug', true);
let Global = require('../global/settings');

let depositsSchema = new Schema({
  userId: { type: Number, index: true },
  description: { type: String, required: false },
  amount: { type: Number, required: true, default: 0 },
  balance: { type: Number, required: false },
  availableBalance: { type: Number },
  maxWithdraw: { type: Number, default: 0 },
  createdBy: { type: String },
  updatedAt: { type: String },
  createdAt: { type: String },
  cashOrCredit: { type: String },
  cash: { type : Number }
});

depositsSchema.plugin(Global.aggregatePaginate);
depositsSchema.plugin(Global.paginate);

depositsSchema.pre('save', function (next) {
  var now = new Date();
  var year = now.getFullYear().toString(); // Extract last two digits of year
  var month = (now.getMonth() + 1).toString().padStart(2, '0'); // Convert month to two digits and pad with zero if necessary
  var day = now.getDate().toString().padStart(2, '0'); // Convert day to two digits and pad with zero if necessary
  var formattedDate = `${year}-${month}-${day}`;
  if (!this.createdAt) {
    this.createdAt = formattedDate;
  } else {
    this.updatedAt = formattedDate;
  }
  next();
});

const Deposits = mongoose.model('deposits', depositsSchema);
Deposits.createIndexes();

module.exports = Deposits;
