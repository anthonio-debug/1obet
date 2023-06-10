const mongoose = require('mongoose');

const betsTransactionSchema = new mongoose.Schema({
  clientPL: { type: Number },
  availableBalance: { type: Number },
  userId: { type: Number }
});

const BetsTransaction = mongoose.model('BetsTransaction', betsTransactionSchema);

module.exports = BetsTransaction;
